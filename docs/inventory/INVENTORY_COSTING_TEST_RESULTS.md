# Inventory Costing UAT-1 — Test Results

Date: **2026-07-28**

## Automated (MySQL live)

```text
npx vitest run tests/inventory-costing-uat1-controlled.test.ts \
  tests/inventory-costing-golden-path-ma-fifo.test.ts \
  tests/inventory-moving-average.test.ts \
  --pool=forks --maxWorkers=1
```

| Suite | Result |
|-------|--------|
| UAT-1 MA | PASS |
| UAT-1 FIFO + transfer | PASS |
| UAT-1 Standard (fail-closed, variance, versions) | PASS |
| UAT-1 Specific (serial issue/return/transfer) | PASS |
| UAT-1 Method preview + tenant isolation | PASS |
| Golden path MA/FIFO WO/FG/recon | PASS |
| Moving average unit | PASS |

Also covered previously: FIFO layers, FIFO return restore, specific ID, Phase C standard + method→FIFO.

## Hardening fixes verified

1. **Cost entry ↔ movement value parity** — cost entry now stamps in-memory `rate`/`value` (no re-round from DB `movement.rate` 2dp).
2. **Transfer cost preservation** — receive uses dispatch cost entry unit cost.
3. **Method change preview** — readiness PASS/WARNING/BLOCKED; execute blocked without force when BLOCKED.
4. **MA history** — derived before/after from cost entries.
5. **Recon** — expanded reason codes; GL **Not Available** (not ₹0).
6. **Standard Cost UI** — `ItemLookupSelect` replaces UUID text box.

## Not run / deferred

| Item | Status |
|------|--------|
| Live SPA controlled UAT checklist | Open |
| Performance 10k movements | Not run |
| Purchase return × 4 methods matrix | Deferred |
| Dispatch relief × 4 methods matrix | Deferred |
| Dedicated method-change approve permission | Deferred |
| Inventory ↔ GL trial balance | Deferred by design |

## Final verdict

**READY WITH CONDITIONS**
