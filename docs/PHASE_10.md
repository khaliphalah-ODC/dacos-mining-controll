# Phase 10 — worker applications and hybrid positioning

DACOS remains a supervised development prototype. No deployment, external QR service, real hardware or emergency dispatch integration is used.

## Milestone A — worker applications

### Routes and permissions

- Public form: `/worker-register`.
- Public write-only endpoint: `POST /api/public/worker-applications`. Returns only a generic receipt, never application IDs, names, contacts, duplicate flags or public status lookup.
- Supervisor/Admin: `/manage/worker-applications`; linked from Worker Management and account navigation.
- Protected APIs: `GET /api/manage/worker-applications?status=PENDING&limit=20&cursor=…`, `GET /api/manage/worker-applications/:id`, `POST /api/manage/worker-applications/:id/review`.
- Existing human session, role and CSRF middleware protect all review operations. Operators cannot access applications or their contact information.

The review page generates and downloads a QR PNG entirely locally using `qrcode`. The destination contains only `/worker-register`, with no applicant data, device token or pairing code. The default origin is the current frontend origin. An optional origin field supports an already approved HTTPS frontend; generating a QR does not start a public server. A localhost QR can only work on the computer hosting it, not on a phone. Phone access requires an independently configured, trusted HTTPS address; this milestone does not configure one.

### Data integrity and privacy

Additive migration: `202611170003_worker_applications`.

- `WorkerApplication`: submitted details, acknowledgement version/time, pending/approved/rejected decision, reviewer, review note and approved-worker relation. The public form requires acknowledgement; it is not location-tracking consent.
- `WorkerPrivateProfile`: contact/employee/site/work-area details separate from `Worker`. General worker APIs, telemetry snapshots and Socket.IO do not include this relation. Reviewed application details remain available only to authorized reviewers.
- `RegistrationThrottle`: persistent atomic PostgreSQL buckets, five attempts per connection per 15 minutes and thirty per 24 hours. Invalid submissions count. Keys hash the server-observed address; forwarded addresses are accepted only through the existing explicit proxy configuration. A shared mine network may need supervised rate-limit tuning.

Shared Zod schemas enforce field limits, phone format, work-area choices, exact privacy notice version and acknowledgement. Optional honeypot suppresses automated submissions. Same-origin JSON writes prevent cross-origin browser submissions; this public endpoint does not use human sessions or device credentials. These are basic abuse controls, not a complete defense against distributed attacks.

Exact identical pending submissions collapse through a partial unique index and receive the same public response. Reviewers see potential matches on normalized phone, name and site/employee number, including existing worker names. Phone matches are heuristic; shared phones and country-code differences need human review. Different spellings of a site can evade text matching because there is no canonical Site model yet.

Approval runs in a serializable transaction. Review notes are required. Potential matches must be acknowledged explicitly. A site/employee number already attached to a private profile cannot create another profile. Generated worker IDs use `WK-` plus a UUID and the Worker primary key enforces uniqueness. Concurrent or repeated review returns a conflict and cannot create extra workers. New workers use an existing reviewer-selected administrative zone, which is not a measured location. Approval creates no login, device or device assignment.

Linking requires an existing active worker. It preserves that worker's profile, zone and any existing private profile rather than silently overwriting them. The reviewed application retains the newly submitted details for reconciliation. An employee identity attached to another worker cannot be moved by linking. Rejection creates no worker. Decisions are final for that application; a rejected applicant may submit again. No existing telemetry, assignments or incident history is deleted.

Audit events record submission, private-detail viewing, approval/rejection and worker creation/linking. Contact data and review-note text are not copied into general audit feeds; notes remain on the protected application. Public submissions are never broadcast over Socket.IO.

### Local setup and manual verification

