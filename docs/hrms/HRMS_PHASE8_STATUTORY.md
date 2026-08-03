# HRMS Phase 8 — Indian Statutory Payroll Foundation

> Verified against code **2026-07-31**. Builds on Phases 1–7. **Does not** implement government portal filing, Form 16, or payroll GL posting.

## Goal

```text
Effective-dated statutory rules (PF / ESIC / PT / TDS / LWF)
→ Employee statutory profile + overrides
→ Payroll calculate appends statutory lines
→ Compliance registers (API + CSV)
```

## Models

| Model | Purpose |
|-------|---------|
| `HrStatutoryRule` | Effective-dated rule per type (`PF`, `ESIC`, `PROFESSIONAL_TAX`, `TDS`, `LWF`; `BONUS` / `GRATUITY` enum only — not calculated in Phase 8) |
| `HrStatutoryWageBasisLine` | Which salary component codes sum into the statutory wage for a rule |
| `HrStatutoryPtSlab` | State PT slab rows (`fromAmount`, `toAmount`, `taxAmount`, optional `specialMonth`) |
| `HrEmployeeStatutoryDetail` *(extended)* | Applicability flags (`pfApplicable`, `esicApplicable`, …), TDS manual override, tax regime placeholders, override audit fields |

Migration: `20260731030000_hrms_phase8_statutory`

Rule lifecycle: `DRAFT` → **activate** → `ACTIVE`; overlapping ACTIVE rules of same `(type, legalEntityId, stateCode)` are **SUPERSEDED** with `effectiveTo` set to the day before the new rule starts.

## APIs

Base: `/api/v1/t/:tenantSlug/hrms/statutory`

| Area | Method | Path | Permission |
|------|--------|------|------------|
| Rules list | `GET` | `/rules` | `hrms.statutory.view` |
| Rule create | `POST` | `/rules` | `hrms.statutory.manage` |
| Rule detail | `GET` | `/rules/:ruleId` | `hrms.statutory.view` |
| Rule update | `PATCH` | `/rules/:ruleId` | `hrms.statutory.manage` (DRAFT only) |
| Activate | `POST` | `/rules/:ruleId/activate` | `hrms.statutory.manage` |
| Wage basis | `PUT` | `/rules/:ruleId/wage-basis` | `hrms.statutory.manage` (DRAFT only) |
| PT slabs | `PUT` | `/rules/:ruleId/pt-slabs` | `hrms.statutory.manage` (DRAFT, `PROFESSIONAL_TAX` only) |
| Employee profile | `GET` | `/employees/:employeeId/profile` | `hrms.statutory.view` |
| Employee profile | `PATCH` | `/employees/:employeeId/profile` | `hrms.statutory.manage` **or** `hrms.statutory.override` |
| Resolve helper | `GET` | `/resolve?type=&employeeId=&date=` | `hrms.statutory.view` |
| Register | `GET` | `/registers/:kind` | `hrms.statutory.reports` |
| Register CSV | `GET` | `/registers/:kind/export.csv` | `hrms.statutory.reports` |

Register kinds: `pf`, `esic`, `pt`, `tds`, `lwf` — sourced from finalized/calculated payroll employee results for the requested period.

Canonical engine: `backend/src/modules/hrms/statutory/statutory-engine.service.ts`  
Rule resolution: `backend/src/modules/hrms/statutory/statutory-rule.service.ts` (`getEffectiveStatutoryRule`)

## Payroll integration

During `POST /hrms/payroll/runs/:runId/calculate`, `payroll-calc.service.ts`:

1. Resolves salary structure lines (Phase 6/7).
2. Builds `earningsByCode` from EARNING components.
3. Calls `calculateStatutoryForEmployee` with period end date, branch `stateCode`, and gross earnings.
4. Fills existing `STATUTORY` structure lines from engine output **by component code**.
5. **Appends** any engine lines not present in the structure (e.g. `PF_EMPLOYEE`, `ESIC_EMPLOYER`) so payroll works without explicit structure STATUTORY rows.
6. Merges engine exceptions into `HrPayrollException`; stores evidence JSON on employee result notes under `statutory`.

Statutory component codes written by the engine:

| Code | Type |
|------|------|
| `PF_EMPLOYEE`, `ESIC_EMPLOYEE`, `PT`, `TDS`, `LWF_EMPLOYEE` | `DEDUCTION` |
| `PF_EMPLOYER`, `ESIC_EMPLOYER`, `LWF_EMPLOYER` | `EMPLOYER_CONTRIBUTION` |

## UI routes

| Route | Purpose |
|-------|---------|
| `/hrms/payroll/statutory` | Hub — links to PF / ESIC / PT / TDS / LWF setup |
| `/hrms/payroll/statutory/pf` | PF rules — rates, ceiling, wage basis, activate |
| `/hrms/payroll/statutory/esic` | ESIC rules — rates, eligibility ceiling |
| `/hrms/payroll/statutory/pt` | PT rules — state code + slabs |
| `/hrms/payroll/statutory/tds` | TDS foundation rules (manual override documented) |
| `/hrms/payroll/statutory/lwf` | LWF fixed amounts + frequency |

Registers are **API-only** in Phase 8 (no dedicated register SPA). Hub footer links to `/hrms/statutory/registers/*` when user has `hrms.statutory.reports`.

Employee statutory profile edits remain on the employee detail statutory section (Phase 1 base + Phase 8 applicability/TDS fields).

## Permissions

| Key | HR Manager | HR Executive | Supervisor |
|-----|------------|--------------|------------|
| `hrms.statutory.view` | ✅ | ✅ | ❌ |
| `hrms.statutory.manage` | ✅ | ❌ | ❌ |
| `hrms.statutory.override` | ✅ | ❌ | ❌ |
| `hrms.statutory.reports` | ✅ | ✅ | ❌ |

Payroll calculate still requires `hrms.payroll.calculate`. See `HRMS_PHASE8_PERMISSION_MATRIX.md`.

After deploy: `npm run db:sync-permissions` (+4 statutory keys).

## Non-goals (Phase 8)

- Government portal filing (EPFO / ESIC / PT challan upload / TRACES)
- Form 16 / Form 24Q generation
- Payroll GL / journal posting for statutory liabilities
- Full annual income-tax slab engine (old/new regime, 80C/80D, surcharge/cess)
- BONUS / GRATUITY calculation (enum hooks only)
- Payslip PDF / employee self-service download
- Dedicated register UI (CSV via API only)
- Full & final settlement

## Tests

`backend/tests/hrms/hrms-phase8-statutory.test.ts` — unit wage-basis/TDS + live rules/profile/payroll/registers/permissions.

Related docs: `HRMS_STATUTORY_RULE_ENGINE.md`, `HRMS_PHASE8_UAT.md`, `HRMS_PHASE8_TEST_RESULTS.md`, `HRMS_PHASE8_PERMISSION_MATRIX.md`.
