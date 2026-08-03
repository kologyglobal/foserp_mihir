# Trailer ERP 2 → FOS Mihir Migration

**Date:** 2026-08-03  
**Source:** `D:\Projects\FOS\trailer-erp 2` (local working tree; same git remote as `kologyglobal/foserp_mihir`, mid-rebase + staged feature packs)  
**Target:** `D:\Projects\FOS\foserp_mihir` (fresh clone of `origin/main` at migration start)

## Context

| | |
|--|--|
| Target before | GitHub `main` only (no HRMS, no notifications module, no Jul 30–Aug 3 finance/HR/maintenance migrations) |
| Source | Contained all Jul 27–Aug 3 feature work in working tree / staged migrations |
| Strategy | Copy **missing-only** trees; upgrade shared files only when required symbols were absent; keep `.bak-pre-migration` for replaced files |

Migrations were **not** applied (`migrate deploy` not run). No commit/push/deploy.

---

## Missing-change matrix (27 Jul – 3 Aug 2026 focus)

| Module | Available in Trailer ERP 2 | Available in FOS Mihir (before) | Missing / files | Migration required | Action |
| ------ | -------------------------- | ------------------------------ | --------------- | ------------------ | ------ |
| HRMS Phases 0–11 (BE+FE) | Yes — `backend/src/modules/hrms` (93), `frontend/src/modules/hrms` (53) | No | Entire module trees + `hrmsRoutes.tsx`, `hrmsApi.ts`, `utils/permissions/hrms.ts`, 176 perms | `20260730230000`…`20260731060000` (phase1–11) | **Migrated** |
| Payroll / payslips / payments | Yes | No (part of HRMS) | Payroll services + FE run/payslip/payment pages | phase7 + phase9 migs | **Migrated** |
| Statutory PF/ESIC/PT/TDS/LWF | Yes | No | `hrms` statutory services + FE | phase8 mig | **Migrated** |
| Loans & advances | Yes | No | loan services + FE | phase10 mig | **Migrated** |
| Exit & F&F | Yes | No | exit/fnf services + FE | phase11 mig | **Migrated** |
| Maintenance V1 | Yes | Partial (V1 only on main) | — | already had V1 migs | **Already available** |
| Maintenance V1.1 machine health | Yes | No | `machine-health.service.ts` + FE `MachineHealthPage` | `20260730200000_maintenance_v11_*` | **Migrated** |
| Maintenance V2 preventive | Yes | No | `pm.*` + FE PM pages | `20260730210000_maintenance_v2_*` | **Migrated** |
| Period-end accruals/prepaid | Yes | No | `accounting/period-adjustments/*` | `20260730190000_finance_period_end_adjustments` | **Migrated** |
| Period close calendar / reopen | Yes | No | `accounting/period-close-ops/*` | `20260730200000_finance_period_close_calendar_reopen` | **Migrated** |
| FX revaluation | Yes | No | `accounting/fx-revaluation/*` | `20260730220000_finance_fx_revaluation` | **Migrated** |
| Bank statement hardening (CAMT.052/.054, lock, supersession) | Yes | Partial | camt052/054/common parsers, supersession service + import wiring | `20260731020000_finance_bank_hardening` | **Migrated** (selected files upgraded) |
| Purchase lifecycle / GRNI | Yes | Largely present on main | — | prior migs on main | **Already available** (not bulk-re-copied) |
| Inventory costing / FIFO | Yes | Present on main | — | prior work | **Already available** |
| Manufacturing costing | Yes | Present on main | — | prior work | **Already available** |
| CRM notifications | Yes | No | `backend/src/modules/notifications`, FE notification pages/API | `20260803100000_crm_notifications` | **Migrated** |
| Quotation order adjustments | Yes | No | `orderAdjustmentsCalc`, quotation validation/service/repo/convert | `20260803120000_quotation_order_adjustments` | **Migrated** |
| Overall discount on taxable | Yes | Missing symbols | `opportunityLineCalc.ts` | none | **Migrated** |
| CRM tax invoice → Money In | Yes | No service file | `crm-tax-invoice-ar.service.ts` + sales-invoice routes/controller | `20260730160000_crm_tax_invoice_ar_bridge` | **Migrated** |
| SO/quotation `customerName` DTO | Yes | No | sales-order/quotation types, mapper, repository | none (schema company relation) | **Migrated** |
| Admin / permissions catalog | Yes | Missing `hrms` | `permissions.ts`, `permission-sync.sql`, `module-catalog.ts` | sync permissions after migrate | **Migrated** |
| Prisma schema (63 new models) | Yes (396 models) | 333 models | Hr*, Notification*, Period*, FX*, PM models | all migs above | **Migrated** (full schema from source after marker strip; backup retained) |

