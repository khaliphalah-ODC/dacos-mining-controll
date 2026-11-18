DACOS — Codex Project Reference
Project: Digital Advanced Connected Operations & Safety (DACOS)
Scope: Module C — Mine Control Room Web Dashboard
Status: Prototype; hardware under development
Version: 1.0
Primary implementation: Vue 3 + TypeScript frontend, Node.js + Express backend, PostgreSQL database
Codex: Read this document before planning or changing code. Treat it as the project reference, not as authorization to implement everything at once. Inspect the existing repository first. Ask for clarification where the repository, design reference, or device specifications differ from this document.

1. Product mission
Build a responsive mine safety control room web dashboard for supervisors, safety officers, rescue teams, and administrators. Module C provides:
1. Live worker information and device status.
2. Underground location tracking and mine-zone visualization.
3. Health and environmental readings.
4. Emergency alerts, acknowledgements, and incident management.
5. Smart evacuation guidance and worker accountability.
The future DACOS ecosystem includes wearable watches, environmental sensors, gateways, a Flutter mobile app, and potentially AI services. Only Module C is in scope now.
2. Current development constraint: simulator first
The physical watch and sensors are not ready. Build an explicit simulator layer that emits fictional worker, device, location, health, environmental, and incident data. The system must be structured so a real telemetry gateway can replace the simulator later.

Non-negotiable safety rules:
- Display a persistent SIMULATION MODE — NOT LIVE SAFETY DATA indicator on every operational screen.
- Never silently substitute simulated readings when a real device disconnects.
- Distinguish simulated, live, stale, offline, and unavailable data states.
- Show data timestamps, source, and connectivity status.
- Do not describe simulated evacuation routes as safe, verified, or operational.
- Emergency controls in prototype mode must not contact real responders or trigger real-world evacuation actions.
- Sensor alert thresholds are configurable examples only until mine-specific engineering and regulatory validation.
- No safety-critical operation may rely on this prototype without appropriate engineering review, testing, and operational authorization.
3. Approved visual identity — preserve the Stitch design
Use the user's existing DACOS ECOSYSTEM — Intel Mine Safety / Control Room Google Stitch screenshots and exported design as the visual source of truth. Do not replace it with a generic SaaS dashboard.
Preserve
- Dark industrial / command-center appearance.
- DACOS branding, logo position, sidebar information architecture, top status bar.
- Dark navy/slate surfaces, cyan/blue operational accents, green safe, amber warning, red critical.
- KPI row, underground mine map, right-side emergency incident panel, atmospheric array, worker vitals panel, communication and system status areas.
- Existing domain-specific navigation labels and terminology when present in the actual design.
Improve without redesigning
- Readability: Inter for UI; JetBrains Mono for telemetry, IDs, and timestamps.
- Suggested font sizes: page headings 22–26px, sections 16–18px, body 14–15px, navigation 13–14px, metadata at least 12px, KPI values 24–30px.
- Consistent 8px spacing scale; balanced card padding and aligned values.
- Better contrast, focus states, hover states, keyboard access, and visible text labels for safety status.
- Responsive layouts without hiding critical alerts.
- Clear map legend, location freshness, tooltips, zoom controls, and readable zone labels.
- Emergency actions separated by priority, with confirmation for consequential actions.
Suggested design tokens (adjust to match the actual Stitch export)
Token	Value
Background	#0B1220
Sidebar	#111C2E
Card	#172338
Cyan	#00C2FF
Blue	#2563EB
Safe	#22C55E
Warning	#F59E0B
Critical	#EF4444


