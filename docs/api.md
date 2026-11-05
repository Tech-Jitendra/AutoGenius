# AutoGenius — API Design

Base URL: `/api/v1` · All bodies are JSON · Auth via `Authorization: Bearer <accessToken>`
Modules through Service History (Tasks 01–04) are implemented; the sections after them are
the V1 contract and are built in Tasks 05–07.

## Interactive documentation

The implemented endpoints are described by an OpenAPI 3.0 document served outside the
`/api/v1` prefix: UI at `/api/docs`, JSON at `/api/docs-json` (port 3001 locally). Both
are served whenever `NODE_ENV` is not `production`, unless `SWAGGER_ENABLED=true|false`
overrides that. `apps/api/src/docs/dto/` holds the documentation-only DTOs; validation
still lives only in `@autogenius/validation`, and `test/docs-example-contract.spec.ts`
fails if a documented example stops validating, if an endpoint loses its security
marker, or if a credential column appears in a schema.

## Auth

| Method | Endpoint        | Description                          |
| ------ | --------------- | ------------------------------------ |
| POST   | /auth/register  | Create account (name, email, password, optional phone) |
| POST   | /auth/login     | Returns access + refresh tokens      |
| POST   | /auth/refresh   | Rotate tokens                        |
| POST   | /auth/logout    | Invalidate refresh token             |
| GET    | /auth/me        | Current user profile                 |

Conventions:
- `register`/`login` return `{ user, accessToken, refreshToken }`; `user` never contains `passwordHash`.
- Emails are trimmed + lowercased before storage; duplicates → `409`.
- `phone` is optional. Spaces, dots, hyphens and parentheses are stripped before validation, so `+91 98765 43210` and `+919876543210` are the same number and the canonical digits are what gets stored; anything left is `8`–`15` digits with an optional `+`, else `400`.
- Login failures (wrong password or unknown email) return the same generic `401` to avoid account enumeration.
- `refresh` rotates: the presented token is revoked and a new pair is issued; reusing a rotated token revokes all sessions of that user (`401`).
- `logout` is idempotent → `204`; afterwards the refresh token is unusable.
- Access tokens are short-lived JWTs; refresh tokens are opaque random strings stored hashed (SHA-256) in the database.
- Rate limits (per client IP, sliding window): register/login `RATE_LIMIT_AUTH_MAX` per `RATE_LIMIT_TTL_MS`; refresh `RATE_LIMIT_REFRESH_MAX` per `RATE_LIMIT_TTL_MS`. Exceeding → `429`.

## Vehicles

| Method | Endpoint                | Description                       |
| ------ | ----------------------- | --------------------------------- |
| POST   | /vehicles               | Add vehicle → `201`               |
| GET    | /vehicles               | List my vehicles                  |
| GET    | /vehicles/:id           | Vehicle details                   |
| PATCH  | /vehicles/:id/default   | Set as the default vehicle        |
| PATCH  | /vehicles/:id           | Edit vehicle                      |
| DELETE | /vehicles/:id           | Delete vehicle → `204`            |

Write fields (`POST`; all trimmed by the shared Zod schema):

```json
{
  "make": "Maruti Suzuki",
  "model": "Baleno",
  "variant": "ZXi CVT",
  "registrationNumber": "MH 12 AB 1234",
  "manufacturingYear": 2019,
  "fuelType": "PETROL",
  "transmission": "CVT",
  "purchaseDate": "2019-06-15",
  "currentOdometer": 42000
}
```

`make`, `model`, `manufacturingYear`, `fuelType` and `transmission` are required;
`variant`, `registrationNumber`, `purchaseDate` and `currentOdometer` are optional.
`fuelType` ∈ `PETROL|DIESEL|CNG|HYBRID|ELECTRIC`, `transmission` ∈ `MANUAL|AUTOMATIC|AMT|CVT`,
`manufacturingYear` ∈ 1900…next year, `currentOdometer` ∈ 0…2 000 000,
`purchaseDate` is a real calendar date and cannot be in the future.
Registration numbers are stored normalised to upper case with single spaces.

Responses are `{ id, userId, make, …, isDefault, createdAt, updatedAt }` — never the owner's password or tokens.

Conventions:
- **Ownership**: every query is scoped by vehicle id **and** the authenticated user id
  (`WHERE id = :id AND user_id = :userId`). A vehicle that belongs to someone else answers
  `404`, exactly like a vehicle that does not exist, so ids cannot be probed. There is no
  endpoint that reads a vehicle by id alone.
- `:id` must be a UUID → `400` otherwise (validated before it reaches SQL).
- Validation failures → `400` with the Zod message; no driver output or SQL is ever included.
- A registration number that the caller already uses on another vehicle → `409`.
  Only that conflict is mapped; any other database error stays a generic `500`.
- `PATCH` is partial: an omitted key leaves the field untouched, `null` clears it, and an
  empty body → `400`.
- Defaults: the first vehicle of a user becomes the default automatically; promoting another
  one unsets the previous default atomically (one transaction, one row lock, plus a partial
  unique index at the database level). Deleting the default promotes another owned vehicle if
  one exists. `PATCH /:id/default` on the vehicle that is already default is a no-op `200`.