### Classifications used

- **Already available** — present on foserp_mihir `main` before this pass  
- **Migrated** — copied/upgraded into foserp_mihir this session  
- **Partial** / **Conflict** — see remaining work  

### Conflicts / manual review

| Item | Notes |
| ---- | ----- |
| Source git state | trailer-erp 2 was mid-rebase with `UU schema.prisma`; used working-tree content after removing a leftover `>>>>>>>` marker |
| Schema overwrite | Target had **0 models** exclusive to FOS Mihir; still kept `schema.prisma.bak-pre-hrms-migration` |
| Shared CRM/SO/sales-invoice files | Replaced when required symbols missing; originals as `*.bak-pre-migration` |
| Purchase/inventory/MFG Jul packs | Treated as already on main — **not** force-overwritten |
| Swagger generated paths | Not regenerated this pass — regenerate when convenient |
| FE commercial editors (full charge editors) | Calc/utils + BE validation/repo migrated; some UI screens may still need UAT if they only lived as partial diffs |

---

## Features migrated (summary)

1. Full **HRMS** backend + frontend (employees through F&F)  
2. **CRM notifications** module + FE centre/settings + API client + scheduler in `server.ts`  
3. **Maintenance V1.1 + V2** services + screens  
4. **Period adjustments**, **period-close ops**, **FX revaluation** BE + route registration  
5. **Bank** CAMT 052/054 + supersession + format-detect/import upgrades  
6. **Quotation order adjustments** + overall discount util  
7. **CRM tax invoice AR bridge** + sales-invoice controller/routes  
8. **customerName** on SO/quotation API DTOs  
9. Permissions, module catalog `hrms`, navigation, route index  
10. **20 Prisma migrations** (listed below) + schema alignment  
11. Related unit/live test files under `backend/tests`

---

## Migrations added (not executed)

```text
20260730160000_crm_tax_invoice_ar_bridge
20260730190000_finance_period_end_adjustments
20260730200000_finance_period_close_calendar_reopen
20260730200000_maintenance_v11_machine_health
20260730210000_maintenance_v2_preventive
20260730220000_finance_fx_revaluation
20260730230000_hrms_phase1_foundation
20260730240000_hrms_phase2_shift_roster
20260730250000_hrms_phase3_leave
20260730260000_hrms_phase4_leave_attendance_sync
20260730270000_hrms_phase5_overtime
20260730280000_hrms_phase6_salary_structure
20260731010000_hrms_phase7_payroll
20260731020000_finance_bank_hardening
20260731030000_hrms_phase8_statutory
20260731040000_hrms_phase9_payslip_accounting_payment
20260731050000_hrms_phase10_loans_advances
20260731060000_hrms_phase11_exit_fnf
20260803100000_crm_notifications
20260803120000_quotation_order_adjustments
```

