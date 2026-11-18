# Netlify + Railway + Neon deployment readiness

Status: local implementation and tests; external deployment is NOT approved or
executed. Do not create platform services, configure real secrets or run migrations
against Neon until the user approves those specific external actions.

## Architecture and cookie strategy

```text
Browser on Netlify -- /api/* HTTP proxy --> Railway Express --> Neon PostgreSQL
        |                       |
        +-- ticket request -----+  (HttpOnly session cookie stays same-origin)
        +-- direct WSS + one-use ticket --> authenticated Socket.IO
```

Netlify's generated API rewrites keep human session cookies first-party on the
frontend host. The cookie is HttpOnly, Secure, SameSite=Strict, Path=/ and has no
Domain attribute. JWTs are not exposed to frontend JavaScript. CSRF remains
mandatory for human mutations. Do not change SameSite to None as a shortcut.
In production, pairing issuance/revocation is permitted for authenticated
ADMIN/SUPERVISOR users with CSRF over trusted HTTPS from an explicitly allowed
frontend origin. Local development retains its laptop-only issuance restriction.
The Socket.IO client connects directly to Railway with a 30-second one-use ticket
obtained through the cookie-authenticated/CSRF-protected HTTP API. Tickets are
not placed in URLs/localStorage and cannot authorize REST mutations. Reconnect
obtains a fresh ticket. Default local development continues using its same-origin
cookie socket connection.

This design does not require a WebSocket proxy through Netlify. Actual provider
proxy forwarding of Cookie/Set-Cookie and websocket Origin must still be verified
with the approved platform smoke procedure, especially with custom domains.

## Files

- `netlify.toml`: build command, publish directory and response headers.
- `scripts/prepare-netlify.mjs`: validates HTTPS origins, generates `_redirects`
  after build, and requires the API and direct socket origins to match.
- `railway.json`: Docker build, additive migration predeploy command, startup,
  `/api/ready` healthcheck and bounded restart policy.
- `Dockerfile`: existing non-root production image; Railway injects PORT.
- `deploy/production.env.example`: placeholders only, no real credentials.
- `scripts/deployment-check.mjs`: configuration-only review.
- `scripts/smoke.mjs`: explicit local/approved external smoke checks.

