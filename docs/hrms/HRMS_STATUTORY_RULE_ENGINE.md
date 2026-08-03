# HRMS Statutory Rule Engine

> Canonical implementation: `backend/src/modules/hrms/statutory/`. Verified **2026-07-31**.

## Overview

```text
getEffectiveStatutoryRule(type, legalEntity, state, asOfDate)
  → resolveWageBasis(rule, earningsByCode)
  → calculatePf | calculateEsic | calculatePt | calculateTds | calculateLwf
  → lines + exceptions + evidence
```

Orchestrator: `calculateStatutoryForEmployee` in `statutory-engine.service.ts`.

---

## `getEffectiveStatutoryRule`

**Signature:** `getEffectiveStatutoryRule(tenantId, type, { legalEntityId?, stateCode? }, date)`

**Candidate filter:**

- `status = ACTIVE`, not soft-deleted
- `effectiveFrom <= asOfDate`
- `effectiveTo` is null or `>= asOfDate`

**Specificity scoring** (higher wins):

| Dimension | Score |
|-----------|-------|
| Tenant-wide rule (`legalEntityId = null`) | 1 |
| Exact `legalEntityId` match | 2 |
| No `stateCode` on rule | 1 |
| Exact `stateCode` match (uppercased) | 2 |

Combined score = `leScore * 10 + stateScore`. Rules with mismatched LE or state are **excluded** (not fallbacks).

**Tie-break:** most recent `effectiveFrom`.

**Activation:** `POST /rules/:id/activate` supersedes overlapping ACTIVE rules of the same `(type, legalEntityId, stateCode)` by setting their `effectiveTo` to the day before the new rule's `effectiveFrom`.

**Resolve helper:** `GET /statutory/resolve?type=&employeeId=&date=` loads employee branch `stateCode` and returns the winning rule + context.

---

## Wage basis — `resolveWageBasis`

**File:** `wage-basis.service.ts`

Resolution order:

1. **Configured lines** — sum `include=true` lines on the rule, ordered by `sequence`.
2. **Default component codes** — caller option (e.g. PF passes `['BASIC']`).
3. **Fallback wage** — caller option (e.g. gross earnings for ESIC/PT when no lines).

Earnings map keys are normalized to uppercase. Amounts rounded to 2 dp before summing.

**Rounding:** `roundStatutoryAmount(amount, rule.roundingMode)` — `NEAREST` (default), `UP`, `DOWN`, `NONE` (2 dp). Non-positive amounts → 0.

---

## PF — `calculatePf`

| Input | Behavior |
|-------|----------|
| Wage basis | Rule lines, else **BASIC** only |
| Ceiling | `min(wage, wageCeiling)` when ceiling set |
| Amounts | `employeeRatePct` / `employerRatePct` on capped wage, or fixed amounts |
| Output | `PF_EMPLOYEE` (deduction), `PF_EMPLOYER` (employer contribution) |

**Applicability default:** `true` when employee has UAN **or** status is `ACTIVE`. Explicit `pfApplicable` on profile always wins.

**Exceptions:** `STATUTORY_RULE_NOT_CONFIGURED` (blocker); `UAN_MISSING` (warning).

---

## ESIC — `calculateEsic`

| Input | Behavior |
|-------|----------|
| Wage basis | Rule lines, else **gross earnings** |
| Eligibility | Wage ≤ `eligibilityWageCeiling` unless `forceEligible` (explicit `esicApplicable: true` override) |
| Amounts | Rates on full wage (not capped by ceiling — ineligible employees get zero lines) |
| Output | `ESIC_EMPLOYEE`, `ESIC_EMPLOYER` when eligible |

**Applicability default:** if rule exists, true when wage at/under ceiling; if no rule yet, default true so missing-config surfaces as exception.

**Exceptions:** `STATUTORY_RULE_NOT_CONFIGURED` (blocker); `ESIC_NUMBER_MISSING` (warning).

---

## PT — `calculatePt`

