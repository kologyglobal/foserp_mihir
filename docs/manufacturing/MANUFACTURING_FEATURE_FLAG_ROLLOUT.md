# Manufacturing Feature Flag & Rollout

Source: `backend/src/modules/manufacturing/accounting/manufacturing-accounting-gate.service.ts`, `manufacturing-accounting-event.service.ts`, `costing/accounting-readiness.service.ts`.

Manufacturing GL posting is gated by the finance feature control **`MANUFACTURING_ACCOUNTING`**, resolved per legal entity and **OFF by default**.

---

## The flag

- Stored as `FinanceFeatureControl` row: `featureKey = 'MANUFACTURING_ACCOUNTING'`, `legalEntityId`, `isEnabled`.
- `isManufacturingAccountingEnabled(tenantId, legalEntityId)` returns true only when such a row exists with `isEnabled = true`. No row = **off**.
- Legal entity resolved by `resolveManufacturingLegalEntityId` (default active LE, else first active). No LE → gate `reason = NO_LEGAL_ENTITY`, `enabled = false`.
- Gate status API: `GET /manufacturing/accounting/gate` → `{ legalEntityId, enabled, reason }` where reason ∈ `ENABLED` / `FLAG_OFF` / `NO_LEGAL_ENTITY`.

When off, events are still recorded (`SKIPPED_FLAG_OFF`) so costing and audit work without any GL impact.

---

## Rollout stages

| Stage | What runs | Flag | State in this build |
|-------|-----------|------|---------------------|
| **Stage 1 — Costing** | Cost policies, WO cost calculation, snapshots/entries, readiness, cost preview, reconciliation views. **No GL.** | Off | **Available now** — works with the flag off |
| **Stage 2 — Manual post** | Enable flag for an LE; controllers manually `validate → post → retry` recorded events; record absorption; financial close. GL vouchers via central `post()`. | On (per LE) | **Available now** — opt-in per legal entity |
| **Stage 3 — Pilot** | Run the full manual loop on real work orders for a controlled legal entity; reconcile and close. | On (pilot LE) | **This phase's target** — READY FOR MANUAL ACCOUNTING PILOT |
| **Stage 4 — Auto** | Shop-floor material/FG events post automatically as they occur (`tryRecord…` when flag on), plus automatic absorption after daily-production confirm. | On (broad) + `autoPostAbsorption` | **Available, opt-in per tenant** — see Stage 4 below |

> The shop-floor auto-post code path (`tryRecordManufacturingAccountingEvent` posting when the flag is on) exists, but because the flag is off by default, **auto-posting is effectively disabled**. Turning it on broadly (Stage 4) is a separate, deliberate decision — not part of this phase's acceptance.

---

## Stage 4 — Auto mfg-GL (Wave 3)

Stage 4 is controlled by **two independent switches** that must both be on:

1. **`MANUFACTURING_ACCOUNTING` feature control (per legal entity)** — managed via the admin API:
   - `GET /manufacturing/accounting/feature-controls` — list finance feature controls for the tenant (`?featureKey=` optional).
   - `GET /manufacturing/accounting/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING` — flag status + readiness summary (`manufacturing.accounting.view`).
   - `PUT /manufacturing/accounting/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING` — body `{ "isEnabled": boolean, "pilotSignOff"?: boolean, "inventoryReconcileConfirmed"?: boolean, "signOffNote"?: string }` (`finance.settings.manage`). Enabling requires readiness (mappings, open period, no failed/unreconciled events) **and** both sign-offs; returns **409 with blockers** or **400** when sign-offs missing. Disabling is always allowed.
2. **`ManufacturingSettings.autoPostAbsorption` (per tenant, default `false`)** — Wave 1 denormalized field (`costing.autoPostAbsorption` in the settings payload).

When both are on, submitting a daily-production batch recalculates work-order cost and records + posts absorption deltas automatically (`autoPostAbsorptionAfterProduction` in `costing/posting-orchestrator.service.ts`). Failures never block shop-floor confirmation — events stay `RECORDED`/`FAILED` in the accounting workspace.

Manual absorption is also HTTP-exposed (`manufacturing.accounting.post`):

- `POST /manufacturing/work-orders/:id/cost/absorption` — record absorption deltas from the latest snapshot.
- `POST /manufacturing/work-orders/:id/cost/absorption/post` — record, then immediately attempt to post each event.

---

## Required mapping set (readiness)

**Core (always):** `WIP_INVENTORY`, `FINISHED_GOODS_INVENTORY`, `PRODUCTION_VARIANCE`

**Conditional (policy / MappingReady events):** see [`MANUFACTURING_ACCOUNT_MAPPING.md`](./MANUFACTURING_ACCOUNT_MAPPING.md). Typical enable set also requires `RAW_MATERIAL_INVENTORY`, `LABOUR_ABSORPTION`, `MACHINE_ABSORPTION`, `JOB_WORK_ABSORPTION`, `SCRAP_LOSS`; overhead when `overheadMethod !== NONE`.

