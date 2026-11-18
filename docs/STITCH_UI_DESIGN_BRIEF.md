# DACOS — complete UI/UX brief for Stitch

## Project and design scope

Design a coherent responsive interface for DACOS (Digital Advanced Connected Operations & Safety), a mine-monitoring technology project developed in Liberia. Use the existing Vue application information architecture below. This is a supervised demonstration prototype, not a certified mine safety system. Physical hardware integration is pending. Do not imply deployment in real mines, verified positioning, diagnostic accuracy or emergency dispatch.

Create a public website and one authenticated application with three permission levels. Operator, Supervisor and Admin share components and pages; permissions change navigation visibility and available actions. Do not create three unrelated products. A worker profile is not a login account. A worker's occupation (miner, electrician, driller) is separate from an application access role.

Existing routes are identified below. Layouts, drawers, tabs and navigation groupings are design recommendations; they do not imply new backend capabilities. Use synthetic sample data explicitly labelled DEMO. Never add working-looking unsupported capabilities.

## Visual system

Public website: premium industrial technology presentation, white sections, deep navy #071B2E, teal #00B8A9, slate #64748B and light gray #F1F5F9. Use realistic industrial photography, large headlines, restrained gradients, generous spacing and clear prototype disclosures.

Authenticated workspace: calm dark navy background, slightly lighter surface cards, subtle borders, high-contrast text and teal actions. Use Inter or Manrope, 14–16px body text, 12–13px secondary metadata and tabular numerals. Provide clear headings and generous row spacing rather than tiny futuristic text. Use consistent line icons, 8px spacing increments, restrained 8–12px corner radii and minimal shadow. Reserve red for critical incidents and destructive operations, amber for caution/stale readings, and green for connection/activity indicators. Green connectivity does not mean a worker is medically safe.

All statuses need text or icons as well as color. WCAG AA contrast, visible keyboard focus, labelled controls, accessible dialogs and reduced-motion alternatives. Avoid flashing or continuous alarm animations.

## Shared application shell — recommended consolidation

Desktop: approximately 240px left navigation, 64–72px header and flexible main content. Header includes page title/breadcrumb, demonstration/operational workspace label, realtime connection status, last-update time and user/role menu. Do not invent site selectors unless clearly shown as future scope. Mobile uses a compact top bar with an accessible navigation drawer.

Navigation groups:
- Monitoring: Overview, Control Room, Live Workers, Mine Map, Environmental.
- Response: Incidents.
- Analysis: History & Reports.
- Management (Supervisor/Admin): Workers, Devices, Rules.
- Device Lab (Supervisor/Admin): Wi-Fi Simulator, BLE Gateway.
- Administration (Admin): Accounts & Audit.
- Account: My Account, Sign Out, Public Website.

Currently some pages use a dashboard sidebar while others use an account/navigation bar. The redesign should unify these into the shell above. Do not reproduce duplicate sidebar entries such as Emergency Center and Alerts & Events pointing to the same incident list. Existing disabled Evacuation/Musters navigation is future scope, not a functioning page. Remove fixed example mine names and hardcoded alert counts from the design.

## Access and role views

Operator: monitor data; browse workers, map, environment, incidents and history; acknowledge incidents; add notes; start/resolve incidents assigned to their account; manage their own password.

Supervisor: Operator capabilities plus worker and device administration, pairing and credential workflows, incident creation/assignment/escalation/closure. Can view/evaluate demonstration rules but cannot author or enable them.

Admin: Supervisor capabilities plus create/edit user accounts, assign roles, disable/reactivate users, reset other users' passwords, view audit logs and manage protected rules.

Do not show a role picker at login: the server determines permissions. Hide inaccessible navigation. For incident actions, show only actions allowed by role, ownership and lifecycle. User interfaces complement backend authorization; they do not replace it.

## Page 1 — public landing website

Route: /welcome. Public, no account required. One scrolling page with a sticky transparent-to-solid header, DACOS logo, Home/About/Services/Contact anchors and a separate Control Room Login CTA to /login. Team is a content section, not a main navigation item.

