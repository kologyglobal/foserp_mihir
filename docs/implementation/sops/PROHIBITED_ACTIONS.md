# SOP — Prohibited Actions & Screens

**Audience:** All pilot users  
**Rule:** If it is not on the allowed list in `PHASE8B_PILOT_SCOPE.md`, do not use it for pilot work.

## Forbidden screens / areas

| Area | Routes / surfaces | Why |
|------|-------------------|-----|
| Classic MRP | `/mrp`, `/mrp/planner`, `/mrp/run`, `/mrp/runs/:id` | DEMO_ONLY — no BE engine |
| Incoming QC | `/quality/incoming` | Needs Purchase GRN |
| Quality reports (as system of record) | `/quality/reports` | Mock / not dual-routed |
| Dispatch pick / pack / challan | Demo dispatch plan/scan/pack/challan | Not implemented |
| Manufacturing costing | `/accounting/manufacturing/**` | Seed KPIs; GL flag off |
| Budgeting | `/accounting/budgeting/**` | DEMO_ONLY |
| Legacy CoA / vouchers SPA | Old `/accounting/coa*`, `/accounting/vouchers*` (if reached without redirect) | Use settings CoA + journals |
| Legacy AR/AP workspaces | `/accounting/receivables/*`, `/accounting/payables/*` (non Money In/Out) | Mock leakage |
| Bank account seed cards | Bank sub-registers called out in 8A mock audit | Use Bank & Cash core |
| Legacy mfg BOM / routes | `/manufacturing/bom`, demo routes | Use `/manufacturing/setup/*` |
| Inventory SPA as authority | `/inventory/**` registers for decisions | Issue via WO materials |
| Store workbench | *(no route — do not invent)* | FE missing |
| OEE / barcode advanced settings as live controls | Mfg settings demo toggles | FE-only |
| FX / IC / live PSD2 bank pull | Advanced treasury | Out of pilot |

## Forbidden behaviours

- Running with `VITE_USE_API=false` on pilot devices.  
- Mixing demo seed data with API tenant data.  
- Enabling `MANUFACTURING_ACCOUNTING` or `MULTI_CURRENCY` without flag-plan change control.  
- Force-resetting shared MySQL to “fix” migrate drift.  
- Treating FE auto-post costing checkboxes as real GL posting.

## If you need a forbidden capability

Raise to Implementation lead → log on remediation register → use **manual control** from `PHASE8B_MANUAL_CONTROLS.md` until Wave 3 ships.
