# Manufacturing Accounting Enablement — Repository Audit

**Date:** 2026-07-23  
**Scope:** Readiness gate before enabling `FinanceFeatureKey.MANUFACTURING_ACCOUNTING`  
**Rule:** Flag remains **OFF by default**; enable only when all mandatory checks pass.  
**Constraint:** No new GL / posting engine; reuse existing services.

---

## 1. Executive finding

The **backend enablement gate already exists** (Wave 3 / Phase 8) and largely matches the product rule. Gaps are:

1. **Unreconciled events** are not a first-class count — `INVENTORY_POSTINGS_UNRECONCILED` is incorrectly aliased to `failedEventCount`.
2. **Frontend Enable** does not send `pilotSignOff` / `inventoryReconcileConfirmed`, so enable always fails validation (or would if called without those fields).
3. **Enable UI** lacks an explicit readiness checklist + dual sign-off confirmation.
4. **Docs drift** — rollout / mapping docs omit sign-off fields and list 8 vs 9 required mapping keys.

**Recommendation:** Harden readiness to match the boolean rule exactly, wire FE enable + checklist to the existing feature-control API, refresh docs. Do **not** add tables, posting logic, or a second mapping store.

---

## 2. Current models

| Concern | Model / storage | Path |
|---------|-----------------|------|
| Feature flag | `FinanceFeatureControl` (`featureKey=MANUFACTURING_ACCOUNTING`, per `legalEntityId`, default no-row = off) | `prisma/schema.prisma` ~2743 |
| Sign-offs | `FinanceFeatureControl.configurationJson` → `pilotSignOffAt/By`, `inventoryReconcileConfirmedAt/By`, `signOffNote` | `manufacturing-feature-control.service.ts` |
| Tenant mfg settings | `ManufacturingSettings` incl. `autoPostAbsorption` (default `false`) — **orthogonal** Stage-4 auto hook | schema ~9054 |
| Cost policy | `ManufacturingCostingPolicy` | schema ~13232+ |
| Production GL events | `ProductionAccountingEvent` | schema ~13199 |
| Account maps | `DefaultAccountMapping` (ADR-039 — **no** `ManufacturingAccountMapping`) | finance module |
| Periods | `AccountingPeriod` (`status=OPEN`) + `FinancialYear` | accounting periods module |
| Cost snapshots | `WorkOrderCostSnapshot` / `WorkOrderCostEntry` | costing |

### `ProductionAccountingEventStatus`

`RECORDED` · `POSTED` · `SKIPPED_ZERO` · `SKIPPED_FLAG_OFF` · `FAILED` · `REVERSED`

Failed = `FAILED`. Unposted backlog = `RECORDED`. Flag-off audit trail = `SKIPPED_FLAG_OFF` (must **not** block enablement).

---

## 3. Current endpoints

Base: `/api/v1/t/:tenantSlug/manufacturing`

| Method | Path | Permission | Role |
|--------|------|------------|------|
| GET | `/accounting/gate` | `manufacturing.cost.view` | `{ legalEntityId, enabled, reason }` |
| GET | `/accounting/feature-controls` | `manufacturing.accounting.view` | List controls |
| GET | `/accounting/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING` | `manufacturing.accounting.view` | Flag + readiness + `enablement` |
| PUT | same | `finance.settings.manage` | Enable/disable (gated) |
| GET | `/costing/readiness` | `manufacturing.accounting.view` | Tenant readiness |
| GET | `/work-orders/:id/accounting-readiness` | (costing) | WO-scoped readiness |
| GET/POST | `/accounting/workspace/*`, events validate/post/retry | various `manufacturing.accounting.*` | Ops after enable |

Files:  
`backend/src/modules/manufacturing/accounting/manufacturing-accounting.routes.ts`  
`backend/src/modules/manufacturing/costing/costing.routes.ts`

---

## 4. Current readiness logic

**Source of truth:** `getManufacturingAccountingReadiness`  
`backend/src/modules/manufacturing/costing/accounting-readiness.service.ts`

