# Purchase multi-unit UOM (vendor → primary)

## Field contract

| Field | Meaning |
|-------|---------|
| `quantity` | Primary / stock / production UOM qty |
| `uomQuantity` | Vendor / purchase UOM qty |
| `uomConversionFactor` | Vendor units per **1** primary unit |
| `rate` | Vendor unit cost |
| `unitCostPrimary` | `rate × uomConversionFactor` |

Formulas: `quantity = uomQuantity / uomConversionFactor`, `lineAmount = rate × uomQuantity`.

## Apply locally

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx prisma generate
```

## Apply on Hostinger (phpMyAdmin)

Run [`backend/scripts/purchase-multi-unit-uom-hostinger.sql`](../backend/scripts/purchase-multi-unit-uom-hostinger.sql).

## Item setup example

Pipe 5.6mm: base UOM = NOS, purchase UOM = Meter, factor = 3 → PO/GRN enter meters; stock posts NOS.

## QA test plan

Full 15-scenario matrix (partial GRN, over-receipt, multi-WH, cost identity, deferred invoice/backdate):  
[`PURCHASE_MULTI_UNIT_UOM_TEST_PLAN.md`](./PURCHASE_MULTI_UNIT_UOM_TEST_PLAN.md)
