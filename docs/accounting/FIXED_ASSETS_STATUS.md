# Fixed Assets — Status

Last verified: **2026-07-21** (Phase 1–2 + **Phase 3 transfers & partial dispose**).

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

## Live vs demo FE

| Surface | API mode | Demo mode |
|---------|----------|-----------|
| Overview KPIs | Live | Seed |
| Categories / register / capitalize / depreciation | Live | Seed |
| **Simple + partial dispose** | Live GL post | Draft → complete (no GL) |
| **Transfers** | Live create/complete (no GL) | Seed create/complete (no GL) |
| Acquisition workspace, maintenance, revaluation, impairment, PV, ledger, reports, setup | Still demo | Seed |

## Out of scope (Phase 4+)

- Intercompany / cross-LE asset transfers
- Component / multi-asset disposal packs
- Revaluation, impairment, maintenance, physical verification (API)
- WDV / units-of-production methods
- CWIP multi-source capitalization documents
- Period-close FA gate
- Disposal reversal

## Ops

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx vitest run tests/finance/finance-fixed-assets.test.ts --no-file-parallelism
```

```bash
cd frontend && npm run test:fixed-assets
```

Configure Finance › Default Mappings: **Asset Disposal Gain** + **Asset Disposal Loss**. Re-login so `finance.fa.*` (including **transfer**) are on roles.
