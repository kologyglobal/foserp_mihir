# Incoming Quality Workflow

## Status

**READY WITH CONDITIONS** — Purchase GRN + Purchase Quality Inspection + **Incoming Quality command center** (`/quality/incoming`).

See [INCOMING_QUALITY_UNIFICATION.md](./INCOMING_QUALITY_UNIFICATION.md) for the full unification map, permissions, and deploy checklist.

Incoming material QC is **not** a manufacturing `INCOMING` category inspection on `mfg_quality_inspections`. It uses:

1. `GoodsReceipt` with `status = QC_PENDING` (inspection required) → stock often `QC_HOLD`
2. `PurchaseQualityInspection` under `/purchase/quality-inspections` (optional `inspectionPlanId` snapshot; auto-resolve ACTIVE INCOMING plan by item/category when omitted)
3. Create UI `/purchase/quality-inspections/new?grnId=` picks plan from Quality → Inspection Plans
4. Quality workspace `/quality/incoming` as the **primary operational screen** (aggregates GRN + QI line work)

## Flow

```text
Purchase Receipt (GRN) → QC_PENDING / QC hold
  → Incoming Quality workbench
  → Create / open Purchase QI (plan snapshot optional)
  → Assign · Start · parameter checklist + qty disposition
  → Complete ACCEPT / PARTIAL / REJECT (fail-closed inventory post)
  → Optional NCR (sourceType=PURCHASE_QI) · Purchase Return for rejected qty
```

## APIs

| Surface | Path |
|---------|------|
| Workbench | `GET /quality/incoming/queue` |
| Reports | `GET /quality/incoming/reports` |
| Stock panel | `GET /quality/incoming/stock-status/{grn|qi|item}/…` |
| QI lifecycle | `/purchase/quality-inspections` (+ assign/start/complete/ncr/return-prefill) |

## Ownership

| Domain | Owns |
|--------|------|
| Quality | Incoming command center UX, shared plans/parameters masters, NCR |
| Purchase | GRN, Purchase QI document, supplier return |
| Inventory | Stock movements / QC hold release (called from QI complete) |

## Related

- [INCOMING_QUALITY_UNIFICATION.md](./INCOMING_QUALITY_UNIFICATION.md)
- Migration `20260804140000_incoming_quality_unification`
