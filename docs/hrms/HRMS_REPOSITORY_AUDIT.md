# FOS ERP — HRMS Repository Audit

> **Phase 0 (mandatory).** Verified against code on **2026-07-30**. When docs and code disagree, **code wins**.  
> **Status:** Audit complete. **No HRMS models, APIs, or UI exist yet.** Phase 1 must not start until this audit is accepted.

**North star (unchanged):** Employee → Shift → Attendance → Leave / OT → Payroll → Statutory → Payslip → Accounting, with manufacturing-aware workforce identity.

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Does FOS already have an Employee master? | **No.** Manufacturing soft-references `employeeId` (string) and uses `User` for operator auth (ADR-034). |
| Can we reuse User as Employee? | **No — different concepts.** Factory workers need HR identity without login. Link optional `HrEmployee.userId → User`. |
| Can we reuse Department / Legal Entity / Branch? | **Yes — reuse as-is.** IAM `Department`; finance `LegalEntity` + `Branch` (incl. `FACTORY`). |
| Is there a Designation master for HR? | **No.** `User.designation` is free text; CRM `CrmMaster` designations are contact labels — do not reuse for payroll. |
| Plant for HR = Branch or MasterPlant? | **Branch (FACTORY)** for LE/payroll/PT scope. Optionally soft-link / display `MasterPlant` for inventory/mfg plant codes — do not invent a third plant master. |
| Holiday / Shift / Attendance / Leave / Payroll? | **None** in backend. Soft `shiftCode`/`shiftLabel` on production only. |
| Payroll account mappings? | **Missing.** `LABOUR_ABSORPTION` ≠ salary. Vendor/customer `TDS_*` ≠ salary TDS. |
| Shared attachment / approval bus? | **No generic bus.** Copy module-local attachment pattern (Maintenance); leave/OT approvals: prefer simple HR approval + optional future finance/purchase-style rules — do not force `FinanceApprovalRequest`. |
| Module flag `hrms`? | **Missing** from `TENANT_MODULE_CATALOG`. |
| Nav / routes `/hrms`? | **Missing.** |

**Recommendation:** Build a dedicated **HRMS domain** (`Hr*` models) that **reuses** org IAM (LE, Branch, Department, User scope, CodeSeries, AuditLog, posting engine) and **does not** duplicate User/Department/Branch/LegalEntity/WorkCentre.

---

## 1. Admin / IAM

### 1.1 User

| Item | Detail |
|------|--------|
| **Model** | `User` → `users` (`backend/prisma/schema.prisma` ~482–530) |
| **People fields** | `firstName`, `lastName`, `email`, `mobile`, `designation` (string), `department` (legacy string), `departmentId` → IAM `Department` |
| **Not present** | `employeeCode`, `legalEntityId`, `branchId`, DOB, bank, statutory IDs |
| **Org scope** | Via `UserLegalEntityAccess` / `UserBranchAccess` / `UserWarehouseAccess` (empty set = **unrestricted / fail-open**) |
| **API** | `/api/v1/t/:tenantSlug/users` — `backend/src/modules/users/` |
| **FE** | `/admin/users` — `frontend/src/modules/systemAdmin/UserAdminPages.tsx` |
| **Can reuse?** | **Yes as login identity only.** Optional link from `HrEmployee.userId`. Never require User to create Employee. |
| **Gap** | No HR lifecycle, worker category, salary, attendance. |
| **Implement** | Keep User thin; put HR fields on `HrEmployee` (+ sensitive child tables). |

### 1.2 Role / Permission / RBAC

| Item | Detail |
|------|--------|
| **Models** | `Role`, `Permission`, `UserRole`, `RolePermission` |
| **Catalog** | `backend/src/constants/permissions.ts` — flat `module.action` names |
| **Sync** | Seed + `backend/scripts/sync-permissions.ts` (`db:sync-permissions`) |
| **Gate** | `requirePermission(...)` after `attachRequestContext` |
| **Can reuse?** | **Yes.** |
| **Gap** | No `hrms.*` permissions. |
| **Implement** | Add `hrms.employee.*`, `hrms.attendance.*`, … per product spec; map to HR Executive / Manager / Supervisor / Payroll roles in `ROLE_PERMISSIONS`; sync. Separate `hrms.employee.sensitive.view` / payroll perms from list-view. |

