# Jastip Anggun Jaya

Platform manajemen jastip ekspedisi untuk bisnis "Jastip Anggun Jaya" — mengelola paket masuk, pengambilan customer, dan laporan owner.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/jastip run dev` — run the frontend (port 21033)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (artifact: `artifacts/jastip/`)
- API: Express 5 (artifact: `artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Auth: Token-based (localStorage key `jaj_token`), SHA-256 password hash with salt
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — DB schema (users, packages, sessions)
- `artifacts/api-server/src/routes/` — API routes (auth, packages, customers, admins, dashboard, reports)
- `artifacts/jastip/src/` — Frontend pages and components
- `artifacts/jastip/public/logo.png` — Business logo

## Architecture decisions

- 3 roles: customer, admin, owner — different sidebar navigation per role
- Token auth via localStorage (`jaj_token`) + sessions table with 7-day expiry
- Password hashed with SHA-256 + `jaj_salt_2024`
- Packages default to `ready` status when admin inputs them (langsung siap ambil)
- Barcode format: `JAJ-<timestamp-base36>-<random-hex>`

## Product

**3 Roles:**
- **Customer**: Dashboard, Paket Saya, Scan Paket, Riwayat Pengambilan
- **Admin**: Dashboard + chart, Input Paket (manual + import JSON/Excel), Konfirmasi Pengambilan, Cetak Barcode
- **Owner**: Dashboard, Monitoring Paket/Customer/Admin, Laporan (harian/bulanan/tahunan) + Export, Manajemen User (Admin)

## Demo Credentials

| Role | Nomor HP | Password |
|------|----------|----------|
| Owner | 08000000000 | owner123 |
| Admin | 08111111111 | admin123 |
| Admin 2 | 08111111112 | admin123 |
| Customer (Andi) | 08222222221 | cust123 |
| Customer (Dewi) | 08222222222 | cust123 |

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after changing schema files
- The `@workspace/api-client-react` package has a `./custom-fetch` subpath export needed for `setAuthTokenGetter`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
