# Trailer ERP 2 → Canonical FOS ERP Consolidation

**Audit type:** Read-only (no production migrate, push, merge, or deploy)  
**Audit date:** 2026-08-03  
**Auditor role:** ERP migration architect / Git recovery  

---

## 1. Repository roots verified

| Role | Path | Git remote | Branch / ref | Commit |
| ---- | ---- | ---------- | ------------ | ------ |
| **Source (WIP)** | `D:\Projects\FOS\trailer-erp 2` | `git@github.com:kologyglobal/foserp_mihir.git` | **Detached HEAD mid-rebase of `main`** | `c8599f0d` (“30 jul” replay) during rebase; **pre-rebase tip of `main`:** `cd342287` (ship commit) |
| **Target (canonical)** | `D:\Projects\FOS\foserp_mihir` | `git@github.com:kologyglobal/foserp_mihir.git` | `main` tracking `origin/main` | `d9baae8d` — **exact match to `origin/main`** |

### Remotes

```text
# Both repositories
origin  git@github.com:kologyglobal/foserp_mihir.git (fetch)
origin  git@github.com:kologyglobal/foserp_mihir.git (push)
```

### Related local clones (not used as primary source/target)

| Path | Origin | Note |
| ---- | ------ | ---- |
| `D:\Projects\FOS\Kology-ERP` | same `foserp_mihir` | branch `feature/crm-so-customer360-titles` |
| `D:\Projects\FOS\foserpapi` / `foserpui` | separate repos | not this monorepo |

---

## 2. Shared Git history

| Question | Answer |
| -------- | ------ |
| Shared remote | **Yes** — both point at `kologyglobal/foserp_mihir` |
| Shared ancestry | **Yes** |
| Merge-base (`source/main` ↔ `origin/main`) | `f5c42ab4` (*Ship Auth/Admin…*) |
| Source ship commit known to target object store | **No** (`cd342287` not present as object in target clone until fetched from source) |
| Divergence | Source `main` was **ahead 2** of origin before rebase attempt (**`82f5b14` “30 jul”** + **`cd342287` ship**); origin **ahead 28** commits of source’s old base. Rebase attempted onto `d9baae8d`, **stuck with conflicts**. |

---

## 3. Source WIP preservation status

| Artifact | Status |
| -------- | ------ |
| Ship commit `cd342287` on `refs/heads/main` | **Yes — still intact** |
| Uncommitted local content | Mid-rebase index/worktree (staged migrations + **25 unresolved conflict files**) |
| Dangerous rebase state | **Yes** — must **not** `reset --hard`; complete carefully or `rebase --abort` after ensuring ship commit remains reachable |
| Stash | `tsbuildinfo` stash may exist from earlier session |

### Golden source for missing code

**Prefer `cd342287` blob tree** (complete ship commit), **not** the conflicted rebase working tree.

Do **not** treat the interrupted rebase as the merge result.

---

## 4. Target working-tree status (canonical clone)

Target `HEAD` = clean GitHub `main` (`d9baae8d`).

**Uncommitted work already present** (partial prior copy, **not** a finished consolidation):

| Category | Count (approx.) |
| -------- | --------------- |
| Modified tracked files | **32** |
| Untracked paths | **95** groups / trees |
| Total porcelain lines | **127** |
| Conflict markers in target tree | **0** |

Prior informal note: `docs/TRAILER_ERP_TO_FOS_MIHIR_MIGRATION.md` documents a bulk tree copy. This audit **supersedes** that as the mandatory matrix before *controlled* porting on `integration/*` branches.

---

## 5. Inventory: ship vs GitHub main vs target disk

Baseline: `git diff origin/main...cd342287` from source.

| Class | Count | Target disk |
| ----- | ----- | ----------- |
| **Added** files on ship | **319** | **289 present**, **30 missing**, **0 content mismatches** among present |
| **Modified** shared files on ship | **258** | **~26** match ship; **~226 still equal target HEAD** (ship edits **not** ported); **~6 three-way hybrids** |

### Schema model counts

| Tree | `# model` lines |
| ---- | --------------- |
| Target `HEAD` (GitHub main) | **333** |
| Source ship `cd342287` | **393** |
| Target **working tree** | **396** |

