> Current update: authentication now uses bcrypt and revocable JWT cookies;
> operational mode, incident workflows and deployment tooling are documented in
> [PRODUCTION_FOUNDATION.md](PRODUCTION_FOUNDATION.md). Earlier milestone test
> counts below are retained as historical results.

# Security and management: Phases 1 and 2

DACOS remains a supervised demonstration prototype. Simulated SOS is labelled
and does not contact emergency responders. These changes add human access
control and persistent management without replacing the simulator or stack.

## First administrator and startup

There are no default accounts or passwords. Stop an existing local dev instance
before running the bootstrap command, because it can start the project-local
PostgreSQL database itself. From the repository root in Bash:

```bash
./scripts/npm run db:generate
read -r -s -p 'New admin password (12–128 characters): ' DACOS_ADMIN_PASSWORD
export DACOS_ADMIN_PASSWORD
./scripts/npm run create:admin
unset DACOS_ADMIN_PASSWORD
./scripts/npm run dev
```

Enter an email and display name when prompted. The password is read from the
process environment, never echoed by the bootstrap script. Use a unique password;
clear that environment variable after use. Do not put it in tracked files.
If DATABASE_URL is configured, the bootstrap uses that database; otherwise it
starts and stops local PostgreSQL. It applies additive migrations first and
creates a new account; it never resets an existing password. For an already
running external database, leave that database running.

Open `http://localhost:5173/login`. For private-network HTTPS follow
[DEVICE_CONNECTIVITY.md](DEVICE_CONNECTIVITY.md). DEVICE_TLS_CERT enables secure
session cookies as well as Vite TLS. NODE_ENV=production also forces Secure
cookies; that mode requires a trusted HTTPS termination/proxy setup. No public
listener or production deployment is configured by this change.

## Roles and routes

| Capability | ADMIN | SUPERVISOR | OPERATOR |
| --- | --- | --- | --- |
| Monitoring screens and operational GET APIs | Yes | Yes | Yes |
| Own account/password/logout | Yes | Yes | Yes |
| Worker/device management | Yes | Yes | No |
| Device lab and scenario control | Yes | Yes | No |
| Account creation, access changes and resets | Yes | No | No |
| Audit-event viewer | Yes | No | No |

The account navigation above the existing application links to `/account`,
`/manage/workers`, `/manage/devices`, and ADMIN-only `/manage/users`.
Frontend guards help navigation; backend middleware enforces permissions.
The frozen static-preview build still displays its fictional offline fixture;
it does not grant access to protected server data or management APIs.

## Authentication and session behavior

New passwords use bcrypt cost 12, with a minimum of 12 characters and a maximum
of 72 UTF-8 bytes. Existing scrypt passwords remain valid and upgrade on eligible
successful logins. Login failures do not reveal whether an account exists.
Login throttling is persisted in PostgreSQL; see the foundation guide for proxy
configuration and the ten-attempt/15-minute limit.

A successful login creates a signed JWT with a random 256-bit jti. Only the
jti SHA-256 digest is stored in PostgreSQL. Signature, claims, expiration and
current database session/role are checked on every authenticated lookup. Browser JavaScript never receives the session token: the
cookie is HttpOnly, SameSite=Strict, Path=/, expires after eight hours, and Secure
with HTTPS/production configuration. Secure mode uses a __Host- cookie name.
Sessions have an absolute expiration; browsing does not extend them.

`GET /api/auth/session` returns a public user profile, expiration and a random
CSRF token. Mutations authenticated with a human session require
`X-CSRF-Token`. Login, logout, password and account changes also verify the
browser Origin against Host. Vite preserves Host for API proxying. A trusted
reverse proxy must preserve these semantics; request headers alone are not TLS
verification. SameSite cookies and CSRF tokens supplement server authorization.

Logout invalidates its session. Password changes invalidate every session for
that user. ADMIN role/access changes and password resets also invalidate sessions.
Self-service password changes require the current password. Administrators
cannot demote/disable themselves or reset their own password through account
administration; they use account settings for their password. The transaction
also prevents removing the final active administrator.

Socket.IO checks the cookie session before accepting a connection, validates a
supplied browser Origin, disconnects at expiration, and revalidates sessions every
two seconds. Logout/revocation therefore disconnects a socket within roughly
two seconds. Frontend auth state is then revalidated and protected data cleared.
Socket errors or database failures fail closed. Network loss alone does not
invent substitute measurements.