Missing keys are returned on readiness as `mappingKeys.missing`. Specific blockers include `WIP_ACCOUNT_NOT_CONFIGURED`, `FINISHED_GOODS_ACCOUNT_NOT_CONFIGURED`, `PRODUCTION_VARIANCE_ACCOUNT_NOT_CONFIGURED`, labour/machine/job-work/overhead/scrap variants, plus `MISSING_ACCOUNT_MAPPINGS`.

`getManufacturingAccountingReadiness` — SoT for the enablement formula:

```ts
canEnable =
  accountMappingsReady &&
  openFinancialPeriodExists &&
  failedAccountingEventCount === 0 &&
  inventoryPostingsUnreconciledCount === 0 && // RECORDED + inv↔acct gaps + duplicates + reversal issues
  inventoryReconcileConfirmed &&
  pilotSignOff
```

| Blocker | Cause |
|---------|-------|
| `NO_LEGAL_ENTITY` | no active legal entity |
| `MANUFACTURING_ACCOUNTING_FLAG_DISABLED` | flag off (ignored when **enabling**) |
| `MISSING_ACCOUNT_MAPPINGS` | any required `DefaultAccountMapping` key missing |
| `NO_OPEN_ACCOUNTING_PERIOD` | no OPEN/REOPENED period covering `postingDateChecked` (tenant TZ today or `?postingDate=`) |
| `FAILED_ACCOUNTING_EVENTS` | unresolved `FAILED` / retry-exhausted events |
| `INVENTORY_POSTINGS_UNRECONCILED` | RECORDED pending, inventory without accounting, accounting without inventory, duplicate pending, or inconsistent reversal chain |
| `INVENTORY_RECONCILE_NOT_SIGNED_OFF` | no inventory reconcile timestamp on feature control JSON |
| `PILOT_FINANCE_SIGNOFF_REQUIRED` | no pilot Finance sign-off timestamp |

Readiness returns `openPeriod` + `postingDateChecked`, and UI-safe `eventIntegrity.exceptions` (no stack traces). `technicalDetails` only for settings/post roles. Enablement does **not** bypass posting-time `resolvePostingPeriod`.

Warning `PROVISIONAL_COST_PRESENT` when snapshots carry provisional cost (does not block enablement).

`allowedActions`: `validate` (LE present), `post` (no blockers), `retry` (flag on + failed events), `financialClose` (no blockers + no failed), `enable` (`canEnable` and flag currently off).

---

## Sign-offs (server-stored only)

Enable PUT requires **explicit** request values every time (checkboxes must not be preselected in UI):

```json
{
  "isEnabled": true,
  "inventoryReconcileConfirmed": true,
  "inventoryReconcileRemarks": "…",
  "inventoryReconcileScope": { "plantId": "…", "warehouseIds": ["…"], "workOrderIds": ["…"] },
  "inventoryReconcileReportRef": "optional-report-ref",
  "pilotSignOff": true,
  "pilotSignOffRemarks": "…",
  "pilotScope": { "plantId": "…", "finishedItemIds": ["…"], "warehouseIds": ["…"] }
}
```

| Code (HTTP 422) | When |
|-----------------|------|
| `INVENTORY_RECONCILE_NOT_SIGNED_OFF` | `inventoryReconcileConfirmed !== true`, reconcile unavailable, or missing reconcile permission |
| `PILOT_FINANCE_SIGNOFF_REQUIRED` | `pilotSignOff !== true`, finance not activated, mappings/period/failed-event pre-checks fail |

Stored on `FinanceFeatureControl.configurationJson` (current snapshot) plus additive `signOffHistory[]` (never overwrites prior entries). No frontend-only persistence.

Permissions: enable route `finance.settings.manage`; inventory confirm also accepts `manufacturing.accounting.reconcile`.

---

## Turning it on

1. Ensure the legal entity has all **9** required `DefaultAccountMapping` keys and an OPEN accounting period covering today.
2. Clear `FAILED` and `RECORDED` production accounting events for that LE.
3. From **Accounting → Manufacturing Accounting** (API mode), open **Enable…**, review the readiness checklist, tick inventory reconcile + pilot Finance sign-off.
4. `PUT /manufacturing/accounting/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING` with:
   ```json
   {
     "isEnabled": true,
     "inventoryReconcileConfirmed": true,
     "pilotSignOff": true,
     "signOffNote": "optional"
   }
   ```
   Permission: `finance.settings.manage`. Incomplete readiness → **409** with blockers; missing sign-offs → **400**.
5. Verify `GET /accounting/gate` shows `enabled: true`.
6. Post manually (Stage 2/3). Do **not** enable Stage 4 `autoPostAbsorption` without a separate rollout decision.