1. Install dependencies if needed, run `./scripts/npm run db:generate`, then `./scripts/npm run dev`. The existing dev runner applies additive migrations to its configured database. Review the database configuration first; do not point it at an external database without approval.
2. Sign in as Supervisor/Admin. Open Worker Management → Applications & registration QR. Expand the QR section, inspect the destination and download the PNG. It must resolve to `/worker-register`, not device pairing.
3. Open `/worker-register` in a signed-out/private window. Submit a synthetic name, phone, job, site, shift and work area; acknowledge the notice. Verify a generic receipt. Do not use actual personnel details during development testing.
4. Confirm no new worker/account exists before review. Open the pending application as Supervisor. Inspect private details, acknowledgement and duplicate results.
5. Select an existing zone, enter a review note and approve. Verify an active worker with generated ID, no new login/device, and a review audit event. General worker/snapshot responses must not include phone, emergency contact or employee number.
6. Submit a potential duplicate with a changed spelling/phone or employee number. Verify duplicate review is required. A duplicate site/employee identity cannot create another worker; link it to the matching active worker instead. Verify existing details are retained.
7. Reject another application with a note. Verify no worker was created and the decision remains readable. Attempt reviewing it again; expect a conflict.
8. Sign in as Operator and try the review route and APIs. Expect route denial/API 403. Signed-out protected API calls return 401; review mutations without CSRF return 403.
9. Submit more than five attempts in 15 minutes from one connection; expect 429. In production, expired throttle-row housekeeping and broader perimeter abuse controls should follow the site's operational policy.

Reviewers must reconcile applicant-provided site names with the chosen zone. A formal site registry, field-by-field private-profile editing, automated identity verification, SMS/email confirmations and site-specific legal/retention policy are not implemented by Milestone A. There is no automatic purge of applications or personnel records.

### Verification

- New PostgreSQL integration tests: pending submission, privacy, validation/origin/honeypot, persistent throttling, concurrent duplicate submission, role/CSRF controls, transactional approval, employee duplicates, linking, competing reviewers and rejection/reapplication.
- Frontend tests: public/protected route behavior, shared validation, QR destination safety/local PNG generation and server rendering.
- Existing full regression suite and frontend production build are run before proceeding to hybrid tracking.

## Milestone C — security and verification

Management APIs reuse role and CSRF middleware, sensitive contacts stay in private models, detailed location-history reads require elevated roles and generate audit events, and location writes reuse device authorization. Both migrations are additive. Integration tests exercise approval/duplicate races, revocation, provenance/source transitions and protected histories. No hardware, deployment or external service is connected.

## Milestone B — hybrid location observations

Additive migration: `202611170004_hybrid_locations`.

Models: `LocationObservation` (immutable accepted observations), `WorkerLocationState` (last-known observation), `LocationMovementEvent` (derived entries/exits/source changes), `LocationPolicy`, and a separate `DeviceRegistration.locationSequence`. New observations never overwrite existing health telemetry or incident history. Zone assignments never generate an observation.

### Device contract

`POST /api/device-location` uses the existing device bearer credential and secure-device request policy. Human JWTs do not authenticate devices. The server rechecks active worker assignment, credential hash, revocation/provisioning state and simulator/hardware provenance inside the same serializable transaction that stores the observation. The schema is shared in `shared/location.js`.

Example GNSS body (synthetic contract example, not a hardware receipt):

```json
{
  "deviceId": "00000000-0000-4000-8000-000000000001",
  "workerId": "WK-example",
  "source": "GNSS",
  "simulation": false,
  "timestamp": "2026-11-17T12:00:00.000Z",
  "sequence": 0,
  "latitude": 6.3,
  "longitude": -10.8,
  "coordinateFrame": "WGS84",
  "accuracyMeters": 12
}
```

Use an actual current ISO UTC timestamp when exercising the contract. No physical device was used to generate this example.