Do not use these approximate tokens to override more accurate colors from the approved design.
4. Pages and modules
4.1 Overview
- Registered workers, active shift, safe workers, workers needing attention, emergencies, wearables, gas sensors, underground workers.
- Dominant underground mine map with worker, gas node, evacuation, and refuge layers.
- Active incident panel with affected worker, severity, zone, timestamps, incident log, and response status.
- Atmospheric array with gas and environmental readings.
- Shift health aggregate, fall detection, device battery, and system status.
4.2 Live Workers
Search/filter worker directory, ID, name, role, assigned zone, shift, device, connectivity, last reading, last location, health status, worker detail view.
4.3 Mine Map
Use a fictional mine floor plan for the prototype; show tunnels, zones, workers, sensors, hazard overlays, refuge areas, exits, route overlays, and last-known-location metadata. Do not pretend outdoor GPS is sufficient for underground positioning. Actual location technology and accuracy are hardware dependencies.
4.4 Health Monitoring
Heart rate, body temperature, SpO₂, respiration, stress, fatigue, hydration, fall detection, time-series charts, sensor availability, data freshness. Show unavailable when the required sensor or validated algorithm does not exist.
4.5 Environmental Monitoring
Methane (CH₄), carbon monoxide (CO), hydrogen sulfide (H₂S), oxygen (O₂), dust, humidity, smoke, water leakage, vibration, hazardous chemicals where sensor support exists. Display units, measurement source, last reading, and trend.
4.6 Emergency Center
SOS, environmental hazard events, fall alerts, incident queue, severity, affected worker, location confidence, timeline, acknowledgement, assignment, escalation, and audit trail. Demonstration actions must be labeled as such.
4.7 Evacuation Management
Fictional evacuation scenario, approved route representation, hazard areas, exits, refuge/assembly areas, personnel accountability, rescue assignments. Never auto-declare a route safe from unverified readings or simulated geometry.
4.8 Alerts & Events
Filters by severity, zone, type, status, worker, date; acknowledgement and event history.
4.9 Reports & Logs
Historical trends, incidents, device connectivity, audit trail; CSV/PDF exports in a later phase.
4.10 Devices & Nodes
Device ID, assigned worker, type, connectivity, firmware metadata when known, battery, last seen, sensor capabilities.
4.11 Settings & Thresholds
Profile, mine sites/zones, roles, alert rules, simulation controls, user permissions, audit settings. Only authorized roles may modify thresholds or incident workflows.
5. Responsive behavior
- Large control-room display (1920px+): full sidebar, KPI row, dominant map, right incident panel, telemetry below.
- Laptop (1366–1440px): preserve hierarchy; readable typography; wrap KPIs or use appropriate grid; avoid horizontal page overflow.
- Tablet (768–1024px): collapsible sidebar; map and incident panels adapt to width.
- Mobile (<768px): navigation drawer, compact header, one/two-column KPIs, map with touch controls, critical alerts prominently visible, stacked panels.
- Do not shrink safety-critical text to fit a fixed desktop composition.
6. Preferred technical stack
Layer	Choice
Frontend	Vue 3, TypeScript, Vite
UI	Tailwind CSS
Routing	Vue Router
State	Pinia
Charts	Apache ECharts
Maps	Leaflet with a custom fictional mine plan / appropriate coordinate system
Backend	Node.js, Express, TypeScript
Validation	Zod
Database	PostgreSQL
ORM	Prisma (use a version compatible with the existing project)
Realtime	Socket.IO
Device integration later	MQTT / gateway adapter, protocol TBD
Testing	Vitest; API integration tests; browser tests when practical
Hosting later	Frontend Netlify; API Railway; PostgreSQL Neon or other suitable host


Do not add packages or switch frameworks without explaining why. Check installed Node, npm, package versions, and repository state before making changes.
7. Suggested repository structure
DACOS/
├── frontend/
│   └── src/
│       ├── assets/
│       ├── components/
│       │   ├── layout/
│       │   ├── dashboard/
│       │   ├── telemetry/
│       │   ├── map/
│       │   └── emergency/
│       ├── views/
│       ├── stores/
│       ├── services/
│       ├── types/
│       ├── router/
│       └── styles/
├── backend/
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── simulation/
│       ├── realtime/
│       ├── repositories/
│       ├── middleware/
│       └── config/
├── docs/
└── DACOS_CODEX_REFERENCE.md
Adapt to an existing repository; do not destructively restructure working code.
8. Domain model (initial proposal)
- User: account, role, permissions.
- Worker: worker ID, name, assigned zone, shift, status.
- MineSite / MineZone: site, zone, fictional map geometry or future surveyed geometry.
- Device: device ID, type, assignment, battery, connectivity, last seen.
- HealthReading: worker/device, timestamp, metrics, source, quality state.
- EnvironmentalReading: device/zone, timestamp, metric, value, unit, source, quality state.
- LocationReading: worker/device, timestamp, map coordinate, accuracy/confidence, source.
- Alert: type, severity, triggering reading, status, timestamps.
- Incident: linked alerts, worker, zone, responder assignment, timeline, resolution.
- AuditEvent: actor, action, target, timestamp.
Do not create all tables immediately. Start with the minimum entities needed for the current milestone. Avoid storing sensitive worker health data unnecessarily; apply access controls and retention rules.
9. API and real-time conventions (proposed)
REST routes (finalize incrementally):
GET /api/health
GET /api/dashboard/summary
GET /api/workers
GET /api/workers/:id
GET /api/zones
GET /api/readings/environmental
GET /api/readings/health
GET /api/alerts
GET /api/incidents
Future authorized mutation routes may handle incident acknowledgement, assignments, and configuration changes.

