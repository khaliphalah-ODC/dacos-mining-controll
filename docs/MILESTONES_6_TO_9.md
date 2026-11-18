# Milestones 6–9: implementation and verification

DACOS remains a supervised demonstration prototype. Simulated incidents are
labelled and cannot contact responders. No external service, database or account
was provisioned, migrated or deployed by this work. Physical hardware integration
remains pending until hardware is available.

## Milestone 6 — incident UI and authenticated realtime

Implemented `/operations/incidents`, `/operations/incidents/:id` and
`/operations/rules`. The list supports search, canonical state/severity, worker,
provenance and created-at date filters with pagination. The detail page displays
ownership, timestamps and append-only activity. Actions are shown according to
role, assignment and lifecycle state; the backend remains authoritative.
Assignments use an active-person selector rather than requiring a copied user ID.
Mutations send the incident version to reject stale clients.

The existing authenticated socket now emits compact `incident:changed` messages
containing only incident ID, version and update time. Pages fetch authorised REST
detail/list data, debounce invalidations, and reload after reconnect. Resolved and
closed updates are included. No second permanent browser connection is created.

Changed: `services/incidents.js` on both sides, telemetry service/store, realtime
adapter, responder lookup, router, IncidentsView, IncidentDetailView, RulesView,
styles and incident-control/socket integration tests. No migration in Milestone 6.
Initial verification: 44 regression tests; the targeted API suite then passed all
17 tests including the full realtime lifecycle. Frontend build passed.

Manual check: sign in in two browser profiles, open the same incident and
acknowledge it in one profile. The other should update without reload. An operator
can acknowledge, and can start/resolve work assigned to that account. Only a
supervisor/admin can assign or close. A conflict requires refreshing detail.

## Milestone 7 — control room, historical charts and reporting

New `/control-room` provides recorded worker/device summaries and filtering by
worker, zone, source connection status and latest-reading date. Health and zone
readings show source and quality; browser loss marks retained values offline.
Live source connection status remains separate from a worker safety assessment.

New `/history` provides health, device and environmental histories with worker,
zone, device, source, quality, metric and UTC-backed time filters. Local-time
inputs are converted to UTC. Pages hold at most 200 records. SVG charts plot only
recorded numeric values, separate devices/assignments/sources and leave unavailable,
stale or large time gaps open. No random frontend generator or zero-fill exists.
Only the currently fetched page is charted; change the time filter or page to
inspect another range. This is not an unbounded full-history chart.

`GET /api/history/readings` reads the new append-only ReadingHistory model.
Accepted device metrics are stored transactionally with packet ingestion. Demo
fixture history is sampled once per minute by default to avoid unnecessary local
writes; DEMO_HISTORY_INTERVAL_MS can be configured, minimum 10000. Disconnected/
stale fixtures are not repeatedly recorded as new observations. The initial
migration imports only the existing last-known Reading rows, not invented past
samples. Acquisition time and server receipt time remain separate.

`/api/reports/readings.csv` and `/api/reports/incidents.csv` export matching
filters, bounded to 10000 rows. Narrow filters if the limit is exceeded. CSV cells
are quoted and spreadsheet formula prefixes are escaped. The incident list and
history page provide downloads. Existing device packet and SOS history endpoints
remain available.

Migration: `202611170001_reading_history`. Changed/new reporting service, history
chart/helper, HistoryView, ControlRoomView, links, navigation, repository and tests.
Initial verification: 47 regression tests and frontend build passed; targeted
history/report API/helper verification passed 20 tests before deployment work.

Manual check: transmit real test-device data or labelled simulator data; inspect
Worker Detail and Control room. Open History, choose metric/source and time range,
then export CSV. A future range or unsupported environmental hardware source
returns empty/unavailable, not sample readings.

## Static-screen audit and navigation

| Existing screen | Fixture findings | Treatment |
| --- | --- | --- |
| Overview | Secondary diagrams, exported annotations and some design labels | Kept as explicitly labelled demo; live Control room is linked globally |
| Worker directory | Hardcoded demo rows/inspector annotations | Dynamic worker detail and management remain; operational mode hides demo directory |
| Mine map | Fictional tunnel geometry and positioning | Demo preserved; operational schematic explicitly shows no verified worker locations |
| Environmental | Demo gauges, trend illustration and unsupported equipment controls | Actual historical chart linked; operational views never invent environmental hardware values |
| Incident screen | Earlier partial lifecycle and raw ID assignment | Replaced by canonical list/detail workflow and active responder selector |
| Sidebars | Disabled health/incidents/reports/device navigation and static overview badges | Routed to working pages; manager links role-gated and overview badges use the shared store |

Evacuation, equipment operation, SCADA and external dispatch controls remain
unavailable because no corresponding verified integration exists. Making those
buttons pretend to work would be misleading. The design-export demo retains its
visual identity and fixture disclaimer; operational pages use database state.

## Milestone 8 — deployment, reliability and recovery

Target configuration is prepared for Netlify frontend, Railway backend and Neon
PostgreSQL. Follow [DEPLOYMENT_NETLIFY_RAILWAY_NEON.md](DEPLOYMENT_NETLIFY_RAILWAY_NEON.md).
No deployment has been executed. The prepared configuration uses same-origin
HTTP API proxying plus direct one-use-ticket WebSockets; it does not depend on
third-party session cookies or a Netlify WebSocket proxy.

