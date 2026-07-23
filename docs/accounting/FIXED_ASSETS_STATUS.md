# Fixed Assets — Status

Last verified: **2026-07-22** (Phase 1–3 + **Phase 4 reval / impair / maintenance / reports**).

## Phase 1 — shipped

| Layer | Status | Notes |
|-------|--------|-------|
| DB | ✅ | Migration `20260720260000_finance_fixed_assets_phase1` — categories, assets, depreciation runs/lines |
| API | ✅ | `/accounting/fixed-assets/*` — categories CRUD, register CRUD, capitalize, depreciation preview/post, overview |
| Permissions | ✅ | `finance.fa.view\|create\|edit\|capitalize\|depreciate\|dispose\|transfer` |
| Posting | ✅ | Central `post()` — `FIXED_ASSET_CAPITALIZE:{id}:V1`, `FIXED_ASSET_DEPRECIATE:{runId}:V1` |
| FE dual-mode | ✅ | Overview, register, categories, asset detail capitalize, depreciation workbench |
| Tests | ✅ | `finance-fixed-assets.test.ts`; FE `npm run test:fixed-assets` |

### Capitalize default

- **Dr** category asset GL account
- **Cr** explicit `creditAccountId`, or default mapping **`FIXED_ASSET_CLEARING`**

### Depreciation

- Straight-line only: monthly = `(cost − residual) / (usefulLifeYears × 12)`, capped at remaining depreciable
- One posted run per legal entity per `YYYY-MM` period key
- **Dr** category dep expense / **Cr** category accumulated depreciation

## Phase 2 — simple dispose ✅ (2026-07-20)

| Layer | Status | Notes |
|-------|--------|-------|
| DB | ✅ | Disposal fields on `fixed_assets` + FA2 disposal document table |
| API | ✅ | `POST …/assets/:id/dispose/preview`, `POST …/assets/:id/dispose` |
| Posting | ✅ | `FIXED_ASSET_DISPOSE:{id}:V1` — Dr accum dep + proceeds + loss / Cr asset cost + gain |
| Mappings | ✅ | Requires `ASSET_DISPOSAL_GAIN` / `ASSET_DISPOSAL_LOSS` when gain/loss ≠ 0 |
| FE | ✅ | `/accounting/fixed-assets/disposal` — API posts GL; demo keeps draft→complete |
| Scope | Full asset exit (`ACTIVE` / `IDLE` / `FULLY_DEPRECIATED` → `DISPOSED`) | Sale / Scrap / Write-off |

## Phase 3 — transfers + partial dispose ✅ (2026-07-21)

| Layer | Status | Notes |
|-------|--------|-------|
| DB | ✅ | Migration `20260720290000_finance_fixed_assets_phase3_transfers_partial` — `fixed_asset_transfers`; partial rows on `fixed_asset_disposals` (`isPartial`) |
| Transfers API | ✅ | `GET/POST …/transfers`, `GET …/transfers/:id`, `POST …/transfers/:id/complete` — perm `finance.fa.transfer` |
| Transfer GL | ❌ by design | Intra-LE location / plant / dept / custodian only — **no voucher** |
| Partial dispose | ✅ | Optional `disposeCostAmount` &lt; acquisition cost → proportional cost/accum/NBV + GL; asset stays **ACTIVE** (or fully depreciated residual) |
| Partial posting | ✅ | `FIXED_ASSET_PARTIAL_DISPOSE:{disposalId}:V1` / event type `FIXED_ASSET_PARTIAL_DISPOSED` |
| FE | ✅ | Transfers dual-mode create→complete; Disposal optional “Dispose cost” for partial |

## Phase 4 — revaluation, impairment, maintenance, reports ✅ (2026-07-22)

| Layer | Status | Notes |
|-------|--------|-------|
| DB | ✅ | Migration `20260722120000_finance_fixed_assets_phase4_reval_impair_maint` — reval/impair/maint tables; `revaluationSurplus` / `accumulatedImpairment` on assets; mappings `ASSET_REVALUATION_SURPLUS` / `ASSET_IMPAIRMENT_LOSS` |
| Revaluation API | ✅ | `GET/POST …/revaluations`, `POST …/:id/post`, `POST …/:id/cancel` — perm `finance.fa.revalue` |
| Revaluation GL | ✅ | Up: Dr asset / Cr surplus; Down: consume surplus then Dr impairment loss / Cr asset |
| Impairment API | ✅ | `GET/POST …/impairments`, `POST …/:id/recognize`, `POST …/:id/cancel` — perm `finance.fa.impair` |
| Impairment GL | ✅ | Dr `ASSET_IMPAIRMENT_LOSS` / Cr asset; updates cost/NBV/accum impairment |
| Maintenance API | ✅ | CRUD + complete/cancel — perm `finance.fa.maintain`; **no GL** |
| Reports API | ✅ | `GET …/reports/summary\|register\|nbv-by-category\|disposals` |
| FE dual-mode | ✅ | Lists + report preview live in API mode; create/post UI still list-first (API clients available) |
| Tests | ✅ | `finance-fixed-assets-phase4.test.ts` |

## Live vs demo FE

| Surface | API mode | Demo mode |
|---------|----------|-----------|
| Overview KPIs | Live | Seed |
| Categories / register / capitalize / depreciation | Live | Seed |
| **Simple + partial dispose** | Live GL post | Draft → complete (no GL) |
| **Transfers** | Live create/complete (no GL) | Seed create/complete (no GL) |
| **Revaluation / impairment / maintenance lists** | Live | Seed |
| **Reports (register / category NBV / disposals / summary)** | Live preview | Seed catalog |
| Acquisition workspace, PV, ledger, setup | Still demo | Seed |

## Out of scope (later)

- Intercompany / cross-LE asset transfers
- Component / multi-asset disposal packs
- Physical verification (API)
- WDV / units-of-production methods
- CWIP multi-source capitalization documents
- Period-close FA gate
- Disposal / revaluation / impairment reversal
- Full create/post wizards on reval & impair list pages (API exists; UI is read + refresh)

## Ops

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx vitest run tests/finance/finance-fixed-assets-phase4.test.ts --no-file-parallelism
```

```bash
cd frontend && npm run test:fixed-assets
```

Configure Finance › Default Mappings: **Asset Disposal Gain**, **Asset Disposal Loss**, **Asset Revaluation Surplus**, **Asset Impairment Loss**.

```bash
cd backend && npm run db:sync-permissions
```

Re-login so `finance.fa.*` (including **revalue**, **impair**, **maintain**) are on roles.