Socket.IO event examples:
worker:status
worker:location
health:reading
environment:reading
alert:created
incident:updated
device:status
Use a consistent typed payload with id, timestamp, source, simulation, quality, and related worker/device/zone IDs as applicable. Validate all external input. Design for reconnection, duplicate events, out-of-order readings, and stale data.
10. Simulation contract
- Seed a small set of fictional workers, zones, devices, and readings.
- Support normal, warning, critical, disconnected, and stale scenarios.
- Simulated values must use plausible units and internally consistent timestamps, but must not be described as medically or industrially validated.
- Allow deterministic test fixtures (seeded randomness or fixed scenarios) for automated testing.
- Keep simulation generation on the backend once the backend exists; frontend mock fixtures are acceptable only for the first UI milestone.
- Clearly label generated alerts and incident workflows as demonstrations.
- Make the telemetry source replaceable through an adapter/interface, rather than coupling the UI directly to a random-data generator.
11. Authentication and security (later milestone)
- Role-based access for administrator, supervisor/safety officer, and rescue team; finalize permissions with stakeholders.
- Use secure sessions or JWT with HTTP-only cookies; enforce authorization on the backend, not only by hiding UI buttons.
- Validate inputs, rate-limit sensitive endpoints, use HTTPS in deployment, and keep secrets in environment variables.
- Log significant incident and configuration actions.
- Never commit credentials, production worker records, or private sensor data.
12. Development phases — one milestone at a time
Phase 1: Foundation and visual shell
1. Inspect repository and verify toolchain.
2. Initialize/verify Vue 3 + TypeScript + Tailwind frontend.
3. Recreate approved Stitch design shell: sidebar, header, responsive layout, design tokens.
4. Build Overview with static clearly simulated cards and panels.
5. Verify desktop and mobile layouts; run lint/build/tests.
Stop here for user review. Do not automatically implement the backend.
Phase 2: Data model and backend
Express app, basic API, initial PostgreSQL schema, validation, sample data, tests.
Phase 3: Telemetry simulator
Backend simulation adapter, timestamped readings, Socket.IO updates, stale/offline handling.
Phase 4: Monitoring pages
Workers, health, environment, map, charts, filters, detail panels.
Phase 5: Emergency workflows
Simulated SOS, incidents, acknowledgements, audit events, notifications.
Phase 6: Evacuation prototype
Fictional routes, responder assignments, accountability, safety disclaimers, human validation.
Phase 7: Hardening and hardware integration planning
Role-based access, security testing, performance, offline/reconnect behavior, telemetry protocol contracts, deployment.
13. Codex working rules
1. Read this file and inspect the existing code before changes.
2. Ask for the actual Stitch export or screenshots if they are not present in the repo; do not claim pixel-perfect fidelity without them.
3. State the goal of the current small task and the files likely to change.
4. Implement one feature at a time; avoid giant changes or broad refactors.
5. Explain important code and architectural decisions in beginner-friendly language, including why the feature works.
6. Reuse existing components, code conventions, and packages where possible.
7. Avoid unnecessary installations, dependencies, long-running commands, or repeated test suites.
8. Do not modify unrelated files or overwrite user work.
9. After changes, run the smallest relevant validation and report results truthfully.
10. Report changed files, how to run the feature, and the next suggested step.
11. Keep sample data explicitly fictional and never confuse it with actual mine telemetry.
12. Do not implement unverified emergency control, automated safety decisions, or hardware claims as production-ready.
13. Wait for user approval before advancing to the next phase.
14. Acceptance criteria for the first UI milestone
- Dashboard opens locally in a browser.
- Visual identity closely matches the supplied Stitch design.
- Sidebar and top bar are responsive.
- Overview contains KPI cards, mine-map placeholder/visual, emergency panel, atmospheric readings, and health vitals.
- All displayed demo data is explicitly labeled simulated.
- No dead controls that falsely suggest real actions: use clearly disabled or demonstrative controls until implemented.
- No overlapping text, unreadable microtype, or horizontal overflow at common laptop/mobile widths.
- App builds successfully; relevant checks pass or failures are explained.
15. Suggested first Codex request
Read DACOS_CODEX_REFERENCE.md and inspect the current repository. We are starting Phase 1 only. First report the existing frontend setup and propose a short plan to recreate the approved DACOS Stitch design. Do not install dependencies or edit files yet. Identify which Stitch screenshots/export assets you need, and explain the first small implementation step. Wait for my approval before coding.

Document ownership: DACOS project team. Update this reference when project decisions are confirmed; do not silently rewrite requirements based on guesses.