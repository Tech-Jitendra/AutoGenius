# AutoGenius — Database Design (PostgreSQL)

Naming: `snake_case` tables/columns. Primary keys are UUIDs. Timestamps are `timestamptz`.
Migrations are managed with the API's migration tooling (introduced with the Auth task).

## Entity Relationship Summary

```
users 1─∞ vehicles 1─∞ vehicle_service_records
              1─∞ maintenance_items
              1─∞ expenses
users 1─∞ ai_conversations 1─∞ ai_messages
users 1─∞ quotations 1─∞ quotation_items
```

## Tables

### users

| Column          | Type          | Notes                    |
| --------------- | ------------- | ------------------------ |
| id              | uuid PK       |                          |
| name            | varchar(100)  |                          |
| email           | citext UNIQUE | validated at API layer   |
| phone           | varchar(20)   | nullable                 |
| password_hash   | text          | bcrypt; never returned   |
| created_at      | timestamptz   |                          |
| updated_at      | timestamptz   |                          |

### vehicles

| Column              | Type         | Notes                          |
| ------------------- | ------------ | ------------------------------ |
| id                  | uuid PK      |                                |
| user_id             | uuid FK→users| INDEX; owner scoping           |
| make                | varchar(50)  |                                |
| model               | varchar(50)  |                                |
| variant             | varchar(50)  | nullable                       |
| year                | smallint     |                                |
| fuel_type           | enum         | PETROL/DIESEL/CNG/HYBRID/ELECTRIC |
| transmission        | enum         | MANUAL/AUTOMATIC/AMT/CVT       |
| registration_number | varchar(20)  | nullable, optionally masked    |
| current_odometer    | integer      |                                |
| created_at          | timestamptz  |                                |
| updated_at          | timestamptz  |                                |

INDEX: `(user_id)`.

### vehicle_service_records

| Column        | Type         | Notes |
| ------------- | ------------ | ----- |
| id            | uuid PK      |       |
| vehicle_id    | uuid FK→vehicles | |
| service_date  | date         |       |
| odometer      | integer      | nullable |
| service_type  | varchar(50)  |       |
| description   | text         | nullable |
| workshop_name | varchar(100) | nullable |
| total_cost    | numeric(10,2)| nullable |
| notes         | text         | nullable |
| created_at    | timestamptz  |       |

### maintenance_items

| Column              | Type         | Notes |
| ------------------- | ------------ | ----- |
| id                  | uuid PK      |       |
| vehicle_id          | uuid FK→vehicles | |
| category            | varchar(50)  | OIL_CHANGE, BRAKE_INSPECTION, TYRE_REPLACEMENT, BATTERY, AIR_FILTER, COOLANT, GENERAL_SERVICE |
| name                | varchar(100) |       |
| last_service_date   | date         | nullable |
| last_odometer       | integer      | nullable |
| next_due_date       | date         | nullable |
| next_due_odometer   | integer      | nullable |
| status              | enum         | OK / DUE_SOON / OVERDUE |
| notes               | text         | nullable |

INDEX: `(vehicle_id, status)`.

### expenses

| Column       | Type          | Notes |
| ------------ | ------------- | ----- |
| id           | uuid PK       |       |
| vehicle_id   | uuid FK→vehicles | |
| category     | enum          | FUEL, SERVICE, REPAIR, INSURANCE, PUC, ACCESSORY, OTHER |
| amount       | numeric(10,2) |       |
| expense_date | date          |       |
| odometer     | integer       | nullable |
| description  | text          | nullable |
| metadata     | jsonb         | nullable |
| created_at   | timestamptz   |       |

INDEX: `(vehicle_id, expense_date)`, `(vehicle_id, category)`.
Totals (monthly/yearly/per-category) are computed by the backend, not stored.

### ai_conversations

| Column      | Type         | Notes |
| ----------- | ------------ | ----- |
| id          | uuid PK      |       |
| user_id     | uuid FK→users|       |
| vehicle_id  | uuid FK→vehicles | nullable (general question) |
| title       | varchar(200) |       |
| created_at  | timestamptz  |       |
| updated_at  | timestamptz  |       |

### ai_messages

| Column          | Type        | Notes |
| --------------- | ----------- | ----- |
| id              | uuid PK     |       |
| conversation_id | uuid FK→ai_conversations | INDEX |
| role            | enum        | user / assistant / system |
| content         | text        |       |
| metadata        | jsonb       | structured AI payload for assistant turns |
| created_at      | timestamptz |       |

### quotations

| Column       | Type        | Notes |
| ------------ | ----------- | ----- |
| id           | uuid PK     |       |
| user_id      | uuid FK→users |     |
| vehicle_id   | uuid FK→vehicles | nullable |
| file_url     | text        | object storage key; nullable for text-only |
| status       | enum        | UPLOADED / PROCESSING / ANALYZED / FAILED |
| raw_text     | text        | extracted OCR text |
| total_amount | numeric(10,2)| nullable |
| analysis     | jsonb       | validated AI analysis result |
| created_at   | timestamptz |       |
| updated_at   | timestamptz |       |

### quotation_items

| Column        | Type          | Notes |
| ------------- | ------------- | ----- |
| id            | uuid PK       |       |
| quotation_id  | uuid FK→quotations | INDEX |
| description   | text          |       |
| quantity      | numeric(8,2)  | nullable |
| unit_price    | numeric(10,2) | nullable |
| labour_cost   | numeric(10,2) | nullable |
| tax           | numeric(10,2) | nullable |
| total         | numeric(10,2) | nullable |
| ai_category   | enum          | NECESSARY / REVIEW / OPTIONAL / POTENTIALLY_OVERPRICED / UNKNOWN |
| ai_reason     | text          |       |
| estimated_min | numeric(10,2) | nullable |
| estimated_max | numeric(10,2) | nullable |
