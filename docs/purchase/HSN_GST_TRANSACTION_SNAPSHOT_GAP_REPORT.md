# HSN/GST Transaction Snapshot — Gap Report

**Version:** 1.0  
**Date:** 2026-08-05  
**Status:** Phase 1 implementation in progress  
**Prerequisite:** Purchase P1 certification PASS  

---

## Objective

Every commercial purchase document line must carry **immutable tax snapshots** so that if Item Master or GST masters change later, historical PO/GRN/Invoice lines still show the rates that applied at transaction time.

```text
Item Master (HSN + GST group + dated rates)
        ↓ snapshot at save
PO Line
        ↓ copy on GRN
GRN Line
        ↓ copy on Invoice
Invoice Line → AP handoff
```

---

## Current state (pre Phase 1)

| Field | Item Master | PO Line | GRN Line | Invoice Line |
|-------|-------------|---------|----------|--------------|
| `hsnId` / code | ✅ live | ✅ FK + `hsnCodeSnapshot` | ❌ | ❌ |
| `gstGroupId` / code | ✅ live | ✅ FK + `gstGroupCodeSnapshot` | ❌ | ❌ |
| GST rate (combined) | via `MasterGstRate` | ❌ FE-only `gstRatePct` | ❌ | flat `taxRatePct` |
| CGST/SGST/IGST rates | ✅ master | ❌ | ❌ | ❌ |
| GST scheme | derived | ❌ | ❌ | ❌ |

**Gold reference:** `SalesInvoiceLine` has full `hsnCodeSnapshot`, `cgstRate`, `sgstRate`, `igstRate`, amounts.

**Purchase PO:** `fillLineMasterSnapshots` resolves HSN/group codes but **not GST rates**.

**GRN:** Copies item code/name from PO; **no tax snapshots**.

**Invoice:** Uses input `taxRatePct`; can re-read live master via FE — **not snapshot-safe**.

**Comparison→PO:** Was missing HSN/GST fields on explicit `create` mapping (fixed in Phase 1).

---

## Phase 1 implementation (this release)

### Schema (`20260805140000_purchase_tax_snapshots`)

**PO line:** `gstRatePctSnapshot`, `cgstRateSnapshot`, `sgstRateSnapshot`, `igstRateSnapshot`, `gstSchemeSnapshot`

**GRN line:** full HSN/GST id + code snapshots + rate snapshots (copied from PO at receive)

**Invoice line:** HSN/GST snapshots + CGST/SGST/IGST rate snapshots (from GRN/PO chain)

### Services

- `purchase-tax-snapshot.ts` — resolves rates via `resolveLineGstFromMasters({ applicableFor: 'PURCHASE' })`
- PO `fillLineMasterSnapshots` — persists rate snapshots using vendor + plant state
- GRN line build — copies tax snapshots from PO line
- Invoice `buildLines` — prefers PO/GRN snapshots over live input

### Out of scope (Phase 2)

- BIN ledger (separate phase)
- Per-line CGST/SGST/IGST **amount** snapshots on PO (header tax total only today)
- Finance unified GST split bridge (on hold per item-master rules)
- PR/RFQ/VQ tax snapshots (Phase B dual-UOM)

---

## Verification

After migration:

1. Create PO for item with HSN 7306 / GST 18%
2. Change master GST to 12%
3. PO line still shows 18% snapshots
4. GRN + Invoice inherit 18%

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-08-05 | Initial gap report + Phase 1 schema plan |
