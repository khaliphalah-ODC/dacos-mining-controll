> Subsequent authorization: Milestones 6–9 are now implemented; see
> [MILESTONES_6_TO_9.md](MILESTONES_6_TO_9.md). This file retains the Milestone 5
> API/manual-test specification and historical gate report.

# Milestone 5: incident database, APIs and lifecycle

This milestone extends the existing OperationalIncident, OperationalIncidentEvent,
JWT/session middleware, CSRF protection, telemetry ingestion and audit repository.
It does not implement Milestone 6 UI/realtime work or deploy anything externally.
No emergency notification or responder-dispatch integration is present.

## Canonical incident fields

- `lifecycleStatus`: OPEN, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED.
- `severityLevel`: LOW, MEDIUM, HIGH, CRITICAL.
- `kind`: ALERT (manual report), SIMULATED_SOS, HARDWARE_RULE.
- `simulation`: explicit provenance, unchanged throughout the lifecycle.
- `ownerId`: active user assigned as responder.
- `createdAt`, `updatedAt`, `resolvedAt`, `closedAt`: server-side timestamps.
- `version`: increases on each activity, optionally submitted to detect stale clients.

Legacy `status` and `severity` fields remain for existing consumers. Status is a
lowercase alias; severity maps CRITICAL to critical and other levels to warning.
Use the canonical fields for full fidelity. The existing two-level simulator and
shared snapshot alert contract retain their legacy severity representation.
The old incident screen is not yet a complete interface for this stricter API;
Milestone 6 will add canonical states, controls and dedicated realtime updates.

## Transitions and permissions

| Action | Required state | Result | Permission |
| --- | --- | --- | --- |
| acknowledge | OPEN | ACKNOWLEDGED | ADMIN, SUPERVISOR, OPERATOR |
| assign | ACKNOWLEDGED or ASSIGNED | ASSIGNED | ADMIN/SUPERVISOR; active user as owner |
| start | ASSIGNED | IN_PROGRESS | Assigned responder or ADMIN/SUPERVISOR |
| resolve | IN_PROGRESS | RESOLVED | Assigned responder or ADMIN/SUPERVISOR |
| close | RESOLVED | CLOSED | ADMIN/SUPERVISOR |
| note | Any non-CLOSED state | Same state | Any authenticated active user |
| escalate | Any non-RESOLVED/non-CLOSED state below CRITICAL | Next severity, same state | ADMIN/SUPERVISOR |

Every mutation requires a nonblank note, maximum 2000 characters. Assignment
requires ownerId; other actions reject ownerId. Operators cannot assign, close
or escalate. A worker profile is distinct from a login account: owners are
active user accounts, including operators. Reassigning already assigned work
is allowed before it starts, with a new note. In-progress work cannot be silently
reassigned. Closed records are immutable. Resolved records can receive notes,
then supervisor closure; there is no reopen or deletion endpoint.

Creation remains ADMIN/SUPERVISOR-only. Unknown worker references are rejected.
Transactions use serializable isolation so an incident update, activity record
and audit entry commit together. Concurrent duplicate transitions result in one
success and a conflict. A supplied version must match the current record.
HTTP 400 means invalid input, 401 signed out, 403 insufficient permission or
CSRF failure, 404 unknown incident, 409 invalid transition/stale/conflicting update.
After 409, reload detail before deciding whether to submit another action.

## APIs

