# Supplied HTML integration

The seventeen supplied design files now provide the markup and design tokens for the live Vue routes:

| Supplied design | Live route | Component |
| --- | --- | --- |
| dacos_monitoring_overview | / | OverviewView.vue |
| dacos_accounts_security_audit | /manage/users | UserManagementView.vue |
| dacos_ble_gateway | /ble-gateway | BleGatewayView.vue |
| dacos_control_room_login | /login | LoginView.vue |
| dacos_control_room_telemetry | /control-room | ControlRoomView.vue |
| dacos_device_management | /manage/devices | DeviceManagementView.vue |
| dacos_environmental_monitoring | /environmental | EnvironmentalView.vue |
| dacos_fictional_mine_map | /map | MapView.vue |
| dacos_history_reports | /history | HistoryView.vue |
| dacos_incident_detail_inc_104 | /operations/incidents/:id | IncidentDetailView.vue |
| dacos_incident_management_console | /operations/incidents | IncidentsView.vue |
| dacos_live_workers_directory | /workers | WorkersView.vue |
| dacos_my_account_security_profile | /account | AccountView.vue |
| dacos_operational_threshold_rules | /operations/rules | RulesView.vue |
| dacos_wi_fi_device_simulator | /device-simulator | DeviceSimulatorView.vue |
| dacos_worker_detail_peter_kollie_w_088 | /workers/:id | WorkerDetailView.vue |
| dacos_worker_management | /manage/workers | WorkerManagementView.vue |

AppShell.vue uses the reference sidebar and fixed header. Existing authorized navigation, session logout, mobile drawer focus handling and route protection remain connected. The reference desktop frame is 240px wide with a 68px header. Mobile adapts the frame into a drawer.

`reference-design.css` is generated from the original Tailwind configuration by `scripts/build-reference-styles.mjs` before frontend production builds. Its selectors are scoped to `.reference-ui`, preserving the public page and other application styles. `reference-responsive.css` contains adaptations for live content, horizontal table scrolling, unavailable states and small screens. Fonts use the existing local Inter and Material Symbols assets.

The layouts are integrated with existing session, user/audit, telemetry, incident and BLE APIs. There are no hardcoded sample identities, passwords, readings, connection claims or mocked success handlers in these live screens. Account creation/editing, password resets, activation, search and cursor pagination remain functional. Audit records are persistent backend events. BLE scanning uses an explicit browser chooser after gateway registration; unsupported MTU controls and raw-hex export remain disabled.

A literal pixel-identical result to the sample screenshots is not claimed: live records replace the sample data, missing measurements use unavailable states, authentication errors appear only on actual failure, and unsupported security/hardware claims are removed. Those differences affect text wrapping and panel heights. The original standalone reference pages remain at `/extracted-ui/index.html` for comparison. Remote reference logo URLs still depend on availability of the original resources.

## Verification

Run `./scripts/npm run build`, `./scripts/npm test`, `./scripts/npm run check:reference-ui`, and `./scripts/npm run check:pilot` from the repository root. Browser checks require isolated local PostgreSQL and Chrome access.

The reference check captures the integrated pages at 1440, 1024, 768 and 390 pixels, checks document overflow, creates an account through the actual form, verifies its stored role, opens the persistent audit tab, and checks mobile navigation/logout. It saves live screenshots plus original desktop reference screenshots to `/tmp/dacos-reference-check/`. Physical BLE hardware is not connected by these tests.

Verified on 2026-11-18: production build; 83 regression tests across 22 files; final frontend checks (30 tests); operational reference browser checks including account persistence and audit; pilot provisioning/incident/realtime/history workflow; and demo Phase 10 browser workflows. Responsive checks cover 1440/1024/768/390 pixels. Screenshot review compares the live routes to local-font versions of the supplied references at the same desktop viewport. No percentage pixel-equality score is asserted.

## Additional four-page integration — 2026-11-18

The Control Room uses the exported filter bar, summary strip and repeated worker cards with backend worker/device/readings/incident records. Search, zone/connection/time filters, active-alert filtering, details and history links work through the existing APIs. Missing measurements stay unavailable and offline readings retain their quality labels.

