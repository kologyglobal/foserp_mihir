# Incoming Quality Unification

**Verdict:** **READY WITH CONDITIONS**

Purchase keeps the **PurchaseQualityInspection** document model. Manufacturing quality inspections remain separate. Quality owns the operational **Incoming command center**; Inventory remains the stock movement authority.

## Flow

```text
GRN (inspection required)
  → submit → QC_HOLD (stock) + status QC_PENDING
  → /quality/incoming workbench
  → Create / Open Purchase QI (purchase.qi.*)
  → Shared Inspection Plan snapshot → checklist parameters
  → Assign inspector · Start · Complete ACCEPT / PARTIAL / REJECT
  → QC_HOLD → UNRESTRICTED (accept) / REJECTED (reject)  [fail-closed]
  → Optional: Create NCR (sourceType=PURCHASE_QI)
  → Optional: Create Purchase Return (prefill rejected qty)
```

## API surfaces

| Surface | Path |
|---------|------|
| Workbench | `GET /quality/incoming/queue` (filters: vendor, item, warehouse, status, inspector, ageing, dates) |
| Reports | `GET /quality/incoming/reports` |
| Assign / Start | `POST /quality/incoming/assign`, `POST /quality/incoming/start` |
| Stock panel | `GET /quality/incoming/stock-status/grn/:id`, `…/qi/:id`, `…/item/:itemId` |
| Purchase QI | `/purchase/quality-inspections` + assign/start/complete/ncr/return-prefill/stock-status |
| Plan snapshot | `POST` create QI with `inspectionPlanId` (copies plan lines into QI parameters once) |

## Permissions

| Role | Keys |
|------|------|
| Incoming QC Inspector | `quality.incoming.view`, `purchase.qi.view/create/update/complete`, `inventory.stock_status.view` |
| Quality Manager | Incoming + NCR + `quality.approve` + reports |
| Underlying writes | Still **`purchase.qi.*`** |

## Migrations

- `20260804140000_incoming_quality_unification` — QI plan refs, assignment timestamps, result/priority, NCR source fields.

## Conditions (deploy)

1. Run `npx tsx scripts/prisma-cli.ts migrate deploy` and regenerate Prisma client.
2. Re-seed / sync permissions so new keys exist (`quality.incoming.*`, `inventory.stock_status.view`).
3. Live suite: `npx vitest run tests/purchase-qi-lifecycle.test.ts tests/incoming-quality-unification.test.ts` with MySQL up.
4. SPA: `/quality/incoming` shows line-level queue (not redirect-only).
5. Optional: deep-link stock panel on GRN detail / Item 360 (API ready).

## Explicit non-goals (this phase)

- Merging `PurchaseQualityInspection` into `ManufacturingQualityInspection`
- Inventory owning QI documents
- Auto-create NCR on every reject

## Related

- [INCOMING_QUALITY_WORKFLOW.md](./INCOMING_QUALITY_WORKFLOW.md)
- [QUALITY_SCOPE_AND_DEFERRALS.md](./QUALITY_SCOPE_AND_DEFERRALS.md)