Working-tree schema is a **superset/hybrid** of ship + main (includes receiving-tolerance master work already on main plus HRMS/notification packs). Needs **line-level merge review**, not blind overwrite of either side.

---

## 6. Migrations — highest priority

### 6.1 Migration directories on ship / target disk (priority set)

All of the following exist under target **working tree** as **untracked** folders and **byte-match** ship (`cd342287`) for `migration.sql` (**verified OK**):

| Migration directory | On GitHub `main` HEAD | On target disk | Exact SQL vs ship |
| ------------------- | --------------------- | -------------- | ----------------- |
| `20260730160000_crm_tax_invoice_ar_bridge` | No | Yes (untracked) | **OK** |
| `20260730190000_finance_period_end_adjustments` | No | Yes | **OK** |
| `20260730200000_finance_period_close_calendar_reopen` | No | Yes | **OK** |
| `20260730200000_maintenance_v11_machine_health` | No | Yes | **OK** |
| `20260730210000_maintenance_v2_preventive` | No | Yes | **OK** |
| `20260730220000_finance_fx_revaluation` | No | Yes | **OK** |
| `20260730230000_hrms_phase1_foundation` | No | Yes | **OK** |
| `20260730240000_hrms_phase2_shift_roster` | No | Yes | **OK** |
| `20260730250000_hrms_phase3_leave` | No | Yes | **OK** |
| `20260730260000_hrms_phase4_leave_attendance_sync` | No | Yes | **OK** |
| `20260730270000_hrms_phase5_overtime` | No | Yes | **OK** |
| `20260730280000_hrms_phase6_salary_structure` | No | Yes | **OK** |
| `20260731010000_hrms_phase7_payroll` | No | Yes | **OK** |
| `20260731020000_finance_bank_hardening` | No | Yes | **OK** |
| `20260731030000_hrms_phase8_statutory` | No | Yes | **OK** |
| `20260731040000_hrms_phase9_payslip_accounting_payment` | No | Yes | **OK** |
| `20260731050000_hrms_phase10_loans_advances` | No | Yes | **OK** |
| `20260731060000_hrms_phase11_exit_fnf` | No | Yes | **OK** |
| `20260803100000_crm_notifications` | No | Yes | **OK** |
| `20260803120000_quotation_order_adjustments` | No | Yes | **OK** |

**Also on GitHub main (already tracked):** `20260801100000_receiving_tolerance_master` — do **not** replace; keep target main copy unless checksum audit requires restore.

**Deployment hazard:** two migrations share timestamp prefix `20260730200000_*` (period-close calendar + machine health). Preserve exact names; deploy order must follow filesystem / Prisma ordering already used in source.

### 6.2 `_prisma_migrations` database audit

| Check | Result |
| ----- | ------ |
| Target `.env` `DATABASE_URL` | Not present as a single var in source `.env` (uses `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASS`) |
| Live query of `_prisma_migrations` | **Not completed this audit** (no `mysql` CLI; `mysql2` not installed under backend `node_modules`; credential construction for CLI deliberately avoided) |
| Prior operational notes | Session history suggests **some** priority migrations (e.g. CRM notifications, quotation order adjustments) may already have been applied on a **local** MySQL used with trailer-erp 2 |

**Rule for next steps:**

1. Query production/staging/local `_prisma_migrations` **read-only**.
2. For any name **already finished**, keep **byte-identical** SQL from ship (already OK on target disk for the 20 above).
3. **Never** re-run finished migrations; **never** rename / re-timestamp.
4. For schema drift that is **not** applied, create **new forward-only** migrations from **target** schema baseline — do not rewrite history.

---

## 7. Module matrix (mandatory)

Legend for **Target Status**:

- **GitHub main** = committed at `d9baae8d`
- **Disk WIP** = uncommitted files currently in `foserp_mihir` working tree
- **Incomplete** = partial tree copy without shared-file merges

