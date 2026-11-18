# DACOS Mine Control

Vue 3, Tailwind CSS, and JavaScript frontend; Express, PostgreSQL/Prisma, and
Socket.IO backend. Implements phases 1–3 of `dacos.md`, plus extraction of the
three additional UI exports explicitly requested by the project owner.
JavaScript is used instead of the reference document's TypeScript preference.

## Organization and full explanation

- `frontend/`: Vue screens, components, state, styles, assets, visual references and browser checks.
- `backend/`: Express API, simulator, realtime events, PostgreSQL persistence, migrations and server tests.
- `shared/`: runtime telemetry contracts used by both workspaces.
- `scripts/`: root launcher and local npm wrapper.

Read [the complete project guide](docs/PROJECT_GUIDE.md) for the architecture,
data flow, every application/configuration file, main functions, database models,
Vue syntax, test behavior and generated-file explanations. One root lockfile
manages all three npm workspaces; install dependencies from the root.

## Start the complete application

Use the installed Node.js 22 runtime through the project wrapper:

```sh
./scripts/npm run dev
```

This starts a project-local **PostgreSQL server** on `127.0.0.1:55432`, applies
tracked migrations, seeds fictional data, starts the API on `127.0.0.1:3001`,
and serves Vue at **http://127.0.0.1:5173**. PostgreSQL data and a generated local
password are stored under ignored `.data/`. No system PostgreSQL, Docker, or
sudo setup is required. Ctrl+C stops the owned processes. If 5173 is occupied:

```sh
FRONTEND_PORT=5174 ./scripts/npm run dev
```

With Node.js 22.16+ installed globally, standard `npm` commands also work.
The system's Node.js 18 is too old for this toolchain; use `./scripts/npm`.

## Screens

- `/`: original Overview with simulator-backed KPI/primary readings.
- `/workers`: `mine-controll/code.html` worker directory and inspection UI.
- `/map`: `map/code.html` SVG mine geometry and inspection dock.
- `/environmental`: `eviro/code.html` atmospheric matrix and SCADA design.

The original exports remain in `frontend/design-reference/`.
Their layout, classes, SVG geometry, and artwork are retained. Environmental
colors are namespaced so that its different palette does not alter other views.
The original logo URL returns HTTP 403; it is retained rather than replaced.
See [the extraction notes](docs/ui-extraction.md) for fidelity boundaries.

## Simulator

The **Demo scenario** selector below each screen supports `normal`, `warning`,
`critical`, `disconnected`, and `stale`. All workers, coordinates, readings,
alerts, and incidents are fictional. Primary readings update every two seconds.
There are 8 workers, 4 zones, 12 devices, and 104 bounded current readings.
Respiration/fatigue are explicitly unavailable. Secondary diagram annotations,
charts, and hardware labels remain static design fixtures, identified by the
status strip. Emergency, SCADA, voice, and dispatch actions are disabled.

The backend generates telemetry through `SimulationAdapter`. Frontend code
consumes validated snapshots; it does not generate substitute readings.
Offline readings retain their last timestamp in the database and render as
unavailable values. Stale readings keep their last values with a stale state.
Socket loss immediately marks the UI offline; missing updates become stale.
Snapshots include session IDs and sequences to reject duplicate/out-of-order
packets. Reconnect delivers a complete authoritative snapshot.

## External PostgreSQL (optional)

Copy `.env.example` to `.env` and set `DATABASE_URL` to an existing development
database. `npm run dev` then uses that database instead of the local cluster.
It applies the DACOS schema and writes fictional seed/current data, so use a
**dedicated database**, not a production database. Do not commit `.env`.

```sh
./scripts/npm run db:generate
./scripts/npm run db:migrate
./scripts/npm run dev:api
./scripts/npm run dev:frontend
```

The separate commands require `DATABASE_URL` (`dev:api` loads `.env`).
`SIMULATION_CONTROLS=false` disables scenario changes. Ports, seed, and tick
interval can be set with `.env` as shown in `.env.example`.

## Checks and production build

```sh
./scripts/npm test
./scripts/npm run build
```

`test:frontend` and `test:backend` run each side separately.
Tests cover deterministic simulation, quality states, unavailable capabilities,
packet ordering, failed persistence, PostgreSQL migrations/storage, REST
validation, origin rejection, Socket.IO events, and reconnection. Integration
tests use a separate local cluster on port 55433 and `.data/test-postgres`;
they never reset the development database. Local sockets must be permitted.

The frontend production build is in `frontend/dist/`. A deployment must proxy `/api`
and `/socket.io` to the API; `vite preview` alone serves the frontend only.
`./scripts/npm run check:browser` checks all routes and widths when the app is
running and Chrome exposes a local debugging endpoint at port 9223. Set
`BASE_URL` if the app uses another port.

## Project layout

- `frontend/src/views/`: exported Vue screens; shared layout remains under `frontend/src/components/`.
- `frontend/src/stores/telemetry.js`: shared Pinia state, quality/freshness and connection lifecycle.
- `frontend/src/services/telemetry.js`: snapshot validation and ordering rules.
- `backend/prisma/`: PostgreSQL schema and initial migration.
- `backend/src/`: Express routes, persistence, simulator adapter, Socket.IO service.
- `backend/tests/`: unit and real PostgreSQL/API/realtime tests.
- `scripts/dev.mjs`, `backend/scripts/database.mjs`: local app/database lifecycle.

This milestone has no user authentication, production authorization, real device
integration, verified evacuation routing, or real emergency side effects.
Thresholds are fictional examples. Later emergency workflows and deployment
hardening remain separate phases.

## Hosted frontend preview

Preview Site: https://dacos-control-room-preview.khaliphalahb.chatgpt.site

The preview uses an explicit static build mode, with a frozen fictional snapshot
and no API or Socket.IO connection. It uses hash navigation for portable static
hosting; scenario changes remain disabled. The regular build retains the local
backend integration and never substitutes preview data on connection failure.

```sh
./scripts/npm run build:preview
```

`frontend/src/preview/snapshot.json` is the fixed preview fixture.
`.env.static-preview` enables it only for the `static-preview` Vite build mode.
The isolated `.preview-site/` staging folder contains frontend-only deployment
source and its Sites identity; local database files and backend source are excluded.

Device lab: [Wi-Fi phone testing, Worker Detail and BLE gateway](docs/DEVICE_CONNECTIVITY.md).

Authentication and management: [Security and management guide](docs/SECURITY_AND_MANAGEMENT.md).

[JWT, bcrypt and operational foundation](docs/PRODUCTION_FOUNDATION.md): operating modes, rules, relay queue, deployment and recovery.

Control room, incident lifecycle UI, charts, CSV reports and deployment readiness:
[Milestones 6–9](docs/MILESTONES_6_TO_9.md) and
[Netlify/Railway/Neon runbook](docs/DEPLOYMENT_NETLIFY_RAILWAY_NEON.md).
