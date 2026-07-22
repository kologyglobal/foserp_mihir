# Report Performance Results (Phase 7D)

Honest record of what was and was **not** measured for Phase 7D reporting performance.

---

## What was run

- **Backend:** `ops-reports-phase7d.test.ts` — vitest suite covering registry/catalog,
  permission gating, filter parsing, timezone resolution, executor output shape, saved-view
  ownership rules, export limit, and UNAVAILABLE/PARTIAL handling. **13/13 passing.**
- **Frontend:** `test:manufacturing-phase7d` smoke suite. **64/64 passing.**
- Representative queries against seeded/dev-scale data confirmed correct shapes, pagination,
  summaries, chart data and warnings.

## What was NOT run this session

- **No 10,000-row volume/load suite was executed this session.** The synchronous export cap
  (`EXPORT_SYNC_ROW_LIMIT = 10000`) and executor scan caps (3000–5000 rows) are implemented and
  unit-covered, but a dedicated large-volume timing benchmark at the 10k boundary was not run.
- No sustained concurrent-load or p95/p99 latency benchmark was captured.

## Design safeguards (in code, pending volume verification)

- Executors bound their scans and emit a "narrow your filters" warning at the cap
  (e.g. work-order-progress 3000, material/WIP 5000, dispatch/fulfilment 300, shopfloor 1000,
  material-reconciliation 200 WOs).
- Server-side pagination limits payload size per page (max page size 500).
- All queries are tenant-scoped and use selective `select` projections.

## Documented targets (to verify in a volume pass)

| Scenario | Target |
|----------|--------|
| Single report query (typical filters, one page) | < ~1s server time |
| CSV export at the 10k-row cap | complete synchronously without timeout |
| Catalog list | effectively instant (static registry) |

**Status:** functional tests green; **volume/latency targets documented but not yet
benchmarked** — schedule a 10k-row volume pass before high-scale production use.