| Module | Source Status | Target Status | Missing Code | Missing Migration | Conflict | Proposed Action |
| ------ | ------------- | ------------- | ------------ | ----------------- | -------- | --------------- |
| HRMS Phases 1–6 foundation (BE) | Complete on `cd342287` (`backend/src/modules/hrms`, 93 files) | **GitHub main: absent**; **Disk WIP: full tree present** (matches ship samples) | Wiring still partially on HEAD for non-hrms shared files | phase1–6 dirs present untracked; **exact SQL OK** | Untracked only; not on branch | Port 1: branch `integration/hrms` — commit migrations → schema subset → module → routes/perms → tests |
| HRMS frontend | Complete FE tree (53 files) | **Disk WIP present**; **not on main** | Some CRM chrome helpers still missing (see §8) | same as above | Low if pure add | Port 1: `hrmsRoutes`, nav, `hrmsApi`, permissions map |
| HRMS payroll / statutory / payslips / loans / F&F (7–11) | In same `hrms` module | Disk WIP present | Payroll GL bridge depends on accounting mounts | phase7–11 SQL OK on disk | Medium — accounting bridge | Port 2 **after** foundation typechecks; reuse existing GL/payment engines only |
| Payroll accounting & payment bridges | Present in HR phase9 code + accounting routes on ship | Disk partially wired via modified `accounting.routes.ts` / `app.ts` | Confirm account mapping / voucher reuse vs ship | phase9 + finance constants | **Manual review** shared accounting routes | Port 2: merge only missing hooks; no second ledger |
| Maintenance V1 | On main | On main | — | already on main | — | Keep target |
| Maintenance V1.1 machine health | On ship | Disk WIP services + pages | Diff V1 tickets that ship also touched (`ticket.*` still **eq HEAD**) | `maintenance_v11` OK | Medium — ticket services not fully ported | Port 3: merge machine-health + required ticket APIs without wholesale replace |
| Maintenance V2 preventive | On ship | Disk WIP `pm.*` + pages | PR links / manufacturing banner **missing** on disk | `maintenance_v2` OK | Low–med | Port 3: PM module + banner + route register |
| Accounting period adjustments / close / reopen | On ship | Disk folders present; routes modified | Many treasury/AR shared files still HEAD | period-end + calendar/reopen OK | **High** on `accounting.routes` / period UI | Port 4: line-level merge only missing ops |
| FX revaluation | On ship | Disk present | FE period-close screens may lag | fx mig OK | Medium | Port 4 |
| Bank hardening (CAMT 052/054, supersession) | On ship | Partial disk (some parsers present in prior copy) | Broad bank-connector / statement services still HEAD | bank_hardening SQL OK | High — do **not** bulk overwrite bank AIS | Port 4: selective file merge + tests/fixtures |
| CRM tax invoice → Money-In AR | Service + routes on ship | Service may be on disk; **schemas/types/source-validation still HEAD** in many paths | Pending UI + tests incomplete (§8) | AR bridge mig OK | **High** with `PROFORMA_INVOICE` + `CRM_TAX_INVOICE` enum | Port 4/5: keep both source types |
| CRM notifications | Full BE+FE on ship | Disk module present; **CRM emitters (lead/activity/opp/FU/quote) still largely HEAD** | `useAppNotifications` **missing** | notifications mig OK | Medium | Port 5: emitters + scheduler + bell wiring |
| Quotation order adjustments / commercial calc | Ship calc BE+FE + mig | Utils partially ported; **OrderAdjustmentsGrid missing**; many quote UIs still HEAD | Shared `opportunityLineCalc` is three-way | order_adj mig OK | High — FE quote editors | Port 5: parity tests before merge |
| CoA import | Ship account-import service | **Missing on disk** | service + test | none exclusive | Low | Port when doing accounting extras |
| Docs / tests / fixtures | Ship | Partial missing (§8) | docs + camt fixtures + several tests | — | Low | Port with owning module |
| Prisma schema | 393 models ship | WT 396 hybrid; HEAD 333 | Align to superset carefully | All priority migs | **Conflict: schema.prisma three-way** | Dedicated commit “schema support”; backup already `.bak-pre-hrms-migration` |
| Permissions / module catalog | Ship | Partially modified on disk | Must not drop main perms | — | Medium | Merge + dry-run `db:sync-permissions` (no prod) |
| Source git state (trailer-erp 2) | Mid-rebase, **25 UU files** | N/A | Rebase must be aborted or finished without data loss | — | **Blocker for using WT as SoT** | Use `cd342287`; abort or finish rebase offline |

