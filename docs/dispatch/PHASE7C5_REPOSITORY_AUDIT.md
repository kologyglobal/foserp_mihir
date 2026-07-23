# Phase 7C5 — Repository Audit

**Date:** 2026-07-23 (refreshed after gap-close pass)  
**Scope:** Hardened Dispatch posting, mandatory end-to-end governance, SO fulfilment, reversal  
**Product completeness:** **READY FOR INTERNAL UAT** — not client production-ready.

---

## 1. Executive verdict

| Decision | Result |
|----------|--------|
| **STOP gate (foundations)** | **READY** — Inventory posting, outbound qty, tenant SO link, reversible FG_DISPATCH, tx support, reservation model present |
| **7C5 product completeness** | **READY FOR INTERNAL UAT** (conditions in §12) |
| Canonical `DispatchPostingService` | **Present** — `backend/src/modules/dispatch/posting/dispatch-posting.service.ts` |
| Policy + feature flag | **Present** — `dispatch-policy.ts`, `DISPATCH_HARDENED_POSTING_ENABLED` |
| Backend readiness | **Present** — `dispatch-posting-readiness.service.ts`, `GET …/posting-readiness` |
| Reversal facade | **Present** — `DispatchReversalService.reverseOutboundDispatchCanonical` (HTTP wired) |
| Reconciliation | **Present** — `dispatch-reconciliation.service.ts` |
| Live tests | **Present** — `tests/dispatch-phase7c5.test.ts` (8 assertions) |

Do **not** claim client production readiness without UAT + reconciliation sign-off.

---

## 2. STOP conditions (foundations)

| Prerequisite | Status | Notes |
|--------------|--------|-------|
| Canonical Inventory posting | **Yes** | `InventoryPostingService.postFgDispatchIssue` |
| Outbound line quantity model | **Yes** | `OutboundDispatchLine.quantity` + pick/pack/challan side ledgers |
| Tenant-scoped SO linkage | **Yes** | All queries filter `tenantId` |
| Reversible FG_DISPATCH | **Yes** | Compensating `INWARD` + `FG_DISPATCH` on reverse |
| Immutable posting reference | **Partial** | Movement idempotency keys; no dedicated `DispatchPosting` table |
| Safe transactions | **Partial** | `prisma.$transaction` for stock + status; some gates outside lock |
| Reservation model | **Yes** | Soft reserve; consume on post; reverse restores free stock only |

**STOP outcome:** Foundations reliable enough to implement/ship 7C5 under conditions. Do not invent a second Inventory ledger.

---

## 3. Current posting paths (canonical)

```text
POST …/outbound/:id/confirm  ──► confirmOutboundDispatch ──┐
                                                           ├──► DispatchPostingService.postFgDispatch
POST …/outbound/:id/post     ──► postOutboundDispatch    ──┘
                                                           │
                                                           ▼
                                              InventoryPostingService.postFgDispatchIssue
                                              (ISSUE / FG_DISPATCH) + status CONFIRMED
```

| Endpoint | Permission | Policy |
|----------|------------|--------|
| `/confirm` | `dispatch.post` or `dispatch.basic_confirm` | Soft unless hardened workbench (`DISPATCH_HARDENED_POSTING_ENABLED` + `WORKBENCH_7C1`) |
| `/post` | `dispatch.post` | Hardened for workbench post path (forceHardened / resolvePostingPolicyForOutbound) |

Request-body `idempotencyKey` is honoured by both confirm and post controllers.

### Legacy / bypass

| Path | Status after gap-close |
|------|------------------------|
| Direct `POST /inventory/movements/fg-dispatch` | **Blocked** when `DISPATCH_HARDENED_POSTING_ENABLED` is true |
| Historical `CONFIRMED` without pick/pack/challan | Remain valid (`LEGACY_POSTED` semantics); new workbench posts enforce policy when flag ON |

---

## 4. Non-stock-moving steps (verified)

| Step | Moves stock? |
|------|--------------|
| FG Reservation | **No** |
| Pick | **No** |
| Pack | **No** |
| Delivery Challan issue | **No** (`DELIVERY_CHALLAN_AS_DOCUMENT_ONLY`) |

Only successful Dispatch posting creates `ISSUE` / `FG_DISPATCH`.

---

## 5. Reversal

| Item | Detail |
|------|--------|
| HTTP | `POST …/outbound/:id/reverse` → `DispatchReversalService.reverseOutboundDispatchCanonical` |
| Stock | Compensating inward; original movements immutable |
| Fulfilment | Derived; net dispatched drops when status → `REVERSED` |
| Reservation policy | `RESTORE_FREE_STOCK_ONLY` (documented in reversal service) |
| Partial reverse | **Deferred** |
| Invoice/COGS hard block | **Shipped** — `SALES_INVOICE_POSTED` / `SALES_INVOICE_OPEN` / `COGS_OR_INV_ACCT_POSTED` via `inspectReversalDependencies` |
| Permissions | Uses `dispatch.post` / `dispatch.override` / `tenant.manage` (no dedicated `dispatch.reverse.*` yet) |

---

## 6. Sales Order fulfilment