- GNSS: latitude/longitude, WGS84 frame. Outdoor coordinates are displayed as reported, without an external map service or invented geographic overlay.
- BLE: zone and/or checkpoint only. Coordinates, coordinate frame and meter accuracy are rejected. BLE transport/proximity does not establish precise location.
- UWB: x/y in meters, optional z in meters, and a named local coordinate frame; optional accuracy. A future real integration must configure anchors, units, surveyed frame and calibration. Coordinates are not projected onto the fictional mine diagram.
- SIMULATED: explicit `simulation:true` plus zone/checkpoint or coordinates. A simulator registration can submit only this source; a hardware registration cannot submit simulated observations. Operational workspace mode rejects simulated location ingestion.
- Optional `zoneId` must identify an existing Zone. `checkpointId` is device-reported text; a checkpoint registry and surveyed mapping are future hardware work. Confidence, if supplied, is in [0,1] and displayed as device-reported, not calibrated certainty.
- Latitude/longitude are a pair; local coordinates require x/y/frame; geographic and local coordinates cannot mix. Missing values remain missing.
- Location sequence is independent of the health-telemetry sequence. Keep it increasing across reconnects, reassignment and credential rotation. Credential responses include `nextLocationSequence`; enrolled inventory exposes the current counter to authorized managers. Start at zero for a new registration.
- Retries with the same device/sequence and identical body are deduplicated; changed payloads with a reused sequence return 409. Previously unseen lower sequences return 409. Fresh writes are limited to two observations/second/device. Duplicates do not update last-seen time.
- Observations may be up to 24 hours old for buffered delivery, or at most 30 seconds ahead. Older timestamps within that window enter history but cannot rewind current state or produce false transitions.

This is a separate optional ingestion endpoint. Existing Wi-Fi simulation, BLE health gateway packets and hardware telemetry contracts continue working unchanged. No location observations are auto-generated by either simulator or worker approval. Future firmware/gateway work can submit observations explicitly using this contract.

### Views and access

- `/tracking`: all signed-in roles; last-known observations and tracking status. No data means **Location Unavailable**.
- Worker Detail: Hybrid Positioning panel, separate from the existing clearly labelled fictional/simulated map panel.
- `/control-room`: per-worker last-known observation, provenance and tracking state.
- `/workers/:id/movement`: Supervisor/Admin only; paginated observation timeline and zone-entry/exit/source-change history with source/date filters.
- `/manage/location-policy`: Admin-only policy editing and explicit retention cleanup; Supervisors can read the policy API.
- Fictional maps link to device-reported tracking but do not infer or project physical worker positions from administrative diagram coordinates.

Current-location endpoints are authenticated: `GET /api/locations/current` and `GET /api/workers/:id/location`. Detailed endpoints are restricted and audited: `GET /api/workers/:id/locations` and `GET /api/workers/:id/movements`. Both accept `limit` (1–100), `cursor`, `source`, `from` and `to` and return a next cursor. No location data is publicly accessible. The existing project has no site/shift access scoping; authorized supervisors/admins currently have project-wide history access.

Default location freshness is 120 seconds, separate from health telemetry freshness and device heartbeat status. Old observations become STALE; missing positions or revoked/unpaired/reassigned devices yield UNAVAILABLE, with retained last-known context where appropriate. Observations beyond the retention window are not returned as current context. Frontend realtime loss explicitly marks retained positions offline, even if the last server response was current. Source changes never blend simulated and physical coordinates into a continuous path.

Zone entries/exits are derived from successive current observations, with timestamps of those observations, not verified boundary-crossing times. Unknown gaps remain unknown. An exit from a simulated prior zone remains labelled as including simulation even if the next source is hardware. Older buffered observations are retained without backfilling a false movement chronology.

### Retention controls

Default history visibility is 90 days. Admins can change retention to 1–3650 days and freshness to 10–86400 seconds with an audit note. Saving policy does not delete data. Reads respect the retention window.

`POST /api/manage/location-retention` defaults to `dryRun:true` and requires a note. Actual deletion additionally requires `dryRun:false` and `confirmation:"PURGE_EXPIRED_LOCATIONS"`. It deletes up to 1,000 expired location observations and their derived events per action, clears any deleted latest-observation reference, and audits cutoff/counts/reason. No scheduled purge runs. Worker profiles, device credentials, health telemetry and incidents are untouched. Cleanup was exercised only against isolated synthetic test records, never the development database.

### Manual positioning verification

