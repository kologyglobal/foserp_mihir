# Incoming Quality Workflow (Phase 7B)

## Status

**NOT READY — PURCHASE RECEIPT FOUNDATION REQUIRED**

There is no API-backed Purchase GRN / Goods Receipt document in this repository.
Quality must not invent receipt rows.

## Intended flow (when GRN ships)

Purchase Receipt → Quarantine / Quality Hold warehouse → Inspection → disposition → Inventory release (accepted) / rejection area (rejected)

## Phase 7B behaviour

- `GET /quality/incoming/queue` → empty list + readiness payload `{ ready: false, reason: 'PURCHASE_RECEIPT_FOUNDATION_REQUIRED' }`
- Frontend Incoming tab shows an explicit blocked banner (API mode), not demo fake GRNs as if live.

## Ownership reminder

Quality owns the inspection decision. Purchase owns supplier return / replacement. Accounting owns debit notes (deferred).