### 1.3 Tenant + module flags

| Item | Detail |
|------|--------|
| **Model** | `TenantModuleFlag` — `(tenantId, moduleKey)`, missing row = **enabled** |
| **Catalog** | `backend/src/modules/modules/module-catalog.ts` — masters, crm, purchase, inventory, manufacturing, quality, maintenance, dispatch, accounting, logistics, gate, reports |
| **Middleware** | `requireModule(key)` — `backend/src/middleware/require-module.middleware.ts` |
| **Can reuse?** | **Yes.** |
| **Gap** | No `hrms` key. |
| **Implement** | Add `{ key: 'hrms', name: 'HRMS', dependsOn: [], … }` (optional soft depends on `accounting` for payroll post — not required for Phase 1). Mount routes with `requireModule('hrms')`. Align FE nav category `id: 'hrms'`. |

### 1.4 Legal Entity

| Item | Detail |
|------|--------|
| **Model** | `LegalEntity` — PAN/GST/CIN, `stateCode`, FY start, default/active |
| **APIs** | `/organisation/legal-entities`, `/accounting/legal-entities` |
| **FE** | `/settings/organisation/*`, `/admin/companies` |
| **Can reuse?** | **Yes — mandatory FK on Employee / payroll / statutory.** |
| **Gap** | No HR children yet. |
| **Implement** | Every payroll-relevant HR record stores `legalEntityId`; enforce `UserLegalEntityAccess` via `scopeAllows` (opt-in helper — **not** global middleware). |

### 1.5 Branch / Plant

| Item | Detail |
|------|--------|
| **Model** | `Branch` under LE; `BranchType` includes `FACTORY`, `HEAD_OFFICE`, `WAREHOUSE`, … |
| **Parallel** | `MasterPlant` — inventory/purchase plant codes; **not** finance LE-scoped; work centres use soft `plantCode` |
| **APIs** | `/accounting/legal-entities/:id/branches`, `/accounting/branches/:id` |
| **Can reuse?** | **Yes — Branch is HR “Plant” for V1** (prefer `branchType = FACTORY` for shop floor). |
| **Gap** | No FK from WorkCentre → Branch; plant identity split (Branch vs MasterPlant). |
| **Implement** | Employee `branchId` required. Document mapping Branch ↔ MasterPlant as operational convention (code alignment), not a new Plant entity. Phase 11 may soft-reference `MasterPlant` / work-centre plantCode for eligibility UX only. |

### 1.6 Department

| Item | Detail |
|------|--------|
| **Model** | IAM `Department` — “Tenant org unit for people admin (not CRM departments)” |
| **API** | `/api/v1/t/:tenantSlug/departments` — `department.view|create|update|delete` |
| **FE** | `/admin/departments` |
| **Do not conflate** | CRM master `departments`; Purchase PR `departmentId` string; finance `CostCentre` |
| **Can reuse?** | **Yes — Employee.departmentId → Department.** |
| **Gap** | Department is tenant-scoped only (not LE/Branch). Acceptable for V1 SME. |
| **Implement** | Reuse; do not create `HrDepartment`. |

### 1.7 User ↔ LE / Branch assignments

| Item | Detail |
|------|--------|
| **Models** | `UserLegalEntityAccess`, `UserBranchAccess` |
| **API** | `GET/PUT …/users/:userId/scopes` |
| **Enforcement** | `loadUserDataScope` / `scopeAllows` in `scope.service.ts`; CRM uses it; **most modules do not auto-filter** |
| **Can reuse?** | **Yes — backend must enforce in HR services.** |
| **Gap** | Fail-open when empty (full access). Document for HR UAT (restricted HR users need explicit scope rows). |
| **Implement** | HR list/get/write: filter by allowed LE/Branch when scope non-empty; never trust FE filters alone. |

### 1.8 Responsibility catalog

| Item | Detail |
|------|--------|
| **Models** | `Responsibility`, `UserResponsibility` (optional LE/Branch/Department stamp) |
| **Can reuse?** | Optional later for “HR Manager for Plant A” labeling. |
| **V1** | Prefer RBAC + LE/Branch scope; do not block Phase 1 on responsibilities. |

