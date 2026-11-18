> Current implementation: [Milestones 6–9](MILESTONES_6_TO_9.md) extends this
> foundation with canonical incident UI, historical charts/reports, socket tickets,
> delta recovery and [Netlify/Railway/Neon preparation](DEPLOYMENT_NETLIFY_RAILWAY_NEON.md).
> Earlier counts/limitations below describe the foundation milestone.

# JWT, bcrypt and operational foundation

This extends the supervised prototype toward an operational pilot. It does not
certify the system, connect responders, verify a physical sensor, or deploy it.
The original demo remains the default for local development.

## Authentication changes

New passwords use the `bcrypt` package with cost 12. New passwords must have at
least 12 characters and at most 72 UTF-8 bytes. A multibyte character consumes
more than one byte. Inputs above the limit are rejected, not silently truncated:
see the [bcrypt maintainer documentation](https://github.com/kelektiv/node.bcrypt.js).
Existing scrypt hashes are verified using their full original password. Successful
login upgrades eligible hashes to bcrypt inside a transaction. A legacy password
longer than 72 bytes remains scrypt until its owner chooses a compatible new
password. No existing password is reset automatically.

Session cookies now contain signed JWTs using `jsonwebtoken`, fixed HS256,
issuer `dacos-auth`, audience `dacos-operations`, subject user ID, random jti,
role, issued-at and eight-hour expiration. Verification checks the signature,
algorithm, issuer, audience, expiration and required claims before consulting
PostgreSQL. See the [JWT library validation options](https://github.com/auth0/node-jsonwebtoken).
The database stores a hash of the jti, not the JWT. The user must still be active,
the subject and role must match the current database user, and the database
session must remain valid. Role changes, logout, password changes, credential
revocation and Socket.IO session checks retain their existing protections.
JWT payloads are signed, not encrypted; they contain no password or device token.
No JWT is returned to browser JavaScript or stored in localStorage.

Cookies remain HttpOnly, SameSite=Strict and Secure in production/HTTPS mode.
CSRF checks remain mandatory for human-session mutations. Device bearer tokens
stay independent. Old opaque session cookies require signing in again.

Set `DACOS_JWT_SECRET` to at least 48 bytes of cryptographically random material
in your private environment or secret manager. For example, generate a fresh key
locally using Node's `crypto.randomBytes(64).toString('base64url')`. Never commit,
log, or paste an actual production key into source code. Production startup
fails if a key is absent or too short. Development uses an ephemeral random key,
so development server restarts invalidate JWTs. Production instances must share
the configured key; replacing it invalidates existing JWTs. There is no refresh
cookie or sliding extension: an expired eight-hour session requires login.

Login throttling is now persisted atomically in PostgreSQL, surviving server
restarts and shared across instances. The current limit is ten attempts per
connection address per 15 minutes. Without proxy configuration, proxied users
share the proxy's address. `DACOS_TRUST_PROXY` may specify actual trusted proxy
addresses/CIDRs; never trust every address. Express derives req.ip only using
that explicit trust configuration. Pairing codes and device-rate state are still
single-process; multi-instance pairing/gateway distribution remains future work.

## Demo and operational modes

- `DACOS_MODE=demo`: existing fictional workers, map, simulation scenarios,
  Wi-Fi simulator, demo BLE and simulated SOS remain available.
- `DACOS_MODE=operational`: no fixture readings or fictional tags are generated.
  Only explicitly registered active workers and zones appear. Simulator packets
  and scenario changes are rejected. Missing measurements stay unavailable.
- Production defaults to operational unless explicitly configured otherwise.

Existing Worker and Zone records receive origin `legacy-demo` through an additive
migration. They are preserved, not silently promoted to operational site data.
New management registrations use origin `registered`. Register reviewed site
zones through Worker Management, then register actual pilot workers in those
zones. Creating a zone/worker is administrative configuration, not verification
of physical positioning. Existing legacy fixture profiles remain accessible in
management/demo mode. Register new IDs for the pilot rather than deleting them.

Operational mode replaces the fixture-heavy overview/directory/map/environment
screens with the dynamic hardware-monitoring screen. Worker Detail remains
available. No environmental or positioning readings are invented. Their actual
hardware ingestion formats still require a supported sensor/gateway extension.
The current hardware contract supports heart rate, SpO₂, temperature and battery.

## Rules, incidents and history

`/operations/incidents` provides:
- Manually reported incidents with an explicit simulation checkbox.
- Simulated SOS mirrored into the incident workflow while retaining its original
  append-only IncidentEvent record and simulation label.
- Acknowledge, assign, internally escalate and resolve actions with required
  notes and persistent event history. Resolved incidents cannot be modified.
- Paginated accepted telemetry history with original timestamps and provenance.
- ADMIN-authored hardware threshold rules. Rules start disabled, require a review
  note to enable, and never run on simulator packets. Review is an internal
  approval record; qualified mine personnel must validate actual thresholds.

Supported rule metrics match the existing hardware contract. A rule creates at
most one unresolved incident per rule/device. Repeated samples do not duplicate
that incident. After resolution, another matching sample may open a new incident.
Automatic clearing, multi-sample debounce, hysteresis and notification-provider
integration are not implemented; account for these before unattended operation.
Escalation records an internal state/event only; it never calls responders.
Rule evaluation, packet persistence and incident creation share a transaction.
Active workflow incidents enter the common snapshot and Worker Detail alerts.
Snapshot SOS/active-workflow lists are bounded to 250 records; history stays in
PostgreSQL. Historical REST pages use a limit up to 100 with nextCursor.

Relevant APIs (human authentication and existing roles/CSRF apply):
- `GET /api/history/telemetry?limit=25&cursor=...&deviceId=...`
- `GET /api/history/sos?limit=25&cursor=...&deviceId=...`
- `GET/POST /api/operations/incidents`
- `POST /api/operations/incidents/:id/events`
- `GET/POST /api/operations/rules` (creation ADMIN-only)
- `POST /api/operations/rules/:id/review` (ADMIN-only)

## Persistent gateway relay

`npm run gateway` starts a Node relay accepting one complete common-contract
JSON packet per stdin line. It is a transport relay, not a BLE scanner or sensor
driver. A programmable board/native GATT adapter must produce the documented
packets; no unknown smartwatch format is guessed.

Required: `DACOS_DEVICE_TOKEN`. Optional: `DACOS_INGEST_URL` (defaults to laptop
loopback), `DACOS_GATEWAY_SPOOL` (defaults to `.data/gateway-spool`). Use one
process, credential and spool directory per device. For trusted private HTTPS,
configure a valid CA using your runtime's certificate trust facilities such as
NODE_EXTRA_CA_CERTS; do not disable TLS certificate verification.

Validated packets are written to protected files, synced and atomically renamed
before input continues. The queue holds at most 1000 packets. Restarting the
relay reuses queued packets. Network failures, authorization failures and rate
limits retain packets and use bounded exponential retry delays. A recognized
accepted/duplicate acknowledgement removes a packet. Explicit invalid, older or
oversized submissions are preserved in a protected dead-letter file. Tokens are
not written to queue files or logs. Ctrl+C stops the relay; queued packets remain.

The live endpoint still rejects acquisition timestamps older than two minutes.
Long-outage samples are quarantined, never restamped as new. A historical upload
contract and physical power-loss/endurance testing remain necessary for a fully
unattended gateway. No actual radio/peripheral has been tested by this relay.

## Production serving and container preparation

The production Express server serves `frontend/dist` and SPA routes; Vite is not
used as the production server. Security headers include a production CSP,
nosniff, frame restrictions and same-origin referrer policy. The API and socket
security remain in force. Build first with `npm run build`.

`Dockerfile` and `deploy/compose.yaml` prepare a non-root application container,
PostgreSQL volume, migration job, readiness checks and restart policy. The
application's port is mapped only to host `127.0.0.1`; PostgreSQL has no published
port. Binding to 0.0.0.0 occurs only inside the explicitly configured container.
Private environment inputs are required: POSTGRES_PASSWORD, DATABASE_URL and
DACOS_JWT_SECRET. In the compose network, DATABASE_URL must use hostname `db` and
URL-encoded credentials. `.dockerignore` excludes secrets, local databases,
certificate keys and development runtime state.

A trusted HTTPS reverse proxy preserving Host/Origin and websocket upgrades is
still required before real users can log into production; Secure cookies will
not work through ordinary remote HTTP. Configure only that proxy as trusted.
No container, proxy, firewall rule or public endpoint was started automatically.
The container recipe and CI workflow need a build in your actual deployment
platform. CI checks install, tests and frontend build; it does not deploy.

## Backups and restore verification

Use a PostgreSQL client version compatible with your server (pg_dump must not be
older than the server major version). Set DATABASE_URL privately and run
`npm run backup`. It writes a protected custom-format dump and SHA-256 metadata
under `.data/backups`. Database passwords are passed in the process environment,
not command-line arguments or logs. Remote backup connections default to
sslmode=verify-full; provide the trusted CA configuration required by your server.

To verify a trusted backup, create a separate **empty** database with a name
ending `_restore_check`, set RESTORE_DATABASE_URL, then run:

```bash
npm run verify:restore -- /absolute/path/to/trusted-backup.dump
```

The script verifies the checksum, rejects an existing populated target or the
source database, restores in one transaction without dropping records, and prints
restored entity counts. It leaves the verification database for inspection.
Backups include sensitive health/authentication records; keep them protected.
Scheduling, encryption at rest, off-host storage, retention and recovery-time
objectives require your deployment configuration. No existing database is
restored or deleted automatically.

## Migrations and verification

Additive migrations:
- `202611160003_operations`: provenance origin, operational incidents/events,
  telemetry history index.
- `202611160004_alert_rules`: disabled/reviewed rules and deduplication constraint.
- `202611160005_login_throttle`: shared persistent login throttle.

Run `npm run db:generate`, apply migrations, and then `npm test` and `npm run build`.
Tests include bcrypt and legacy migration, JWT signature/claim/expiry rejection,
role restrictions, session/socket revocation, operational mode without fixtures,
incident transitions, rule deduplication, history pagination and network-failure
queue persistence. Existing simulator, pairing and frontend tests remain.

Hardware integration, approved site rules, surveyed positioning, environmental
sensor contracts, real notification delivery, multi-instance pairing/rate state,
large-load qualification and field/power-loss testing remain unverified or require
additional implementation. MFA and an email recovery provider are not included.
This work is an operational foundation, not proof that every production-readiness
item is complete.

### Verification in this workspace

The backend/frontend regression run passed 39 tests across 12 files, and the
frontend production build passed. The independent built-app browser check passed
login/logout, protected redirects, fixture-free operational monitoring, zone/
worker/device management, assignment, credential issuance and a test packet
appearing in Worker Detail at 1440/390/360-pixel layouts. This uses the dedicated
`.data/pilot-check-postgres` test database and an isolated Chrome profile. Its
packets are synthetic test inputs, not evidence of a physical hardware connection.
Run `npm run build` then `npm run check:pilot` to repeat it with an installed Chrome.
The authenticated `/api/operations/status` endpoint exposes persistence health,
last snapshot time, uptime, source connection counts and open-incident count;
the incident screen refreshes these values every five seconds.

Docker is not installed in this workspace, so the image/compose recipe has not
been executed. The installed pg_dump/pg_restore are version 16 while the embedded
PostgreSQL test database is version 18. Restore execution therefore remains
unverified until matching client tools (or the database container's tools) are
available; no incompatible dump or restore was attempted. Backup script syntax
and safety checks were reviewed, but that is not a successful recovery drill.

Manual pilot sequence:
1. Follow the existing admin bootstrap instructions. Set a private persistent
   DACOS_JWT_SECRET before running multiple instances or production mode.
2. For normal demos use `npm run dev`. For a fixture-free local pilot set
   DACOS_MODE=operational before running that command. The two modes share the
   database but retain explicit worker/zone/readings provenance.
3. Register a reviewed zone and a worker in it. Register/assign a hardware device
   and securely reprovision its credential. No readings appear until submitted.
4. Create a hardware rule as ADMIN. It starts disabled. Have qualified personnel
   review any actual site rule before entering a review note and enabling it.
5. Send a supported real device packet; inspect Worker Detail and the incident
   workflow. Acknowledge/assign/resolve only with an explanatory note.
6. Use the stdin relay with a real, documented sensor/native gateway adapter if
   buffering is needed. Test disconnection and recovery on that physical setup.
7. Build/deploy only after configuring TLS, secrets, backup storage, matching
   PostgreSQL clients and an actual restore drill. No public deployment was made.

Physical device integration remains intentionally pending until hardware is available, as requested.

CI action versions were checked against the official [checkout release](https://github.com/actions/checkout/releases/tag/v7.0.1) and [setup-node release](https://github.com/actions/setup-node/releases/tag/v7.1.0). The PostgreSQL 18 volume layout follows the [official image documentation](https://hub.docker.com/_/postgres). These source checks do not replace executing the deployment recipe.