Hero: realistic underground-mining photograph with dark overlay, headline “Smarter Mining. Safer Workers.”, concise introduction, Explore DACOS and Control Room Login buttons. Three highlights: Connected Wearable Technology, Environmental Intelligence, Emergency Awareness.

About: industrial/engineering image and mission introduction; Our Mission, Our Vision and Our Innovation cards.

Services: six cards for Worker Health Monitoring, Environmental Monitoring, Emergency SOS, Smart Device Connectivity, Intelligent Control Room and Worker Location Awareness. Label planned, simulated and prototype capabilities honestly.

Team: four editable portrait/name/role/biography placeholders. Never invent actual team members.

Contact: partnership invitation, editable email/phone/location placeholders and form fields Full Name, Email Address, Subject, Message. Current form does not send/store messages; clearly display this before submission and in feedback. Social links remain placeholders until real URLs exist.

Footer: logo, description, four anchor links, contact placeholders, copyright and prototype context.

## Page 2 — login

Route: /login. Restrained branded panel with email, password, show/hide password design, Sign In, submitting state and inline generic error. Explain that access is administrator-managed. Include Back to DACOS. Do not add self-registration or a functioning email password-recovery flow: neither currently exists. Recovery currently uses an authorized local reset command. Recommend text “Contact your administrator for access or password recovery.” Never expose device tokens or technical authentication details here.

## Page 3 — monitoring overview

Route: /. Authenticated landing screen, all roles. Answer: what needs attention now?

Show workspace/source notice, realtime state, summary cards for recorded workers, device connectivity and active incidents, a compact fictional mine schematic, recent incidents and worker health/environment summaries. Use actual available aggregates; do not invent safety scores, uptime percentages or prediction confidence. Link cards to workers, control room and incident detail. In operational mode without incoming telemetry, show genuine empty/unavailable states instead of demonstration fixtures.

Distinguish this quick summary from the detailed Control Room screen.

## Page 4 — control room

Route: /control-room. All roles. Detailed monitoring workspace for shift staff.

Top filter bar: worker, zone, connection state and latest-reading date/time range. Summary cards followed by dense but readable worker cards/table: worker name/ID, occupation, zone, assigned device, source, last-seen, connection, supported measurements with units/quality, and current alerts. Add links to Worker Detail and filtered History. Include zone environmental readings. Keep realtime disconnection visible; retained values must say last known. No measurements means Unavailable, never a generated normal value.

## Page 5 — live workers directory

Route: /workers. All roles. Searchable monitoring directory, preferably a table with responsive cards. Show name, ID, occupation, shift, zone, assigned device, connectivity, last-seen, available health values and provenance. Row opens Worker Detail. Design filtering/search affordances around real supported data; any new filter needs implementation. Administrative create/edit controls belong in Worker Management, not this monitoring list.

## Page 6 — worker detail

Route: /workers/:id. All roles. Identity header: name, worker ID, occupation, shift, zone and provenance badge. Recommended tabs or clearly separated sections:
- Summary: connection, last received, battery and assigned device.
- Health: supported heart rate, temperature, SpO2 and other received metrics. Unsupported fields display Unavailable. Do not imply fatigue or respiration has validated physical support.
- Environment: measurements for the worker's zone, with timestamp/source/quality.
- Location: last-known simulated location on a fictional schematic; never call it verified GPS.
- Incidents: current alerts and incident timeline.

Show source and freshness beside measurements, links to history and authorized management actions. Missing worker and no telemetry states must be designed.

## Page 7 — mine map

Route: /map. All roles. Large fictional schematic with zones, tunnels, worker markers, selected-worker drawer and clear legend. Distinguish simulated locations and last-known points. Provide zoom/reset controls where implemented or mark them as proposed interactions. Empty operational data must not fill the map with fictional workers. Keep permanent “Fictional mine schematic / simulated positioning” labelling. No evacuation routing, guaranteed exits, geographic survey accuracy or physical tracking claims.

## Page 8 — environmental monitoring

Route: /environmental. All roles. Zone-oriented layout, supported metric cards with units, timestamps, quality and provenance, plus links to environmental history. Gases/oxygen may appear as simulated examples or planned unsupported fields, not verified sensor readings. Show missing data explicitly. Separate threshold exceedance from absent/disconnected sensors. Do not invent a validated multi-gas sensor installation.

