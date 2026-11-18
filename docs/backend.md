# Phases 2 and 3

The API binds to loopback for local prototype development. Express validates
queries and scenario mutations with Zod. The service serializes simulation
updates, validates their complete payload, and commits them to PostgreSQL
before publishing them over Socket.IO or exposing the new API snapshot.
A failed write is not published and causes telemetry endpoints to return 503;
clients become stale when updates stop rather than generating replacements.

## Database

Prisma's tracked initial migration creates Zone, Worker, Device, Reading, Alert,
and Incident tables. The simulator seeds 9 fictional workers, 4 fictional
zones, 9 wearable tags, 4 environmental nodes, and 111 current readings.
Readings use stable device/metric keys and are upserted so that continuous
simulation does not grow an unbounded health history. Alerts are current demo state. Incident records are retained across scenario changes;
device simulated SOS uses separate append-only IncidentEvent records.
No production workers, credentials, or sensitive real health records are seeded.

## REST

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/health` | PostgreSQL connectivity and service status |
| GET | `/api/telemetry/snapshot` | Complete committed simulator snapshot |
| GET | `/api/dashboard/summary` | Counts derived from the same snapshot |
| GET | `/api/workers` | Optional `q`, `zoneId`, `status` filters |
| GET | `/api/workers/:id` | Fictional worker and current readings |
| GET | `/api/zones` | Fictional map coordinates/depths |
| GET | `/api/devices` | Sensor capability metadata |
| GET | `/api/readings/environmental` | Optional `zoneId` filter |
| GET | `/api/readings/health` | Optional `zoneId` filter |
| GET | `/api/alerts` | Current synthetic alerts |
| GET | `/api/incidents` | Current demonstration incidents |
| POST | `/api/simulation/scenario` | `{ "scenario": "normal" }`, or warning/critical/disconnected/stale |

Unknown query fields and invalid scenario bodies return 400; nonexistent
workers return 404. Scenario mutations reject unapproved browser origins and
can be disabled with `SIMULATION_CONTROLS=false`. This endpoint is a local
fixture control, not an authenticated emergency control. Production roles,
sessions, and deployment authorization remain outside these phases.

## Realtime contract

Socket.IO sends `telemetry:snapshot` on connection/reconnection and each tick.
It also emits `worker:status`, `worker:location`, `health:reading`,
`environment:reading`, `device:status`, `alert:created`, and `incident:updated`.
Reading events include `id`, `timestamp`, `source`, `simulation`, `quality`,
related worker/device/zone IDs, metric/unit/value, and sequence metadata.
Unsupported metrics use a null value and `unavailable` quality.

Complete snapshots carry a server-session `streamId` and monotonically
increasing `sequence`. Clients reject duplicate/older sequences and retired
sessions; a reconnect receives a complete current snapshot to repair missed
events. Transport loss marks readings offline immediately. Updates or reading
timestamps older than 6.5 seconds become stale. A stale/offline scenario keeps
last values and timestamps; no simulated data is substituted for missing data.

`SimulationAdapter` owns seeded randomness and scenario generation. The service
and UI do not contain random reading generation. A future gateway should
implement the adapter boundary with explicit live/source contracts and no
simulator fallback. The scenario adapter retains its fictional snapshot contract. Optional device session
fields carry authenticated Wi-Fi/BLE provenance separately; see [Device connectivity](DEVICE_CONNECTIVITY.md).

Device routes, HTTPS phone setup, BLE limitations and the packet contract are documented
in [DEVICE_CONNECTIVITY.md](DEVICE_CONNECTIVITY.md).

## Milestone 5 incident lifecycle

The canonical incident states, four-level severity, operator acknowledgement,
responder ownership, demonstration escalation, filtered/detail APIs and durable
SOS action deduplication are documented in
[MILESTONE_5_INCIDENT_API.md](MILESTONE_5_INCIDENT_API.md).
The legacy status/severity fields remain compatibility aliases. Dedicated incident
UI and realtime work is held for Milestone 6 confirmation.

## Milestones 6–9

Incident list/detail UI and compact authenticated events, persisted reading history,
CSV reports, control-room summaries, socket tickets, delta recovery and split-host
production policy are documented in [MILESTONES_6_TO_9.md](MILESTONES_6_TO_9.md).
Cloud configuration and approval gates: [DEPLOYMENT_NETLIFY_RAILWAY_NEON.md](DEPLOYMENT_NETLIFY_RAILWAY_NEON.md).
