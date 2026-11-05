# AutoGenius — Development Plan

## Task sequence (from the V1 specification)

### Task 01 — Foundation ✅ (this deliverable)
- Monorepo structure, tooling (ESLint, Prettier, TS strict), shared packages
- Skeleton apps: mobile (Expo), api (NestJS), ai-service (FastAPI), admin (Next.js)
- Docker Compose (postgres, redis, api, ai-service, admin), `.env.example`, README
- Docs: architecture, database, API, AI, development plan
- **No business features.**

### Task 02 — Authentication ✅
- users table + migration, register/login/refresh/logout/me, bcrypt, JWT pair,
  auth guard, rate limiting, mobile login/register screens + secure token storage.

### Task 03 — Vehicle Module ✅
- vehicles CRUD with ownership checks, indexes, mobile list/add/edit/details/delete
  with empty/loading/error states.

### Task 04 — Service History & Maintenance Records ✅ (this deliverable)
- `service_records` + `maintenance_reminders` in one explicit migration (no `synchronize`),
  money in `NUMERIC(12,2)` with a CHECK that the total equals its three components, and a
  composite `(vehicle_id, user_id)` foreign key so ownership is enforced in the database.
- Service records: CRUD, paginated newest-first list with `from`/`to`/`serviceType` filters,
  parts replaced as JSONB.
- Reminders: CRUD, `status`/`due` filters, `PATCH …/complete` (date + odometer, rolls
  recurrence forward from the previous completion in one transaction) and `PATCH …/dismiss`;
  `GET …/maintenance-summary` aggregates on read instead of storing roll-ups.
- Urgency computed per read: OVERDUE / UPCOMING / SCHEDULED on UTC calendar days, with the
  30-day and 1 000-km windows from `@autogenius/constants`; closed reminders never report one.
- Deleting a vehicle with history answers `409` instead of cascading.
- Mobile: upkeep card on vehicle details, service history list/add/edit, maintenance list
  grouped by urgency with complete/dismiss/edit/delete, all through TanStack Query and the
  shared Zod schemas.
- Swagger for every new endpoint; unit + live-PostgreSQL integration tests; mobile tests.
- **Deferred:** invoice/receipt attachments. There is no secure object-storage provider in
  this stack yet, and binaries do not belong in PostgreSQL — the required shape is documented
  in `docs/architecture.md`.

### Task 05 — Expense Tracking & upkeep dashboard
- expenses CRUD + category/monthly/yearly aggregations computed on the backend,
  mobile list/add/edit + summary + basic charts.
- The `maintenance_items` dashboard from the earlier draft is covered by Task 04's reminders,
  so this task only adds the expense side and any reporting polish.

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