1. Start the migrated local application. Open Tracking or any approved worker's Hybrid Positioning panel before device observations: expect Location Unavailable, regardless of assigned zone.
2. Use an authorized manager to register/assign/provision a **test** device. Keep credentials private. With no hardware available, use a simulator registration and explicit SIMULATED source; do not pass generated positions off as hardware readings.
3. In a controlled test client, send a SIMULATED zone observation with its device credential, correct worker, current timestamp, increasing location sequence and `simulation:true`. Verify a SIMULATED last-known zone appears in Tracking/Control Room/Worker Detail. No physical position is claimed.
4. Repeat the same body/sequence: expect duplicate acknowledgement and one history record. Change the payload without increasing sequence: expect 409. Send a later sequence with an older timestamp: it may be retained as history, but current position must not rewind.
5. As Supervisor/Admin, open movement history. Verify source filters, paging, inferred entry/exit labels and timestamps. As Operator, verify current monitoring works but detailed history is denied.
6. Wait past the saved freshness interval: expect STALE. Disconnect browser realtime: expect offline retained-value labels. Revoke/unassign the device: tracking becomes unavailable; history remains available to authorized reviewers.
7. Review location policy as Admin. Preview cleanup first. Do not execute deletion against real records without the approved retention policy and an intentional confirmation.
8. Run the isolated tests for GNSS/BLE/UWB transitions; these exercise synthetic hardware-contract payloads without connecting physical devices. Actual sensors, anchors, positioning accuracy and site calibration remain unvalidated.

## Verification commands and results

- `./scripts/npm run db:generate` — Prisma client generated successfully.
- `./scripts/npm test` — full regression suite, including application and positioning tests.
- `./scripts/npm run build` — frontend production build.
- `./scripts/npm run check:phase10` — isolated built-app browser workflow, requires Chrome and loopback/PostgreSQL permissions. Creates and removes its own temporary database/profile; does not use development data.

Milestone A checkpoint: 68 tests in 18 files and production build passed before location implementation. Dedicated positioning tests then passed 10 tests across backend/frontend. Final full-suite/browser results are recorded in the implementation handoff.

## Files changed for Phase 10

- Database: `backend/prisma/schema.prisma`; migrations `202611170003_worker_applications` and `202611170004_hybrid_locations`.
- Shared contracts: `shared/contracts.js`, `shared/worker-registration.js`, `shared/location.js`.
- Backend: `backend/src/app.js`, services `worker-applications.js`, `locations.js`, `devices.js` (shared device authorization), `management.js` (next location sequence on credential issuance), `reporting.js` (control-room last-known location).
- Frontend navigation/integration: `frontend/src/router.js`, `App.vue`, and views `WorkerManagementView.vue`, `WorkerDetailView.vue`, `ControlRoomView.vue`, `MapView.vue`.
- New views: `WorkerRegisterView.vue`, `WorkerApplicationsView.vue`, `TrackingView.vue`, `WorkerMovementView.vue`, `LocationPolicyView.vue`.
- Components/helpers: `LocationSummary.vue`, `WorkerLocationPanel.vue`, services `worker-registration.js`, `locations.js`.
- Verification: backend tests `worker-applications.test.js`, `locations.test.js`; frontend tests `worker-registration.test.js`, `locations.test.js`; `frontend/scripts/check-phase10.mjs` and root `check:phase10` command.
- Dependencies: frontend `qrcode` and the package lock; QR encoding runs locally, without an external service.

The migrations have been exercised on isolated test databases. The development database is not modified by the Phase 10 verification scripts; apply the additive migrations through the existing local startup/migration workflow before using the new pages with development data.

### Final verified results

- Full suite: **78 tests passed across 20 files** (including incident/device/pairing/simulator/authentication/realtime regressions).
- Frontend production build: passed. Existing upstream Zod comment-annotation warnings remain non-blocking.
- Isolated built-app Chrome check: passed public application submission, login, locally generated QR PNG/destination, review/approval, unavailable-position semantics, tracking/history/retention pages, sign-out/public access and 1440/768/390px overflow checks.
- JavaScript syntax checks and `git diff --check`: passed.
- No development personnel/location records were purged, no development database migration was applied, no deployment was made and no physical hardware was connected.
