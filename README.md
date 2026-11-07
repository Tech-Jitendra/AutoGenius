# AutoGenius

> **Diagnose • Verify • Track • Maintain**
> "Your AI second opinion before you spend money on your car."

AI-powered vehicle ownership assistant for Indian vehicle owners.
This repository currently contains the **V1 foundation** (Task 01),
**authentication** (Task 02), **vehicles** (Task 03) and **service history &
maintenance reminders** (Task 04): service records with parts and costs,
maintenance reminders with due dates and odometer intervals, completion that
rolls recurrence forward, and the mobile screens for all of it. Expense
tracking, the AI assistant and quotation analysis come in Tasks 05–07.

## Repository structure

```
autogenius/
├── apps/
│   ├── mobile/        React Native app (Expo + TypeScript)
│   ├── api/           NestJS REST API (/api/v1)
│   ├── ai-service/    Python FastAPI AI service
│   └── admin/         Next.js admin console
├── packages/
│   ├── types/         Shared domain models
│   ├── validation/    Shared zod schemas (env, DTOs)
│   └── constants/     Shared enums/categories
├── infrastructure/
│   └── nginx/
├── docs/              architecture, database, api, ai, development-plan
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- Node.js >= 20 (Node 22+ recommended) and npm
- Python 3.12+ (for the AI service)
- PostgreSQL 16+ — either Docker Compose or a native install
- Docker + Docker Compose — **optional** for day-to-day work; only needed for
  the containerized setup described further down
- Redis — provisioned by Docker Compose but **not yet used by any application
  code**, so it is optional at this stage

## Installation

```bash
# 1. Clone and enter the repo
cd autogenius

# 2. Install all JS/TS dependencies (npm workspaces install everything)
npm install

# 3. AI service (Python)
cd apps/ai-service
python -m venv .venv
source .venv/Scripts/activate        # Windows Git Bash
# .venv\Scripts\Activate.ps1         # Windows PowerShell
pip install -r requirements.txt
```

## Environment setup

```bash
cp .env.example .env
# Then edit .env — replace the placeholder JWT secrets with real ones:
#   openssl rand -hex 32
```

Never commit `.env`. Secrets are validated at startup by `@autogenius/validation`.

**How the API finds `.env`.** `apps/api` loads the repository-root `.env` itself
(`apps/api/src/config/load-env.ts`, using Node's built-in
`process.loadEnvFile`) before validating it. It works from any working
directory, needs no extra dependency, and **never overwrites a variable that is
already set** — so values injected by Docker Compose or CI always win. Point at
a different file with `API_ENV_FILE=/path/to/.env`. Expo and Next.js load their
own env files as usual.

| Variable | Required? | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://user:password@host:5432/autogenius` |
| `JWT_ACCESS_SECRET` | Yes | min 32 chars, no insecure default |
| `JWT_REFRESH_SECRET` | Yes (validated) | min 32 chars. Currently unused by the code — refresh tokens are opaque random values stored as SHA-256 hashes, not JWTs |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | No | default `15m` / `30d` |
| `RATE_LIMIT_TTL_MS` / `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_REFRESH_MAX` | No | default `60000` / `5` / `10` |
| `SWAGGER_ENABLED` | No | unset = Swagger at `/api/docs` everywhere except production; `true`/`false` overrides either way |
| `REDIS_HOST` / `REDIS_PORT` | No | defaults exist; nothing connects to Redis yet |
| `QWEN_API_KEY` / `QWEN_BASE_URL` | No | may be left **empty** until Task 06; a non-empty `QWEN_BASE_URL` must still be a valid URL |

