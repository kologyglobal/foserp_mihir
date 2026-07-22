# Phase 8B — UAT Pack (Pilot Scope)

**Mode:** `VITE_USE_API=true` · Tenant: `vasant-trailers` (UAT) / `pilot-client` (placeholder)  
**Pass/Fail:** leave blank until executed. Mark **N/A** where excluded by pilot freeze.

Adapted from manufacturing go-live style cases 1–17 to the controlled pilot path (8A readiness).

---

| ID | Title | Role | Steps (outline) | Expected | Result | Notes |
|----|-------|------|-----------------|----------|--------|-------|
| UAT-01 | Login + API hydrate | All | Login JWT; confirm tenant slug; masters/CRM hydrate without demo merge | Session valid; no demo seed mixed | ☐ Pass ☐ Fail | |
| UAT-02 | Mfg setup masters | Admin / Planner | Create or verify WC, machine, BOM version, routing version, profile for P1–P3 | Records active; setup routes only | ☐ Pass ☐ Fail | |
| UAT-03 | Opening stock load | Stores / Admin | Load RM balances via API/script for P1 BOM | `InventoryStockBalance` on hand > 0 | ☐ Pass ☐ Fail | Not via demo inventory SPA |
| UAT-04 | WO create + release (simple) | Planner | Create WO for `PILOT-FG-SIMPLE` → release | WO released; on Today/Control Room | ☐ Pass ☐ Fail | |
| UAT-05 | Assign + My Work complete | Supervisor + Operator | Assign op → Start → Complete good qty | Stage balance updates; idempotent double-submit safe | ☐ Pass ☐ Fail | |
| UAT-06 | Daily Production batch | Supervisor | Draft multi-line batch → validate → submit | Atomic post; batch immutable | ☐ Pass ☐ Fail | |
| UAT-07 | Material issue | Stores | Issue components from API WO materials | Movement posted; on hand down | ☐ Pass ☐ Fail | |
| UAT-08 | Material return | Stores | Return unused qty | Movement posted; on hand up | ☐ Pass ☐ Fail | |
| UAT-09 | Multilevel WO path | Planner + Ops | Release `PILOT-FG-MULTI`; progress parent/child path as designed | Progress without MRP | ☐ Pass ☐ Fail | |
| UAT-10 | In-process / final QC | QC | Queue inspection for `PILOT-FG-QC`; complete decision | Inspection closed; no incoming used | ☐ Pass ☐ Fail | |
| UAT-11 | Incoming QC | QC | — | — | **N/A** | Excluded — no GRN |
| UAT-12 | Runtime change + WIP transfer | Supervisor | Apply allowed runtime change; WIP move if applicable | Audit trail; balances consistent | ☐ Pass ☐ Fail | |
| UAT-13 | Corrections | Supervisor | Correct a Daily Update or progress mistake | Correction id; balances fixed | ☐ Pass ☐ Fail | |
| UAT-14 | Job Work split / JW order | Planner | — | — | **N/A** *(or CONDITIONAL)* | N/A until JW smoke PASS; then re-open |
| UAT-15 | FG receipt + WO close | Supervisor / Stores | FG via approved API path if smoked; close WO | WO closed; FG stock if in scope | ☐ Pass ☐ Fail | Skip FG if smoke not done — note |
| UAT-16 | Dispatch pick / pack | Dispatch | — | — | **N/A** | Excluded — pick/pack not shipped |
| UAT-17 | Mfg cost / GL posting | Finance | — | — | **N/A** | `MANUFACTURING_ACCOUNTING` OFF; costing UI forbidden |

---

## Optional finance riders (if pilot includes finance)

| ID | Title | Role | Steps | Expected | Result |
|----|-------|------|-------|----------|--------|
| UAT-F1 | Journal post | Finance | Create + post balanced journal on canonical route | Posted voucher | ☐ Pass ☐ Fail |
| UAT-F2 | Money In or Money Out smoke | Finance | One document on `/accounting/money-in` or `money-out` | API path works; no legacy AR/AP | ☐ Pass ☐ Fail |
| UAT-F3 | Bank statement import | Finance | Import file on Bank & Cash | Statement validated | ☐ Pass ☐ Fail |

---

## Sign-off

| Role | Name | Date | Verdict |
|------|------|------|---------|
| Implementation lead | | | ☐ Ready for client pilot ☐ Ready with conditions ☐ Not ready |
| Client sponsor (later) | | | |

*Attach document numbers / screenshots under pilot evidence folder (TBD).*