Added SocketTicket and migration `202611170002_socket_tickets`. Tickets are hashed,
expire after 30 seconds, are single-use, tied to a database session and cannot
authenticate REST requests. The browser JWT remains in its HttpOnly cookie.
Session expiry/revocation still disconnects sockets. The production policy checks
exact allowed origins, Secure/SameSite cookies, CSRF and explicitly trusted HTTPS
proxy information. Wildcard origin/proxy trust is not enabled.

Modern clients opt into `telemetry:delta`: unchanged top-level collections are
omitted and duplicate per-reading legacy events are avoided. Initial connection,
reconnect, periodic repair and explicit resync use full authoritative snapshots.
A delta requires the exact baseline sequence and stream; malformed/gapped data
requests a rate-limited resync. Legacy clients retain the original snapshot/events.
This is a single-backend-instance transport; horizontal Socket.IO scaling needs a
shared adapter and shared pairing/device-rate state before multiple replicas.

Public `/api/live` and `/api/ready` support provider checks; readiness verifies
PostgreSQL and committed telemetry availability. Structured request/background
errors include safe codes/request IDs, not cookies, tokens, passwords or payloads.
Railway PORT is supported. SERVE_FRONTEND=false permits the split hosting setup.
Production migrations use DATABASE_URL_UNPOOLED when supplied; no reset command is
used. The supplied Railway predeploy migration runs only after an approved actual
deployment is initiated.

Gateway queue refinements validate acknowledgement device/sequence identity,
retain packets on ambiguous/network/auth errors, quarantine corrupt queue files,
and preserve invalid/expired samples in protected dead letters. Original timestamps
and SOS action IDs are retained. The CLI emits a small queued receipt after durable
storage; an upstream native adapter must wait for that receipt before discarding
its own sample. One process/device per spool directory is required. Browser tabs
are not an unattended physical gateway; the Node relay needs a real sensor/native
BLE adapter. No physical adapter is claimed here.

Initial verification: full production policy/ticket regression run passed 52 tests;
subsequent targeted gateway/API/history checks passed 24 tests. Build passed.

Manual local check: stop the relay's destination temporarily, enqueue valid test
packets and restart the relay against the same spool directory. Unacknowledged
packets should remain; accepted/duplicate packets are removed only on a matching
acknowledgement. Older-than-two-minute live samples are quarantined, never restamped.
No automatic production data-retention deletion was added.

## Milestone 9 — final checks and readiness gates

Run from the root:

```bash
./scripts/npm run db:generate
./scripts/npm test
VITE_SOCKET_ORIGIN= VITE_STATIC_PREVIEW=false ./scripts/npm run build
./scripts/npm run check:pilot
./scripts/npm run check:deployment
```

The browser check uses an isolated Chrome profile and dedicated local PostgreSQL
cluster, never an external/production database. It tests login/logout, protected
redirects, operational fixture exclusion, zone/worker/device forms, assignment,
credential issuance, Worker Detail, an independent-session realtime acknowledgement,
the full UI lifecycle through CLOSED, recorded history and desktop/phone widths.
Its synthetic test packet is not evidence of connected physical hardware.

`check:deployment` is configuration-only and prints presence/validity, never secret
values. Missing approved cloud credentials/configuration correctly results in a
failed readiness check. Do not populate real cloud credentials simply to make it
green without the requested approval. The smoke script refuses external targets
unless explicit external-smoke approval is provided after user approval.

Final results and open gates are recorded in the deployment readiness document.
Physical hardware, external platform smoke tests, real backup/restore execution,
provider-specific trusted-proxy verification and production load qualification
remain deployment acceptance work. No emergency notifications are sent.

## File map

- Backend: `services/incidents.js`, `reporting.js`, `operations-api.js`,
  `telemetry.js`, `devices.js`, repository, realtime adapter, app/server,
  `security/auth.js`, new `security/origins.js`, Prisma schema and two new migrations.
- Frontend: incident list/detail/rules, control room, history and fictional map
  views; HistoryChart; auth/telemetry stores; delta/history/incident helpers;
  sidebar/demo links; App/router/styles; shared device acknowledgement contract.
- Gateway: spool, relay CLI and failure/restart/corruption tests.
- Deployment: `netlify.toml`, `railway.json`, `deploy/production.env.example`,
  `scripts/prepare-netlify.mjs`, `deployment-check.mjs`, `smoke.mjs`, direct migration
  URL support and backup URL selection.
- Verification: backend API/deployment/origin tests, frontend role/history/delta/
  auth-race helpers, and extended `frontend/scripts/check-pilot.mjs`.

### Final verified results

- Full regression/integration suite: **56 tests across 16 files passed**.
- Frontend production build: passed; only existing third-party Zod annotation warnings.
- Built-app Chrome check: passed management, independent-session incident updates,
  full lifecycle through CLOSED, recorded history, and 1440/390/360-pixel layouts.
- Local live/ready/anonymous-access/login/session/logout smoke procedure is included
  in the isolated browser harness.
- Syntax checks and `git diff --check`: passed.
- Deployment configuration preflight: correctly blocked because cloud URL/secret/
  origin/proxy inputs are not configured or approved. Templates/build files exist.
- Docker execution and actual database restore remain unverified in this workspace:
  Docker is unavailable; installed PostgreSQL clients are version 16 and the test
  server is version 18. No cloud database was modified to work around these gates.

Operational status now distinguishes an authenticated connected socket from live
sensor data: an empty dataset is unavailable, and retained disconnected readings
are not labelled live. Hosted pairing requires human role/CSRF plus explicitly
allowed origin and trusted HTTPS; local laptop-only restrictions remain in dev.

The implementation/review work for Milestones 6–9 is complete locally. Online
production acceptance is not complete until the documented external approval,
provider, restore, physical validation and load-qualification gates are satisfied.