`EXPO_PUBLIC_API_URL` does **not** belong in this file — Expo never reads the
repository root. It lives in `apps/mobile/.env`; see [Mobile app](#mobile-app).

## Local development without Docker

Run each app as its workspace. From the repository root:

```bash
npm install                      # once, installs every workspace
npm run api:dev                  # API with watch mode  (= npm run start:dev -w @autogenius/api)
npm run mobile:start             # Expo dev server for the mobile app
npm run admin:dev                # Next.js admin console
cd apps/ai-service
.venv\Scripts\activate           # Windows; then:
uvicorn app.main:app --reload --port 8000
```

Verify the API answers: `curl http://localhost:3001/api/v1/health`.

### API documentation (Swagger UI)

With the API running:

| What | URL |
| --- | --- |
| Interactive docs | <http://localhost:3001/api/docs> |
| OpenAPI 3.0 JSON | <http://localhost:3001/api/docs-json> |

Both sit outside the `/api/v1` prefix on purpose: they describe the API instead
of being another API resource. Every Auth, Vehicles, service-records,
maintenance-reminders and maintenance-summary endpoint is documented with its
request body, validation rules, examples, success and error statuses, and
whether it needs a bearer token.

To exercise the protected endpoints: call `POST /auth/register` (or
`/auth/login`) from the UI, copy `accessToken` from the response, paste it into
**Authorize**, and the token is then sent on `GET /auth/me` and every
`/vehicles` call. The Authorize value survives a page reload; **Cancel** clears
it. `docs-example-contract.spec.ts` fails if a documented example stops
validating against the shared Zod schemas, so the examples here are the rules
the server actually applies.

Set `SWAGGER_ENABLED=false` to hide both routes locally, or `SWAGGER_ENABLED=true`
to expose them in production. Unset means "available outside production".

### Mobile app

Start Expo **from the mobile workspace, never from the repository root**:

```bash
npm run mobile:start                    # from the repo root (runs in apps/mobile)
# or explicitly:
cd apps/mobile && npx expo start
# or with the Android emulator attached:
npm run mobile:android
```

The mobile project is already wired correctly — `"main": "expo-router/entry"`
in `apps/mobile/package.json`, the `expo-router` plugin in
`apps/mobile/app.json`, routes in `apps/mobile/src/app/`, and a monorepo-aware
`apps/mobile/metro.config.js`. Running `expo start` from the repo root instead
makes Expo fall back to the legacy `expo/AppEntry.js` entry, which imports a
non-existent root `App` component and fails with
`Unable to resolve "../../App"`. There is intentionally no `App.tsx`.

#### Screens that exist today

Signed-out (`src/app/(auth)/`): `/login`, `/register`. Signed-in
(`src/app/(app)/`): `/` (vehicle list), `/vehicles/add`,
`/vehicles/[id]` and its `/edit` and `/delete`, plus the Task 04 upkeep screens
under the same group: `/vehicles/[id]/service-history`, `/service-history/add`,
`/service-history/[recordId]/edit`, `/vehicles/[id]/maintenance`,
`/maintenance/add`, `/maintenance/[reminderId]/edit`. The route guard keys off
the first segment, so a new signed-in screen must live under `(app)` — the
folder is what keeps it behind authentication.

Vehicle details opens both: the upkeep card (last service, total spent on
upkeep, overdue and upcoming counts, the next thing due) links to the service
history list and the maintenance list, and reads from the same TanStack Query
caches those screens use, so it costs no extra request.

#### Which API URL the app uses

`apps/mobile/src/lib/api/config.ts` picks the first value that resolves:

1. `EXPO_PUBLIC_API_URL` from **`apps/mobile/.env`** (copy `apps/mobile/.env.example`).
   Expo reads env files from the directory it starts in — always `apps/mobile`
   here — so the repository-root `.env` is never consulted for this key.
2. While the app is served by `npx expo start`, the host part of the Expo
   dev-server address (`Constants.expoConfig.hostUri`) with port `3001`. A phone
   on the same Wi-Fi therefore finds the API without anyone editing an IP
   address. Windows may prompt for a firewall rule the first time the API
   listens; allow it on the private network.
3. `http://10.0.2.2:3001` on the Android emulator (that alias means "the host
   machine"), otherwise `http://localhost:3001`.

Restart Metro after changing the value — `EXPO_PUBLIC_*` is inlined at bundle
time, not read at runtime. If the app cannot reach the server it says so
explicitly ("Cannot reach the AutoGenius API at …") instead of failing with a
generic message.

Registration and login are rate limited per IP (`RATE_LIMIT_AUTH_MAX`, default
5 requests per `RATE_LIMIT_TTL_MS`, i.e. 5 per minute). Repeated test sign-ups
inside a minute return `429 Too Many Requests`; wait for the window or raise
`RATE_LIMIT_AUTH_MAX` in the repository-root `.env` while developing.


 or a development
build (`npx expo run:android`, or an EAS development build); a newer Expo Go
will refuse to open it. Because `expo-secure-store` has native code, Expo Go
support is limited to what it bundles — use a development build to test login
and token storage on a real device.

### Connecting to an existing Windows PostgreSQL installation

If PostgreSQL is already installed as a Windows service (check with
`Get-Service *postgre*`) it owns port 5432, so Docker Compose's `postgres`
container cannot bind it. Either stop the service, or create the role and
database in the existing cluster and use it directly. With a native
PostgreSQL 17 install:

```bat
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1
```

```sql
CREATE ROLE autogenius LOGIN PASSWORD 'autogenius_dev_password';
CREATE DATABASE autogenius OWNER autogenius;
```

Then set `DATABASE_URL=postgresql://autogenius:autogenius_dev_password@localhost:5432/autogenius`
in `.env`. A stock install uses `scram-sha-256` for local and `127.0.0.1`
connections, so a real password is mandatory — there is no trust fallback.

Confirm the app can reach it **before** running migrations: `npm run api:dev`
should log a TypeORM connection and apply the auth migration without errors.

## Docker startup (PostgreSQL, Redis, API, AI service, Admin)

Requires Docker Desktop to be running.

```bash
docker compose up --build
```

| Service    | URL                    |
| ---------- | ---------------------- |
| API        | http://localhost:3001/api/v1 |
| API health | http://localhost:3001/api/v1/health |
| AI service | http://localhost:8000/health |
| Admin      | http://localhost:3002  |

The mobile app runs locally (see above), not in Docker.

### Running only databases in Docker

```bash
docker compose up postgres redis
```

Then run the apps locally with the commands in
[Local development without Docker](#local-development-without-docker). Note
that a native PostgreSQL service and Docker's `postgres` container both want
port 5432 — only one of them can have it.

## Database migrations

Migrations live in `apps/api/src/database/migrations/`:
`1791158400000-CreateAuthTables.ts` creates `users` and `refresh_tokens`, including the
`email` and `lower(email)` unique constraints; `1793664000000-CreateVehicles.ts` creates
`vehicles` with its CHECK constraints and partial unique indexes;
`1793750400000-NormalizeVehicleRegistrationUniqueness.ts` re-keys the per-owner plate
index so separator formatting cannot smuggle in a duplicate; and
`1793836800000-CreateServiceHistory.ts` adds `UNIQUE (id, user_id)` to `vehicles` so history
rows can reference vehicle-and-owner as one key, then creates `service_records` and
`maintenance_reminders` with their CHECK constraints and indexes. The API applies pending
migrations automatically on boot (`migrationsRun: true`, `synchronize: false`). To run
them by hand:

```bash
npm run migration:run -w @autogenius/api   # or: npm run api:migration:run
```

`migration:run` uses `apps/api/src/database/data-source.ts`, which loads the
same root `.env`. Verify the connection first — running a migration against an
unknown database is not reversible.

## Running tests

```bash
npm run test          # all JS/TS workspaces (jest, no database required)
# AI service (Python):
cd apps/ai-service && pytest
```

The API's unit suites run against `pg-mem`, which cannot reproduce real
PostgreSQL behaviour (row locking, `lower(email)` indexes, SQLSTATE codes).
`apps/api/test/*.postgres.spec.ts` therefore runs the same auth, vehicle and
service-history flows against a **live PostgreSQL** server using the root `.env` connection:

```bash
npm run api:test:postgres    # requires PostgreSQL running with migrations applied
```

They create users under `pg-e2e-<run-id>@example.com`, `pg-veh-<run-id>@example.com` and
`pg-hist-<run-id>@example.com`, and delete exactly those rows afterwards — never a truncate,
never a schema reset, and never anything belonging to a real account. They are excluded
from `npm run test` so CI without a database still passes.

**When a run is interrupted.** The `<run-id>` in the email is the ownership condition the
cleanup is written against, so a leftover row always names the run that made it. Cleanup runs
after **every test** as well as at the end of the suite, so a failing test, a `Ctrl-C`, or the
worker abort that happens on Windows when jest recycles between these suites costs at most the
fixtures of the one test that was in flight. Only the operating system killing the process
outright (`taskkill /F`, power loss, the OOM killer) skips cleanup, because no code of ours is
left running to execute it; those rows then sit in the database until someone sweeps them by
run id:

```sql
-- What a given run left behind (read-only).
SELECT id, email FROM users WHERE email LIKE 'pg-hist-<run-id>-%';
```

Nothing in the repository deletes those automatically, and no suite may delete rows that do not
carry its own run id.

## Lint, typecheck, build

```bash
npm run lint          # ESLint (or tsc-based lint for packages)
npm run typecheck     # tsc --noEmit across workspaces
npm run build         # packages → api → admin → mobile
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — system design & principles
- [docs/database.md](docs/database.md) — PostgreSQL schema
- [docs/api.md](docs/api.md) — REST API contract
- [docs/ai.md](docs/ai.md) — AI pipeline, safety rules, provider isolation
- [docs/development-plan.md](docs/development-plan.md) — task sequence & roadmap

## Git strategy

Branches: `main`, `develop`, `feature/*`, `bugfix/*`.
Commits: `feat(vehicle): add vehicle CRUD`, `fix(auth): handle expired refresh token`,
`test(ai): add quotation schema tests`, `docs(api): update quotation endpoints`.

## Out of V1 scope

Marketplace, workshop booking, insurance marketplace, OBD, GPS tracking,
social features, emergency/SOS, parts marketplace, payments.