- `GET /vehicles` returns the default first, then newest first. No pagination in V1.
- `DELETE /vehicles/:id` **refuses to take history with it**. If the vehicle has service
  records or reminders the answer is `409` naming both counts
  ("This vehicle still has 3 service records and 1 maintenance reminder. Delete those
  first…"); the foreign keys are `RESTRICT`, so the database enforces the same rule if the
  application ever forgets to. A vehicle with no history deletes exactly as before (`204`).

## Service history

Every path hangs under the vehicle, so ownership is checked on the parent before the row is
touched — another user's record and a non-existent one both answer `404`.

| Method | Endpoint                                        | Description |
| ------ | ----------------------------------------------- | ----------- |
| POST   | /vehicles/:vehicleId/service-records            | Add a visit → `201` |
| GET    | /vehicles/:vehicleId/service-records            | Page of visits, newest first |
| GET    | /vehicles/:vehicleId/service-records/:recordId  | One visit |
| PATCH  | /vehicles/:vehicleId/service-records/:recordId  | Edit a visit |
| DELETE | /vehicles/:vehicleId/service-records/:recordId  | Delete a visit → `204` |

Write fields (`POST`; `PATCH` accepts any subset, `null` clears an optional one):

```json
{
  "serviceDate": "2026-05-12",
  "serviceType": "GENERAL_SERVICE",
  "odometerKm": 42000,
  "workshopName": "City Auto Care",
  "description": "Front brake pads replaced, rotors skimmed",
  "partsReplaced": [{ "name": "Brake pads", "quantity": 1, "cost": 2500 }],
  "labourCost": 800,
  "partsCost": 1250.5,
  "otherCost": 149.5,
  "notes": "Paid by card"
}
```

- `serviceDate` (real calendar date, not in the future) and `serviceType` are required;
  `serviceType` ∈ `OIL_CHANGE|BRAKE_INSPECTION|TYRE_REPLACEMENT|BATTERY|AIR_FILTER|COOLANT|GENERAL_SERVICE|OTHER`.
- `odometerKm` ∈ 0…2 000 000. Costs are non-negative, at most `10 000 000` each, and are
  rounded to the two decimals the column can hold.
- **`totalCost` is not an input.** The API stores `labour_cost + parts_cost + other_cost`
  in whole cents and a database CHECK keeps them in agreement, so a client cannot invent a
  total. It appears on every response.
- `partsReplaced` is a JSON array of `{name, quantity, cost}`; at most 100 entries, name
  required. It records what was fitted on this visit — costs still come from the three
  billed fields.
- List query: `page`, `pageSize` (≤ 100), `from`, `to` (service-date range, `from` may not
  be later than `to`), `serviceType`. Ordered `service_date DESC, created_at DESC`.
- Response shape: `{ items, page, pageSize, totalItems, totalPages }`.

## Maintenance reminders

| Method | Endpoint                                          | Description |
| ------ | ------------------------------------------------- | ----------- |
| POST   | /vehicles/:vehicleId/maintenance-reminders         | Add a reminder → `201` |
| GET    | /vehicles/:vehicleId/maintenance-reminders         | Page, active work first |
| GET    | /vehicles/:vehicleId/maintenance-reminders/:reminderId | One reminder |
| PATCH  | /vehicles/:vehicleId/maintenance-reminders/:reminderId | Edit |
| PATCH  | /vehicles/:vehicleId/maintenance-reminders/:reminderId/complete | Mark done, roll recurrence forward |
| PATCH  | /vehicles/:vehicleId/maintenance-reminders/:reminderId/dismiss | Close without doing the work |
| DELETE | /vehicles/:vehicleId/maintenance-reminders/:reminderId | Delete → `204` |
| GET    | /vehicles/:vehicleId/maintenance-summary           | Upkeep snapshot for the vehicle card |

Write fields: `title` (required), `description`, `dueDate`, `dueOdometerKm`,
`intervalMonths` (1…120), `intervalKm` (1…2 000 000), `lastCompletedDate`,
`lastCompletedOdometerKm`. **A reminder needs at least one due condition** —
`dueDate` or `dueOdometerKm` — otherwise `400`.

List query: `page`, `pageSize`, `status` (`ACTIVE|COMPLETED|DISMISSED`, case-insensitive),
`due` (`OVERDUE|UPCOMING|SCHEDULED`). Ordering is soonest `due_date` first (rows without a
date fall last), then `due_odometer_km`.

Each reminder carries `alertStatus` — `OVERDUE`, `UPCOMING` or `SCHEDULED` — computed on
read, never stored:

- **OVERDUE** — `due_date` is strictly before today, **or** the vehicle's stored odometer
  has reached `due_odometer_km`. Either condition alone is enough.
- **UPCOMING** — due within the next `UPCOMING_DUE_WINDOW_DAYS` (30) days, or within
  `UPCOMING_DUE_WINDOW_KM` (1 000) km.
- **SCHEDULED** — anything else. `COMPLETED` and `DISMISSED` rows report `null`, so closed
  work can never be shown as overdue.

Dates are compared as `YYYY-MM-DD` calendar days at UTC midnight, so a phone in Kolkata and
a server in Frankfurt agree on whether the oil change is overdue.

### Completing a reminder

`PATCH …/complete` takes `{ "completionDate": "2026-11-04", "completionOdometerKm": 44210 }`
— both required, the date not in the future, and the reading not lower than the highest
figure already stored for the vehicle (its odometer, the newest service record, or the
reminder's own last completion), else `400` naming that floor. One transaction stamps the
completion and, when the reminder has an interval, rolls its due values forward:

- next due date = **last completion date** (or this one) + `intervalMonths`, clamped to the
  end of a shorter month (31 Jan + 1 month = 28 Feb);
- next due odometer = **last completion reading** (or this one) + `intervalKm`, clamped to
  2 000 000.

Measuring from the work rather than from the old promise is what keeps a long-overdue
reminder from becoming instantly overdue again. The base is the previous completion, not
the current date, so six-monthly service done a week late still lands six months after the
last visit. A reminder with **no** interval keeps its due values and becomes `COMPLETED` —
that is what makes a one-time reminder one-time. Completing an already-closed reminder is
`409`, and reopening happens by editing it.

Completing **never writes a service record**: history is only created when the user supplies
the workshop and cost details, so no duplicate bill and no invented spend appears in the
expenditure totals.

`PATCH …/dismiss` takes no body: the reminder becomes `DISMISSED` with its due values
untouched, so the history of what was promised survives. `DELETE` removes it entirely.

### Maintenance summary

`GET /vehicles/:vehicleId/maintenance-summary` returns
`{ vehicleId, totalServiceRecords, totalExpenditure, lastServiceDate, lastServiceOdometer,
activeReminders, overdueReminders, upcomingReminders }`. Nothing is cached in roll-up
columns: the totals are aggregated from `service_records` and the urgency counts recomputed
from `maintenance_reminders` on every call, so editing or deleting a record cannot leave a
stale figure behind.

## Expenses

| Method | Endpoint                       | Description        |
| ------ | ------------------------------ | ------------------ |
| GET    | /vehicles/:vehicleId/expenses  | List (filters: category, from, to) |
| POST   | /vehicles/:vehicleId/expenses  | Add expense        |
| PATCH  | /expenses/:id                  | Edit expense       |
| DELETE | /expenses/:id                  | Delete expense     |

Categories: `FUEL, SERVICE, REPAIR, INSURANCE, PUC, ACCESSORY, OTHER`.
Aggregations (monthly/yearly/category totals) are computed on the backend.

## AI

| Method | Endpoint                 | Description                     |
| ------ | ------------------------ | ------------------------------- |
| POST   | /ai/chat                 | Message + vehicleId → structured AI response |
| GET    | /ai/conversations        | List conversations              |
| GET    | /ai/conversations/:id    | Conversation with messages      |
| DELETE | /ai/conversations/:id    | Delete conversation             |

`POST /ai/chat` response (schema-validated before returning):

```json
{
  "severity": "medium",
  "confidence": 0.78,
  "possibleCauses": [{ "cause": "Worn brake pads", "probability": "high" }],
  "recommendedChecks": ["Inspect brake pads"],
  "canDrive": true,
  "urgency": "soon",
  "estimatedCost": { "min": 1500, "max": 6000, "currency": "INR" },
  "questionsForMechanic": ["What is the remaining brake pad thickness?"],
  "disclaimer": "This is an AI-generated assessment..."
}
```

## Quotations

| Method | Endpoint                 | Description                  |
| ------ | ------------------------ | ---------------------------- |
| POST   | /quotations              | Upload image/PDF (multipart) |
| GET    | /quotations              | List my quotations           |
| GET    | /quotations/:id          | Quotation + items + analysis |
| POST   | /quotations/:id/analyze  | Run/re-run AI analysis       |

Analysis result contract:

```json
{
  "summary": {
    "quotationTotal": 0,
    "estimatedFairMin": 0,
    "estimatedFairMax": 0,
    "potentialDifference": 0,
    "confidence": 0
  },
  "items": [
    {
      "description": "",
      "assessment": "REVIEW",
      "reason": "",
      "estimatedMin": 0,
      "estimatedMax": 0,
      "safetyCritical": false,
      "questions": []
    }
  ],
  "recommendations": [],
  "warnings": []
}
```

## Conventions

- Errors: `{ "statusCode": number, "message": string, "error": string }`.
- Pagination (`?page=1&pageSize=20`, `pageSize` ≤ 100) returns
  `{ "items": [], "page", "pageSize", "totalItems", "totalPages" }`.
- Date/time: `date` columns travel as `YYYY-MM-DD`, timestamps as ISO 8601 UTC. Money is
  `numeric(12,2)` in INR and is summed in whole cents, never as a float.
- Rate-limited endpoints: auth, AI chat, quotation analyze.
