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
                    │ Expenses            │
                    │ Maintenance         │
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
| Mobile     | React Native + TypeScript (Expo) |
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

## 5. Request Flow (AI features)

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

## 6. Environments

| Env        | Purpose                              |
| ---------- | ------------------------------------ |
| local dev  | Expo app local; api/admin via Docker Compose or `npm run dev` |
| staging    | Docker Compose on a single host      |
| production | AWS: API, PostgreSQL, Redis, object storage, AI service, admin |

## 7. Security Baseline

- Passwords hashed (bcrypt); never logged, never returned.
- JWT secrets from environment only; minimum length enforced by env schema.
- Rate limiting on auth and AI endpoints (Redis-backed).
- CORS restricted to known origins.
- Secrets never committed; `.env` is git-ignored, `.env.example` documents variables.