`/api/health` is a public local health check. Pairing-code redemption at
`/api/devices/register` uses the short-lived one-use pairing secret, and
`/api/device-telemetry` uses the device bearer token. These deliberate device
exceptions do not accept human cookies as device authorization. Other operational
REST endpoints require a human session. Pairing issuance/revocation requires
ADMIN/SUPERVISOR, CSRF, and the existing laptop-local request restrictions.

## Worker management

`GET/POST /api/manage/workers` lists/searches and registers profiles.
`PATCH /api/manage/workers/:id` edits name, role, shift, zone or active state.
Worker IDs are immutable. Zones must exist. Deactivation preserves records and
history, removes the worker from the operational snapshot, and is blocked while
an active device is assigned. Unassign the device first. Reactivation is supported.
New workers do not receive fictional health readings automatically.

Existing fixture profiles are inserted only when missing. Simulation ticks no
longer overwrite edited profiles or restore deactivated workers. The published
snapshot merges current database workers with simulated/device readings.
The map remains fictional; changing an assigned zone does not create a real
position or a new position measurement.

## Device inventory, assignments and credentials

The existing DeviceRegistration model now also holds model, optional unique
serial number and firmware version. Existing paired devices keep their IDs and
credentials. The older Device table describes fixture tags/environmental nodes;
those fixtures are not evidence of enrolled physical hardware. Management
inventory lists registered telemetry devices/gateways, not fictional nodes.
Battery is the latest supplied battery metric, never a fabricated inventory value.

- `GET/POST /api/manage/devices`: search/list or register inventory.
- `PATCH /api/manage/devices/:id`: edit model, serial and firmware metadata.
- `POST /api/manage/devices/:id/assignment`: `{ "workerId": "W-014" }`, or null
  to unassign. Assignment is checked in a serializable transaction and protected
  by a partial unique index on active worker assignments.
- `GET /api/manage/devices/:id/assignments`: persistent assignment history.
- `POST /api/manage/devices/:id/reprovision`: create a new credential for an
  inventory/revoked device, or replace a credential intentionally.
- `POST /api/manage/devices/:id/rotate`: replace an already provisioned credential.
- `POST /api/manage/devices/:id/revoke`: invalidate the credential immediately.

Unassignment/reassignment clears displayed measurement state so a new worker
cannot inherit the previous worker's readings. Historical packets remain intact.
Assignment identity and credential hash are checked again during the ingestion
transaction, preventing a packet accepted concurrently with revocation from
silently updating current state. Rotation retains sequence history and returns
`nextSequence`; firmware must continue from it. Secrets are shown once and must
be transferred securely; they are excluded from inventory, snapshots and audits.

Browser Wi-Fi/BLE pairing still creates a registration using its single-use code.
That registration appears in management inventory automatically; fill in its model,
serial and firmware metadata there. Inventory-first devices can instead be
assigned and reprovisioned through management, then configured in firmware/native
gateways with the returned bearer token. No firmware flasher is bundled.

| Status | Rule |
| --- | --- |
| Unpaired | Inventory record has never been provisioned |
| Revoked | Credential explicitly invalidated; packets rejected |
| Unavailable | No accepted packet has supplied a last-seen time |
| Connected | Last accepted contact at most 10 seconds ago, not explicitly stopped |
| Stale | Last accepted contact older than 10 and at most 30 seconds |
| Disconnected | Explicit stop, or contact older than 30 seconds |

Unavailable remains an additional truthful state for existing paired registrations
that have not transmitted yet. A status is not a worker safety assessment.
Worker Detail prefers an active assignment; if none remains, it can show the
last revoked registration explicitly. Once a registration exists, missing health
metrics are not filled with fixture values. Measurements show provenance and
timestamps; retained old values are not a claim of a current connection.

## Provenance and audit

Individual readings carry source (`dacos-simulator`, `simulator`, or `hardware`),
simulation boolean, quality, measurement timestamp and sequence. Fixture fields
keep their existing source. Device readings enter the common reading list, so
REST reading endpoints and Socket.IO events can carry hardware provenance too.
Mixed snapshots identify source `dacos-mixed` and simulation=false, indicating
that the packet is not simulation-only. Readings still need individual inspection:
false at the envelope level does not turn simulated environment/location into
hardware measurements. The dashboard remains a demonstration workspace.

AuditEvent persists login success/failure, logout, password changes, account
creation/access changes, worker edits, pairing issuance/redemption, inventory
changes, assignment changes and credential actions. Credentials and passwords
are not logged. The ADMIN viewer shows the latest 100 events; archival/export,
large-scale pagination and tamper-resistant external audit storage remain future
operational work. No application route deletes audit events.

## Milestone delivery and manual checks