---

## 2. Masters

| Concept | Existing | Reuse for HRMS? |
|---------|----------|-----------------|
| Country / State / City | `MasterCountry`, `MasterState`, `MasterCity` | **Yes** for address / PT state — prefer codes/names on employee address; optional FK to MasterState for PT eligibility |
| Holiday | **None** | **Build** `HrHolidayCalendar` / `HrHoliday` (Phase 2) |
| UOM | `MasterUom` | Not needed for core HR V1 (time stored as minutes) |
| CRM designations / departments | `CrmMaster` kinds | **Do not reuse** for employment designation |
| Code series (FE demo) | FE catalog includes `'employee'` | Demo only — **extend BE `CodeSeriesEntity`** |

---

## 3. Manufacturing

| Concept | Existing | Reuse / gap |
|---------|----------|-------------|
| Work Centre | `ManufacturingWorkCentre` + CRUD APIs + FE setup | **Reuse FK** `primaryWorkCentreId` optional on Employee. Do not duplicate. Note: soft `departmentRef`, `plantCode`, `defaultShiftRef`. |
| Machine | `ManufacturingMachine` | Indirect via WC; skill eligibility Phase 11 |
| Operator identity | `ProductionAssignment.userId` (User); soft `employeeId` string | **Phase 11:** populate `employeeId` from `HrEmployee.id` when User linked; keep `userId` for My Work auth |
| Shift | Soft `shiftCode` / `shiftLabel` on assignment & daily production (ADR-034) | **Phase 2:** `HrShift`; later migrate soft refs → `shiftId` |
| My Work | `GET …/manufacturing/my-work` — JWT `userId` | ESS / supervisor: resolve Employee by `userId` |
| Job Card | Demo Zustand only | Out of HR scope |
| Labour costing | `LabourRateCard` + `LABOUR_ABSORPTION` posting | **Keep separate from payroll.** Absorption ≠ salary expense |
| Skill matrix | **None** | Phase 11 new models |

**Do not break:** existing assignment history, My Work, labour absorption.

---

## 4. Accounting

| Concept | Existing | HRMS use |
|---------|----------|----------|
| Accounting period | `AccountingPeriod` + `enforcePeriodOpenForPosting` | Payroll post gate (Phase 9) |
| CoA / Account | `Account` LE-scoped | Map via default mappings — never hardcode codes |
| Default mappings | `DefaultAccountMappingKey` | **Add** salary keys in Phase 9 (see §4.1) |
| Posting engine | `post()` → `PostingEvent` → `AccountingVoucher` → `GeneralLedgerEntry` | Payroll must call central `post()` only |
| Party type | `AccountingPartyType.EMPLOYEE` already exists | Use for salary payable / advances |
| TDS | Vendor/customer TDS + `TDS_PAYABLE` / `TDS_RECEIVABLE` | **Not** salary TDS — build statutory salary TDS layer (Phase 8) |
| Money Out | Vendor payment pipeline | Pattern for bank payment; **do not** force vendor open items for salary |
| Payment account mappings | Customer/vendor/bank/cash use cases | Extend with salary/payroll use case when payment readiness lands |
| Finance approvals | `FinanceApprovalRequest` document types — no PAYROLL | Leave/OT: HR-native approval V1; payroll finalize = HR permission, not finance approval doc |
| Demo seeds | “Salary Payable”, payroll funding narrations | Demo only — not live |

### 4.1 Mapping keys to add (Phase 9 — not Phase 1)

Recommended additions to `DefaultAccountMappingKey` (names exact TBD at Phase 9):

- `SALARY_EXPENSE` / `WAGES_EXPENSE` / `OVERTIME_EXPENSE` / `BONUS_EXPENSE`
- `SALARY_PAYABLE`
- `PF_PAYABLE` / `ESIC_PAYABLE` / `PT_PAYABLE` / `TDS_SALARY_PAYABLE` (distinct from vendor `TDS_PAYABLE` if semantics differ)
- `EMPLOYER_PF_EXPENSE` / `EMPLOYER_ESIC_EXPENSE`
- `EMPLOYEE_ADVANCE` / `LOAN_RECEIVABLE` (or shared employee receivable)

