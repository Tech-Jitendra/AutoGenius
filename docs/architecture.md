# AutoGenius — Architecture

> **Diagnose • Verify • Track • Maintain**
> "Your AI second opinion before you spend money on your car."

## 1. System Overview

AutoGenius V1 is an AI-powered vehicle ownership assistant for Indian vehicle owners,
delivered as a mobile-first product with an admin console.

```
                    ┌─────────────────────┐
                    │   React Native App  │
                    │     TypeScript      │
                    └──────────┬──────────┘
                               │
                         REST / JSON
                               │
                    ┌──────────▼──────────┐
                    │     NestJS API      │
                    │                     │
                    │ Auth                │
                    │ Vehicles            │
                    │ Service History     │
                    │ Maintenance         │
                    │ Expenses            │
                    │ AI                  │
                    │ Quotations          │
                    └──────┬───────┬──────┘
                           │       │
                 ┌─────────▼─┐   ┌─▼──────────┐
                 │PostgreSQL │   │   Redis    │
                 └───────────┘   └────────────┘
                           │
                    ┌──────▼──────┐
                    │ AI Service  │
                    │   Python    │
                    └──────┬──────┘
                           │
                       Qwen Model
```

## 2. Technology Stack

| Layer      | Technology                    |
| ---------- | ----------------------------- |
| Mobile     | React Native + TypeScript (Expo), TanStack Query for server state |
| API        | NestJS + TypeScript           |
| Admin      | Next.js                       |
| Database   | PostgreSQL                    |
| Cache      | Redis (caching, rate limiting)|
| AI service | Python (FastAPI)              |
| AI model   | Qwen (behind an AI provider interface) |
| DevOps     | Docker, Docker Compose → AWS  |

## 3. Monorepo Layout

```
autogenius/
├── apps/
│   ├── mobile/        React Native app (Expo, TypeScript strict)
│   ├── api/           NestJS REST API (/api/v1)
│   ├── ai-service/    Python FastAPI AI processing service
│   └── admin/         Next.js admin console
├── packages/
│   ├── types/         Shared domain models (User, Vehicle, Expense, ...)
│   ├── validation/    Shared zod schemas (env, auth DTOs)
│   └── constants/     Shared enums/category lists
├── infrastructure/
│   ├── docker/        Docker assets
│   └── nginx/         Reverse proxy configuration
├── docs/              This documentation
├── docker-compose.yml
└── .env.example
```

## 4. Architectural Principles

1. **REST API with versioning** — all endpoints live under `/api/v1`.
2. **JWT authentication** — short-lived access token + refresh token (Tasks 02+).
3. **Thin controllers** — business logic lives in services/use-cases.
4. **DTO validation** — all input validated at the boundary (zod class-validator DTOs).
5. **Centralized error handling** — NestJS exception filter with structured error responses.
6. **AI isolation** — the AI provider sits behind an `AiProvider` interface; Qwen is
   one implementation, a mock provider is used in tests. AI output is never rendered
   raw: it is parsed as structured JSON, schema-validated, then passed through safety
   rules before reaching the client.
7. **No premature message broker** — RabbitMQ is only introduced when an actual
   asynchronous workflow (OCR jobs, notification jobs) requires it.
8. **TypeScript strict everywhere** — `strict: true`, no `any` unless unavoidable.

## 5. Ownership and data protection (Auth, Vehicles, Service History)

Every record a user creates is read and written through the owner, never through the id
alone:

- **Scope on both keys.** `service_records` and `maintenance_reminders` carry `vehicle_id`
  *and* `user_id`, with a composite foreign key `(vehicle_id, user_id) → vehicles(id,
  user_id)`. The database itself rejects a row that claims someone else's vehicle, and every
  query filters on both, so another user's record answers `404` like a missing one. RESTRICT
  on that key is what protects history from a cascading vehicle delete: `DELETE
  /vehicles/:id` counts the attached rows first and answers `409` with what is still there,
  while a vehicle with no history deletes exactly as it did before Task 04.
- **Nothing is trusted from the client on money or urgency.** `total_cost` is re-derived on
  every write in whole cents (`NUMERIC(12,2)` + a CHECK), and `OVERDUE` / `UPCOMING` /
  `SCHEDULED` is computed on read from the due values, the vehicle's stored odometer and
  today's UTC calendar day — so it cannot go stale overnight and cannot be spoofed.
- **Recurrence is predictable and documented.** Completing a reminder measures the next due
  date and reading from the *previous completion*, not from the old promise, so a reminder
  finished late does not instantly become overdue again. A reminder with no interval simply
  becomes `COMPLETED`.
- **Mobile mirrors the API, it does not duplicate it.** The screens reuse the shared Zod
  schemas, so a form rejects exactly what the server would, and the completion panel shows
  the recurrence rule before confirming and the server's real next due values after. The
  client never recomputes the roll-forward and never reports success the backend did not
  give it; ownership is enforced by the API, not by hiding buttons.
- **Attachments are deliberately not implemented yet.** There is no secure object-storage
  provider in this stack, so invoice images are not accepted and no binary is parked in
  PostgreSQL. When storage lands it should be an `attachments` table holding a provider key
  plus owner id, served through short-lived signed URLs from the API — never a public URL,
  and never a client-supplied bucket path.

## 6. Request Flow (AI features)

```
Mobile question
   → NestJS /api/v1/ai/chat
   → intent detection + vehicle context assembly
   → prompt construction
   → AI service (Python) → Qwen provider
   → structured JSON response
   → schema validation (zod)
   → safety rules layer
   → persisted conversation history
   → validated JSON → Mobile UI
```

## 7. Environments

| Env        | Purpose                              |
| ---------- | ------------------------------------ |
| local dev  | Expo app local; api/admin via Docker Compose or `npm run dev` |
| staging    | Docker Compose on a single host      |
| production | AWS: API, PostgreSQL, Redis, object storage, AI service, admin |

## 8. Security Baseline

- Passwords hashed (bcrypt); never logged, never returned.
- JWT secrets from environment only; minimum length enforced by env schema.
- Rate limiting on auth and AI endpoints (Redis-backed).
- CORS restricted to known origins.
- Secrets never committed; `.env` is git-ignored, `.env.example` documents variables.