**Command (do not run until reviewed):**

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
# then:
npm run db:sync-permissions   # or project-equivalent permission sync
npx prisma generate
```

Note: two migrations share timestamp prefix `20260730200000_*` (period-close calendar + machine health) — already present that way in source; deploy carefully if MySQL history collides.

---

## Wiring changes

| File | Change |
| ---- | ------ |
| `backend/src/app.ts` | Mount `/hrms`, `/notifications` (tenant id + slug) |
| `backend/src/server.ts` | Notification scheduler start/stop |
| `backend/src/modules/accounting/accounting.routes.ts` | period-adjustments, period-close, fx-revaluation |
| `backend/src/constants/permissions.ts` | HRMS + finance keys from source |
| `backend/src/modules/modules/module-catalog.ts` | `hrms` module flag |
| `backend/prisma/schema.prisma` | Superset models (backup `.bak-pre-hrms-migration`) |
| `frontend/src/routes/index.tsx` | hrms children + notification pages |
| `frontend/src/routes/hrmsRoutes.tsx` | New |
| `frontend/src/routes/maintenanceRoutes.tsx` | Preventive / health |
| `frontend/src/config/navigation.ts` | HRMS nav group |
| `frontend/src/services/api/hrmsApi.ts` | New |
| `frontend/src/services/api/notificationsApi.ts` | New |

---

## Final report

### Features already available (on Mihir main before this pass)

- Auth, admin IAM core, CRM baseline, purchase, inventory costing, MFG fuel-tank path  
- Maintenance **V1**  
- Accounting core (GL, AR/AP, treasury baseline, journals, year-end close earlier pack)

### Features migrated

- Full list in tables above (HRMS 0–11, notifications, maint V1.1/V2, period/FX, bank CAMT, CRM commercial/AR bridge, order adjustments)

### Files created (high level)

- `backend/src/modules/hrms/**` (~93)  
- `backend/src/modules/notifications/**` (~11)  
- `backend/src/modules/accounting/period-adjustments/**`, `period-close-ops/**`, `fx-revaluation/**`  
- `frontend/src/modules/hrms/**` (~53), `frontend/src/modules/notifications/**`  
- 20 migration folders under `backend/prisma/migrations/`  
- Tests under `backend/tests/hrms`, `finance/*`, `crm/order-adjustments-calc.test.ts`, `notifications-unit.test.ts`  
- This document  

### Files modified (high level)

- `app.ts`, `server.ts`, `accounting.routes.ts`, `permissions.ts`, `schema.prisma`, `module-catalog.ts`  
- Several CRM quotation/SO files, sales-invoice, bank import services  
- FE `routes/index.tsx`, `navigation.ts`, `maintenanceRoutes.tsx`, bridges, types  

### Permissions added

- Full `hrms.*` set (~176 keys matching source) + period/FX/bank keys from source `permissions.ts`  
- SQL sync: `backend/scripts/permission-sync.sql` updated from source  

### Conflicts found

- Source mid-rebase; schema conflict marker cleaned  
- Shared files replaced when incomplete (backups `*.bak-pre-migration`)  
- Swagger stubs may be stale until regenerate  

### Tests

| Suite | Status |
| ----- | ------ |
| Backend typecheck | **Not run this pass** (run after `npm install` + `prisma generate` via project CLI) |
| Frontend typecheck | **Not run this pass** |
| Backend tests | **Not run** (migrate required for live HRMS suites) |
| Frontend tests | **Not run** |
| Prisma validate | Tried `npx prisma validate` — **failed due to global Prisma 7.9.1**; use repo script e.g. `npx tsx scripts/prisma-cli.ts validate` / project-pinned Prisma. No merge markers in schema. |

### Remaining manual work

1. Review `*.bak-pre-migration` / `schema.prisma.bak-pre-hrms-migration` for any origin/`main` nuance to re-merge  
2. `prisma migrate deploy` + `prisma generate` + permission sync  
3. `backend` + `frontend` typecheck and unit tests  
4. Regenerate swagger paths if CI requires  
5. UAT: `/hrms/*`, notifications bell, PM plans, period close accruals/FX, SO/quote names + charges  
6. Resolve any Hostinger-only deploy scripts if main had post-d9baae commits not in source working tree  
7. Optional: line-merge UIs still partial for quotation charge editors if SPA still shows old pricing-only control  

### Deployment steps

```text
1. Review docs/TRAILER_ERP_TO_FOS_MIHIR_MIGRATION.md
2. Review git diff in D:\Projects\FOS\foserp_mihir (do not push until typecheck green)
3. Local MySQL: migrate deploy + generate + sync permissions
4. Start API + SPA VITE_USE_API=true
5. Smoke: login → /hrms → employees; notifications; maintenance/preventive; period-close
6. Commit deliberately; deploy Hostinger only after CI and migrate on target DB
```

### Do-not list honored

- Did **not** run migrate / reset / deploy / force-push / commit  
- Did **not** delete FOS Mihir-only trees  
- Did **not** full tree overwrite of purchase/inventory/MFG  

---

## Quick verification commands

```powershell
cd D:\Projects\FOS\foserp_mihir\backend
npx tsc --noEmit -p tsconfig.json
npx prisma validate
cd ..\frontend
npx tsc -b --noEmit
```
