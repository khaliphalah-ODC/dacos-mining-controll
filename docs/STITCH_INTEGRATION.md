# Stitch UI integration

Primary references: `stitch_dacos_mine_safety_ui/`, including the Industrial Mission Interface design tokens and the exported overview, login, telemetry, workers, devices, map, environmental, incident, history, account and public screens. The newer export supersedes the older `frontend/design-reference` visual shell.

## Inspection and implementation plan

Preserve Vue/Pinia/Router, Express/Prisma, shared Zod contracts, cookie/CSRF sessions and the single authenticated telemetry socket. Extract the design into local components and CSS without a new UI framework or CDN. Keep functional management/incident/Phase 10 logic and adapt its composition/styles. Replace the legacy static monitoring pages at their existing routes; keep design files as references, not data sources.

Milestones: (1) tokens and reusable components; (2) shell/auth/client; (3) operational overview/monitoring/workers/devices; (4) Phase 10/incidents/history/report integration; (5) remaining pages, responsive/browser checks and regressions. Each milestone receives a build/test checkpoint before the next.

## Initial hardcoded-data audit

The legacy Overview/DashboardContent, Workers, Environmental and Map templates included static statistics, fictional identities, example site/sector names, secondary labels, schematic coordinates, decorative trend curves and disabled controls. Sidebar/GlobalHeader contained a fixed signed-in identity, mine sector and alert count. These templates must leave the runtime path rather than have their static values rethemed. The new Stitch export also contains illustrative people, MAC addresses, asset counts, percentages, latencies, diagnoses, demo chart series, ventilation assertions and unsupported actions; none are an API or authoritative record.

The current management, incidents, recorded HistoryChart and Phase 10 workflows already use backend APIs. Landing-page text, genuine editorial placeholders, icon paths and labels are not operational records. Device Lab inputs are deliberate operator-controlled simulated readings; retain their explicit simulation labels and real ingestion requests. `preview/snapshot.json` belongs only to the explicitly configured offline static design preview and must never be loaded as a network-failure fallback or in operational mode.

No localStorage operational cache or human/device credential storage exists in the inspected frontend. Device tokens remain in memory and one-time issuance panels.

## Endpoint reuse

Authentication: `/api/auth/login`, `/session`, `/logout`, `/password`, `/socket-ticket` under `/api/auth`.
Monitoring: `/api/telemetry/snapshot`, `/api/control-room`, `/api/dashboard/summary`, `/api/workers`, `/api/workers/:id`, `/api/zones`, `/api/readings/health`, `/api/readings/environmental`, `/api/operations/status`.
Management: `/api/manage/workers`, `/api/manage/zones`, `/api/manage/devices`, device `/:id/assignment`, `/:id/assignments`, `/:id/rotate`, `/:id/revoke`, `/:id/reprovision`.
Registration: `/api/public/worker-applications`, `/api/manage/worker-applications`, `/:id`, `/:id/review`.
Locations: `/api/locations/current`, `/api/workers/:id/location`, `/:id/locations`, `/:id/movements`, `/api/manage/location-policy`, `/api/manage/location-retention`.
Incidents/rules: `/api/operations/incidents`, `/:id`, `/:id/events`, `/api/operations/responders`, `/api/operations/escalation-rules`, `/api/operations/incidents-escalate-due`, `/api/operations/rules` and rule review.
History/reports: `/api/history/readings`, `/api/reports/readings.csv`, `/api/reports/incidents.csv`.
Accounts/audit/health: `/api/users`, `/api/users/:id`, `/api/audit`, `/api/health`, `/api/ready`, `/api/live`.
Device Lab: `/api/device-pairing`, `/api/devices/register`, `/api/device-telemetry` using separate device credentials. No physical hardware is changed.
Realtime: existing `telemetry:snapshot`, validated `telemetry:delta`, `telemetry:resync`, `telemetry:unavailable` and `incident:changed`; do not add per-page sockets.

No schema or migration change is required for the UI. Any paging additions extend existing endpoints compatibly. No database reset, deployment or external messaging service is authorized.

## Page-by-page integration checklist

All operational values below are backend records/aggregates, accepted device packets or explicit backend-generated simulation. The shared Pinia snapshot is a read cache, not another persistent source of truth.

