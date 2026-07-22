# Phase 8B — Manual Controls

Maps each Phase 8A **condition / exclusion** to an operational control for the controlled pilot.  
Companion: [`PHASE8B_PILOT_SCOPE.md`](PHASE8B_PILOT_SCOPE.md), [`PHASE8A_PILOT_READINESS.md`](../audit/PHASE8A_PILOT_READINESS.md).

| ID | 8A condition / limitation | Risk if uncontrolled | Control | Owner role | Evidence | Frequency |
|----|---------------------------|----------------------|---------|------------|----------|-----------|
| MC-01 | Allowed routes only (deep links to legacy/demo forbidden) | Fake data / wrong process | SOP index + `PROHIBITED_ACTIONS`; bookmark canonical URLs; remove demo bookmarks | Supervisor / Admin | Training attendance; spot-check screenshots | Daily spot-check week 1; then weekly |
| MC-02 | Inventory SPA non-authoritative | Wrong stock decisions | Opening stock via API/scripts; materials only via WO API detail; inventory pages = reference at best | Stores + Admin | Opening stock load log; issue document numbers | Each stock load; daily issue recon |
| MC-03 | `MANUFACTURING_ACCOUNTING` off; costing UI seed | False confidence on costs/GL | Flag OFF; forbid `/accounting/manufacturing/**`; offline cost sheet if needed | Finance lead | Flag query screenshot; SOP ack | At cutover + weekly |
| MC-04 | Schema validate / migrate drift (8A-P0-1/2) | Deploy surprises | Pilot env: document validate/migrate status; no force-reset | Platform / DBA | CLI output attached to readiness | Before each deploy |
| MC-05 | Typecheck debt (8A-P0-3) | Broken builds / silent regressions | Prefer smoke scripts on pilot DB over “CI green”; freeze non-pilot features | Tech lead | Smoke PASS log | Before UAT + weekly |
| MC-06 | No incoming GRN QC | Bad receipts enter production | Paper/Excel incoming checklist; quarantine bin physical; do not use `/quality/incoming` | Quality + Stores | Signed incoming sheets | Per receipt |
| MC-07 | NCR UI not authoritative | Fake NCR register | Use paper NCR or API-backed path only if dual-routed; else log offline | Quality | NCR binder / ticket IDs | Per event |
| MC-08 | No classic MRP | Over/under planning | Manual plan / Phase 6A production plan only; forbid `/mrp/*` | Planner | Plan sheet vs WO list | Weekly |
| MC-09 | No dispatch pick/pack | Shipping errors | Manual pick list + delivery challan outside ERP; optional 7C0 confirm only if trained | Dispatch / Sales | Signed pack list | Per shipment |
| MC-10 | No full purchase RFQ/PO/GRN | Procurement gaps | Existing purchase process outside ERP (or PR-only if already used); no GRN expectation | Purchase | PO/GRN paper trail | Per PO |
| MC-11 | FG receipt PARTIAL UI | Stock/FG mismatch | Smoke FG API before SOP; else physical FG book + inventory movement script | Stores + Supervisor | FG movement numbers | Per FG post |
| MC-12 | Job Work CONDITIONAL | Broken JW documents | Exclude JW until smoke PASS; if included, follow JW SOP only | Planner | Smoke log | Once before enabling |
| MC-13 | Mock leakages on finance side-routes | Trusting seed AR/AP/bank cards | Use Money In/Out + Bank & Cash core only; avoid legacy receivables/payables + bank-account seed cards | Finance | Route checklist | Weekly |
| MC-14 | Store workbench missing | Ad-hoc stock moves | All production issues/returns via WO materials; no “store workbench” | Stores | Issue/return refs | Daily |
| MC-15 | Budgeting demo | Fake budget vs actual | Spreadsheet budget; forbid `/accounting/budgeting/**` | Finance | Spreadsheet version | Monthly |
| MC-16 | Live bank 5D2 / FX / IC not shipped | Failed connector / FX posts | File import / sandbox only; base currency; no IC transfers | Finance / Treasury | Import logs | Per import |
| MC-17 | FA unfinished / typecheck noise | Asset register errors | Keep FA out of pilot ops unless smoke-passed; else Excel FA | Finance | Smoke or Excel | Monthly if used |
| MC-18 | Live-activity / chrome mock | Misleading “live” KPIs | Ignore live-activity widgets; use Control Room/Today API data | Supervisor | — | Continuous |

*Update Owner names when pilot roster is named. Evidence stored under pilot runbook folder (TBD path).*
