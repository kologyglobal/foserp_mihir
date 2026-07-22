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
   - `PUT /manufacturing/accounting/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING` — body `{ "isEnabled": boolean }` (`finance.settings.manage`). Enabling runs the readiness gate (mappings, open period, no failed events — the flag blocker itself is ignored) and returns **409 with the blockers** when not ready. Disabling is always allowed.
2. **`ManufacturingSettings.autoPostAbsorption` (per tenant, default `false`)** — Wave 1 denormalized field (`costing.autoPostAbsorption` in the settings payload).

When both are on, submitting a daily-production batch recalculates work-order cost and records + posts absorption deltas automatically (`autoPostAbsorptionAfterProduction` in `costing/posting-orchestrator.service.ts`). Failures never block shop-floor confirmation — events stay `RECORDED`/`FAILED` in the accounting workspace.

Manual absorption is also HTTP-exposed (`manufacturing.accounting.post`):

- `POST /manufacturing/work-orders/:id/cost/absorption` — record absorption deltas from the latest snapshot.
- `POST /manufacturing/work-orders/:id/cost/absorption/post` — record, then immediately attempt to post each event.

---

## Readiness gate (must pass before posting)

`getManufacturingAccountingReadiness` blockers:

| Blocker | Cause |
|---------|-------|
| `NO_LEGAL_ENTITY` | no active legal entity |
| `MANUFACTURING_ACCOUNTING_FLAG_DISABLED` | flag off |
| `MISSING_ACCOUNT_MAPPINGS` | any required `DefaultAccountMapping` key missing |
| `NO_OPEN_ACCOUNTING_PERIOD` | no OPEN period covering today |
| `FAILED_ACCOUNTING_EVENTS` | unresolved `FAILED` events |

Warning `PROVISIONAL_COST_PRESENT` when snapshots carry provisional cost (does not block).

`allowedActions`: `validate` (LE present), `post` (no blockers), `retry` (flag on + failed events), `financialClose` (no blockers + no failed events).

---

## Turning it on

1. Ensure the legal entity has the 8 required `DefaultAccountMapping` keys and an OPEN accounting period.
2. Create the `FinanceFeatureControl` row (`MANUFACTURING_ACCOUNTING`, `isEnabled = true`) for that LE.
3. Verify `GET /accounting/gate` shows `enabled: true` and `GET /costing/readiness` has no blockers.
4. Post manually (Stage 2/3). Do **not** enable Stage 4 auto-posting without a separate rollout decision.