| Page / route | APIs / data source | Working interactions | Verification |
|---|---|---|---|
| Public `/welcome` | Editorial content and local photographs, no operational values | Four section links, mobile menu, login CTA; contact delivery explicitly disabled | Browser responsive checks; no invented startup statistics |
| Login `/login` | `/api/auth/login`, `/api/auth/session` | Validation, password reveal, submit/error/busy, public return | Auth tests; browser login/logout |
| My Account `/account` | Session profile, `/api/auth/password`, logout | Current/new password validation, session invalidation | Existing auth tests; browser page |
| Overview `/` | Snapshot, `/api/control-room`, `/api/operations/status`, incidents | Drill-down links, recorded summaries, received telemetry | Both mode checks, missing-data assertions, responsive browser |
| Control Room `/control-room` | Existing control-room API plus snapshot updates | Worker/zone/connectivity/date filters, location status, detail/history links | PostgreSQL integration and built-app workflow |
| Workers `/workers` | `/api/workers?q&zoneId&status&limit&cursor` | Server search/filter/pagination, worker detail | New compatible-paging API tests; browser |
| Worker Detail `/workers/:id` | Snapshot, worker location API | Received vitals, location/history, alerts/incidents | Existing detail tests; device-packet browser workflow |
| Map `/map` | Backend zones/geometry; explicitly simulated backend position readings in demo mode | Zone directory, links to received hybrid observations | No fictional positions injected in operational mode; browser |
| Environmental `/environmental` | Snapshot environmental readings | Zone/metric filters over actual received data, history link | Missing-data and simulation-label tests; browser |
| Workers `/manage/workers` | Existing worker/zone management APIs | Register/edit/deactivate/reactivate, server search/pagination | Existing/new API tests; browser registration/search |
| Devices `/manage/devices` | Existing inventory, assignment and credential APIs | Register/edit/search/page, assign/unassign, one-time credential handling, assignment history | API and actual browser provisioning/assignment |
| Public registration `/worker-register` | Public write-only application API | Shared validation, acknowledgement, pending receipt | Phase 10 integration/browser |
| Applications `/manage/worker-applications` | Protected list/detail/review APIs | Status paging, duplicate acknowledgement, approve/link/reject, local QR | Phase 10 integration/browser |
| Tracking `/tracking` | `/api/locations/current` | Actual current-observation search, unavailable/offline/source labels | Source/permission tests; browser |
| Movement `/workers/:id/movement` | Restricted observation and movement APIs | Source/time filters and backend cursor paging | Phase 10 source-transition/retention tests; browser |
| Location policy `/manage/location-policy` | Existing policy/retention APIs | Save, preview, explicitly confirmed bounded purge | Admin/CSRF and retention tests; browser page only (no real purge) |
| Incidents `/operations/incidents` | Existing incident list/create and CSV endpoints | Search/filter/page/create/export | Lifecycle API tests; browser lifecycle |
| Incident Detail `/operations/incidents/:id` | Detail/events/responders, `incident:changed` | Role/owner/state-constrained actions, required notes, resync | Independent-session realtime and UI lifecycle browser |
| History `/history` | Recorded readings and CSV endpoint | Real date/source/metric filters, cursor paging, chart, export | Chart gap/source tests; historical browser workflow |
| Rules `/operations/rules` | Existing demo-escalation and hardware threshold APIs | Role-aware create/review/enable/evaluate controls | Existing rule/auth tests; browser rendering |
| Accounts & Audit `/manage/users` | Existing users/audit endpoints extended with optional server paging/search | Create/edit/access/password reset, search/page audit/account records | Authorization and new paging tests; browser |
| System Health `/system-health` | Existing operations/status and health APIs | Refresh and actual connection/persistence/device states | Browser and existing health API tests |
| Wi-Fi Lab `/device-simulator` | Existing pairing/register/telemetry/scenario APIs | Pair, start/stop, explicit simulated SOS, backend scenario control | Preserved simulator/device regression tests; browser layout |
| BLE `/ble-gateway` | Existing pairing/register/telemetry plus approved browser GATT | Compatibility, discovery/subscribe/reconnect/disconnect, provenance | Existing fake-GATT/relay tests; browser compatibility state; no real device connected |

Backend pagination extends the existing endpoints using optional `limit`/`cursor`; unpaged worker/device/user consumers retain their contracts. Audit's default remains the latest 100 events. These changes require no migration.

## Deliberately unavailable capabilities

The supplied design's fixed shift-key rotation, report dashboard percentages, sensor diagnoses, ventilation-control assertions, arbitrary hardware MAC fields, mass decommissioning, medical certification indicators and user identity samples are omitted. There is no backend contract establishing those capabilities. Contact delivery is clearly disabled rather than reporting a fake send. Social/team fields remain editorial placeholders. No email service, external map provider or physical hardware connection is added.

The existing explicit `VITE_STATIC_PREVIEW=true` frozen design preview remains separate from the operational product: it is clearly labelled offline and does not claim backend or hardware connectivity. It never loads automatically on a failed request. All actual application modes use backend data; operational mode never loads the preview fixture.

## Verification workflow

Build with `./scripts/npm run build`; run `./scripts/npm test`. `./scripts/npm run check:phase10` checks a fresh temporary operational PostgreSQL/Chrome application at 1440/1024/768/390, including mobile navigation and Phase 10 flows. `DACOS_UI_DEMO=true ./scripts/npm run check:phase10` repeats against the backend simulator. `./scripts/npm run check:pilot` exercises provisioning, assignment, accepted synthetic hardware-contract packets, incident lifecycle, independent-session realtime and historical records. Browser scripts never connect physical devices or deploy services. See the final verification result below.

## Final verification — 2026-11-18

Production build passed. The full regression suite passed: 83 tests across 22 files.
Isolated Chrome Phase 10 workflows passed in both operational and demo modes,
including public registration, authentication, application approval, location routes,
mobile navigation and responsive layouts at 1440/1024/768/390 pixels.
The isolated pilot workflow passed device registration/assignment, credential issuance,
accepted synthetic telemetry, incident lifecycle, independent-session realtime updates
and recorded history charts. The demo check initially stopped during concurrent
startup; its separate retry passed. These checks use temporary local databases and
synthetic inputs; they do not establish cloud deployment or physical hardware readiness.