## Page 9 — incident list

Route: /operations/incidents. All roles. Search/filter by text, status, severity, worker ID, provenance and creation date range. List/table includes message, severity, lifecycle status, worker, responsible user, source and timestamps where returned. Selecting a row opens incident detail. Supervisor/Admin can open a Report Incident form: message, optional worker ID, severity and simulated designation as applicable. Operator creation is not currently authorized. Include no-results, loading, network failure and retry states.

## Page 10 — incident detail

Route: /operations/incidents/:id. All roles. Strong message/severity/status header, associated worker, provenance, creation/update timestamps and responsible user. Main content shows response context and append-only activity timeline; side panel shows permitted next action, required response note and assignee selector for managers.

Lifecycle: OPEN → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED.
- All active roles: acknowledge OPEN incidents; add notes while not CLOSED.
- Supervisor/Admin: assign, escalate and close; start/resolve through management authority.
- Assigned Operator: start/resolve their incident.
- CLOSED: read-only.

Show only valid transitions. Require useful notes for response actions. On concurrent update conflict, preserve the draft note and request refresh/review. Realtime updates should not steal focus or erase inputs. No notification delivery or responder dispatch claims.

## Page 11 — history and reports

Route: /history. All roles. Filter by category, metric, worker ID, zone ID, device ID, source, quality and date/time range. Provide recorded-sample chart, sample table, result count and existing CSV export actions. Charts need axis labels/units, timestamps, source legend and honest gaps for missing readings. Never interpolate missing data as a normal state or mix sources invisibly. Separate historical time ranges from live status. No scheduled email reports, PDF designer or predictive analytics unless explicitly marked future scope.

## Page 12 — worker management

Route: /manage/workers. Supervisor/Admin. Searchable personnel inventory with Register Worker CTA. Use a form drawer or dedicated panel for worker ID, name, occupation, shift and zone. Row actions: edit, deactivate/reactivate and open monitoring detail. Show device assignment context when available. Deactivation is controlled and preserves history; do not design permanent deletion. Confirm consequential actions and show validation/conflict feedback. Clearly distinguish occupational role from application access role.

## Page 13 — device management

Route: /manage/devices. Supervisor/Admin. Inventory table: device ID, model, serial number, firmware, transport, provenance, battery (last known), status, last-seen and assigned worker. Search by ID/model/serial/worker. Register/Edit device panel and selected-device detail drawer.

Detail sections: metadata; current assignment; assignment history; provisioning/credentials. Actions: assign/unassign worker, rotate credential, revoke credential, reprovision revoked device. Present pairing through the existing Device Lab workflow. Show assignment conflict errors. Never suggest inventory registration proves a physical device is connected.

Device states: Connected, Disconnected, Stale, Unpaired, Revoked. Display both transport and telemetry source; BLE transport does not itself prove hardware provenance. Derive labels from backend state, not arbitrary UI timers. A newly generated token appears once in a secure reveal panel, with copy/hide controls and secure-transfer guidance. Never put secrets into normal tables, activity feeds or mock sample screenshots.

## Page 14 — rules

Route: /operations/rules. Supervisor/Admin. Two explicit concepts: demonstration escalation rules and existing telemetry threshold rules.

Demo escalation rules list: name, elapsed minutes, target severity, enabled/disabled state and explicit evaluation feedback. Admin creates/enables/disables. Supervisor can view and trigger evaluation. Demo rules apply to simulated incidents and send no notifications. Protected hardware threshold authoring/approval controls are Admin-only; reflect actual rule fields and state from the implementation. Do not imply validated safety limits or automatic external escalation.

## Page 15 — Wi-Fi simulator

Route: /device-simulator. Supervisor/Admin. A clearly separate Device Lab screen, not normal operation. Guided steps: create pairing code on control-room computer; register simulator with code and fictional worker; send simulated readings. Controls for heart rate, temperature, SpO2, battery, sending cadence where supported, start/stop and simulated SOS. Show connection, acknowledgement/error and pairing feedback. Permanent SIMULATED TELEMETRY badge. SOS must explicitly say no emergency responders are contacted.