Audit mapping validation Zod + organisation UI when adding.

---

## 5. Platform patterns to copy

| Capability | Pattern | HRMS action |
|------------|---------|-------------|
| Number series | `CodeSeries` + `codeSeries.service.nextCode` | Add `EMPLOYEE` (+ later `PAYROLL_RUN`, `LEAVE_REQUEST`, …) with prefix `EMP` |
| Audit | `auditFromRequest` / `createAuditLog` | `module: 'hrms'`; mandatory for bank/statutory/salary/payroll |
| Attachments | CRM / Maintenance module-local files + DB rows | **New** `HrEmployeeDocument` (or generic entity attachment) + `HRMS_UPLOAD_DIR`; reuse multer/fs pattern from Maintenance |
| Approvals | Finance / Purchase / Gate — **no shared bus** | V1: leave/OT status machine + reporting manager; optional `Responsibility` later |
| Notifications | FE demo only | Optional later; not Phase 1 blocker |
| Saved views | FE `useSavedViews` (localStorage) + ops `SavedReportView` | Use FE saved views on registers; ops reports Phase 12 |
| Pagination / errors | `paginationSchema`, `sendPaginated`, domain errors | Same as Maintenance |
| Module shell | Maintenance routes stack | Template: auth → context → tenant → `requireModule('hrms')` → permission → Zod → thin controller |
| Dual-mode FE | `VITE_USE_API` + bridges | API mode only for live HR; if demo seed added later, **never mix** with API rows |

**Good module template:** `backend/src/modules/maintenance/maintenance.routes.ts`.

---

## 6. What already looks like “Employee” but is not

| Surface | Reality |
|---------|---------|
| CRM / masters “Users / Employees / Owners” | Demo/catalog register — not employment |
| Gate contractors | Explicitly **no payroll / attendance** |
| `AccountingPartyType.EMPLOYEE` | Ledger party typing only |
| Soft `employeeId` on MFG | Placeholder string awaiting HR FK |
| FE code series document type `employee` | Masters UI catalog wider than BE enum |
| Budgeting `payroll` column / bank “payroll funding” | Demo finance seeds |

**Conclusion:** HR requires a **separate domain model** `HrEmployee`. Proven: User ≠ Employee; no existing Employee table; manufacturing already anticipated a future Employee module (ADR-034).

---

## 7. Recommended Phase 1 domain (do not implement until approved)

### 7.1 Reuse (no new org tables)

- `LegalEntity`, `Branch`, `Department`, `User` (optional link)
- `CodeSeries` (extend enum)
- `AuditLog`
- `TenantModuleFlag` + catalog key `hrms`
- Permissions catalog sync
- Geo masters for address/state (optional FK)

### 7.2 New models (logical grouping — Phase 1)

| Model | Purpose |
|-------|---------|
| `HrDesignation` | Tenant (optionally LE) designation master |
| `HrEmployee` | Centre of HRMS — code, names, LE, Branch, Department, Designation, employment type/status, optional userId / workCentreId / defaultShiftId (shift later) |
| `HrEmployeeEmploymentHistory` | Status/dept/designation/manager changes |
| `HrEmployeeBankDetail` | Sensitive bank — masked in lists |
| `HrEmployeeStatutoryDetail` | PAN/UAN/ESIC/Aadhaar ref — sensitive |
| `HrEmployeeDocument` | Doc type + file path (attachment pattern) |

Prefer embedding non-sensitive address on `HrEmployee` over excessive tables.

### 7.3 Explicit non-goals for Phase 1

No Shift, Attendance, Leave, OT, Payroll, Statutory engine, Skills, Dashboard ESS — per product phase plan.

### 7.4 API / FE skeleton (Phase 1)

| Layer | Target |
|-------|--------|
| Backend | `/api/v1/t/:tenantSlug/hrms/…` |
| FE | `/hrms`, `/hrms/employees`, `/hrms/employees/new`, `/hrms/employees/:id` |
| Module flag | `hrms` |
| Permissions | Phase 1 subset: `hrms.employee.view|create|edit`, `hrms.employee.sensitive.view`, `hrms.designation.view|manage` |

