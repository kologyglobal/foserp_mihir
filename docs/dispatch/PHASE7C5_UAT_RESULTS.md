# Phase 7C5 — Manual UAT Results

**Status:** Automated suite re-verified after `salesAllowed` fixture fix (2026-07-27). **Operator UI sign-off still required** (Scenario A PARTIAL).

## Automated evidence

```bash
cd backend
npx vitest run tests/dispatch-phase7c5.test.ts
```

Expect **17/17 PASS** (MySQL up). Covers gates, happy path, idempotent re-post, full/partial reverse + approval workflow, SI/COGS reverse blocks, emergency override, serial/lot, concurrency.

## Operator UI sign-off (API mode)

Tenant with `dispatch.*` (+ `dispatch.override` for emergency / force reverse). Path: **Dispatch → Register → open WORKBENCH outbound** (`DSP-*`).

| # | Scenario | Steps | Pass? | Notes |
|---|----------|-------|-------|-------|
| A | Full Dispatch | Reserve → Create pick → Pick complete → Start packing → Pack → Complete/verify → Create/issue challan → **Post Dispatch (7C5)** | PARTIAL | `DSP-000001` posted **API** `DRAFT`→`CONFIRMED` (`scripts/post-7c5-outbound.ts`). UI coach/Reserve seen earlier; **UI Post click still not signed**. Domain-event side noise: `findUnique` on `DISPATCH_POSTED` / `SALES_ORDER_INVOICE_READY` handlers (post still 200). |
| B | Gate validation | On draft, try Post before gates pass | | Post disabled / blockers listed; coach shows ✗ |
| C | Partial Dispatch | Plan qty &lt; SO remaining; post | | Fulfilment partial; SO remaining correct |
| D | Duplicate post | Post again on confirmed | | Idempotent; no second ISSUE |
| E | Full reversal | Reverse (7C5) → reason → apply (or approve panel if required) | | Status `REVERSED`; stock restored |
| F | Reverse approval | Role with `reverse.request` only → Submit; approver Approve → Apply | | Open reversals panel: Submit / Approve / Reject / Cancel / Apply |
| G | Downstream block | Create/post SI linked to outbound → Reverse | | Blocked unless `dispatch.override` + Force |
| H | Emergency override | Blocked draft (no pick/pack/challan) → Emergency override… → post | | Needs `dispatch.override`; never-overridable stays blocked |

### Reverse approval panel check (new FE)

On `CONFIRMED` with an open reversal (`DRAFT_REQUEST` / `SUBMITTED` / `APPROVED`):

- [ ] Panel **Open reversals (7C5)** visible
- [ ] Submit / Approve / Reject / Cancel / Apply match role perms
- [ ] After Apply, outbound `REVERSED` or still `CONFIRMED` if partial

### Sign-off

| Field | Value |
|-------|-------|
| Tester | Auto (browser assist) |
| Date | 2026-07-27 |
| Environment | local |
| Automated 7C5 | PASS |
| UI scenarios A–H | PARTIAL (A posted via API; UI Post not signed) |
| Decision | **Hold** — optional UI re-check on confirmed `DSP-000001`; investigate domain-event `findUnique` noise |

**Helpers (local):** `npx tsx scripts/seed-7c5-uat-draft.ts`, `npx tsx scripts/advance-7c5-to-ready-post.ts [id]`, `npx tsx scripts/post-7c5-outbound.ts [id]`

**Sign-off:** _not signed_ — Scenario A Post still needs operator confirm in UI
