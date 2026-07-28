# GRN receiving tolerance — test plan & scenarios

Purpose: build confidence that Item Master `%` + Setup fallback + GRN statuses + approval behave correctly — including **multi-line GRNs where only 1 of 3 items is received**.

## Evening review demo pack

For stakeholder walkthrough (items 0–15%, open POs, draft/pending/posted GRNs):

```bash
cd backend && npm run seed:grn-tolerance-review
```

See `docs/PURCHASE_GRN_TOLERANCE_REVIEW_DEMO.md` — cheat sheet prints with live document numbers.

---

## Seeded items (live script)

| Item code | Receiving tolerance | Intent |
|-----------|---------------------|--------|
| `TOL-ITEM-0PCT` | **0%** | Exact match only; any excess → approval |
| `TOL-ITEM-2PCT` | **2%** | Narrow band (typical metals) |
| `TOL-ITEM-10PCT` | **10%** | Wide band (bulk / loose count) |

Vendor: `VND-TOL-01` · Warehouse: first active (`BO-MAIN` / …)

---

## Plan A–E — single-line calculator (open qty = 100)

| # | Item tol | Received | Close open? | Expected status | Approval? |
|---|----------|----------|-------------|-----------------|-----------|
| A1 | 0% | 100 | — | OK | No |
| A2 | 0% | 101 | — | EXCESS_OUTSIDE | **Yes** |
| A3 | 0% | 90 | no | PARTIAL | No |
| A4 | 0% | 90 | yes | SHORT_OUTSIDE | **Yes** |
| A5 | 0% | 0 | — | NOT_RECEIVED | No |
| B1 | 2% | 98–102 | — | OK | No |
| B2 | 2% | 101.5 | — | EXCESS_WITHIN | No |
| B3 | 2% | 105 | — | EXCESS_OUTSIDE | **Yes** |
| B4 | 2% | 50 | no | PARTIAL | No |
| C1 | 10% | 105 | — | EXCESS_WITHIN | No |
| C2 | 10% | 111 | — | EXCESS_OUTSIDE | **Yes** |
| C3 | 10% | 90 (lower edge) | — | OK | No |
| C4 | 10% | 85 (below band) | no | PARTIAL | No |
| D1 | item 0 + Setup 5% allow | 103 | — | EXCESS_WITHIN (setup fallback) | No |
| D2 | item 0 + Setup off | 103 | — | EXCESS_OUTSIDE | **Yes** |
| E1 | 2% | 102 (upper edge) | — | EXCESS_WITHIN | No |
| E2 | 2% | 102.01 | — | EXCESS_OUTSIDE | **Yes** |
| E3 | 10% | 110 (upper edge) | — | EXCESS_WITHIN | No |
| E4 | 10% open=10 | 10.5 | — | EXCESS_WITHIN | No |

Variance: `((received − open) / open) × 100` when `open > 0`.

---

## Plan M — multi-line GRN (3 items on one PO)

UI loads **all pending PO lines**. User may set received qty to **0** on lines not arriving today. Each line is evaluated independently; **header needs approval if ANY line is outside**.

| # | Receive pattern | Expected line statuses | Header approval? | PO after submit |
|---|-----------------|------------------------|------------------|-----------------|
| **M1** | Only middle (2% item) exact; others 0 | NOT_RECEIVED, **OK**, NOT_RECEIVED | No | Only middle `received=100`; others stay open |
| **M2** | Only first (0%) exact | OK, NOT_RECEIVED, NOT_RECEIVED | No | Only first received |
| **M3** | Only last (10%) +5% | NOT_RECEIVED, NOT_RECEIVED, EXCESS_WITHIN | No | Only last received |
| **M4** | Only first +10% (0% tol) | EXCESS_OUTSIDE, NOT_RECEIVED×2 | **Yes** | Pending until approve |
| **M5** | First half + middle exact + last 0 | PARTIAL, OK, NOT_RECEIVED | No | Two lines updated |
| **M6** | All three exact | OK×3 | No | All closed |
| **M7** | All zero | NOT_RECEIVED×3 | No | PO open unchanged |
| **M8** | Zero + within 2% + outside 10% | NOT_RECEIVED, EXCESS_WITHIN, EXCESS_OUTSIDE | **Yes** | Pending |
| **M9** | Only middle outside (+5% on 2%) | NOT_RECEIVED, EXCESS_OUTSIDE, NOT_RECEIVED | **Yes** | Pending |
| **M10** | First short-close; others 0 | SHORT_OUTSIDE, NOT_RECEIVED×2 | **Yes** | Pending |

**Rule:** zero qty on a line does **not** block submit and does **not** require approval — it leaves that PO line open for a later GRN.

---

## Live API flow (script)

1. Upsert UOM / vendor / warehouse / **3 tolerance items**.
2. Single-line PO→GRN: exact / excess approve / 10% within / reject / zero.
3. **3-line PO → receive only middle** → statuses + submit + PO received qty check.
4. **3-line PO → receive only 0% item outside** → `PENDING_TOLERANCE_APPROVAL`.

## How to run

```bash
# Backend unit
cd backend
npm run test:grn-tolerance

# Backend live E2E (MySQL + tenant) — includes 1-of-3
cd backend
npm run test:grn-tolerance-live
# Seed items only (for UI play):
npx tsx scripts/test-grn-tolerance-flow.ts --seed-only

# Frontend Plans A–E + M (calculator + document rollup)
cd frontend
npm run test:grn-tolerance
```

## UI manual checklist

1. Item Master → `TOL-ITEM-0PCT` / `2PCT` / `10PCT` → confirm **Receiving tolerance (%)**.
2. Create **one released PO with all three items** (qty 100 each).
3. New GRN from that PO → set received **100** on one line, **0** on the other two → statuses Not received / OK / Not received; banner shows “2 not received”.
4. Submit → posts only the received item; reopen PO → other two still pending.
5. Repeat with excess on the 0% line only → Pending Tolerance Approval.
6. Print GRN → stacked dual qty (A4 landscape).
