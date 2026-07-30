# Incoming Quality Workflow

## Status

**READY** — Purchase GRN foundation + Purchase Quality Inspection API are shipped.

Incoming material QC is **not** a manufacturing `INCOMING` category inspection on `mfg_quality_inspections`. It uses:

1. `GoodsReceipt` with `status = QC_PENDING` (and inspection-required lines)
2. `PurchaseQualityInspection` (+ lines + **parameter checklist**) under `/purchase/quality-inspections`

The Quality workspace incoming endpoints aggregate those Purchase rows for a single queue UI.

## Flow

```text
Purchase Receipt (GRN) → QC_PENDING / quarantine hold
  → Create / open Purchase QI
  → Parameter checklist + qty disposition
  → Complete ACCEPT / PARTIAL / REJECT (fail-closed inventory post)
  → Purchase Return for rejected qty (Purchase-owned)
```

## APIs

| Surface | Path |
|---------|------|
| Queue | `GET /quality/incoming/queue` → `{ ready: true, code: 'PURCHASE_INCOMING_QC_AVAILABLE', items[], counts }` |
| Workspace | `GET /quality/workspace/incoming` (same service) |
| QI CRUD / lifecycle | `/purchase/quality-inspections` (+ `/complete`, `/hold`, `/cancel`, …) |
| Parameter results | Persisted on QI create (defaults) and `PATCH` (`parameters[]`, `inspectionPlan`) |

## Frontend

| Mode | Behaviour |
|------|-----------|
| API | `/quality/incoming` live table → GRN or Purchase QI hrefs; Purchase QI detail edits checklist |
| Demo | Legacy demo incoming inspections from quality store |

## Ownership

| Domain | Owns |
|--------|------|
| Quality | Queue UX, manufacturing plans/NCR/certificates |
| Purchase | GRN, Purchase QI document, supplier return |
| Inventory | Stock movements / QC hold release (called from QI complete) |
| Accounting | Debit notes — separate (may still be deferred) |

## Related

- [QUALITY_SCOPE_AND_DEFERRALS.md](./QUALITY_SCOPE_AND_DEFERRALS.md)
- Migration `20260730110000_purchase_qi_parameter_checklist`
