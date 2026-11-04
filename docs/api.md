# AutoGenius — API Design

Base URL: `/api/v1` · All bodies are JSON · Auth via `Authorization: Bearer <accessToken>`
Modules through Vehicles (Tasks 01–03) are implemented; the sections after them are the V1
contract and are built in Tasks 04–07.

## Auth

| Method | Endpoint        | Description                          |
| ------ | --------------- | ------------------------------------ |
| POST   | /auth/register  | Create account (name, email, password) |
| POST   | /auth/login     | Returns access + refresh tokens      |
| POST   | /auth/refresh   | Rotate tokens                        |
| POST   | /auth/logout    | Invalidate refresh token             |
| GET    | /auth/me        | Current user profile                 |

Conventions:
- `register`/`login` return `{ user, accessToken, refreshToken }`; `user` never contains `passwordHash`.
- Emails are trimmed + lowercased before storage; duplicates → `409`.
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

## Expenses

| Method | Endpoint                       | Description        |
| ------ | ------------------------------ | ------------------ |
| GET    | /vehicles/:vehicleId/expenses  | List (filters: category, from, to) |
| POST   | /vehicles/:vehicleId/expenses  | Add expense        |
| PATCH  | /expenses/:id                  | Edit expense       |
| DELETE | /expenses/:id                  | Delete expense     |

Categories: `FUEL, SERVICE, REPAIR, INSURANCE, PUC, ACCESSORY, OTHER`.
Aggregations (monthly/yearly/category totals) are computed on the backend.

## Services (history)

| Method | Endpoint                        | Description        |
| ------ | ------------------------------- | ------------------ |
| GET    | /vehicles/:vehicleId/services   | Service history    |
| POST   | /vehicles/:vehicleId/services   | Add service record |
| GET    | /services/:id                   | Record details     |
| PATCH  | /services/:id                   | Edit record        |
| DELETE | /services/:id                   | Delete record      |

## Maintenance

| Method | Endpoint                          | Description          |
| ------ | --------------------------------- | -------------------- |
| GET    | /vehicles/:vehicleId/maintenance  | List items (+ due soon / overdue views) |
| POST   | /vehicles/:vehicleId/maintenance  | Add item             |
| PATCH  | /maintenance/:id                  | Update item          |
| DELETE | /maintenance/:id                  | Delete item          |

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
- Pagination: `?page=1&limit=20` → `{ "data": [], "meta": { "page", "limit", "total" } }`.
- Date/time: ISO 8601 UTC. Money: smallest consistent unit via `numeric(10,2)`, currency INR.
- Rate-limited endpoints: auth, AI chat, quotation analyze.