All routes require the existing human authentication and mutation CSRF protections.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/operations/incidents` | Filtered, paginated list |
| GET | `/api/operations/incidents/:id` | Incident and recorded activity |
| POST | `/api/operations/incidents` | Create manual incident |
| POST | `/api/operations/incidents/:id/events` | Validated lifecycle action |
| GET | `/api/operations/escalation-rules` | List rules; ADMIN/SUPERVISOR |
| POST | `/api/operations/escalation-rules` | Create rule; ADMIN |
| PATCH | `/api/operations/escalation-rules/:id` | Toggle enabled; ADMIN |
| POST | `/api/operations/incidents-escalate-due` | Explicit demonstration evaluation; ADMIN/SUPERVISOR |

List parameters: limit (1–100, default 25), cursor, q (message/incident ID/worker ID),
status, severity, workerId, ownerId, kind, simulation (`true`/`false`), from and to
(UTC ISO datetimes, inclusive created-at bounds). status/severity filters use the
uppercase canonical values. Results return data and nextCursor. Incident detail
includes activity with actor, action, note, timestamp, fromStatus, toStatus,
ownerId and optional escalationRuleId. Old activity remains readable even when
its historical transition fields were never recorded.

## Simulated SOS and duplicate protection

The existing device-specific bearer authorization, rate checks, sequence checks
and transactional packet history remain in place. A valid simulated SOS creates
one labelled IncidentEvent plus an OperationalIncident and creation activity/audit.
Hardware credentials still cannot submit simulated SOS actions.

Device packets may now supply `eventId`, a UUID identifying one SOS action. The
shared browser sender generates it when submitting SOS. Retries of that same
action must retain eventId, measurement timestamp and sequence when retransmitting
an unacknowledged packet. Gateways must not generate a new eventId for a retry.
Newer packet sequences repeating an already handled eventId also cannot create
another incident, even after the original incident has been closed.

Repeated SOS while a device already has an open SOS is combined into that incident.
SimulatedSosAction stores each supplied action ID, including combined actions, so
retrying one after closure does not create a duplicate. Unique constraints provide
a database safeguard. Accepted telemetry packets remain individually persisted.
For legacy packets lacking eventId, deduplication applies while the device has
an active SOS; after resolution, a later nonce-less SOS is treated as a new action.
Use eventId for durable action-level idempotency across resolution and restarts.

A disconnection or revocation does not resolve an incident. Explicit resolution
removes its active SOS alert while preserving its incident detail and original
SOS history. Closing does not delete anything. No endpoint sends messages to
responders or external emergency systems.

## Demonstration escalation rules

A rule specifies name, afterMinutes (1–10080), targetSeverity and enabled (defaults
false). Its definition is immutable; create a replacement and disable an old rule
when changing the demonstration policy. Only ADMIN can create/enable rules.

POST an empty object to incidents-escalate-due to evaluate up to 100 eligible
incidents in one serializable transaction. This is deliberately explicit: there
is no background timer, external notification provider or deployment scheduler.
Only simulation=true, noncompleted incidents are eligible. The highest matching
severity is applied, never a downgrade; status/ownership stay unchanged. Activity
and audit entries identify the applied rule. Repeated evaluation does not append
another entry once that severity has been reached. Larger sets can be processed
through repeated explicit calls. These are demonstration rules, not approved
mine safety thresholds or emergency-response instructions.

## Additive migrations and history

- `202611160006_incident_lifecycle`: canonical enums/fields, activity metadata,
  escalation rules, incident search index and active-incident deduplication.
- `202611160007_sos_action_receipts`: persistent action receipts linked to incidents.

Existing operational incidents keep their IDs, original fields and activities.
Canonical fields are backfilled from known legacy state. Recorded resolution
activity supplies resolvedAt; absent evidence leaves the time unknown. Missing
historical simulated SOS workflow records are imported from IncidentEvent without
deleting the source records. Those imports start OPEN with an explicit imported
activity because their old lifecycle was not tracked; supervisors must review them.
Historical duplicate SOS records are preserved rather than silently deleted or
marked resolved. One active deduplication key is assigned per existing device.

Only local isolated test databases were used for verification. Nothing connects
to Neon or modifies an external database. The normal dev bootstrap applies local
migrations; for any external database, inspect/review migrations and obtain the
requested deployment approval first.

## Manual API test

After applying the migrations locally and signing in as ADMIN/SUPERVISOR, open
your browser developer console on the DACOS page. This helper uses the existing
HTTP-only cookie automatically; it never reads or prints the JWT:

```js
const session = await fetch('/api/auth/session').then(r => r.json())
async function incidentApi(path, body, method = 'POST') {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(`${response.status}: ${result.error}`)
  return result
}
let incident = await incidentApi('/api/operations/incidents', {
  message: 'SIMULATED milestone 5 manual test', severity: 'LOW', simulation: true,
})
const actionPath = `/api/operations/incidents/${incident.id}/events`
incident = await incidentApi(actionPath, { action: 'acknowledge', note: 'Demo reviewed' })
incident = await incidentApi(actionPath, {
  action: 'assign', ownerId: session.user.id, note: 'Assigned for supervised test',
})
incident = await incidentApi(actionPath, {
  action: 'start', version: incident.version, note: 'Demonstration response started',
})
incident = await incidentApi(actionPath, { action: 'resolve', note: 'Demonstration completed' })
incident = await incidentApi(actionPath, { action: 'close', note: 'Supervisor review completed' })
await incidentApi(`/api/operations/incidents/${incident.id}`, undefined, 'GET')
await incidentApi('/api/operations/incidents?status=CLOSED&q=milestone', undefined, 'GET')
```

To check permissions, sign in as OPERATOR in a separate browser profile and
initialize the helper with that profile's session. Acknowledge a fresh OPEN
incident; assignment/closure/escalation must return 403. An operator assigned
by a supervisor can start and resolve their own incident. Resolving before
IN_PROGRESS must return 409. A note containing only spaces must return 400.
Do not manually edit dates in a non-test database to accelerate escalation tests.

For SOS testing use the existing Wi-Fi lab in demo mode: send SOS repeatedly,
stop transmission and confirm detail/history remain available. Use the API
lifecycle to resolve/close the incident, then verify its active alert clears and
history remains. Automated tests cover action-ID replay after closure; the older
screen will gain complete lifecycle controls in Milestone 6.

## Verification and milestone boundary

Run `./scripts/npm test` and `./scripts/npm run build`.
The suite checks complete transitions, all roles/ownership, CSRF/input rejection,
concurrent acknowledgements, stale versions, filtering/detail retrieval, escalation,
SOS replay/combining/disconnection/resolution and fresh legacy migration upgrades.
Existing simulator, pairing, JWT and frontend regressions remain included.

Changed files for this milestone:
- Prisma schema and the two new migration directories above.
- `backend/src/services/incidents.js` (new), `services/operations-api.js`, `app.js`.
- `backend/src/repositories/postgres.js`, `services/telemetry.js`.
- `shared/contracts.js`, `frontend/src/services/device-client.js` (optional SOS ID).
- `backend/tests/api.test.js`, this guide and the backend/project-guide links.

Remaining: Milestone 6 incident UI/detail routes and dedicated authenticated
incident realtime messages; Milestone 7 control-room/history charts/reporting;
Milestone 8 deployment/recovery preparation; Milestone 9 integration readiness.
Approval is required before beginning Milestone 6, per the requested milestone gate.

Final verification: 43 tests across 12 files passed, including a fresh legacy-to-current migration check in an isolated temporary database. The frontend production build passed (third-party Zod annotation warnings only). `git diff --check` passed. No external deployment/database migration or credential setup was performed.
