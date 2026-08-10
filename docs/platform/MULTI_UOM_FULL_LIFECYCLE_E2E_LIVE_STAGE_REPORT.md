# Multi-UOM Full Lifecycle E2E — LIVE STAGE run (real HTTP, stageapi.dhurandharcrm.com)

**Date:** 2026-08-10
**Trigger:** Follow-up to `MULTI_UOM_FULL_LIFECYCLE_E2E_REPORT.md` (local DB run). User asked whether
the same test could run against the live DB/API, confirmed stage has a separate database from local
dev, and approved running real HTTP requests against `stageapi.dhurandharcrm.com` in the
`vasant-trailers` tenant.
**Method:** Zero local DB/Prisma access. Every step — login, master-data lookups, and all 16
documents — goes over real HTTP to the deployed backend, using the same demo credentials as the
`stage.dhurandharcrm.com` login screen. Re-runnable any time.

```bash
cd backend
npx tsx scripts/test-full-purchase-lifecycle-muom-e2e-live.ts
```

Env overrides available: `API_BASE`, `UI_BASE`, `TENANT_SLUG`, `MAKER_EMAIL`/`MAKER_PASSWORD`,
`APPROVER_EMAIL`/`APPROVER_PASSWORD` (defaults match the seeded `vasant-trailers` demo accounts).

---

## 1. Pre-flight findings (before the flow even started)

### 1.1 Stage login: one transient 500, not a real bug

First `POST /auth/login` for `admin@vasant-trailers.com` returned `500 Internal server error`.
Re-tested systematically before assuming a real defect:

| Probe | Result |
|---|---|
| Wrong password (same account) | `401 AUTH_INVALID_CREDENTIALS` (correct) |
| Bogus tenant slug | `401 AUTH_INVALID_CREDENTIALS` (correct, no tenant-existence leak) |
| Missing body | `400 VALIDATION_ERROR` (correct) |
| `purchase@vasant-trailers.com` (correct pwd) | `200 OK` |
| `quality@vasant-trailers.com` (correct pwd) | `200 OK` |
| `admin@vasant-trailers.com` retry (correct pwd) | `200 OK` |
| `accounts@vasant-trailers.com` (correct pwd) | `200 OK` |

Conclusion: an isolated, non-reproducing 500 on one login call — most likely a cold-start/connection-pool
blip on the shared Hostinger box (`/health` reported `database: connected` throughout). Not a
credentials or code defect. The live script includes a one-retry-on-5xx wrapper (`callApi`) as a
pragmatic mitigation; **worth keeping an eye on** if it recurs under real user load, but not treated
as a blocker here.

### 1.2 Stage catalog gap: only 2 real Multi-UOM items existed

Unlike local dev (seeded with 8 synthetic MUOM test items), the `vasant-trailers` stage tenant's real
catalog had:

- **79 active items total**
- Only **2** with `purchaseUomId ≠ baseUomId`: `ITEM-0121` (KG↔Nos, factor 1 — same magnitude, just a
  different UOM label) and `RM-MS-PIPE-DN25` (MTR↔Nos, factor 3 — a genuine scaling conversion)
- The other 77 are all single-UOM (mostly tanker/trailer manufacturing items: `FG-*`, `BO-*`, `RM-*`,
  `SA-*`, `SFG-*`, `CON-*`)

Per explicit user decision, **6 new Multi-UOM item masters were created via the live API** (not a DB
script) to reach 8 MUOM + 8 single, matching the original test scope:

| Code | Base UOM | Purchase UOM | Factor |
|---|---|---|---|
| `TEST-MUOM-KG-A-585726` | Nos | KG | 25 |
| `TEST-MUOM-KG-B-585726` | Nos | KG | 50 |
| `TEST-MUOM-KG-C-585726` | Nos | KG | 5 |
| `TEST-MUOM-KG-D-585726` | Nos | KG | 2.5 (fractional) |
| `TEST-MUOM-MTR-A-585726` | Nos | MTR | 6 |
| `TEST-MUOM-MTR-B-585726` | Nos | MTR | 3 |

Created with `backend/scripts/_seed-stage-muom-items.ts` (one-off, admin token, `POST
/masters/items`) — safe to keep, deactivate, or delete; category `RM` (Raw Material), all flagged
`isPurchasable`/`isStockable`, description notes they're test items.

### 1.3 Stage had zero Department masters

PR submit enforces `PR_DEPARTMENT_REQUIRED` (a service-level rule, not just Zod) and stage had **no**
departments at all. Created one via `POST /departments` (admin token): code `PUR`, name "Purchase".
This is a real onboarding gap on this tenant (`master.item.view`/`department.view` had nothing to
show) — worth checking whether it blocks real users creating PRs from the UI today, since a fresh
tenant with no departments would hit the same wall.

## 2. Scope of the test run

One PO, one vendor (`VEND-0001` — Gujarat Steel Traders), **16 lines**, real HTTP end to end:

| # | Item | Kind | Purchase UOM | Base UOM | Factor | Ordered (base) |
|---|------|------|--------------|----------|--------|-----------------|
| 1 | RM-MS-PIPE-DN25 (existing) | MUOM | MTR | Nos | 3 | 20 |
| 2 | TEST-MUOM-KG-A-585726 | MUOM | KG | Nos | 25 | 40 |
| 3 | TEST-MUOM-KG-B-585726 | MUOM | KG | Nos | 50 | 20 |
| 4 | TEST-MUOM-KG-C-585726 | MUOM | KG | Nos | 5 | 60 |
| 5 | TEST-MUOM-KG-D-585726 | MUOM | KG | Nos | 2.5 (fractional) | 40 |
| 6 | TEST-MUOM-MTR-A-585726 | MUOM | MTR | Nos | 6 | 25 |
| 7 | TEST-MUOM-MTR-B-585726 | MUOM | MTR | Nos | 3 | 45 (partial receive 80%) |
| 8 | ITEM-0121 (existing) | MUOM | Nos | KG | 1 | 30 |
| 9 | RM-BRACKET-TEST | SINGLE | Nos | Nos | 1 | 100 (10 returned post-accept) |
| 10 | BO-DRAIN-VALVE-DN25 | SINGLE, **QC required** | Nos | Nos | 1 | 50 (70/30 accept/reject) |
| 11 | RM-VALVE-TEST | SINGLE | Nos | Nos | 1 | 20 |
| 12 | BO-GASKET-MANHOLE-450 | SINGLE | Nos | Nos | 1 | 80 |
| 13 | BO-VALVE | SINGLE | Nos | Nos | 1 | 30 |
| 14 | BO-FASTENERS | SINGLE | Nos | Nos | 1 | 15 |
| 15 | CON-WELD-E7018 | SINGLE | KG | KG | 1 | 40 (partial receive 70%) |
| 16 | RM-MS-PLATE-008 | SINGLE | KG | KG | 1 | 25 |

8 Multi-UOM + 8 Single-UOM, including one fractional conversion factor (2.5) and two partial
receipts — same stress profile as the local run.

Document chain (this run's final numbers — re-running the script produces new ones):

```
PR-000043 (16 lines, rfqRequired)
  → RFQ-000008 (sent to VEND-0001)
    → VQ-000007 (commercial qty in purchase UOM, submitted)
      → Comparison (awarded) → PO-000053 (16 lines, one vendor)
        → GRN-000042 (15 non-QC lines, full + 2 partial receipts) → INVENTORY_POSTED
        → GRN-000043 (1 QC line, BO-DRAIN-VALVE-DN25) → QC_PENDING
          → QI-000029 (70% accept / 30% reject) → COMPLETED → GRN-000043 INVENTORY_POSTED
        → PRT-000008 (non-QC return, 10 Nos found-damaged) → COMPLETED
        → PRT-000009 (QC-rejected qty, 15 Nos) → COMPLETED
        → PI-000013 (invoice for the 15 non-QC lines) → POSTED
        → PI-000014 (invoice for the QC line, billed at accepted qty only) → POSTED
```

## 3. Result

**85/85 automated assertions passed** — same pass rate as the local run, over real HTTP, on the
live deployed backend, against the real production database. The one known defect (§4) reproduced
identically and was worked around the same way (existing `overrideAuthorized` finance-override path,
not patched).

| Stage | Multi-UOM contract check | Result |
|---|---|---|
| Master lookups | Vendor / warehouse / department / all 16 items resolved via real API (no DB access) | ✅ |
| PR | Created + submitted + approved, 16 lines | ✅ |
| RFQ | Sent to vendor, all 16 lines carried through | ✅ |
| VQ | Commercial qty entered in purchase UOM (e.g. 1000 KG for 40 Nos), submitted | ✅ |
| Comparison → PO | PO line `quantity` (stock) = commercial ÷ factor; `uomQuantity` preserved; `uomConversionFactor` snapshot stored | ✅ all 16 lines, incl. fractional factor 2.5 |
| GRN | `receivedQuantity` (base) / `receivedUomQuantity` (vendor) correct for full **and partial** receipts | ✅ |
| QC | Inspected/accepted/rejected tracked in base qty; QC hold isolated to its own GRN | ✅ |
| Return | `returnQuantity` in base qty against a specific GRN line; both plain-accepted and QC-rejected returns | ✅ |
| Invoice | Line `quantity` (base) → service auto-derives `uomQuantitySnapshot`/`uomConversionFactorSnapshot` | ✅ all 16 lines |
| Invoice (QC line) | Billed at **QC-accepted qty (35)**, not gross receipt (50) | ✅ |
| PO rollup | `invoicedQuantity` increments in **base** qty on invoice post — verified for QC line (35 Nos) and a MUOM line (20 Nos, not 60 MTR vendor qty) | ✅ |

## 4. Defect reproduced (same as local run — not new, not fixed here)

**PO header tax doesn't roll up from line-level GST** (`comparison.service.ts` /
`computePurchaseOrderTotals` copies the VQ header tax verbatim instead of summing line GST
snapshots) — both live invoices hit `Invoice tax tolerance exceeded` on first submit and were pushed
through with the platform's existing `overrideAuthorized` finance-override path, exactly like the
local run. See `MULTI_UOM_FULL_LIFECYCLE_E2E_REPORT.md` §3.1 for the code-level root cause. Confirms
this is a genuine, environment-independent defect, not a local-data artifact — still out of scope to
fix here (GST logic is under the standing "do not touch" restriction) but now double-confirmed on
production infra.