| Item | Detail |
|------|--------|
| Source of truth | Derived from `CONFIRMED` outbound lines (minus reversed headers) |
| Cached `dispatchedQty` | Not authoritative |
| Events | Domain outbox **shipped** — enqueue + drain to `PUBLISHED` for `DISPATCH_POSTED` / `SALES_ORDER_INVOICE_READY` / fulfilment / reverse (`DISPATCH_DOMAIN_EVENTS.md`) |
| Auto invoice / COGS | Out of scope (correct) |

---

## 7. Idempotency & concurrency

| Layer | State |
|-------|-------|
| Movement keys | `fg-dispatch:{outboundId}:{lineId}` |
| Request idempotency key | Accepted on confirm/post |
| Status replay | Already `CONFIRMED` / `REVERSED` returns safely |
| Concurrent double-post | Stress-covered (8-way + reverse race) in `dispatch-phase7c5.test.ts` |
| Header `FOR UPDATE` | Best-effort via status + unique posting keys |

---

## 8. Schema vs target

| Target | Current |
|--------|---------|
| `DispatchPosting` / lines | **Not added** — outbound + inventory movements act as posting identity |
| `DispatchReversal` tables | **Not added** — header reverse fields |
| Policy DB settings | Env + code policy object (pilot defaults) |
| Expanded lifecycle enums | Readiness derives richer status; DB still DRAFT/CONFIRMED/CANCELLED/REVERSED |

Additive posting tables remain optional until UAT demands immutable posting documents separate from outbound.

---

## 9. Permissions

| Present | Gap |
|---------|-----|
| `dispatch.post`, `dispatch.basic_confirm`, pick/pack/challan | Dedicated `dispatch.reverse.request/approve/apply` |
| `dispatch.override` (used in reverse) | FE permission gating for Post/Reverse incomplete |

---

## 10. Frontend (API mode)

| Area | State |
|------|-------|
| Readiness checklist | Backend-driven on outbound detail |
| Post button | Shown only when `allowedActions` includes `POST` (readiness must load) |
| Posting preview | Confirm dialog with quantity reconciliation summary |
| Duplicate-click | `busy` guard + idempotency key |
| Reversal UX | Reason prompt + immutable warning copy |
| Reconciliation UI | API exists; Workbench exception view thin / unused |
| Override / approval drawers | API emergency post shipped (`DISPATCH_EMERGENCY_OVERRIDE.md`); FE drawer still light |

---

## 11. Tests & docs

| Asset | State |
|-------|-------|
| `dispatch-phase7c5.test.ts` | **17/17** live (gates, happy path, reverse, emergency, serial/lot, concurrency stress) |
| Supporting docs | `PHASE7C5_HARDENED_POSTING.md`, readiness/policy/qty/reversal/legacy/permission docs |
| PROJECT_MEMORY | States 7C0–7C5 controlled UAT |

---

## 12. Known conditions (after deferred gap-close)

| Item | Status |
|------|--------|
| Dedicated `DispatchPosting` table | **Done** |
| Partial reverse / approval workflow | **Done** |
| Invoice/COGS hard blockers | **Done** (creation of SI/COGS still out of scope) |
| Outbox domain events | **Done** |
| Serial/lot + concurrency tests | **Done** |
| Soft `/confirm` BASIC when flag OFF | **By design** → `LEGACY_POSTED` |
| Emergency override UX drawers | Light / deferred |
| Auto Sales Invoice / COGS creation | Out of scope (phase stop) |

---

## 13. Compatibility

| Risk | Mitigation |
|------|------------|
| Historical confirm without documents | Do not retro-invalidate |
| Soft confirm for BASIC | Keep route; workbench harden via flag |
| Flag OFF in production | Legacy soft path until UAT sign-off |

---

## 14. Key file index

```
backend/src/modules/dispatch/posting/dispatch-posting.service.ts
backend/src/modules/dispatch/posting/dispatch-posting-readiness.service.ts
backend/src/modules/dispatch/posting/dispatch-policy.ts
backend/src/modules/dispatch/posting/dispatch-reversal.service.ts
backend/src/modules/dispatch/posting/dispatch-reconciliation.service.ts
backend/src/modules/dispatch/outbound/outbound-dispatch.service.ts
backend/src/modules/dispatch/outbound/outbound-dispatch.controller.ts
backend/src/modules/inventory/movements/movement.service.ts  (direct FG_DISPATCH gate)
backend/src/modules/inventory/shared/stock-posting.service.ts
frontend/src/modules/dispatch/ApiOutboundDispatchPages.tsx
backend/tests/dispatch-phase7c5.test.ts
```

---

## 15. Final audit decision

```text
PHASE 7C5 FOUNDATION GATE: READY (no STOP)
PHASE 7C5 PRODUCT STATUS:   READY FOR INTERNAL UAT — WITH CONDITIONS (§12)
```

**Correct status wording:**

> Dispatch 7C0–7C5 is complete for controlled UAT. Reservation, Pick, Pack and issued Delivery Challan are policy-enforced readiness steps when hardened posting is enabled; only hardened Dispatch posting moves FG stock and contributes to derived Sales Order fulfilment.

Do **not** claim client production readiness until manual UAT and reconciliation sign-off.
