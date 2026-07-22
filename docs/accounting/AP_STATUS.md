# Accounts Payable — Status

**Status:** Phases **4A1–4A5**, **4B1–4B5**, **4C1**, **4C2**, **4D1** and **4D2** complete. **AP Phase 4 complete.** Next Finance area: **Bank & Cash** (separate approval — not auto-started).

Last verified: **2026-07-19**

---

## Phase 4D2 — Shipped ✅

AP-to-GL reconciliation + close-readiness gate + Money Out frontend. See [`AP_RECONCILIATION_ARCHITECTURE.md`](AP_RECONCILIATION_ARCHITECTURE.md), [`AP_CLOSE_GATE.md`](AP_CLOSE_GATE.md), [`AP_RECONCILIATION_EXCEPTIONS.md`](AP_RECONCILIATION_EXCEPTIONS.md).

| Area | Delivered |
|------|-----------|
| **Reconciliation HTTP** | `POST/GET /payables/reconciliation/runs`, account/vendor results, exceptions, acknowledge, CSV export |
| **Close gate HTTP** | `POST/GET /payables/close-gate/runs`, `/latest`, export — advisory only (does not close period) |
| **Rules** | GL `Cr−Dr` vs AP `CREDIT−DEBIT` base outstanding; CURRENT vs HISTORICAL; tolerance; persisted runs; no GL/open-item mutations |
| **Frontend** | Money Out Reconciliation + Close Gate tabs live; overview recon status card |
| **Migration** | `20260719210000_finance_phase4d2_ap_reconciliation` |
| **Tests** | `finance-ap-gl-reconciliation.test.ts` (9/9); `finance-ap-close-gate.test.ts` (4/4); backend `tsc --noEmit` clean |
| **Verify** | `npm run test:money-out-reconciliation` (frontend static checks) |

**Deferred:** Bank reconciliation (Bank & Cash module); branch-scoped reconciliation.

---

## Phase 4D1 — Shipped ✅

AP reporting (outstanding, ageing, vendor summaries, payment planning) — backend read-only GETs + Money Out frontend. See [`AP_REPORTING_ARCHITECTURE.md`](AP_REPORTING_ARCHITECTURE.md).

| Area | Delivered |
|------|-----------|
| **Reporting HTTP** | `/payables/overview`, `/outstanding`, `/ageing`, `/vendors`, `/vendors/:id`, `/vendors/:id/open-items`, `/payment-planning` — all `finance.ap.view`, read-only |
| **Rules** | CREDIT-side outstanding (invoices + credit adjustments); `due_date` and `document_age` ageing bases; vendor `netPayableBase` = credit − debit base outstanding; payment planning horizon grouping |
| **Frontend** | Money Out Outstanding, Ageing, Vendors, Payment Planning pages live |
| **Tests** | `finance-ap-reporting.test.ts` — **9/9** (live MySQL); backend `tsc --noEmit` clean |
| **Verify** | `npm run test:money-out-reporting` (frontend static checks) |

---

## Phase 4C2 — Shipped ✅

Vendor adjustments (debit notes / credit adjustments) + corrections workspace + reversal frontend. See [`AP_ADJUSTMENT_ARCHITECTURE.md`](AP_ADJUSTMENT_ARCHITECTURE.md), [`AP_ADJUSTMENT_FRONTEND.md`](AP_ADJUSTMENT_FRONTEND.md), [`AP_REVERSAL_FRONTEND.md`](AP_REVERSAL_FRONTEND.md).

| Area | Delivered |
|------|-----------|
| **Adjustments HTTP** | Full vendor-adjustment CRUD + workflow + post + reversal + debit-note allocation (backend, pre-existing) |
| **Frontend routes** | `/vendor-adjustments/*`, `/corrections`, `/reversals`, `/reversals/:type/:id` |
| **Pages** | List, form (debit note default), detail, allocate, corrections hub, reversal preview/history |
| **Reversal UI** | Payment/invoice/adjustment preview + cascade; allocation reverse; wired on detail pages |
| **Permissions** | `finance.ap.adjustment.*`, `finance.ap.corrections.view`, existing reverse keys |
| **Verify** | Backend: 4 live-MySQL vitest files (17 cases); `tsc --noEmit` clean; full AP regression green. Frontend: `npm run test:money-out-adjustments` (24/24) + typecheck |

**Gaps vs full acceptance:** dedicated AP reversal history API (stub empty state), no E2E Playwright.

---

## Prior phases (4A–4C1)

See prior sections in git history and `AP_*` docs for 4A vendor invoice, 4B payment/allocation, 4C1 backend reversal.

---

## Deferred

| Phase | Scope | Status |
|-------|-------|--------|
| **Bank & Cash** | Bank reconciliation, treasury workspace (backend) | ❌ Deferred — next Finance area (separate approval) |
| **Branch recon** | Branch-scoped AP-to-GL reconciliation | ❌ Deferred (legal-entity scope in 4D2) |