---

## 8. Added paths still **missing** on target disk (product-relevant)

Excludes runtime `backend/uploads/treasury-statements/**` (do **not** port upload blobs).

| Path | Module |
| ---- | ------ |
| `backend/src/modules/accounting/accounts/account-import.service.ts` | Accounting extras |
| `backend/tests/accounting-coa-import.test.ts` | Tests |
| `backend/tests/crm-tax-invoice-ar-bridge.test.ts` | AR bridge tests |
| `backend/tests/fixtures/bank-statements/sample.camt052.xml` | Bank hardening fixtures |
| `backend/tests/fixtures/bank-statements/sample.camt054.xml` | Bank hardening fixtures |
| `docs/accounting/CRM_TAX_INVOICE_MONEY_IN_BRIDGE.md` | Docs |
| `docs/accounting/PERIOD_CLOSE_CALENDAR_REOPEN.md` | Docs |
| `docs/accounting/PERIOD_CLOSE_FX_REVALUATION.md` | Docs |
| `docs/accounting/PERIOD_END_ADJUSTMENTS.md` | Docs |
| `frontend/scripts/scan-unstable-store-selectors.mjs` | Tooling (optional) |
| `frontend/scripts/test-overall-discount-calc.ts` | Commercial calc tests |
| `frontend/scripts/test-quotation-commercial-display.ts` | Commercial display tests |
| `frontend/src/components/crm/CrmWorkspaceViewToggle.tsx` | CRM UI |
| `frontend/src/components/crm/Customer360RecordHeader.tsx` | CRM UI |
| `frontend/src/components/crm/Customer360SummaryCard.tsx` | CRM UI |
| `frontend/src/components/erp/OrderAdjustmentsGrid.tsx` | Order adjustments UI (critical) |
| `frontend/src/components/quotations/QuotationCommercialTermsBlock.tsx` | Commercial terms |
| `frontend/src/hooks/useAppNotifications.ts` | Notifications poll/hook (critical) |
| `frontend/src/modules/accounting/money-in/crm-pending/CrmPendingInvoicesPage.tsx` | AR pending CRM invoices (critical) |
| `frontend/src/modules/manufacturing/components/ManufacturingActiveMaintenanceBanner.tsx` | Maint × MFG |
| `frontend/src/utils/quotationEngine/commercialTermsDisplay.ts` | Quotation display |
| `frontend/src/utils/quotationEngine/revisionLabels.ts` | Quotation revision labels |

---

## 9. Shared files requiring **manual merge** (three-way)

Target working tree is **neither** pure ship **nor** pure HEAD for:

- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `backend/src/constants/permissions.ts`
- `frontend/src/config/navigation.ts`
- `frontend/src/types/quotation.ts`
- `frontend/src/utils/opportunityLineCalc.ts`

Plus **~226** shared files still equal **GitHub HEAD** that ship changed — including CRM event services (needed for notifications), AR sales-invoice validation/schemas/types, significant treasury bank code, maintenance ticket controllers, and quotation workflow pieces.

---

## 10. Interrupted rebase on source (do not ignore)

Source currently: **`(no branch, rebasing main)`** onto `d9baae8d`, applying ship commit; **conflicts open** in sales-invoice AR, money-in, Opportunity/Customer/SO pages, quotation components, `ErpProductPricingSection`, schema, changelog, etc. (25 files).

**Recommended recovery (when work resumes — not done in this audit):**

1. Confirm `git rev-parse main` still `cd342287`.
2. Prefer `git rebase --abort` **or** finish with explicit three-way resolves — do **not** wipe `main`.
3. Perform all consolidations on **target** clone under `integration/*` branches, extracting from `cd342287` via `git show` / `git archive` / path checkout, merging against target HEAD.

---

## 11. Branch and commit plan (approved structure — not started)

Work **only** on target `D:\Projects\FOS\foserp_mihir`:

```text
integration/hrms
integration/maintenance-v2
integration/accounting-extras
integration/crm-aug03
```

Commit series per module (examples):

```text
restore exact migrations
add Prisma schema support
add backend module
register routes and permissions
add frontend module
add tests
add documentation
```

**Forbidden until explicit approval:** push, merge to `main`, `migrate deploy` on production, Hostinger deploy, production permission sync.

---

## 12. Validation commands (from `package.json` — for post-port gates)

### Backend (`foserp_mihir/backend`)

| Check | Script / command |
| ----- | ---------------- |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |
| Migrate status (read-only) | `npm run db:migrate:status` / `npx tsx scripts/prisma-cli.ts migrate status` |
| Deploy migrations | `npm run db:migrate:deploy` — **do not run on prod in this program** |
| Permission sync | `npm run db:sync-permissions` — **dry-run/local only** |
| Build | `npm run build` / `build:app` |

### Frontend (`foserp_mihir/frontend`)

| Check | Script |
| ----- | ------ |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Tests | `npm test` / `test:ci` |
| Route integrity | `npm run test:route-integrity` |
| Build | `npm run build` |

### After each Port

- No `<<<<<<<` markers  
- No duplicate routes / Prisma models / permission keys  
- Tenant filters preserved  
- Demo mode (`VITE_USE_API=false`) not broken unless intentionally out-of-scope  

---

## 13. Rollout readiness summary

```text
Canonical repository:     D:\Projects\FOS\foserp_mihir  (origin main d9baae8d)
Source repository:        D:\Projects\FOS\trailer-erp 2  (same remote; ship cd342287)
Shared Git history:       Yes
Source WIP preserved:     Yes (ship commit on main; rebase interrupted — treat carefully)
Applied migrations restored: N/A for Git restore — priority SQL files already on target disk and match ship;
                          DB application status: UNVERIFIED (query required)
New migrations created:   None this audit
HRMS migrated:            Partial (code trees on disk untracked; ~not committed; emitters/shared wiring incomplete)
Maintenance V2 migrated:  Partial (services/pages on disk; ticket shared merges + MFG banner incomplete)
Accounting extras migrated: Partial (modules on disk; most shared accounting files still HEAD)
CRM changes migrated:     Partial (notifications module on disk; FE hook/grid/pending page missing; CRM emitters mostly HEAD)
Files requiring manual review:
  - backend/prisma/schema.prisma (333 / 393 / 396 model divergence)
  - ~226 shared files still at HEAD that ship modified
  - 6 three-way hybrid files
  - 25 conflicted files if anyone continues source rebase
  - Dual migration timestamp 20260730200000_*
Build result:             Not run (audit-only)
Test result:              Not run (audit-only)
Database blockers:        Live _prisma_migrations inventory not yet taken;
                          applied/not-on-disk collisions possible on environments that already ran notifications/order-adj
Deployment blockers:      Uncommitted partial WIP on target; incomplete shared-file merge; migrations untracked; no integration branches yet
Safe to merge:            No
```

---

## 14. Next actions (when code changes are authorized)

1. **Read-only DB:** dump `_prisma_migrations` for each environment; flag any applied name whose SQL is missing/changed.  
2. **Source safety:** abort or carefully finish rebase without losing `cd342287`.  
3. **Reset consolidation on target to controlled process:**  
   - Create `integration/hrms` from `origin/main`.  
   - Stage **exact** priority migrations (already matching ship).  
   - Merge HRMS code from `cd342287` + only required wiring.  
   - Validate BE typecheck/tests.  
4. Repeat Port 2–5; finish §8 missing FE files specially for CRM commercial + notifications.  
5. Keep `docs/TRAILER_TO_CANONICAL_CONSOLIDATION.md` updated after each port.  

---

## 15. Hard stops (policy)

Do **not**:

- `prisma migrate reset` / `db push --force-reset` / `DROP TABLE` / `git reset --hard` on valued branches  
- Replace entire target tree with source folder  
- Push / merge / deploy Hostinger / production permission sync  
- Treat prior informal bulk copy as complete without shared-file merge  

---

*End of read-only audit. No module port commits performed in this step.*
