# GRN Tolerance — Evening Review Demo Pack

Seed rich demo data (items, open POs, GRNs in draft / pending / posted) for stakeholder review.

## Seed (run before the meeting)

```bash
cd backend
npm run seed:grn-tolerance-review
```

Console prints a **cheat sheet** with real PO/GRN numbers for your tenant.

## What gets created

### Items (`TOL-ITEM-*` in Item Master)

| Code | Tol % | Story |
|------|-------|--------|
| `TOL-ITEM-0PCT` | 0% | Exact only — any excess needs approval |
| `TOL-ITEM-1PCT` | 1% | Tight / precision |
| `TOL-ITEM-2PCT` | 2% | Typical metals |
| `TOL-ITEM-5PCT` | 5% | Mid band |
| `TOL-ITEM-10PCT` | 10% | Bulk / loose |
| `TOL-ITEM-15PCT` | 15% | Wide band |

Vendor: **`VND-TOL-01`** (Tolerance Review Vendor). Filter PO/GRN remarks containing **`REVIEW-PACK`**.

### Open POs (create New GRN live)

| Tag | Contents | Live tip |
|-----|----------|----------|
| PO-A | 0% + 2% + 10% qty 100 | Set one line to 100, others **0** → 1-of-3 |
| PO-B | 0% qty 50 | Receive 50 = OK; 55 = pending approval |
| PO-C | 1% / 5% / 15% | Show different Tol % columns together |

### Pre-built GRNs

| State | Story |
|-------|--------|
| **Posted** | 1-of-3 middle line only; other PO lines still open |
| **Pending tolerance** | 0% item received 112 → Approve/Reject |
| **Draft** | 5% within + 10% not received — edit in UI |
| **Posted** | 10% item +5% within band (no approval) |
| **Pending** | 1-of-3 where the only received line is outside 2% |

## 8-minute walkthrough

1. **Item Master** → filter `TOL-ITEM` → open 0% vs 10% → **Receiving tolerance (%)**.
2. **Purchase Orders** → open PO-A → **New GRN** → receive only one item (others 0) → submit → re-open PO (two lines still pending).
3. **GRN list / Approvals** → open Pending Tolerance → Approve or Reject.
4. **Posted 1-of-3 GRN** → Print / Download PDF (A4 landscape, dual qty).
5. Optional: PO-B receive 55 → show pending banner without leaving the editor flow.

## Automated confidence (optional before review)

```bash
cd backend && npm run test:grn-tolerance && npm run test:grn-tolerance-live
cd frontend && npm run test:grn-tolerance
```

Full scenario matrix: `docs/PURCHASE_GRN_TOLERANCE_TEST_PLAN.md`.