## 5. Document links (live, in the browser)

| Doc | Number | Link | Notes |
|-----|--------|------|-------|
| Purchase Requisition | PR-000043 | https://stage.dhurandharcrm.com/purchase/requisitions/9e4210af-a26a-4fda-a7ad-c4ac43be42ae | |
| RFQ | RFQ-000008 | https://stage.dhurandharcrm.com/purchase/rfqs/ced5abcf-b7be-47e4-9e16-9e73ad971d94 | |
| Vendor Quotation | VQ-000007 | https://stage.dhurandharcrm.com/purchase/vendor-quotations/9541df62-1293-4ccc-8a90-de8cfb5e3aeb | |
| Purchase Order | PO-000053 | https://stage.dhurandharcrm.com/purchase/orders/7fa193a4-1788-411c-8cf3-82e7acfa9fb2 | |
| GRN (non-QC) | GRN-000042 | https://stage.dhurandharcrm.com/purchase/grn/76487b97-ea23-4477-8639-0d70aeb3e986 | |
| GRN (QC) | GRN-000043 | https://stage.dhurandharcrm.com/purchase/grn/54aa7511-6750-40cf-b91f-bd4d3a687a38 | |
| Quality Inspection | QI-000029 | https://stage.dhurandharcrm.com/purchase/quality-inspections/5cf187b9-e330-45e2-9adb-8fbc0c78b44b | |
| Purchase Return | PRT-000008 | https://stage.dhurandharcrm.com/purchase/returns/05cf20b3-d0bd-49af-a3da-e172d02e4fad | RM-BRACKET-TEST qty 10 |
| Purchase Return | PRT-000009 | https://stage.dhurandharcrm.com/purchase/returns/6d4adf05-8120-48e0-bfb2-65bc35f2d47e | QC-rejected qty 15 |
| Purchase Invoice | PI-000013 | https://stage.dhurandharcrm.com/purchase/invoices/b9a42589-5db7-4911-8013-306b99febfdc | Non-QC lines |
| Purchase Invoice | PI-000014 | https://stage.dhurandharcrm.com/purchase/invoices/87fee63a-b9c7-49b3-96db-1fcd7d4e416a | QC-accepted qty 35 |

An earlier run (PR-000041/042 and downstream numbers) failed mid-flow on the department/item gaps
above before those were fixed — those partial documents (PR only, in PR-000041's case) were left as
harmless drafts/abandoned docs in the tenant; PR-000042's full chain (RFQ-000007 → PO-000052 →
GRN-000040/041 → QI-000028 → PRT-000006/007 → PI-000011/012) also completed successfully (same
85-assertion pass, minus the two rollup checks that crashed the script on a stale item-code
reference, fixed before the final run above). All are safe test data in a tenant already flagged for
this purpose.

## 6. What changed on stage as a side effect of this test (persistent, not cleaned up)

- **6 new item masters**: `TEST-MUOM-KG-A/B/C/D-585726`, `TEST-MUOM-MTR-A/B-585726` (category `RM`,
  status `ACTIVE`). Safe to deactivate/delete — clearly named and described as test items.
- **1 new department**: `PUR` / "Purchase". This is real, useful master data (stage had none before);
  recommend keeping it rather than deleting, and checking whether other departments should be seeded
  too since this was a genuine gap, not test noise.
- **Transactional documents**: 3 PRs, 2 RFQs, 2 VQs, 2 POs, 4 GRNs, 2 QIs, 4 Returns, 4 Invoices —
  all in `vasant-trailers`, all clearly test data per the user's own remarks/vendor-challan naming
  (`LIVE ... E2E`, `CH-A-LIVE-*`, `VINV-A-LIVE-*`), left in place per the user's earlier "okay with
  test documents" confirmation.

## 7. Artifacts

- Reusable script: `backend/scripts/test-full-purchase-lifecycle-muom-e2e-live.ts` — pure HTTP, no
  DB/Prisma dependency, safe to re-run against any environment via env vars.
- One-off setup script: `backend/scripts/_seed-stage-muom-items.ts` — creates the 6 MUOM items (idempotent
  guard not implemented — re-running creates a new timestamp-suffixed batch; delete after use if not
  needed for future runs).
- No production code was changed. Two new **master-data** records category as described in §6.
