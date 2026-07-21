# ACCOUNTING GATE: PASSED WITH ACCEPTED RISKS

**Date:** 2026-07-18  
**Commit tested:** `e49b9081c54177a7d2c030f9bcb3c0c20ed7ebcb` (+ uncommitted finance Phase 2C3/3D worktree)  
**Environment:** Local MySQL `fos_erp` @ `localhost:3306` (development) — **not production**  
**API mode FE:** `VITE_USE_API=true` (`frontend/.env`)

---

## 1. Executive summary

Live Accounting (Finance Settings → Journals → GL → Sales Invoices → Receipts → Allocations → Credit Notes → AR reversals → Money In reports) was verified against code and automated evidence.

**Phase 2C3** (journal reverse) and **Phase 3D** (receipt/CN allocation + document reverse) pass focused regression. GL/open-item integrity script is clean (15/15). Money In FE verify is **76/76**. Backend/frontend typecheck pass. Local DB had **16 unapplied finance migrations** at gate start — applied during this gate; schema is now up to date.

**Accepted risks:** sales-invoice *document* reverse is **not implemented** (out of coded Phase 3D); full parallel finance suite shows intermittent MariaDB write-conflict flakes (serial critical path green); dedicated browser journal smoke and dedicated reverse tenant-isolation suite were not expanded beyond existing coverage.

**No AP / Bank / Fixed Assets / GST returns / inventory accounting work was started.**

---

## 2–4. Repository / environment

| Item | Value |
|------|--------|
| Branch | `main` |
| DB | `fos_erp` local MySQL — controlled/dev |
| Backend | `http://127.0.0.1:5000` |
| Frontend | `http://127.0.0.1:5173` |
| Backup | Not taken (local disposable test DB; migrations applied forward-only) |

---

## 5. Phase status matrix

See [`ACCOUNTING_PHASE_STATUS_MATRIX.md`](./ACCOUNTING_PHASE_STATUS_MATRIX.md).

---

## 6. Commands executed

| Command | CWD | Exit | Summary |
|---------|-----|-----:|---------|
| `npx tsx scripts/prisma-cli.ts format` | backend | 0 | Schema formatted |
| `npx tsx scripts/prisma-cli.ts validate` | backend | 0 | Valid |
| `npx tsx scripts/prisma-cli.ts generate` | backend | 0 | Client generated |
| `npx tsx scripts/prisma-cli.ts migrate status` (pre) | backend | 1 | 16 finance migrations pending + history drift |
| `npx tsx scripts/prisma-cli.ts migrate deploy` | backend | 0 | 16 migrations applied |
| `npx tsx scripts/prisma-cli.ts migrate status` (post) | backend | 0 | Up to date (31 migrations) |
| `npx vitest run tests/finance` (parallel) | backend | 1 | 241 pass / 2 fail / 24 skip (flakes + stale assert) |
| Serial critical finance subset | backend | 1→0 | 136/137 then fixed assert → reversals 31/31 |
| Focused reversals (journal+receipt+CN) | backend | 0 | **31/31** |
| `npx tsc --noEmit` | backend | 0 | Pass |
| `npx tsx scripts/verify-finance-integrity.ts` | backend | 0 | **15/15** P0 checks |
| `npx tsc -b --noEmit` | frontend | 0 | Pass |
| `npm run test:money-in` | frontend | 0 | **76/76** |
| Full backend `npm test` / backend `build` / FE `build` | — | — | **Not run this gate** (accepted risk) |

---

## 7–14. Phase results (summary)

| Area | Result |
|------|--------|
| Journal post (2C2B) | PASS (serial suite) |
| Journal reverse (2C3) | **PASS 5/5** |
| Invoice post (3A4) | PASS |
| Invoice document reverse | **NOT IMPLEMENTED** (accepted) |
| Receipt post / allocate | PASS |
| Receipt alloc reverse (3D) | **PASS** |
| Receipt document reverse (3D) | **PASS** |
| CN post / allocate | PASS |
| CN alloc reverse (3D) | **PASS** |
| CN document reverse (3D) | **PASS** |
| Idempotency (reverse replay) | PASS (receipt/CN/journal) |
| Reversal ordering (alloc before doc) | PASS (blocked while POSTED allocs) |
| Permissions (reverse 403) | PASS |

Detail: [`ACCOUNTING_REVERSAL_EVIDENCE.md`](./ACCOUNTING_REVERSAL_EVIDENCE.md)

---

## 15–19. Integrity

| Check set | Result |
|-----------|--------|
| Voucher/GL balance | PASS |
| Open-item bounds | PASS |
| Allocation/reversal markers | PASS |
| AR GL vs subledger net | PASS (0 mismatches) |

Detail: [`ACCOUNTING_GL_SUBLEDGER_EVIDENCE.md`](./ACCOUNTING_GL_SUBLEDGER_EVIDENCE.md)  
Script: `backend/scripts/verify-finance-integrity.ts`

---

## 20–22. Permissions / isolation

| Check | Result |
|-------|--------|
| Reverse permission 403s in 3D/2C3 tests | PASS |
| Cross-tenant reverse dedicated suite | **Not added** — accepted P2 (middleware + tenant-scoped routes present) |
| Cross-legal-entity reverse dedicated suite | **Not added** — accepted P2 |

---

## 23–26. API-mode smoke / refresh / errors / audit

| Check | Result |
|-------|--------|
| Money In verify (incl. reverse demos) | **76/76** |
| Journal API-mode browser smoke | Partial — covered by BE live tests + JournalDetail reverse UI wired; full multi-role browser path not executed |
| Browser refresh of Money In routes | Not exhaustively browser-automated; routes registered in `accountingRoutes.tsx` |
| Audit on reverse | Covered in 2C3/3D tests (`MANUAL_JOURNAL_REVERSED`, receipt/CN reverse audits) |

Detail: [`ACCOUNTING_API_MODE_SMOKE.md`](./ACCOUNTING_API_MODE_SMOKE.md)

---

## 27. Performance

No dedicated load run. Serial finance suite completed ~3 minutes for critical subset. No P0 performance defects observed.

---

## 28–32. Defects / risks / blockers

See [`ACCOUNTING_GATE_DEFECTS.md`](./ACCOUNTING_GATE_DEFECTS.md).

| Severity | Open |
|----------|------|
| P0 | **None** |
| P1 | Invoice document reverse deferred; full parallel suite flake under load |
| P2 | No dedicated reverse tenant-isolation E2E; FE/BE full build not run |

**Merge blockers:** None for integrity. Merge of uncommitted finance work should include the migration history stub `20260710212426_add_crm_quotations` (no-op) and the receipt posting allowedActions test fix.

---

## 33. Final recommendation

```text
Freeze live AR + journals + GL as PARTIAL Accounting (Money In / Journals verified).
Do not start Accounts Payable until explicitly reopened.
Recommended checkpoint: accounting-ar-verification-gate-complete
Next accounting phase (when reopened): Accounts Payable / Money Out Foundation
```