Official references: [Netlify rewrites/proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/),
[Railway healthchecks/PORT](https://docs.railway.com/deployments/healthchecks),
[Railway interface requirements](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond),
[Neon Prisma connection guidance](https://github.com/neondatabase/website/blob/main/content/docs/guides/prisma.md).
This repository retains Prisma 6 and its existing PostgreSQL client; it does not
migrate to a different driver or TypeScript configuration.

## Environment ownership

| Variable | Platform | Purpose |
| --- | --- | --- |
| DATABASE_URL | Railway secret | Runtime Neon PostgreSQL connection; pooled URL as appropriate |
| DATABASE_URL_UNPOOLED | Railway secret | Direct connection for approved Prisma migrations and backups |
| DACOS_JWT_SECRET | Railway secret | At least 48 bytes of random signing material; shared per backend deployment |
| NODE_ENV | Railway | production |
| DACOS_MODE | Railway | operational |
| API_HOST | Railway/container | 0.0.0.0 inside the hosted container; local development remains loopback |
| PORT | Railway-provided | Provider listening/healthcheck port; overrides API_PORT |
| SERVE_FRONTEND | Railway | false for Netlify split hosting |
| DACOS_ALLOWED_ORIGINS | Railway | Exact frontend HTTPS origins, comma-separated, no wildcard or path |
| DACOS_TRUST_PROXY | Railway | Explicit verified proxy addresses/CIDRs or verified hop count 1–3; never true/* |
| DACOS_API_ORIGIN | Netlify build | Public exact Railway HTTPS origin |
| VITE_SOCKET_ORIGIN | Netlify build | Same public Railway origin for direct WSS |
| DEMO_HISTORY_INTERVAL_MS | Optional local demo | Fixture history interval, default 60000, minimum 10000 |

Only public URLs belong in VITE_ variables. Build configuration rejects common
VITE_ secret/password/database/private-key variable names. Never copy backend
credentials into Netlify build variables. An approved deploy-preview origin must
be listed exactly; arbitrary preview-domain wildcards are rejected.

Verify the actual Railway/Netlify forwarded-header path before setting proxy
trust. A hop-count setting is safe only when traffic cannot take a shorter
untrusted path. Do not enable public TCP bypasses or trust arbitrary X-Forwarded-*
headers. The default unconfigured proxy policy remains fail-closed for public
production HTTPS login. With a proxy untrusted, login throttling aggregates at
its address; verify real client attribution before accepting production traffic.

## Proposed deployment sequence — requires approval

1. Review the diff and run the local checks. Approve external service creation,
   credential setup, Railway deployment and Neon migrations explicitly.
2. Create a Neon database/branch and obtain the runtime/direct URLs privately.
   Confirm both target the intended database/schema. Store secrets in Railway's
   secret settings; never commit them or expose connection strings in logs.
3. Set Railway environment, exact allowed frontend origin, verified proxy trust
   and operational mode. The migration command uses the direct URL when supplied;
   it never resets existing records. Take a backup before an approved migration.
4. Create/configure Netlify with root `netlify.toml` and the two public build URL
   variables. The generator writes API rewrites before the SPA fallback. It makes
   no network request and does not deploy anything itself.
5. Create the first admin through an approved controlled bootstrap against the
   intended database. Existing production passwords are not reset automatically.
6. Check Railway ready/live, Netlify API forwarding, login/session/logout, CSRF,
   direct socket tickets, reconnect and data provenance in actual browsers.
7. Only after the acceptance checks pass should real users or real gateways be
   onboarded. Preserve simulated labels; no response provider is connected.

Do not run generic platform CLI deploy commands from this guide without approval.
Single Railway backend instance is the prepared baseline. Multiple replicas need
a shared Socket.IO adapter plus shared pairing/device-rate state; JWT and login
throttle database state alone do not provide full multi-instance coordination.

## Local checks and smoke procedure

```bash
./scripts/npm test
VITE_SOCKET_ORIGIN= VITE_STATIC_PREVIEW=false ./scripts/npm run build
./scripts/npm run check:pilot
./scripts/npm run check:deployment
```

The last command intentionally reports missing cloud variables until approved
configuration exists. It does not connect to Neon or contact deployment APIs.
The build emits known third-party Zod comment warnings but should exit zero.

With a local server already running:

```bash
./scripts/npm run smoke
```

Set DACOS_SMOKE_URL for another local loopback port. Live and ready must return
JSON/200; an anonymous operational snapshot must return 401. Optional
DACOS_SMOKE_EMAIL/PASSWORD verifies login/session/logout without printing credentials.
Use test accounts. External targets require the user's prior approval and
DACOS_EXTERNAL_SMOKE_APPROVED=true; the flag is not a substitute for permission.
Set DACOS_SMOKE_ORIGIN when testing an approved proxied frontend origin.

On the approved hosted site, check browser cookie flags, response cache control,
CORS exact origin, unauthorised-origin rejection, CSRF failure, ticket replay
rejection, websocket reconnect, logout disconnection and all role restrictions.
Third-party-cookie blocking should not break the first-party proxy/ticket design;
verify this rather than assuming the provider headers are configured correctly.

## Backup, recovery and retention

See [PRODUCTION_FOUNDATION.md](PRODUCTION_FOUNDATION.md) for backup and isolated
restore commands. Backup selects DATABASE_URL_UNPOOLED when available. Keep dump
files, checksum metadata and queue/dead-letter files protected. Use a PostgreSQL
client compatible with the server; the local system client is version 16 and the
embedded test server is version 18, so a real restore drill remains unverified.
Never restore over a populated database; the verifier requires an empty dedicated
`_restore_check` database and verifies the checksum first.

Define approved encrypted/off-host storage, backup cadence, retention, recovery
point/time objectives and alert recipients before accepting production use. No
automatic history deletion or backup-upload provider was configured. Preserve
recorded acquisition timestamps during recovery. Samples outside the live
endpoint's two-minute acceptance window are retained in dead letters, not forged
as current observations. Backpressure/full spool requires operator attention.

## Readiness review

| Gate | Current disposition |
| --- | --- |
| Local incident/role/history/report/regression tests | Verified locally; final counts in milestone report |
| Built-app browser workflow and responsive checks | Verified in isolated local Chrome |
| Deployment generator and origin/proxy/cookie/ticket policy | Tested locally |
| Netlify/Railway/Neon actual configuration | Pending approval and provider verification |
| Docker image execution | Not verified here; Docker unavailable |
| Database backup restoration | Pending matching client tools and actual drill |
| Physical sensors/BLE/environment/positioning | Pending hardware, as requested |
| High-load, long-duration and field failure qualification | Not certified by the local test suite |
| External emergency dispatch | Intentionally absent |

This is a preparation/readiness review, not a claim of an executed or certified
production deployment. No real cloud secrets or services were created.
