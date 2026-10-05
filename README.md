# AutoGenius

> **Diagnose • Verify • Track • Maintain**
> "Your AI second opinion before you spend money on your car."

AI-powered vehicle ownership assistant for Indian vehicle owners.
This repository currently contains the **V1 foundation** (Task 01): monorepo,
skeleton apps, tooling, Docker, and docs. Business features start in Task 02.

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
│   ├── docker/
│   └── nginx/
├── docs/              architecture, database, api, ai, development-plan
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- Node.js >= 20 (Node 22+ recommended) and npm
- Python 3.12+ (for the AI service)
- Docker + Docker Compose (for PostgreSQL/Redis and containerized runs)

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
# Then edit .env — at minimum set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET:
#   openssl rand -hex 32
```

Never commit `.env`. Secrets are validated at startup by `@autogenius/validation`.

## Docker startup (PostgreSQL, Redis, API, AI service, Admin)

```bash
docker compose up --build
```

| Service    | URL                    |
| ---------- | ---------------------- |
| API        | http://localhost:3001/api/v1 |
| API health | http://localhost:3001/api/v1/health |
| AI service | http://localhost:8000/health |
| Admin      | http://localhost:3002  |

The mobile app runs locally (see below), not in Docker.

### Running only databases in Docker (recommended for local dev)

```bash
docker compose up postgres redis
```

Then run the apps locally:

```bash
npm run start:dev -w @autogenius/api      # API with watch mode
npm run dev -w @autogenius/admin          # Admin with hot reload
cd apps/ai-service && uvicorn app.main:app --reload --port 8000
cd apps/mobile && npx expo start          # Mobile (Expo)
```

## Database migrations

Migrations are introduced with the Auth task (Task 02) alongside the
PostgreSQL data layer. Until then, Docker Compose provisions an empty
`autogenius` database.

## Running tests

```bash
npm run test          # all JS/TS workspaces (jest)
# AI service (Python):
cd apps/ai-service && pytest
```

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