Device Management uses the exported inventory table, five summary cards, filters and right-hand inspector. Registration, metadata editing, assignment, credential rotation/reprovision/revocation, one-time token display and assignment history retain their existing backend operations. Summary figures describe the current server-paginated page. The table scrolls within its own container, including its screen-reader action labels. Bulk shift-key rotation and inventory export have no backend contract and remain disabled.

Environmental Monitoring uses the exported sector/metric tiles with registered zones and received samples, adds the existing zone/metric filters, and plots actual persisted environmental readings with HistoryChart. CSV export uses the existing report endpoint. Calibration and fan override controls are visibly unavailable. No sample gas diagnoses, fan state, work-rest advice or dispatch claims are published as live telemetry.

The Mine Map retains the original corridor SVG as explicitly illustrative artwork. Registered administrative coordinates and backend-labelled simulated movement use a separate overlay; physical location observations are never projected onto that artwork. Zone selection, layer toggles, zoom/reset, worker selection and dossier/movement/tracking links are connected. Sample personnel, gateway locations, survey coordinates, RSSI accuracy and refuge certifications are not presented as measured records.

At 1440px the automated reference comparison verifies identical primary font (Inter), main background (#011427), left/right padding (16px), top padding (68px), header height (68px) and rail width (240px) for each of the four live routes and its supplied HTML reference. Metrics and side-by-side screenshots are saved in `/tmp/dacos-reference-check/`, including `layout-metrics.json`. The four-page comparison is also saved in [ui-reference-layout-check.json](ui-reference-layout-check.json). These checks establish matching design properties; they do not assert a 100% full-image pixel match with fictional sample records.

The additional integration passed the 83-test regression suite and the final 30-test frontend suite. The populated-device pilot passed registration, assignment, credential issuance, accepted synthetic hardware-contract packets, incident lifecycle, realtime updates and responsive layouts. Demo-mode Phase 10 browser workflows passed after updating the old Control Room heading selector to the source page landmark. Environmental history navigation preserves the selected zone and metric.

## History, incidents, directory and account integration — 2026-11-18

History uses the supplied heading, query card, summary row, trend panel and recorded-sample table. The primary filter row has six controls; extra device, quality and precise date filters remain under an advanced disclosure. Data, gap-aware graphs, pagination, CSV export and sample inspection come from the existing historical API. PDF reports and server-saved presets are visibly unavailable. The sample inspection overlay supports keyboard focus containment, Escape and focus restoration.

The incident console uses the supplied banner, command row, five summaries, register table, context panels and report overlay. Its summaries describe the returned server page, not an invented shift total. Incident creation, search, severity/status/source/time filters, CSV export and cursor paging retain their existing backend operations. The detail screen binds the supplied summary, lifecycle pipeline, telemetry, spatial/audit panels and response command to the requested incident ID. Current readings are labelled separately from trigger-time evidence, which the API does not retain. Lifecycle actions require a note, server version and an authorized role/owner; responder assignment and realtime recovery remain connected. No audio hail, external rescue, fabricated geofences or hash certification is claimed.

The worker directory uses the supplied search/filter toolbar, summary cards, table and table/grid switch. Rows, connection and provenance labels, details/history links, anomaly filtering and cursor paging use backend records. Counts describe the current page. The reference's fictional names, diagnoses and shift totals are not injected into operational mode.

My Account uses the complete supplied identity banner, password form, policy checklist, session panels and signout confirmation. Identity and expiry come from authenticated account/session responses. The password form enforces the actual server policy (12–128 characters and at most 72 UTF-8 bytes), matching confirmation and a supplied current password. Successful rotation invalidates existing sessions and returns to login; it does not pretend to re-sign a session. Other-terminal inventory and individual revocation remain visibly unavailable. The source's fabricated terminal IDs/IPs, Ed25519/HMAC assertions and mock success toast are omitted.

`useModalFocus.js` supplies focus containment, Escape and return focus for inspection, reporting and account confirmation overlays. Supplied document scripts are reference material, not execution instructions; their mock handlers are replaced by Vue events and the existing authenticated client.

The five-page batch passed the production build, 83-test regression suite, 30-test frontend suite, the populated-device/incident pilot and demo-mode Phase 10 browser workflows. The thirteen-page reference check passed at 1440/1024/768/390 pixels and compared each new page's desktop frame/font/background/spacing to its original HTML. Browser checks cover table/grid switching, sample inspection, report-dialog focus restoration, mismatched-password rejection, a 120-byte UTF-8 password rejection, successful password rotation, session invalidation, signing in with the new password, and confirmed account signout. Current metrics are recorded in `ui-reference-layout-check.json`; screenshots remain in `/tmp/dacos-reference-check/`. Full-image 100% pixel equality is not asserted because backend records and supported capabilities replace the source's fictional sample content.

## Rules, simulator, worker detail and worker management — 2026-11-18

The rules page retains the supplied heading, role ribbon, tabs and two-column authoring/evaluation frame. Actual escalation rules can be created disabled, enabled/disabled and explicitly evaluated through the existing demonstration APIs. The hardware tab uses reviewed hardware-rule controls and preserves administrator-only mutation permissions. Source firmware thresholds, medical assertions, invented device models and mock rule matches are not published as records.

The Wi-Fi simulator retains the reference lab banner, transmitter configuration panels and packet-console frame. Pairing-code creation, registered-worker selection, registration, operator-controlled biometric inputs, transmission, safe stop, simulated SOS and backend scenario controls retain the existing implementations. The console shows actual server acknowledgements and no credentials. Cadence remains the supported three-second sender interval; source broker addresses, fabricated packet counts/checksums and unsupported packet-loss/man-down controls are omitted. Operational mode keeps simulated ingestion disabled.

Worker Detail uses the source identity card, navigation tabs and 5/4/3-column telemetry/environment/location frame. Its route ID selects the actual worker. Received readings, device/source/freshness, unavailable metrics, hybrid-location panel, administrative schematic, alerts and incident timeline remain connected. Unsupported diagnoses, baseline claims, refuge distances and mock worker-log notes are not asserted. History and incident links carry the worker ID; the incident register now initializes that filter from its route query.

Worker Management uses the source roster table, summary cards, filters and inspector proportions. Registration, profile updates, zones, searching, cursor paging, deactivation confirmation/reactivation and device-management links use the existing APIs. Extra zone configuration remains accessible in a disclosure. Private national IDs, medical notes, attendance and certification claims are not fabricated. An initialization race that could reset a newly opened profile while zone data loaded was corrected. Deactivation preserves recorded history; software account access remains separate from occupational worker records.

The batch passed the production build, 83 regression tests and the 30-test frontend suite. Operational reference browser checks cover all seventeen pages at 1440/1024/768/390 pixels, rule creation/evaluation, worker editing and confirmed deactivation/reactivation, account security and source layout comparisons. The populated-device pilot verifies worker/zone registration, device provisioning, accepted telemetry on Worker Detail, incidents, realtime updates and history. Full-image pixel equality is not claimed where live data and supported capabilities differ from fictional reference content.

The management editor now reads the protected `/api/manage/zones` configuration endpoint rather than the live telemetry zone list. This preserves registered assignments when demo telemetry intentionally omits those zones. A regression test checks that distinction and verifies anonymous/operator access restrictions. The deactivation confirmation performs the real backend operation; active device assignments must be removed first, and rejected changes remain visible as errors.

The final demo reference workflow also passed real Wi-Fi pairing, accepted simulated telemetry, persisted `SIMULATED_SOS` and a disconnected device state after safe stop. These operations use temporary local data only. All seventeen live routes passed screenshot/overflow checks at the four documented widths, and the four new pages matched the reference frame/font/background/spacing properties in `ui-reference-layout-check.json`. Live records and unsupported capabilities still make full-image pixel equality inappropriate to claim.

Final checkpoint for this batch: production build passed; all 84 regression tests passed across 22 files, including the new protected configuration-zone regression. Operational provisioning/incident workflows and the full seventeen-page demo reference workflow passed. No external deployment or physical hardware connection was performed.