| Input | Behavior |
|-------|----------|
| Wage basis | Rule lines, else **gross earnings** |
| Slabs | Match `fromAmount`–`toAmount` on wage; open-ended when `toAmount` null |
| Special month | Slabs with `specialMonth = payrollMonth` take priority over generic slabs |
| Output | Single `PT` deduction |

**State:** resolved from employee **branch** `stateCode`. PT rules should carry matching `stateCode`.

**Activation guard:** at least one PT slab required before activate.

**Exceptions:** `PT_STATE_MISSING` (warning); `STATUTORY_RULE_NOT_CONFIGURED` (blocker).

---

## TDS — `calculateTds`

**Foundation only — no annual IT engine.**

| Source | Amount | `reviewRequired` |
|--------|--------|------------------|
| `tdsManualMonthly` on employee profile | That value | `false` |
| No manual override | `0` | `true` (`PENDING_ANNUAL_ENGINE`) |

Profile fields reserved for future engine: `taxRegime`, `previousEmploymentIncome`, `declaredDeductions`, `taxAlreadyDeducted` — **not used in calculation** in Phase 8.

**Exceptions:** `PAN_MISSING` (warning); `TDS_CALCULATION_REVIEW_REQUIRED` when no manual override; `STATUTORY_RULE_NOT_CONFIGURED` (warning only — calculation still runs).

Setting `tdsManualMonthly` requires `overrideReason` (same as applicability toggles).

---

## LWF — `calculateLwf`

Fixed amounts — **not wage-linked**.

| `frequency` | Due when |
|-------------|----------|
| `MONTHLY` (default) | Every payroll month |
| `HALF_YEARLY` | Only months listed in `configJson.months` (e.g. `[6, 12]`) |
| Other | Skipped with note, no exception |

Uses `employeeFixedAmount` / `employerFixedAmount`. Output: `LWF_EMPLOYEE`, `LWF_EMPLOYER`.

**Exceptions:** `STATUTORY_RULE_NOT_CONFIGURED` (warning — no lines emitted).

---

## Applicability overrides

On `HrEmployeeStatutoryDetail`, explicit `true`/`false` for `pfApplicable`, `esicApplicable`, `ptApplicable`, `tdsApplicable`, `lwfApplicable` **always wins** over defaults.

Changing any applicability flag or `tdsManualMonthly` requires `overrideReason`; audit fields `overrideByUserId`, `overrideAt` are set.

Permission: `hrms.statutory.manage` or `hrms.statutory.override` for profile PATCH.

---

## Exceptions summary

| Code | Severity | When |
|------|----------|------|
| `STATUTORY_RULE_NOT_CONFIGURED` | BLOCKER (PF/ESIC/PT) or WARNING (TDS/LWF) | No effective ACTIVE rule |
| `UAN_MISSING` | WARNING | PF applicable, no UAN |
| `ESIC_NUMBER_MISSING` | WARNING | ESIC applicable, no ESIC number |
| `PT_STATE_MISSING` | WARNING | PT applicable, branch has no state |
| `PAN_MISSING` | WARNING | TDS applicable, no PAN |
| `TDS_CALCULATION_REVIEW_REQUIRED` | WARNING | No manual TDS override |
| `STATUTORY_ENGINE_ERROR` | BLOCKER | Unexpected engine failure (payroll calc wrapper) |

Phase 7 stub `STATUTORY_DATA_MISSING` is removed once the engine runs successfully.

---

## Effective dating examples

```text
Rule A: PF, LE=HQ, effectiveFrom=2026-01-01, ACTIVE
Rule B: PF, LE=HQ, effectiveFrom=2026-04-01, ACTIVE (activating B supersedes A with effectiveTo=2026-03-31)

Payroll Aug 2026 → uses Rule B (asOf = period end date)

Tenant-wide PF rule (legalEntityId=null) applies only when no LE-specific rule scores higher.
MH PT rule (stateCode=MH) applies to employees in branch with stateCode=MH.
```

---

## BONUS / GRATUITY

`HrStatutoryRule.type` enum includes `BONUS` and `GRATUITY` for future use. **`calculateStatutoryForEmployee` never calculates them** in Phase 8.
