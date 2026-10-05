# AutoGenius — API Design

Base URL: `/api/v1` · All bodies are JSON · Auth via `Authorization: Bearer <accessToken>`
(Unimplemented modules below are the V1 contract; they are built in Tasks 02–07.)

## Auth

| Method | Endpoint        | Description                          |
| ------ | --------------- | ------------------------------------ |
| POST   | /auth/register  | Create account (name, email, password) |
| POST   | /auth/login     | Returns access + refresh tokens      |
| POST   | /auth/refresh   | Rotate tokens                        |
| POST   | /auth/logout    | Invalidate refresh token             |
| GET    | /auth/me        | Current user profile                 |

## Vehicles

| Method | Endpoint          | Description            |
| ------ | ----------------- | ---------------------- |
| GET    | /vehicles         | List my vehicles       |
| POST   | /vehicles         | Add vehicle            |
| GET    | /vehicles/:id     | Vehicle details        |
| PATCH  | /vehicles/:id     | Edit vehicle           |
| DELETE | /vehicles/:id     | Delete vehicle         |

Fields: `make, model, variant, year, fuelType, transmission, registrationNumber, currentOdometer`
Ownership rule: a user can only access their own vehicles (enforced in the service layer).

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
