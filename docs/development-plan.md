# AutoGenius — Development Plan

## Task sequence (from the V1 specification)

### Task 01 — Foundation ✅ (this deliverable)
- Monorepo structure, tooling (ESLint, Prettier, TS strict), shared packages
- Skeleton apps: mobile (Expo), api (NestJS), ai-service (FastAPI), admin (Next.js)
- Docker Compose (postgres, redis, api, ai-service, admin), `.env.example`, README
- Docs: architecture, database, API, AI, development plan
- **No business features.**

### Task 02 — Authentication
- users table + migration, register/login/refresh/logout/me, bcrypt, JWT pair,
  auth guard, rate limiting, mobile login/register screens + secure token storage.

### Task 03 — Vehicle Module
- vehicles CRUD with ownership checks, indexes, mobile list/add/edit/details/delete
  with empty/loading/error states.

### Task 04 — Expense Tracking
- expenses CRUD + category/monthly/yearly aggregations computed on the backend,
  mobile list/add/edit + summary + basic charts.

### Task 05 — Maintenance
- maintenance_items CRUD, due-soon/overdue computation (date + odometer),
  dashboard OVERDUE / DUE SOON / UPCOMING sections. No push notifications.

### Task 06 — AI Assistant
- AiProvider interface, mock provider first, Qwen integration after tests pass,
  structured + validated responses, conversation persistence, safety layer,
  rate limiting, timeout/malformed-output handling.

### Task 07 — Quotation Checker (killer feature)
- Upload (image/PDF/camera) → OCR/text extraction → line-item parsing → AI
  per-item analysis (NECESSARY / REVIEW / OPTIONAL / POTENTIALLY_OVERPRICED /
  UNKNOWN) → fair-range estimate → result screen with warnings and questions
  for the workshop. Tests for parsing, totals, malformed docs, AI failures.

### Later tasks (per spec)
- Admin panel screens, security hardening, logging, performance,
  production Docker + AWS deployment, beta + V1 release.

## 8-week roadmap (from spec section 27)

| Week | Focus |
| ---- | ----- |
| 1    | Architecture, monorepo, Docker, PostgreSQL, Redis, Auth |
| 2    | Vehicle, service history, maintenance |
| 3    | Expenses, dashboard, mobile UX |
| 4    | AI abstraction, Qwen integration, AI chat, safety layer |
| 5    | Quotation upload, OCR, parser, quotation DB |
| 6    | Qwen quotation analysis, fair-price analysis, result UI, testing |
| 7    | Admin, security, rate limiting, logging, performance |
| 8    | Production Docker, AWS, beta testing, bug fixing, V1 release |

## Definition of Done (applies to every task)

- Feature implemented; TypeScript, ESLint, unit + integration tests pass
- API validation works; error/loading/empty states handled
- Auth/authz verified; no secrets committed; README updated; Docker works
- Existing tests still pass

## Git strategy

Branches: `main`, `develop`, `feature/*`, `bugfix/*`.
Commit style: `feat(vehicle): add vehicle CRUD`, `fix(auth): handle expired refresh token`,
`test(ai): add quotation schema tests`, `docs(api): update quotation endpoints`.

## Qwen's role in the workflow

Qwen acts as the reasoning/review layer; Qoder implements. Review prompt checks
architecture, security, TS quality, API/DB design, auth, validation, error handling,
AI integration + response validation, prompt-injection risk, rate limiting, logging,
tests, Docker, maintainability — and returns a prioritized action list without
inventing unsupported problems.