## Page 16 — BLE gateway

Route: /ble-gateway. Supervisor/Admin. Guided gateway pairing with code and fictional worker, browser compatibility notice, peripheral connection controls and supported standard heart-rate/demo characteristic options. Advanced UUID fields should be secondary to the main flow. Show browser permission, connecting, connected, disconnected, unsupported and error states. Do not depict a physical wearable as already connected. Separate Bluetooth link state from backend receipt state and measurement freshness. Demo characteristics stay labelled simulated.

## Page 17 — accounts and audit

Route: /manage/users. Admin only. Recommend two tabs within this existing route.

Accounts: name/email/role/active status; create account, edit role/name, disable/reactivate and reset password. Create form includes initial password; edit makes reset optional. Explain sessions are invalidated when appropriate. Prevent self-disable/self-demotion through clear disabled controls or omitted actions consistent with backend rules. Do not allow choosing privileges beyond the defined roles.

Audit: persistent timestamped authentication, account and device management activity, with actor/action/target/result details only where the API returns them. No edit/delete actions. Search/date/export are future enhancements unless implemented. Sensitive passwords/tokens never appear.

## Page 18 — my account

Route: /account. All roles. Name, email and role summary; password form with current/new password, visible requirements, confirmation design, validation, submitting/success/error states and Sign Out. Current password minimum is 12 characters and maximum 72 UTF-8 bytes for bcrypt. Do not offer self-service role editing. Password reset via administrator/local recovery is separate from changing one's password while signed in.

## Cross-page states and interaction rules

Design skeleton loading; no records; no matching filter results; unsupported sensor; no enrolled device; pending hardware integration; stale readings; disconnected browser realtime; revoked device; expired human session; permission denied; validation errors; mutation conflicts; save success and retryable failure.

Keep three concepts separate in every screen: device connection, measurement quality/freshness and incident/safety assessment. Show units, source, measurement timestamp and last-received time where relevant. Missing is not zero. Connected is not safe. Historical is not live. Simulation is not hardware.

Recommended mutation UX: field-level validation, concise error summary, busy state preventing duplicate submissions, success feedback and confirmations for revocation/deactivation/role changes. Preserve drafts on refresh/conflict. Realtime changes update content quietly and announce important changes accessibly without moving focus.

At 1440px use full sidebar, readable tables and multi-column panels. At 768px collapse navigation and use two-column cards when appropriate. At 390px use one column, full-screen drawers/dialogs, visible field labels and at least 44px touch targets. Tables may scroll within a labelled region or become cards; avoid page-level horizontal overflow. Large-screen monitoring can be dense; forms should remain comfortably readable.

## Generate in Stitch as consistent screen batches

1. Design system + shared application shell + Public Landing + Login.
2. Monitoring Overview + Control Room + Workers Directory + Worker Detail.
3. Fictional Mine Map + Environmental + History & Reports.
4. Incident List + Incident Detail in Operator and Supervisor states.
5. Worker Management + Device Management + Rules.
6. Wi-Fi Simulator + BLE Gateway + Accounts/Audit + My Account.

For each batch reuse the same visual tokens, navigation, role model and components. Generate desktop and mobile variants. Include at least one loading, empty, stale/offline and validation state. Use the route names above so designs map back to the existing application. Screens are connected by the user flows below, not isolated marketing mockups.

Primary flows:
- Visitor → Landing → Login → Overview → Control Room.
- Operator → Workers → Worker Detail → History or Incident Detail.
- Operator acknowledges incident → Supervisor assigns → assigned Operator starts/resolves → Supervisor reviews/closes.
- Supervisor registers worker → registers device → assigns worker → pairs through Device Lab → checks actual telemetry receipt.
- Admin creates staff accouABSENT
nt → assigns role → reviews audit history.
- Any authenticated user → My Account → change password / sign out.

Final design quality: professional, restrained, readable and operationally honest. No invented certification badges, fabricated client logos, real mine names, fake team identities, emergency dispatch buttons, automatic evacuation promises or claimed live sensor data when hardware is absent.