| Product condition | Current behaviour | Blocker code |
|-------------------|-------------------|--------------|
| Account mappings ready | Required keys present on LE | `MISSING_ACCOUNT_MAPPINGS` (+ WIP/FG/VARIANCE specifics) |
| Open accounting period | `checkOpenAccountingPeriod` → `resolvePeriodByDate`; OPEN/REOPENED covering `postingDateChecked` (tenant TZ today or `?postingDate=`) | `NO_OPEN_ACCOUNTING_PERIOD` |
| Failed events = 0 | Integrity inspector: `status=FAILED` (+ retry exhausted) | `FAILED_ACCOUNTING_EVENTS` |
| Unreconciled / inventory integrity = 0 | RECORDED + inv↔acct gaps + duplicates + reversal issues | `INVENTORY_POSTINGS_UNRECONCILED` |
| Inventory reconcile signed off | `configurationJson.inventoryReconcileConfirmedAt` | `INVENTORY_RECONCILE_NOT_SIGNED_OFF` |
| Pilot Finance sign-off | `configurationJson.pilotSignOffAt` | `PILOT_FINANCE_SIGNOFF_REQUIRED` |
| Flag off (posting) | Always when disabled | `MANUFACTURING_ACCOUNTING_FLAG_DISABLED` (ignored for **enablement**) |

**Enable path:** `setManufacturingAccountingFeature`  
`backend/src/modules/manufacturing/accounting/manufacturing-feature-control.service.ts`

1. Require `inventoryReconcileConfirmed` and `pilotSignOff` on body (or prior timestamps in config).
2. Persist sign-off timestamps with flag still **false**.
3. Re-run readiness; ignore `MANUFACTURING_ACCOUNTING_FLAG_DISABLED`.
4. If any remaining blockers → **409 Conflict** (flag stays off).
5. Else upsert `isEnabled=true`.

Disable is always allowed.

**Required mapping keys (code today — 9):**

```
RAW_MATERIAL_INVENTORY, WIP_INVENTORY, FINISHED_GOODS_INVENTORY,
LABOUR_ABSORPTION, MACHINE_ABSORPTION, JOB_WORK_ABSORPTION,
PRODUCTION_OVERHEAD_ABSORPTION, PRODUCTION_VARIANCE, SCRAP_LOSS
```

(`MANUFACTURING_ACCOUNT_MAPPING.md` still says 8 and excludes `SCRAP_LOSS` — doc drift.)

---

## 5. Feature flag & posting (do not change engine)

| Piece | File | Note |
|-------|------|------|
| Gate check | `manufacturing-accounting-gate.service.ts` | `isEnabled` row required |
| Record + conditional post | `manufacturing-accounting-event.service.ts` | Uses central `post()` when flag on |
| Builder | `manufacturing-accounting-builder.service.ts` | Mapping keys only — no local CoA |
| Auto absorption | `posting-orchestrator.service.ts` + `ManufacturingSettings.autoPostAbsorption` | Separate Stage-4 switch |
| Period close awareness | `period-close-readiness.service.ts` | Skips mfg GL check if flag off |

ADR-031: events always recorded when LE exists; GL only when flag on.

---

## 6. Frontend audit

| Area | Location | Status |
|------|----------|--------|
| Live workspace | `ManufacturingAccountingWorkspacePage.tsx` | Gate banner + Enable/Disable |
| API client | `manufacturingCostingApi.ts` | `setManufacturingAccountingFeatureControl(leId, isEnabled)` sends **only** `{ isEnabled }` |
| Demo costing shell | `ManufacturingCostingSetupPage.tsx` + `manufacturingAccountingService.ts` | Demo seed; not SoT for enablement |
| Permissions | `finance.settings.manage` for toggle; `manufacturing.accounting.*` for workspace | OK |
| Readiness checklist UI | — | **Missing** on enable path |
| Dual sign-off confirm | — | **Missing** (generic `appConfirm` only) |
| Failed / unposted / reconcile tabs | Workspace | Present (post-enable ops) |
| Account mapping UI | Finance default mappings | Existing |
| Period UI | Accounting periods | Existing |

---

## 7. Documentation inventory

