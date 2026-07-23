# Manufacturing Failed / Unreconciled Events

Integrity SoT: `manufacturing-accounting-event-integrity.service.ts`.

## Enablement blockers

| Code | Meaning |
|------|---------|
| `FAILED_ACCOUNTING_EVENTS` | `status=FAILED` (incl. retry exhausted) |
| `INVENTORY_POSTINGS_UNRECONCILED` | RECORDED pending, inventory↔accounting gaps, duplicates, reversal chain issues |

`SKIPPED_FLAG_OFF` / `SKIPPED_ZERO` are **not** unreconciled.

## Workspace

`GET /manufacturing/accounting/workspace/failed` — failed register.  
Retry: `POST /manufacturing/accounting/events/:id/retry` (`manufacturing.accounting.retry` / `failed_events.retry`).

Users **must not** manually set event status to success.

UI-safe exception rows omit stack traces; `technicalDetails` only for elevated roles.