1. **Database/auth:** migration `202611160001_security`, `security/auth.js`,
   `create-admin.mjs`, auth routes and integration tests. Verified 24 tests.
   Create an admin, login, check HttpOnly/SameSite in browser tools, change the
   password, and confirm the previous session is rejected.
2. **Frontend/security/provenance:** login/account screens, auth store, router,
   App navigation, realtime middleware, shared contracts and telemetry merge.
   Verified 25 tests and frontend build. Signed-out operational URLs redirect
   to login; anonymous sockets are rejected. OPERATOR cannot manage devices.
3. **Management APIs/database:** migration `202611160002_management`,
   `services/management.js`, repository/pairing/telemetry changes and integration
   tests. Verified 26 tests. Create a worker, edit it, change a demo scenario and
   confirm the edit survives; assign a device and verify deactivation is blocked.
4. **Management UI/integration:** worker/device/account management screens,
   route access helper, frontend tests, authenticated browser-check scripts and
   this guide. Run the final test/build commands below for current results.

Manual end-to-end checks:

1. As ADMIN, create SUPERVISOR and OPERATOR accounts. Sign into each in separate
   browser profiles and verify the role table above. ADMIN can inspect audits.
2. Register a worker and an inventory device. Assign the worker. Attempt another
   active assignment to that worker; expect a conflict. Unassign then deactivate
   the worker, and verify their history remains.
3. Reprovision an assigned device. Record the one-time token and nextSequence in
   your test gateway. Submit the documented packet. Rotate, verify the old token
   returns 401, and submit using the replacement and next sequence. Revoke and
   verify the replacement is also rejected.
4. Open the Wi-Fi lab as ADMIN/SUPERVISOR, generate a code, pair an available worker,
   transmit values and trigger **SIMULATED SOS**. Verify Worker Detail and audit
   events. Stop safely, then revoke. Phone login requires its own user session;
   phone HTTPS certificate trust is still a manual setup/hardware check.
5. For BLE, use a compatible peripheral with the documented service. Physical
   BLE reliability and phone background execution are not proven by mocked tests.

```bash
./scripts/npm test
./scripts/npm run build
```

Browser scripts require a local Chrome debugging instance and an authenticated
ADMIN/SUPERVISOR test session, or DACOS_TEST_EMAIL and DACOS_TEST_PASSWORD in the
process environment. They do not print those credentials. Never use production
accounts for browser automation. The static-preview fixture remains unchanged.

Remaining limits: single-process device-rate/pairing state; no email password-recovery
service or MFA; no physical ESP32/BLE verification; no public production deployment;
no certified alert rules or emergency dispatch. These limits do not grant bypasses
of protected operational APIs.

### Final verification and changed-file map

The final checks cover 31 tests across nine files: authentication/cookies/CSRF,
roles, protected sockets and logout disconnection, worker CRUD/deactivation,
assignment conflicts, credential changes, mixed/hardware provenance, existing
simulator/Wi-Fi/BLE behavior, frontend route decisions/rendering, and denial of
private development-server files. The frontend production build is also checked.
Physical BLE, ESP32 firmware and Android certificate trust are not verified by
these tests. Updated Chrome scripts are available but their full visual flows
were not rerun in this phase.

New files:
- `backend/prisma/migrations/202611160001_security/migration.sql`
- `backend/prisma/migrations/202611160002_management/migration.sql`
- `backend/src/security/auth.js`
- `backend/src/services/management.js`
- `backend/scripts/create-admin.mjs`
- `backend/tests/dev-files.test.js`
- `frontend/src/stores/auth.js`
- `frontend/src/services/access.js`
- `frontend/src/views/LoginView.vue`, `AccountView.vue`, `UserManagementView.vue`,
  `WorkerManagementView.vue`, `DeviceManagementView.vue`
- `frontend/tests/security-ui.test.js`
- `docs/SECURITY_AND_MANAGEMENT.md`, `docs/ESP32_S3_TELEMETRY.md`

Updated files:
- Prisma schema; app/server/realtime wiring; PostgreSQL repository;
  telemetry/pairing services; API integration tests.
- Shared contracts; App/router; telemetry store/status component; device sender;
  worker-detail helper; Wi-Fi/BLE worker selectors; styles.
- Vite configuration (private-file HTTP deny rules), browser-check scripts,
  package bootstrap command, certificate-directory ignore rule and project guides.

Both migrations are additive. The existing telemetry and incident migrations and
history are retained. Only the dedicated automated test cluster resets its test
device/assignment records, as before. No administrator, production secret or
public deployment is created automatically. Apply migrations/create your admin
with the local setup instructions above.