---

## 8. Reuse decision matrix

| Need | Existing model/API | Decision |
|------|-------------------|----------|
| Login | `User` | Reuse; optional link |
| Org company | `LegalEntity` | Reuse |
| Plant | `Branch` (`FACTORY`) | Reuse |
| Inventory plant | `MasterPlant` | Soft align codes; no FK required Phase 1 |
| Department | IAM `Department` | Reuse |
| Designation | — | **New** `HrDesignation` |
| Employee | — | **New** `HrEmployee` |
| Work Centre | `ManufacturingWorkCentre` | Optional FK reuse |
| Shift | soft strings | **New** Phase 2 |
| Holiday | — | **New** Phase 2 |
| Attendance | — | **New** Phase 3 |
| Leave / OT | — | **New** Phases 4–5 |
| Salary / Payroll | — | **New** Phases 6–7 |
| Statutory PF/ESIC/PT/salary TDS | Vendor TDS only | **New** Phase 8 layer |
| Payslip / GL post | Posting engine | Reuse engine Phase 9 |
| Attachments | Module-local | New HR attachment rows |
| Approvals | Fragmented | HR-native V1 |
| Number EMP-* | CodeSeries | Extend enum |
| LE/Branch scope | User*Access | Enforce in HR services |
| Module toggle | TenantModuleFlag | Add `hrms` |

---

## 9. Risks & design constraints

1. **User vs Employee confusion** — UI and APIs must never treat Admin Users as the employee register.
2. **Scope fail-open** — empty LE/Branch access = all access; UAT must assign scopes for Plant A HR.
3. **MasterPlant vs Branch** — document plant convention early to avoid dual “plants” in HR UI.
4. **Sensitive data** — list APIs must not return full PAN/bank/Aadhaar with only `hrms.employee.view`.
5. **Manufacturing soft refs** — migrate carefully in Phase 11; do not rewrite historical assignment rows aggressively.
6. **Labour absorption vs payroll** — never post salary through manufacturing absorption keys.
7. **No shared approval/attachment platform** — budget module-local implementations; avoid fake “generic” frameworks mid-flight.
8. **Demo/API mix** — if any HR demo seed is added, bridges must replace (not merge) in API mode.

---

## 10. Suggested implementation order after audit acceptance

1. **Phase 1** — Foundation + Employee Master (this audit’s next step)  
2. Phases 2–12 — per product brief; **do not start N+1 until N contracts + tests stable**  
3. Explicit human approval between phases  

---

## 11. Evidence index (primary paths)

| Area | Path |
|------|------|
| Schema | `backend/prisma/schema.prisma` |
| Permissions | `backend/src/constants/permissions.ts` |
| Module catalog | `backend/src/modules/modules/module-catalog.ts` |
| Code series | `backend/src/services/codeSeries.service.ts` |
| Scope | `backend/src/modules/scopes/` (scope.service) |
| Organisation / LE / Branch | `backend/src/modules/organisation/`, accounting branch routes |
| Departments | `backend/src/modules/departments/` |
| Manufacturing WC / assignment / My Work | `backend/src/modules/manufacturing/` |
| Posting | `backend/src/modules/accounting/` posting services |
| Default mapping keys | `DefaultAccountMappingKey` enum + `default-mapping.validation.ts` |
| Maintenance template | `backend/src/modules/maintenance/maintenance.routes.ts` |
| FE nav | `frontend/src/config/navigation.ts` |
| ADR-034 | `docs/ARCHITECTURE_DECISIONS.md` |

---

## 12. Phase 0 acceptance

| Criterion | Status |
|-----------|--------|
| Existing Admin/IAM audited | Done |
| Masters / MFG / Accounting / Platform audited | Done |
| Reuse vs new decided for Employee/Department/Branch/LE | Done |
| No duplicate org concepts proposed without proof | Done — separate `HrEmployee` justified |
| Audit doc published | `docs/hrms/HRMS_REPOSITORY_AUDIT.md` |
| Models / APIs / UI created | **Not started** (by design) |

**Phase 0 readiness:** **COMPLETE — awaiting approval to start Phase 1.**
