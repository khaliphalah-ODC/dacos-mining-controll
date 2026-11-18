# Environment and Neon setup

The root `.env` supplies local development settings. `.env.static-preview` enables the static UI preview. `deploy/.env` holds private production database and signing settings; it is ignored by Git and explicitly excluded from Docker build context.

Run these commands from the repository root using `./scripts/npm`:

- `run db:check:production`: verify Neon URL pairing, authenticated TLS connections, JWT signing, migration status, and table counts.
- `run db:migrate:production`: apply existing Prisma migrations using the direct Neon URL. This does not seed, import, or reset data.
- `run check:deployment:production`: validate production hosting configuration.
- `run start:production`: start the backend with the deployment environment file.

On November 18, 2026, all 14 migrations were applied to Neon. All 28 application tables were empty; no local records, seed fixtures, or administrator accounts were imported. The direct connection URL was corrected to use the matching unpooled Neon endpoint. JWT signing and verification passed.

Hosting has not been deployed. Replace placeholder frontend/backend origins with the actual Netlify and Railway HTTPS URLs after provisioning them, then rerun the deployment check. Configure production secrets as hosting environment variables; do not include the private environment file in an image.

Cleanup removed five unused archived Vue components in `frontend/design-reference/legacy-runtime/` and the unused `frontend/src/views/FictionalMapView.vue`. A recovery archive is saved locally at `.data/cleanup-backups/unused-ui-2026-11-18.tar.gz`. Active design references, tests, tooling, and local databases were retained.