| Doc | Relevance |
|-----|-----------|
| `PRODUCTION_PHASE6B_README.md` | Flag default off; SQL enable (pre-Wave-3) |
| `MANUFACTURING_FEATURE_FLAG_ROLLOUT.md` | Stages 1–4; **outdated** PUT body (missing sign-offs) |
| `MANUFACTURING_ACCOUNT_MAPPING.md` | ADR-039; required keys (partially stale) |
| `MANUFACTURING_ACCOUNTING_RECONCILIATION.md` | Workspace queues — not enable gate |
| `docs/audit/PHASE8A_FEATURE_FLAG_MATRIX.md` | FE/BE gate mismatch notes |
| Phase 7E / costing READMEs | Costing vs accounting |

---

## 8. Duplication risks (avoid)

| Risk | Status |
|------|--------|
| Second GL engine | None — keep `posting.service` |
| `ManufacturingAccountMapping` table | Explicitly rejected (ADR-039) |
| Parallel period validation | Reuse `AccountingPeriod` OPEN |
| Parallel ProductionAccountingEvent | Reuse existing model |
| Frontend-only readiness | Forbidden — SoT is `getManufacturingAccountingReadiness` |

---

## 9. Gaps vs product rule

```ts
const canEnable =
  accountMappingsReady &&
  openFinancialPeriodExists &&
  failedAccountingEventCount === 0 &&
  unreconciledAccountingEventCount === 0 &&
  inventoryReconcileConfirmed === true &&
  pilotSignOff === true
```

| Check | Backend | Frontend |
|-------|---------|----------|
| `accountMappingsReady` | ✅ | ❌ not shown as checklist |
| `openFinancialPeriodExists` | ✅ (posting date = now) | ❌ |
| `failedAccountingEventCount === 0` | ✅ | ❌ |
| `unreconciledAccountingEventCount === 0` | ❌ aliased / incomplete | ❌ |
| `inventoryReconcileConfirmed` | ✅ on enable PUT | ❌ not sent |
| `pilotSignOff` | ✅ on enable PUT | ❌ not sent |

Additional hardening:

- Scope event counts by `legalEntityId` when provided.
- Expose explicit booleans + counts on readiness payload for UI.
- Optional `postingDate` on readiness (default tenant timezone today) via `checkOpenAccountingPeriod` — **done**.
- Treat `SKIPPED_FLAG_OFF` / `SKIPPED_ZERO` as **not** unreconciled.

---

## 10. Recommended implementation (this phase)

1. **Audit doc** — this file (complete before code changes).
2. **Backend** — fix `accounting-readiness.service.ts`:
   - Count `unreconciledAccountingEventCount` = `RECORDED` events (LE-scoped).
   - Blocker `UNRECONCILED_ACCOUNTING_EVENTS` when count > 0.
   - Stop aliasing `INVENTORY_POSTINGS_UNRECONCILED` from failed count.
   - Return `checklist` + boolean fields matching the formula.
3. **Frontend** — extend `setManufacturingAccountingFeatureControl` body; enable flow loads readiness, shows checklist, requires both sign-offs + confirmation before PUT.
4. **Docs** — update FEATURE_FLAG_ROLLOUT, ACCOUNT_MAPPING, TESTING/SESSION notes.
5. **Tests** — extend `manufacturing-phase8-auto-gl.test.ts` for unreconciled blocker + sign-off rejection.
6. **Out of scope** — new posting types, auto-enable in seed, changing central `post()`.

---

## 11. Acceptance for follow-on work

- Flag default off; seed never enables.
- Enable API returns 409 with blockers when not ready.
- Enable API returns 400 when sign-offs missing.
- UI cannot enable without checklist green + both confirmations.
- No duplicate engines/tables.
- Existing Phase 6B/7E/8 posting paths unchanged except readiness gate inputs.

---

## 12. Decision

| Item | Verdict |
|------|---------|
| Audit complete | **Yes** |
| Safe to implement gap closure | **Yes** — reuse existing Wave-3 services |
| Greenfield enablement module needed | **No** |
| New migrations required | **No** (use `configurationJson`) |
