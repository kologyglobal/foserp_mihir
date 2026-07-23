# Accounting Gate Defects

## P0 — Gate blockers

**None open.**

## Fixed during gate

| ID | Issue | Root cause | Fix | Retest |
|----|-------|------------|-----|--------|
| G1 | Local DB missing all finance tables | 16 migrations never applied; history drift on `20260710212426_add_crm_quotations` | Added no-op historical migration folder; `migrate deploy` | migrate status up to date; integrity 15/15 |
| G2 | `allowedActions.allocate` expected false on posted receipt | Stale assertion after Phase 3B5 (unallocated credit is allocatable) | Updated `finance-ar-receipt-posting.test.ts` to expect allocate/reverse true | receipt posting **12/12** |

## P1 — Accepted / deferred

| ID | Issue | Owner | Workaround / decision |
|----|-------|-------|------------------------|
| R1 | Sales invoice document reverse | Product | **Shipped** — `finance.ar.invoice.reverse` + `POST …/invoices/:id/reverse` + Money In UI |
| R2 | Full parallel `vitest run tests/finance` flakes (write conflicts / unique LE codes) | Eng | Run critical suites serial (`--fileParallelism=false`); serial critical path green |

## P2 — Accepted

| ID | Issue | Decision |
|----|-------|----------|
| R3 | No dedicated reverse cross-tenant E2E | Middleware + tenant-scoped routes; add later |
| R4 | Backend/FE production `build` not run this gate | Typecheck pass; run before release tag |
| R5 | Full multi-role browser journal smoke not executed | BE live + UI wiring + Money In verify |

## Non-defects (expected)

- Concurrent post unique-constraint log lines while one winner succeeds
- Invoice reverse absent by design for this gate
