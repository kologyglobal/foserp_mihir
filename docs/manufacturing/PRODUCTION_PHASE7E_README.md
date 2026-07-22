# Manufacturing Phase 7E — Costing & Accounting Productionisation

**Status:** **READY FOR MANUAL ACCOUNTING PILOT** (READY WITH CONDITIONS)
**Shipped (core):** 2026-07-21
**Depends on:** Costing/GL events 6B, Warehouse/FG 7A, Corrections 5C, Finance posting engine (2B), AR/AP mapping foundation
**Feature flag:** `MANUFACTURING_ACCOUNTING` — **OFF by default** (per legal entity)

> Source of truth is the code under `backend/src/modules/manufacturing/costing/` and `backend/src/modules/manufacturing/accounting/`. This README describes only what those modules do.

---

## Why "READY FOR MANUAL ACCOUNTING PILOT" (not fully auto)

| Signal | State |
|--------|-------|
| Live test suite | `manufacturing-phase7e.test.ts` **7/7**; `manufacturing-phase6b.test.ts` regression **4/4** |
| GL posting flag | `MANUFACTURING_ACCOUNTING` **off by default** — costing works without it; GL vouchers only when a finance controller enables it per legal entity |
| Inventory valuation | **Movement-value basis** with a **provisional fallback** (qty × item standard rate) when `InventoryStockMovement.value ≤ 0` — there is **no moving-average / FIFO valuation engine** |
| Posting path | GL only through the central finance `post()` engine (ADR-039) — no parallel posting code |
| Automation | Posting of absorption / variance / close is **manual** (explicit endpoints); shop-floor material/FG events auto-post **only when the flag is on**, and the flag is off by default |

Because valuation is provisional-tolerant and posting is operator-driven with the flag off by default, the phase is safe to pilot for **manual** manufacturing accounting, but is **not** a fully automatic mfg-GL rollout.

---

## Delivered

| Area | Capability | Code |
|------|-----------|------|
| Costing policy | `ManufacturingCostingPolicy` CRUD + activate (single ACTIVE per plant scope) + built-in provisional fallback policy | `costing/costing-policy.service.ts` |
| WO cost calculation | Planned + actual cost by category, cost snapshots (versioned) and idempotent cost entries, completeness/provisional warnings, source fingerprint | `costing/work-order-cost.service.ts` |
| Readiness | Tenant + work-order accounting readiness (flag, legal entity, mappings, open period, failed events) | `costing/accounting-readiness.service.ts` |
| Manual posting | Validate / post / retry accounting events; record absorption events (delta over prior); financial-close preview + close (residual variance) | `costing/posting-orchestrator.service.ts` |
| Accounting workspace | Summary, unposted, failed, provisional, close-ready, reconciliation lists | `costing/workspace.service.ts` |
| Event recording | Idempotent `ProductionAccountingEvent` persistence; balanced SYSTEM voucher only when flag on + amount > 0 + MappingReady | `accounting/manufacturing-accounting-event.service.ts` |
| Posting builder | Debit/credit mapping-key pairs per event type via `DefaultAccountMapping`; `MFG_*` event key | `accounting/manufacturing-accounting-builder.service.ts` |
| Gate | `MANUFACTURING_ACCOUNTING` feature-control resolution + legal-entity resolution | `accounting/manufacturing-accounting-gate.service.ts` |
| Cost preview | Read-only WO cost preview (no flag required) | `accounting/manufacturing-cost-preview.service.ts` |
| FG capitalisation | Proportional-by-good-quantity capitalisation with cumulative cap | `fg-receipts/fg-receipt.service.ts` |
| FG reversal | Compensating FG issue + `MANUFACTURING_REVERSAL` event (Phase 5C corrections) | `corrections/handlers/fg-correction.handler.ts` |

### Companion rule docs

`MANUFACTURING_COSTING_POLICY.md` · `WORK_ORDER_COSTING_RULES.md` · `MATERIAL_COSTING_RULES.md` · `LABOUR_AND_MACHINE_COSTING.md` · `JOB_WORK_COSTING.md` · `WIP_VALUATION_RULES.md` · `FG_CAPITALISATION_RULES.md` · `MANUFACTURING_VARIANCE_RULES.md` · `MANUFACTURING_POSTING_EVENTS.md` · `MANUFACTURING_ACCOUNT_MAPPING.md` · `MANUFACTURING_REVERSAL_ACCOUNTING.md` · `MANUFACTURING_FEATURE_FLAG_ROLLOUT.md` · `MANUFACTURING_ACCOUNTING_RECONCILIATION.md`

---

## Deferred / not in this build

- **Auto-posting rollout** (Stage 4) — code paths exist but the flag is off by default; auto-enable is a separate decision.
- **`STANDARD_WITH_VARIANCE` costing** — not a `ManufacturingCostingMethod` enum value; only `ACTUAL` and `PLANNED_AS_PROVISIONAL` exist.
- **Moving-average / FIFO inventory valuation** — no engine; material cost is movement value with provisional fallback.
- **Payroll / true labour cost**, **ABC / activity-based overhead**, **OEE / capacity absorption**.
- **COGS / Delivery Challan / Sales Invoice / revenue recognition** — still deferred (no models in this build).
- **Scrap / rework cost capture** — snapshot columns exist and default to 0; no capture pipeline wired.

---

## Migration

- `20260721190000_manufacturing_phase7e_costing` (additive only):
  - `manufacturing_machines.costRate` column
  - `production_accounting_events.eventType` gains `MANUFACTURING_REVERSAL`; `status` gains `SKIPPED_ZERO`, `SKIPPED_FLAG_OFF`, `REVERSED`
  - `default_account_mappings.mappingKey` extended (manufacturing keys already present) — **no separate `ManufacturingAccountMapping` table** (ADR-039)
  - new tables `manufacturing_costing_policies`, `work_order_cost_snapshots`, `work_order_cost_entries`

CI applies migrations with `npx tsx scripts/prisma-cli.ts migrate deploy`.

---

## Tests

| Suite | Result |
|-------|--------|
| `backend/tests/manufacturing-phase7e.test.ts` | **7/7** (policies/activation, snapshot + honest warnings, permission gate, readiness blockers, manual absorption → post → idempotent retry, financial close, tenant isolation) |
| `backend/tests/manufacturing-phase6b.test.ts` | **4/4** regression |

Live suites require MySQL; they `describe.skipIf(!dbAvailable)`.

---

## Feature flags & permissions

- Flag: `FinanceFeatureControl.featureKey = 'MANUFACTURING_ACCOUNTING'`, per `legalEntityId`, default off.
- Permissions: `manufacturing.cost.view|calculate|details|provisional_view`, `manufacturing.costing_policy.view|manage`, `manufacturing.accounting.view|validate|post|retry|financial_close|reconcile`, `manufacturing.cost_reports.view|export`.

---

## Next (not auto-started)

**Phase 8 — pilot hardening**: enable the flag for a controlled legal entity, exercise the manual post → reconcile → close loop on real work orders, and only then evaluate Stage 4 auto-posting. Requires separate approval.
