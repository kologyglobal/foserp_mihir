# 2026-07-22 — Inventory Store Workbench backend + DB APIs

- Prisma validate + generate — **PASS**.
- Backend `npm run typecheck` — **PASS**.
- Focused Vitest (no live DB required for these suites):
  - `inventory-stock-status-tracking.test.ts` — **3/3 PASS**
  - `inventory-accounting-events.test.ts` — **11/11 PASS**
  - `inventory-document-workflows.test.ts` — **5/5 PASS**
  - `inventory-store-workbench.test.ts` — **6/6 PASS**
  - Total **25/25 PASS**
- Live `migrate deploy` — **NOT APPLIED in this session** (approval UI failed). Required before live GRN/QI/transfer suites:
  `cd backend && npx tsx scripts/prisma-cli.ts migrate deploy`
- New/renamed forward migrations to apply:
  - `20260722030000_inventory_document_workflows`
  - `20260722033000_inventory_stock_status_batch_serial`
  - `20260722040000_inventory_lot_serial_masters`
  - `20260722041000_inventory_accounting_events`

---

# 2026-07-22 — Manufacturing Wave 2 costing depth (verification pending)

- Added `tests/manufacturing-phase8-costing-depth.test.ts` for positive scrap allocation and `STANDARD_WITH_VARIANCE` policy validation.
- Changed-file IDE diagnostics — **0 errors**.
- `prisma generate`, backend typecheck, and focused Vitest were invoked, but the command runner returned no output or exit status; they are **not claimed as passed**.

---

# 2026-07-22 — Inventory Phase 1 foundation (verification pending)

- Backend `npm run typecheck` — **PASS** before final reservation concurrency hardening.
- Frontend `npm run typecheck` — **PASS** before final route/workbench copy changes.
- Changed-file IDE diagnostics — **0 errors** after final edits.
- Focused `inventory-phase3a.test.ts` + `dispatch-phase7c0.test.ts` initially
  exposed and led to a fix for inventory-master alias route interception.
- Final focused rerun — **NOT VERIFIED** because the command runner stopped
  returning output or exit status. Required before completion:
  `npx vitest run tests/inventory-phase3a.test.ts tests/dispatch-phase7c0.test.ts --no-file-parallelism --hookTimeout=120000`.

---

# 2026-07-21 — Accounting invoice master reuse (Wave 6)

- New backend suites (live MySQL): `tests/finance/finance-ar-master-reuse.test.ts` — **11/11 PASS**; `tests/finance/finance-ap-vendor-invoice-master-reuse.test.ts` — **13/13 PASS**. Cover CrmCompany/MasterVendor resolution, unknown/cross-tenant/inactive/blocked rejection, DIRECT vs SO/PO/GRN source modes, fabricated source-UUID rejection, PO/GRN vendor match, snapshot stability after master edits, DRAFT-only refresh-from-master preview/apply, lookup + eligibility endpoints, and a no-`FinanceCustomer`/`FinanceVendor` guardrail.
- Targeted regression `finance-ar-*` + `finance-ap-vendor-invoice-*` (25 files): **314/319 PASS**. The 5 failures are pre-existing/environmental, not Wave 6 regressions:
  - `finance-ar-credit-note-posting.test.ts` ×3 — `BACKDATED_POSTING_NOT_ALLOWED`: fixture posts a backdated note without enabling `allowBackdatedPosting` in finance settings.
  - `finance-ap-vendor-invoice-reversal.test.ts` ×1 (cascade case) — 500: derived cascade key `CASCADE:{invoiceId}:{batchId}:{eventKey}` is ~144 chars, exceeding `PayableAllocationReversalBatch.idempotencyKey` `VarChar(128)`. Pre-existing product bug in `vendor-invoice-reverse.service.ts` (untouched since the finance deploy commit).
  - `finance-ar-invoice-posting.test.ts` ×1 — unique-key collision only under parallel file execution; **passes sequentially** (`--no-file-parallelism`).
- Backend typecheck: 228 pre-existing errors — quality (108), purchase (75), ops-reports (36), manufacturing (5), dispatch (4); zero in accounting. Consistent with a stale generated Prisma client for those modules.
- Frontend: typecheck **PASS**; `npm run test:money-in` **93/93**; `npm run test:money-out` **68/68**; new `npm run test:accounting-master-reuse` **39/39**; `npm run test:phase8c-wave1` **56/57** (pre-existing drift: "Mfg accounting gate retained" check expects `withManufacturingAccountingApiGate(` in `accountingRoutes.tsx`, absent at HEAD as well).
- Product fix while testing: `finance.ar.invoice.reverse` was missing from `PERMISSIONS` (`backend/src/constants/permissions.ts`) — AR reversal routes 403'd for every user. Added; `finance-ar-invoice-reversal.test.ts` now passes.

# Purchase Phase 6 live lifecycle tests (2026-07-22)

- New shared fixture: `tests/helpers/purchase-live-fixture.ts`.
- Live suites (MySQL required; `describe.skipIf(!dbAvailable)` when unavailable):
  - `purchase-invoice-lifecycle-live.test.ts` — direct invoice, PO/GRN match submit→approve→post + AP handoff preview, tenant isolation, RBAC (unit policy tests remain in `purchase-invoice-lifecycle.test.ts`).
  - `purchase-qi-lifecycle.test.ts` — QI from QC_PENDING GRN, complete ACCEPT, RBAC, isolation.
  - `purchase-return-lifecycle.test.ts` — create/submit/complete, RBAC, isolation.
- npm scripts: `test:purchase-grn-live`, `test:purchase-po-live`, `test:purchase-setup-live`, `test:purchase-approvals-live`, `test:purchase-invoice-live`, `test:purchase-qi-live`, `test:purchase-return-live`.
- Backend typecheck: 3 pre-existing errors in fixed-assets (unrelated); new test files clean.
- Live run (MySQL): invoice unit **4/4** + invoice live **4/4** + QI **4/4** + return **4/4** = **16/16 PASS**.

# Purchase backend lifecycle verification (2026-07-21)

- `cd backend && npm run typecheck` — **PASS**.
- `cd backend && npx vitest run tests/purchase-invoice-lifecycle.test.ts` — **4/4 PASS** (create/code series, direct-invoice policy, PO/GRN requirements, tolerance override).
- Purchase RBAC regression — **4/4 PASS**.
- Broader combined purchase run — **11/12 PASS**; one existing planning create-PO concurrency test returned `[400, 400]` instead of one `201` and is outside the new invoice/QI/return modules.

## Purchase create/edit footer verification (2026-07-21)

- `npm run test:purchase-form-footers` — **80/80 PASS** (registered editor footer, API wiring, redirect, duplicate-save, unsaved-confirmation, mobile layout, and detail lifecycle contracts).
- `npm run typecheck` — **PASS**.
- `npm run build` — **PASS** (existing Tailwind/chunk warnings only).
- Targeted changed-file `oxlint` — **PASS** with four pre-existing hook dependency warnings.
- Full `npm run lint` — **BLOCKED** by the existing syntax error in `scripts/generate-uat-deliverables.ts`.
- `npm run test:purchase:production` — **39/39 PASS** (runner uses `tsconfig.app.json` for path aliases).

See [`PURCHASE_FORM_FOOTER_AUDIT.md`](PURCHASE_FORM_FOOTER_AUDIT.md).

---

## Purchase create/edit footer standard — 2026-07-21

- `cd frontend && npm run test:purchase-form-footers` — **80/80 PASS**
  - Registered PR/RFQ/VQ/PO/GRN/Return/Invoice editors use shared Cancel | Save actions.
  - Stable route-map redirects, unsaved confirmation, backend API wiring, lifecycle action placement, mobile widths, and duplicate-click single-flight behavior covered.
- `cd frontend && npm run build` — **PASS**
- `cd frontend && npm run test:purchase:production` — **39/39 PASS** (script now uses `tsconfig.app.json` for path aliases).
- Targeted `oxlint` on changed files — **PASS** with four pre-existing hook dependency warnings.
- Full `npm run lint` — non-zero on the existing repository-wide warning baseline; no changed-file lint errors.

---
# 2026-07-21 — Manufacturing Form UX modernisation (FORM-A→D)

- FE smoke `npm run test:manufacturing-forms` — **46/46** (shell/primitives, WO create readiness, WO detail NBA + info panel + close-readiness dialog, issue/return/FG posting drawers, daily-update selectors, JW reconciliation equation, docs pack).
- Frontend `npm run typecheck` — **exit 0**; `npm run build` — **exit 0**.
- No backend behaviour changed (additive query param on close-readiness client only); backend suites not re-run.
- Live browser/tablet UAT + accessibility audit deferred to FORM-F certification.

# 2026-07-21 — Dispatch Phase 7C4 Delivery Challan

- Backend `dispatch-phase7c4.test.ts` — **7/7 pass** (live MySQL): draft create; confirm blocked until ISSUED; issue assigns `DC-` number; on-hand/fulfilment unchanged until 7C0 confirm after issue.
- FE smoke `npm run test:dispatch-phase7c4` — **22/22**.
- Semantics: `DELIVERY_CHALLAN_AS_DOCUMENT_ONLY`. Hardened posting still deferred (7C5).

# 2026-07-21 — Dispatch Phase 7C3 packing / packages

- Backend `dispatch-phase7c3.test.ts` — **8/8 pass** (live MySQL): pack ≤ picked; over-pack blocked; unpack no stock/unpick; on-hand + fulfilment unchanged; confirm gated until PACKED + qty match.
- Regression 7C0+7C1+7C2+7C3 — **23/23**.
- FE smoke `npm run test:dispatch-phase7c3` — **33/33**; combined 7C0–7C3 FE **82/82**.
- Backend/frontend typecheck + builds — **PASS**.
- Semantics: `PACKING_AS_OPERATIONAL_ALLOCATION`; Packed ≠ Dispatched; no FG_DISPATCH from packing.
- Docs: `PHASE7C3_README.md` + packing rule pack. Delivery Challan still deferred (7C4).

# 2026-07-21 — Dispatch Phase 7C2 reservation / pick lists

- Backend `dispatch-phase7c2.test.ts` — **7/7 pass** (live MySQL): onHand unchanged; over-reserve blocked; pick no FG_DISPATCH; pick ≤ reserved; unpick history; fulfilment unchanged; confirm blocked with partial pick list.
- Regression 7C0+7C1+7C2 — **15/15**.
- FE smoke `npm run test:dispatch-phase7c2` — **30/30**; 7C0 smoke updated for Basic Confirm label.
- Migration `20260721194500_dispatch_phase7c2_reservation_picking` deployed.
- Docs: `PHASE7C2_README.md`, `PHASE7C2_PICKING_SEMANTICS.md`, reservation/pick/7C0-compat/permission/test-result docs.
- Packing/challan/posting still deferred (7C3–7C5).

# 2026-07-21 — Dispatch Phase 7C1 requirement / readiness / workbench

- Backend `dispatch-phase7c1.test.ts` — **3/3 pass** (live MySQL): requirements sync + workbench summary; draft-from-requirements (`WORKBENCH_7C1`, no FG_DISPATCH posted); CRM fulfilment-summary + dispatch-history.
- Regression `dispatch-phase7c0.test.ts` — **5/5 pass** after adding `dispatchRequirement` cleanup to the tenant teardown.
- FE smoke `npm run test:dispatch-phase7c1` — **12/12 pass**.
- Prisma generate — **pass**. Migration `20260721193000_dispatch_phase7c1_requirements` **deployed** (Docker MySQL restarted).
- Migration drift fixed: `20260720190000_manufacturing_phase3c_materials` referenced `purchase_requisitions` before `20260720250000_purchase_phase3b_requisition` created it (P3009 on fresh replay). PR FK split into conditional `20260720260000_manufacturing_phase3c_pr_link_fk`; empty leftover dir `20260721200000_fix_pom_purchase_requisition_fk` removed (P3015). `migrate deploy` now clean — 78 migrations applied, none pending.
- Docs: `PHASE7C1_README.md`, `PHASE7C0_COMPATIBILITY_AUDIT.md`. Pick/pack/challan still deferred (7C2+).

# 2026-07-21 — Manufacturing Phase 7E costing/accounting

- Prisma format, validate, migration deploy and generate — **pass**; `20260721190000_manufacturing_phase7e_costing` applied.
- `manufacturing-phase7e.test.ts` — **7/7 pass** (live MySQL): policy activation replacement, cost snapshot/warnings, permission denial, readiness blockers, absorption post/retry idempotency, financial close duplicate block, tenant isolation.
- `manufacturing-phase6b.test.ts` — **4/4 pass** regression.
- Backend typecheck has no Phase 7E errors; command remains exit 2 because of 3 pre-existing Fixed Assets errors.

# 2026-07-21 — Dispatch Phase 7C0 SO fulfilment + FG_DISPATCH

- Backend `dispatch-phase7c0.test.ts` — **5/5 pass** (live MySQL): fulfilment projection; draft→confirm FG_DISPATCH + balance; over-dispatch reject; cancelled qty; draft cancel; 403 without `dispatch.post`.
- FE smoke `npm run test:dispatch-phase7c0`.
- Migration `20260721030000_dispatch_phase7c0_fulfilment` deployed.
- Docs: `DISPATCH_PHASE7C0_README.md`. Pick/pack/challan deferred.

# 2026-07-21 — Finance Budgeting Phase 1 + Bank connectors 5D3

- `finance-budgeting-phase1.test.ts` — **3/3 pass** (live MySQL): version → line → submit → approve → BVA; tenant isolation; 403.
- FE `npm run test:budgeting` — **12/12**.
- `finance-bank-connector-live.test.ts` + scaffold — **12/12** (5D3 mocked SFTP + consent; 5D2 sandbox).
- FE `npm run test:bank-connectors` — **24/24**.
- Migrations: `20260721120000_finance_phase5d3_bank_connector_consent`, `20260721130000_finance_budgeting_phase1`.

# 2026-07-21 — Finance Phase 5D2 bank connector sandbox/REST pull

- `finance-bank-connector-live.test.ts` + scaffold — sandbox MT940 sync creates `BANK_API` statements + idempotent re-sync; OPEN_BANKING still 422.
- Env: `BANK_CONNECTOR_SANDBOX_ENABLED`, `BANK_CONNECTOR_SANDBOX_ROOTS`, `BANK_CONNECTOR_ALLOWED_HOSTS`.
- FE `npm run test:bank-connectors`.
- Docs: `BANK_CONNECTOR_ARCHITECTURE.md` / `BANK_CASH_STATUS.md`.

# 2026-07-21 — Finance Fixed Assets Phase 3 transfers + partial dispose

- Extended `finance-fixed-assets.test.ts` — **9/9 pass** (live MySQL): transfer create→complete (no GL) + partial dispose (asset stays Active) + full dispose/idempotent replay.
- Migration `20260720290000_finance_fixed_assets_phase3_transfers_partial` (`fixed_asset_transfers`).
- Permission `finance.fa.transfer`; FE Transfers dual-mode + Disposal optional `disposeCostAmount`.
- FE `npx tsx scripts/verify-fixed-assets.ts` — Phase 1–3 static checks.
- Docs: `FIXED_ASSETS_STATUS.md` Phase 3 complete.

# 2026-07-20 — Quality Phase 4B Parameters + Inspection Plans

- Backend `quality-phase4b.test.ts` — live MySQL (CRUD params/plans; stage QC snapshot; PASS gated on mandatory results).
- FE smoke `npm run test:quality-phase4b`.
- Migration `20260720280000_quality_phase4b_plans_parameters` deployed.
- Docs: `QUALITY_PHASE4B_README.md`. Incoming GRN QC still deferred.

# 2026-07-20 — Manufacturing Phase 6B Costing / GL

- Backend `manufacturing-phase6b.test.ts` — **4/4 pass** (live MySQL): gate off by default; event `SKIPPED_FLAG_OFF`; flag on → `POSTED` + voucher + idempotent replay; cost preview 403/200.
- FE smoke `npm run test:manufacturing-phase6b` — **12/12**.
- Migration `20260720280000_manufacturing_phase6b_accounting_events`.
- ADR-031 Accepted. Docs: `PRODUCTION_PHASE6B_README.md`.

# 2026-07-20 — Finance Phase 5B3 finish (flag, settings UI, Swagger, smoke)

- Enforced `useTreasuryAdjustmentsForStatementItems` on statement-led create → `422 TREASURY_ADJUSTMENT_STATEMENT_PATH_DISABLED` when false; recon **Create Bank Transaction** button gated on the same flag.
- Finance Settings Features page: statement flag, prevent-self-approve, approval limit.
- Swagger: Treasury Adjustments / Posting Rules / Standing Instructions / Books.
- Backend 5B3 live suites (`--no-file-parallelism`) — **75/75 pass**: foundation 8, calculation 8, workflow 7, posting 4, reversal 4, permissions 5, tenant isolation 7, statement-posting 4 (incl. flag off), standing instructions 12, bankbook/cashbook 9, classification 7.
- FE `npm run test:treasury-adjustments` — **40/40**.
- Migration already deployed: `20260720180000_finance_phase5b3_treasury_adjustments`.

# 2026-07-20 — Manufacturing Phase 6A Production Planning

- Backend `manufacturing-phase6a.test.ts` — **3/3 pass** (live MySQL): create/release/netting/generate draft WO + close; draft-generate blocked; cancel blocked after WOs; list.
- FE smoke `npm run test:manufacturing-phase6a` — **12/12**.
- Migration `20260720250000_manufacturing_phase6a_production_plans` deployed.
- 5C depth limits (split / no cascade / no mfg GL) accepted as gate — see `PRODUCTION_PHASE5C_README.md`.
- Docs: `PRODUCTION_PHASE6A_README.md`.

# 2026-07-20 — Finance Fixed Assets Phase 2 simple dispose

- Extended `finance-fixed-assets.test.ts` — **7/7 pass** (live MySQL): Phase 1 suite + dispose preview/post with balanced GL + idempotent replay.
- Migration `20260720280000_finance_fixed_assets_phase2_dispose` deployed.
- Registered `finance.fa.*` permissions (were missing from catalog).
- FE: Disposal page API-mode posts via `postDisposal`; `npx tsx scripts/verify-fixed-assets.ts` for static checks.
- Docs: `FIXED_ASSETS_STATUS.md` Phase 2 complete.

# 2026-07-20 — Finance Phase 5C1 Treasury cash position & liquidity

- Added `finance-treasury-liquidity.test.ts` — **7/7 pass** (live MySQL): cash position, daily liquidity, forecast (7/14/30), closing controls, dashboard, soft day-close OPEN→REVIEWED→CLOSED (+409 duplicate), 403 without `liquidity.view`.
- Migration: `20260720270000_finance_phase5c1_treasury_liquidity` (`TreasuryDayClose`) — **deployed**.
- Permissions: `finance.treasury.liquidity.view`, `finance.treasury.closing.view|manage`.
- Frontend: API liquidity dashboard at `/accounting/bank-cash` + `/liquidity` (`VITE_USE_API=true`); demo overview retained.
- Docs: `TREASURY_LIQUIDITY_ARCHITECTURE.md`, BANK_CASH_STATUS (5C1 complete), API_CONVENTIONS liquidity section.
- Soft day-close does **not** lock GL periods (by design). Fixture cleanup deletes `treasuryDayClose` before legal entity.

# 2026-07-20 — Bank statement MT940 + CAMT.053 file ingest

- Added `finance-bank-statement-mt940-camt.test.ts` — **7/7 pass** (parser unit + live MySQL when available): MT940/CAMT fixtures → normalised lines; XXE guard; AUTO_DETECT; MT940 import without column mapping; CAMT via AUTO_DETECT.
- Backend parsers typecheck clean (repo `tsc` still has unrelated pre-existing liquidity/manufacturing unused-import noise).
- Frontend: `npm run test:bank-statements` — **51/51** (format labels + accept extensions).
- Docs: `BANK_STATEMENT_IMPORT_ARCHITECTURE.md`, `BANK_CASH_STATUS.md`, SESSION_CHANGELOG, PROJECT_STATUS, REMAINING_WORK, PROJECT_MEMORY.

# 2026-07-20 — Finance Phase 5A2 Bank statement import / validation / review

- Added `finance-bank-statement-import.test.ts` — **7/7 pass** (live MySQL, `--no-file-parallelism`): CSV upload → inspect → preview → import → validate (lines `UNMATCHED`, no voucher/GL mutation); duplicate-file checksum BLOCK; executable/binary CSV reject; manual statement + lines + validate balance equation + reopen + out-of-balance VALIDATION_FAILED + cancel with retention; viewer 403 on import / 200 on list; Indian/European decimal parsing + ambiguous date formats (DD/MM vs MM/DD).
- Phase 5A1 regression: `finance-treasury-foundation.test.ts` — **18/18** still pass alongside 5A2.
- Migration `20260720020000_finance_phase5a2_bank_statement_import` deployed; Prisma generate + backend `tsc --noEmit` clean.
- Frontend: `npm run typecheck` clean; `npm run test:bank-statements` — **41/41**.
- Docs: `BANK_STATEMENT_IMPORT_ARCHITECTURE.md`, `BANK_STATEMENT_COLUMN_MAPPING.md`, `BANK_STATEMENT_VALIDATION.md`, `BANK_STATEMENT_DUPLICATE_RULES.md`, `BANK_STATEMENT_FRONTEND.md`, `BANK_CASH_STATUS.md` (5A1–5A2 complete).
- **Not covered in this suite (deferred / later):** full XLSX workbook live matrix, E2E Playwright specs, zip-bomb stress, concurrent double-import races (optimistic concurrency covered at API layer for statements).

# 2026-07-19 — Finance Phase 5A1 Bank & Cash treasury foundation

- Added `finance-treasury-foundation.test.ts` — **18/18 pass** (live MySQL): create BANK account with profile (mask/last4 only, hash/encrypted never returned, plaintext never in response body); create CASH + CLEARING accounts; reject duplicate ACTIVE GL mapping (`409 TREASURY_ACCOUNT_GL_MAPPING_CONFLICT`); reject duplicate bank account number in same legal entity (`409 TREASURY_BANK_ACCOUNT_DUPLICATE_NUMBER`); payment-mapping resolution — specific (currency+direction exact) beats generic fallback, falls back correctly when currency doesn't match, ambiguous tie → `409`, default-mapping conflict → `409`; bank reconciliation profile create/read for BANK accounts, blocked `lastReconciled*` writes (`400`), bank-only rejection for CASH (`400 BANK_RECONCILIATION_PROFILE_BANK_ONLY`); bank-statement header/line validation + deterministic identity-key helpers (no HTTP route, DB rows created directly via repository); no mutation of `AccountingVoucher`/`GeneralLedgerEntry`/`VendorPayment` from any treasury setup call; 403 without `finance.treasury.account.create`; tenant isolation (cross-tenant GET → 404); stale `expectedUpdatedAt` → `409 TREASURY_ACCOUNT_STALE_VERSION`. Plus a standalone unit-test block (no DB) for the account-number security service: masking, stable HMAC hash across formatting variants, and rejection when no secret is configured.
- Extended `tests/finance/helpers/ap-allocation-fixture.ts#cleanupTenant` to delete treasury rows (statement lines → statements → import batches → payment mappings → reconciliation profile → bank/cash profile → `TreasuryAccount`) before `Account`/`LegalEntity`/`Tenant`, since `TreasuryAccount` now FKs those tables.
- Added `TREASURY_ACCOUNT_HMAC_SECRET` to `backend/.env` (gitignored, dev/test only) so hash-based duplicate-number detection is exercised by the live-MySQL suite; without it, bank-account creation with a number correctly falls back to `422 TREASURY_BANK_ACCOUNT_SECURITY_UNAVAILABLE` (covered by the unit-test block).
- Backend `npx tsc --noEmit` — clean. `prisma migrate deploy` + `generate` — clean.
- No frontend changes (backend-only phase).
- Docs: `BANK_CASH_ARCHITECTURE.md`, `TREASURY_ACCOUNT_MASTER.md`, `PAYMENT_ACCOUNT_MAPPING.md`, `BANK_RECONCILIATION_FOUNDATION.md`, `BANK_STATEMENT_SCHEMA.md`, `BANK_CASH_STATUS.md`.
- Known pre-existing flakiness (unrelated to this phase, reproduces on `main` before this change too): `finance-ar-credit-note-posting.test.ts` (3 date/period-dependent failures) and one `allowedActions.reverse` assertion in `finance-ap-vendor-payment-posting.test.ts` fail when run against the current system date; neither file references the treasury module or the modified fixture helper.

# 2026-07-19 — Finance Phase 4D2 AP reconciliation + close gate

- Added `finance-ap-gl-reconciliation.test.ts` — **9/9 pass** (live MySQL): MATCHED after invoice+payment; allocation neutrality; no mutation of VendorInvoice/PayableOpenItem/GeneralLedgerEntry; orphan open item → MISMATCHED + BLOCKER; tolerance within/over; 403 without `finance.ap.reconciliation.run`; tenant isolation on create/read.
- Added `finance-ap-close-gate.test.ts` — **4/4 pass**: PASS when matched recon + no readiness issues; BLOCKED when READY_TO_POST invoice in period; `AccountingPeriod.status` never mutated; 403 without `finance.ap.close_gate.run`.
- Backend `npx tsc --noEmit` — clean.
- Frontend: `npm run test:money-out-reconciliation` (`frontend/scripts/verify-money-out-reconciliation.ts`); Reconciliation + Close Gate tabs live under `/accounting/money-out/`.
- Migration: `20260719210000_finance_phase4d2_ap_reconciliation`.
- Docs: `AP_RECONCILIATION_ARCHITECTURE.md`, `AP_CLOSE_GATE.md`, `AP_RECONCILIATION_EXCEPTIONS.md`, `AP_CONTROL_ACCOUNT_RULES.md`, `AP_STATUS.md` (4D2 complete, AP Phase 4 complete).

# 2026-07-19 — Finance Phase 4D1 AP reporting (outstanding, ageing, vendors, payment planning)

- Added `finance-ap-reporting.test.ts` — **9/9 pass** (live MySQL, `--no-file-parallelism`): posted CREDIT open items in outstanding (drafts excluded); due-date ageing buckets (CURRENT, 1d, 31d, 121d, NO_DUE_DATE); future `reportDate` → 422 `PAYABLE_REPORT_DATE_IN_FUTURE`; multi-currency `currencyBreakdown`; vendor `netPayableBase` = credit − debit base outstanding; payment planning within horizon; read-only (no audit logs, no open-item mutation); 403 without `finance.ap.view`; cross-tenant outstanding → 403.
- Test fix: bootstrap via `createFinanceAdminTenant` + `bootstrapApAllocFixture` (was passing string slug); NO_DUE_DATE uses `createPostedInvoice` return `openItemId` instead of last CREDIT row by `createdAt`.
- Backend `npx tsc --noEmit` — clean.
- Frontend: `npm run test:money-out-reporting` exists (`frontend/scripts/verify-money-out-reporting.ts`); pages: Outstanding, Ageing, Vendors, Payment Planning under `/accounting/money-out/`.
- Docs: `AP_REPORTING_ARCHITECTURE.md`, `AP_STATUS.md` (4D1 complete, next 4D2).

# 2026-07-19 — Finance Phase 4C2 AP vendor adjustment backend verification

- Verified the `VendorAdjustment` backend foundation (schema, permissions, module, calc/posting/reverse/allocation extension — already implemented) and closed the remaining test gap.
- Added `finance-ap-vendor-adjustment-foundation.test.ts` — **8/8 pass** (live MySQL): permission constants present; draft create/read/update/list with computed totals; mark-ready → cancel; submit (approval-required) → reject → revise back to DRAFT; mark-ready blocked (`VENDOR_ADJUSTMENT_NOT_READY`) when a line fails validation; create blocked (403) without `finance.ap.adjustment.create`; cross-tenant read → 404.
- Regression-confirmed already-passing: `finance-ap-vendor-adjustment-posting.test.ts` (3), `finance-ap-vendor-adjustment-allocation.test.ts` (3), `finance-ap-vendor-adjustment-reversal.test.ts` (3) — 9/9 pass.
- Fixed a shared fixture gap: `tests/finance/helpers/ap-allocation-fixture.ts` did not create `FinanceNumberSeries` rows for `VENDOR_DEBIT_NOTE`/`VENDOR_CREDIT_ADJUSTMENT`, which `reserveSourceDocumentNumber` requires at posting time — added both series alongside the existing `VENDOR_INVOICE`/`VENDOR_PAYMENT` ones.
- Full-suite run of the 4 vendor-adjustment files together (17 tests) plus a regression pass of 5 pre-existing AP suites (85 tests: invoice foundation/posting/reversal, payment reversal, payment allocation) — all green with `--no-file-parallelism`. Note: running many finance vitest files fully in parallel can hit transient MariaDB `TransactionWriteConflict` (P2034) retries on the shared delete+createMany line-replacement pattern (pre-existing across vendor-invoice/payment/adjustment line repositories, not a regression) — use `--no-file-parallelism` or targeted files for reliable CI runs.
- Backend `tsc --noEmit` — clean. `prisma validate` / `migrate deploy` — clean, no pending migrations.
- Docs: `AP_ADJUSTMENT_ARCHITECTURE.md` (added Backend tests section), `AP_STATUS.md`, `SESSION_CHANGELOG.md`.

# 2026-07-19 — Finance Phase 4B5 AP vendor payment / advance / allocation frontend (Money Out)

- Added `frontend/scripts/verify-money-out-payments.ts` + `npm run test:money-out-payments` — **73/73 static checks pass**: live tabs (payments/advances/payables) + preview tabs (ageing/reconciliation); all 8 routes registered; `finance.ap.payment.*` / `advance.view` / `allocation.*` / `open_item.view` permissions + hook accessors; `payablesApiBridge` + `payablesApi` payment/allocation methods; form fields (purpose/method/adjustments/`expectedUpdatedAt`/`useBlocker`); detail post-confirm + allocation history + open-item summary; allocate page `idempotencyKey` + stable signature + `crypto.randomUUID` + `expectedSourceOpenItemUpdatedAt` + per-line `expectedTargetUpdatedAt` + `idempotentReplay` + "no journal entry" copy; **no** Reverse Payment / Reverse Allocation / Delete Allocation / Unallocate action strings; **no** Ant Design imports; totals panel reads server amounts.
- `npm run test:money-out` — **53/53 pass** (updated for now-live payments tab + overview cards).
- `npm run typecheck` — pass. `npm run build` — pass (only pre-existing INEFFECTIVE_DYNAMIC_IMPORT warnings, unrelated).
- Gaps (deferred): no E2E Playwright (static verify only, matching Phase 4A5); payment/allocation reversal UI; vendor adjustments module; AP ageing/reconciliation (4D); bank reconciliation. Live click-through against a running API is a manual step.

# 2026-07-18 — Finance Phase 4B4 AP vendor payment/advance allocation (subledger only, no GL)

- Added `finance-ap-payment-allocation.test.ts` — **18/18 pass** (live MySQL): partial/full/one→many/many→one/advance/mixed allocations; over-allocation of source & target; duplicate target; vendor/control-account/currency mismatch; FX effective-rate block; same-rate foreign base amount; no GL/voucher/PostingEvent/number-series side effects; OPEN/PARTIALLY_SETTLED/SETTLED transitions + `settledAt`; payment `allocationState` + invoice `payableSettlementState`; allocatable-invoice walking suggestions; history + get-by-id; date-before-posting guard.
- Added `finance-ap-payment-allocation-idempotency.test.ts` — **2/2 pass**: replay same batch on repeated key; reused key + different payload → `PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH`.
- Added `finance-ap-payment-allocation-concurrency.test.ts` — **2/2 pass**: two concurrent allocations of one payment (exactly one wins, no over-allocation, single batch); two concurrent payments on one invoice (no over-settlement).
- Added `finance-ap-payment-allocation-permissions.test.ts` — **3/3 pass**: 403 without `finance.ap.allocation.create`; `payment.post` alone insufficient; allocatable-invoices requires `allocation.view`.
- Added `finance-ap-payment-allocation-tenant-isolation.test.ts` — **2/2 pass**: cross-tenant allocate blocked (no writes leak); cross-tenant batch read → 404.
- Added `finance-ap-payment-allocation-reconciliation.test.ts` — **3/3 pass**: net AP subledger + GL + number-series invariant across allocation; batch/line totals ↔ open-item deltas reconcile; FX mismatch kept out of subledger.
- Shared fixture `tests/finance/helpers/ap-allocation-fixture.ts` (posted invoice/payment seeding + raw FX seeders).
- Regression: `finance-ap-vendor-payment-workflow` (6), `finance-ap-vendor-payment-posting` (8 — updated `allowedActions.allocate=true` for POSTED payments with unallocated open item), `finance-ap-allocation-foundation` (5) all green.
- Backend/frontend `tsc --noEmit` — pass.
- Docs: `AP_ALLOCATION_ARCHITECTURE.md` (rewritten), `AP_STATUS.md`, `AP_PAYMENT_WORKFLOW.md`, project memory/status/remaining/session changelog.
- Gaps (deferred): allocation reversal (4B5); allocation/payment frontend UI; AP ageing/reconciliation (4D).

# 2026-07-18 — Finance Phase 4B3 AP vendor payment workflow + atomic posting

- Added `finance-ap-vendor-payment-workflow.test.ts` — **6/6 pass** (live MySQL): draft create/update/validate/mark-ready uniqueness claim, stale version, duplicate key conflict, cancel, submit→approve, reject→revise.
- Added `finance-ap-vendor-payment-posting.test.ts` — **8/8 pass** (live MySQL): simple POSTED + FOS number/voucher/GL/DEBIT open item, ADVANCE→VENDOR_ADVANCE, TDS+bank-charge settlement≠cash outflow, idempotent replay, no allocation, DRAFT/POSTED immutability, post permission 403, closed period block.
- Regression: 4B1 foundation + 4B2 calculation suites green with the above (**43** combined in focused payment run).
- Backend/frontend `tsc --noEmit` — pass. Builds green.
- Docs: `AP_PAYMENT_WORKFLOW.md`, `AP_STATUS.md`, project memory/status/remaining/session changelog.
- Gaps (deferred): dedicated concurrency/tenant-isolation/read test files; real FinanceApprovalRule matching (override-based approval gating); payment frontend UI; allocation (4B4).

# 2026-07-18 — Finance Phase 4A2 AP vendor invoice calculation/validation engine

- Added `finance-ap-vendor-invoice-calculation.test.ts` — **22/22 pass** (pure sync): basic intra/inter-state GST split, tax-inclusive derivation, line/header discount allocation, non-taxed freight, ITC eligible/ineligible/partial/pending-review, TDS at-invoice/at-payment/blank-rate-validation-error, reverse charge, foreign currency base-total conversion, `assertBaseCurrencyRate` direct unit check, calculation determinism, missing-account readiness failure, `NIL_RATED`, plus one live-DB side-effect check (`calculateVendorInvoice` never writes a `VendorInvoice` row).
- Added `finance-ap-vendor-invoice-duplicate.test.ts` — **3/3 pass** (live MySQL): `EXACT_BLOCKING` match, `excludeVendorInvoiceId` self-exclusion, cross-vendor same-number is not a match.
- Regression re-run: `finance-ap-vendor-invoice-foundation.test.ts` — **47/47 pass** (unchanged).
- Backend `npx tsc --noEmit` — pass.
- Docs: `docs/accounting/AP_STATUS.md`, `AP_ARCHITECTURE.md` updated; new `docs/accounting/AP_CALCULATION_RULES.md`.
- Known gaps documented (not fixed this phase): `assertBaseCurrencyRate` defined but not wired into the calculation pipeline; `otherChargeAmount` has no accounting-preview line/account component (would leave the preview unbalanced if a non-zero value were used).

# 2026-07-18 — Accounting Verification Gate

- Decision: **PASSED WITH ACCEPTED RISKS** (`docs/accounting/ACCOUNTING_VERIFICATION_GATE.md`).
- `migrate deploy`: 16 finance migrations applied; status up to date.
- Focused reversals **31/31**; integrity **15/15**; `test:money-in` **76/76**; BE/FE `tsc` pass.
- Fixed `finance-ar-receipt-posting` allowedActions expectations (allocate/reverse true when posted + unallocated).
- Script: `npm run verify:finance-integrity`.

# 2026-07-18 — P2-3 Mobile CRM API-mode E2E

- Added `frontend/scripts/test-crm-mobile-api-e2e.ts` (`npm run test:crm-mobile-api-e2e`).
- Result: **26/26 pass** (static wiring 13 + live API login/lists/follow-up create+complete + FE `/m/crm/leads`).
- Requires backend + MySQL; uses seeded `admin@vasant-trailers.com` / tenant `vasant-trailers`.

# 2026-07-18 — Finance Phase 2C3 journal reversal

- Added focused test: `finance-journal-reversal.test.ts` — reverse happy path (REVERSAL voucher, original REVERSED, JO- number kept, GL nets, audit), idempotent replay, reject DRAFT/APPROVED, 403 without `finance.voucher.reverse`, `allowedActions.reverse` gating.
- Frontend: `JournalDetailPage` Reverse modal + REVERSED banner; `finance.voucher.reverse` / `canReverseVoucher`; demo-store reverse stub.
- Swagger + `API_CONVENTIONS` / project memory docs updated. No new migration.

### Verification

- Backend `npx tsc --noEmit` — **pass**.
- `npx vitest run tests/finance/finance-journal-reversal.test.ts` — **5/5 pass**.
- Frontend `npx tsc -b --noEmit` — **pass**.

# 2026-07-18 — Finance Phase 3D AR reversal (receipts, credit notes, allocations)

- Added focused tests:
  - `finance-ar-receipt-reversal.test.ts` — **7 cases**: allocation reverse (balances restored, lines + batch REVERSED, no new voucher/GL, audit), idempotent allocation-reverse replay + 409 mismatch, allocation reverse 403 without `finance.ar.allocation.reverse`, document reverse blocked by POSTED allocations (422 `CUSTOMER_RECEIPT_ALLOCATIONS_MUST_BE_REVERSED`), full allocate→reverse-alloc→document-reverse (REVERSAL voucher, original REVERSED + linked, credit open item SETTLED, `receiptNumber` preserved, GL nets per account), idempotent document replay, 403 without `finance.ar.receipt.reverse`.
  - `finance-ar-credit-note-reversal.test.ts` — **7 cases**: same matrix for credit notes (`CUSTOMER_CREDIT_NOTE_*` audit/error codes, `finance.ar.credit_note.reverse`).
- Frontend: `moneyIn.ts` MANAGER reverse perms + `canReverse*` flags; Money In `ReceiptDetailPage`/`CreditNoteDetailPage` reverse-document modal + per-batch reverse action; `moneyInUi` REVERSED labels/tones + reverse error map. Frontend `ReadLints` clean.

### Deferred verification (local shell unavailable during session)

- `npx prisma generate` + `npx tsx scripts/prisma-cli.ts migrate deploy` (migration `20260718140000_finance_ar_document_reversal`), backend `npx tsc --noEmit`, `npx vitest run tests/finance/finance-ar-receipt-reversal.test.ts tests/finance/finance-ar-credit-note-reversal.test.ts`, frontend `npx tsc -b --noEmit` + `npx tsx scripts/verify-money-in.ts` — **not yet executed here; must be run before merge.**

# 2026-07-18 — Finance Phase 3B6 customer receipt frontend

- Money In receipt workspace (list/form/detail/allocate) under `/accounting/money-in/receipts/*`; 8th workspace tab inserted after Invoices, before Credit Notes.
- Frontend `npm run typecheck` (`tsc -b --noEmit`) — pass.
- `npx tsx scripts/verify-money-in.ts` — **63/63 pass**. Added: 8-tab count + Receipts tab + ordering check, receipt route checks, `finance.ar.receipt.*` permission checks, demo-store create/get/mark-ready/post (+ idempotent replay)/allocate/history smoke.
- No backend changes — Phase 3B1–3B5 receipt/allocation APIs already shipped; this phase is frontend-only.
- Legacy demo `/accounting/receivables/receipts*` routes left untouched (verified still present in `accountingRoutes.tsx`).

# 2026-07-18 — Finance Phase 3C6 credit-note frontend

- Money In credit-note workspace (list/form/detail/allocate) under `/accounting/money-in/credit-notes/*`.
- Frontend `npx tsc --noEmit` — pass.
- `npx tsx scripts/verify-money-in.ts` — credit-note tab/route/permission + demo create/get/mark-ready/allocate smoke checks added; suite green after replacing obsolete “legacy redirect to Money In” assertion (demo Receivables routes intentionally remain).

# 2026-07-18 — Finance Phase 3C5 credit-note allocation

- Added focused test: `finance-ar-credit-note-allocation.test.ts` — **11/11 pass** (full/partial settlement, multi-invoice from one CN, multiple CNs against one invoice, multiple batches on one CN, unallocated CN stays a customer advance, over-allocation/empty/zero rejection, cross-customer rejection, idempotent replay, permission boundary, invoice outstanding unchanged until allocation + reconciliation MATCHED).
- `npx prisma generate` — pass; `npx tsx scripts/prisma-cli.ts migrate deploy` (migration `20260718130000_finance_phase3c5_credit_note_allocations`) — pass; backend `npx tsc --noEmit -p tsconfig.json` — pass.
- Regression re-run: `finance-ar-credit-note-posting.test.ts` (5/5), `finance-ar-credit-note-foundation.test.ts` (3/3), `finance-ar-receipt-allocation.test.ts` (11/11), `finance-ar-reporting.test.ts` (10/10), `finance-ar-receipt-drafts.test.ts` (12/12) — all pass; `finance-ar-receipt-posting.test.ts` — 11/12 (the one pre-existing Phase 3B4 `allowedActions.allocate` expectation noted below, unrelated to this phase).
- **Bug fix uncovered by the new reconciliation assertion:** `receivable-reconciliation.service.ts`'s `CONTROL_ACCOUNT_MANUAL_POSTING` exception check excluded `CUSTOMER_CREDIT_NOTE` from its allowed `sourceDocumentType` list, so any tenant with a posted credit note against the AR control account always reported `MISMATCH`. Fixed by adding `CUSTOMER_CREDIT_NOTE` alongside `SALES_INVOICE` / `CUSTOMER_RECEIPT`.

# 2026-07-18 — Finance Phase 3C1-3C4 customer credit notes

- Added focused tests: `finance-ar-credit-note-foundation.test.ts` and `finance-ar-credit-note-posting.test.ts` — **8/8 pass**.
- Prisma format/generate — pass; migration deploy to local MySQL — pass; backend `npx tsc --noEmit` — pass.
- Full finance suite — **232/233 pass**. The only failure is an older Phase 3B4 receipt-posting assertion expecting `allowedActions.allocate=false`; Phase 3B5 intentionally makes it true when unallocated credit remains.

---

# Testing Status

### 2026-07-21 — Self-approval policy (maker-checker override)

| Check | Result |
|-------|--------|
| `purchase-approval-flow.test.ts` | **7/7 PASS** — new: PERMISSION_ONLY default allows holder of `purchase.approvals.self_approve` (queue `canAct` + approve + `selfApproved` audit flag); NEVER blocks everyone; EVERYONE allows without permission; legacy maker-checker/delegation/send-back still pass |
| `purchase-approvals.test.ts` | **11/11 PASS** — requester provisioned without the bypass permission; self-approval block re-verified |
| Migration `20260721110000_self_approval_policy` | **Applied** |
| `sync-permissions.ts` | **PASS** (238 perms incl. `purchase.approvals.self_approve`) |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `npm run typecheck` | **PASS** |

---

### 2026-07-21 — Purchase Setup full persistence

| Check | Result |
|-------|--------|
| `purchase-setup.test.ts` | **15/15 PASS** — nested DTO round-trip, approval bands, number series prefix/pad, notifications ON_HOLD, version 409, FK/RBAC/tenant isolation, audit |
| `purchase-invoice-lifecycle.test.ts` | **4/4 PASS** — matching / direct-invoice setup enforcement |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc -p tsconfig.app.json` | **PASS** |
| Migrations `20260721120000_purchase_setup_full_persistence` + `20260721130000_purchase_status_history_docs` | **Applied** |

### 2026-07-21 — Purchase Setup Phase 1A

| Check | Result |
|-------|--------|
| `purchase-setup.test.ts` | Superseded by full persistence suite (was 13/13 on Phase 1A flat DTO) |
| `purchase-order-lifecycle.test.ts` | **PASS** — includes deliveryWarehouseId resolution, `requirePoWarehouse`, retain warehouse after setup change |
| `goods-receipt-lifecycle.test.ts` | **15/15 PASS** — Setup over-receipt tolerance (client `allowExcess` ignored), challan/vehicle/gate requirements |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `npm run typecheck` | **PASS** |
| `prisma validate` + migrate `20260721090000_purchase_setup_phase1` | **Applied** |
| `sync-permissions.ts` | **PASS** (237 perms incl. `purchase.setup.view`) |

---

### 2026-07-21 — Purchase Planning Sheet E2E audit

| Check | Result |
|-------|--------|
| `purchase-planning-workflow.test.ts` | **6/6 PASS** — net qty, transitions, PO-ready codes (vendor/qty/rate/date; Action Message not required) |
| `purchase-planning-sheet.test.ts` | **5/5 PASS** — approve→PPS sync, edit/bulk, create-po grouping, RFQ-required never syncs |
| FE Create PO eligibility | Aligns with backend: vendor_selected/approved/po_pending + vendor/qty/rate/date |
| Who can Create PO | `purchase.planning.create_po` (Purchase Manager / Purchase Executive); Requester & Dept Manager cannot |
| Frontend `/purchase/planning-sheet` HTTP | **200** |

---

Last run: **2026-07-21** (Purchase Planning Sheet E2E + approvals).

### 2026-07-21 — Purchase approvals

| Check | Result |
|-------|--------|
| `purchase-approvals.test.ts` | **11/11 PASS** — PR+PO queue/review/actions/RBAC/tenant/empty state |
| `purchase-approval-flow.test.ts` | **4/4 PASS** — maker-checker, actor inbox, real-user delegation/assignment, PR send-back |
| PR + PO + approval combined regression | **26/26 PASS** |
| Frontend `test:purchase-approvals-api` | **PASS — 9 assertions** |
| Backend typecheck | **PASS** |
| Frontend app typecheck (`tsconfig.app.json`) | **PASS** |
| Running API smoke | **PASS** — pending + history queue |
| `/purchase/approvals` HTTP smoke | **200** |

### 2026-07-20 — Purchase typecheck + coverage gaps

| Check | Result |
|-------|--------|
| Frontend `npm run typecheck` | **PASS** |
| Frontend `npm run test:purchase-phase15-all` | **PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Backend `npm run test:purchase-phase15` | **29/29** |
| Backend `purchase-phase15-integration.test.ts` | **9/9** |
| Backend `purchase-module-coverage.test.ts` | **4/4** (cross-tenant, double-approve, RFQ→PO, concurrent conflict) |
| Local migrate deploy `20260720160000_rfq_flow_award_fields` | **Applied** |

### 2026-07-20 — Purchase Phase 16 final QA

| Check | Result |
|-------|--------|
| Report | [`docs/purchase/PHASE_16_FINAL_QA_REPORT.md`](purchase/PHASE_16_FINAL_QA_REPORT.md) |
| Prisma validate | **PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Backend `npm run test:purchase-phase15` | **29/29** |
| Backend live `purchase-phase15-integration.test.ts` | **9/9** |
| Frontend `npm run test:purchase-phase15-all` | **PASS** (20 + E2E A/B) |
| Frontend `npm run typecheck` | Was **FAIL** — **fixed** same day (see entry above) |
| Full CRM/Sales/Inventory suite | **Not re-run** (modules present) |

### 2026-07-20 — Purchase Phase 15 automated tests

| Check | Result |
|-------|--------|
| Backend `npm run test:purchase-phase15` | **29/29** |
| Backend `npx vitest run tests/purchase-phase15-integration.test.ts` | **9/9** (live MySQL) |
| Backend `tsc --noEmit` | **PASS** |
| Prisma validate | **PASS** |
| Frontend `npm run test:purchase-phase15-all` | **PASS** (20 FE checks + E2E A + E2E B) |
| Create PO from Planning | `POST /purchase/planning-sheet/create-po` |

### 2026-07-20 — Purchase Phase 14 validation and error messages

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-requisition-workflow.test.ts tests/purchase-planning-workflow.test.ts tests/purchase-error-catalog.test.ts` | **Pass** (8+6+2) |
| Backend `tsc --noEmit` | **PASS** |
| Stable codes | `PR_*` / `PPS_*` / `PO_*` catalog + FE `purchaseErrorMessages` |
| Error middleware | Prisma/FK/SQL sanitized; technical detail logged only |
| Live MySQL lifecycle | Expectations updated (`PR_NOT_EDITABLE`, `PR_NO_LINES`, …); re-run when DB available |

### 2026-07-20 — Purchase Phase 13 audit logs and timeline

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-audit-timeline.test.ts` | **2/2** |
| Backend `tsc --noEmit` | Pass (after audit helper + service wiring) |
| Timeline API | `GET /purchase/timeline/:entityType/:entityId` |
| FE views | PR / Planning drawer / RFQ / PO show `PurchaseAuditTimeline` |

### 2026-07-20 — Purchase RBAC

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-rbac-permissions.test.ts` | **4/4** |
| Canonical keys on purchase routes | Wired (`purchase.pr.*` / `planning.*` / `rfq.*` / `po.*`) |
| Permission-denied audit | `requirePermission` → `PERMISSION_DENIED` audit log |

### 2026-07-20 — Purchase RFQ workflow + FE dual-mode bridge

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-rfq-workflow.test.ts` | **2/2** |
| FE RFQ/VQ/comparison facade + mappers | Wired (`VITE_USE_API=true`); demo path unchanged |
| Live RFQ/VQ/comparison MySQL suite | **Pending** |

### 2026-07-20 — Purchase Planning Sheet backend

| Suite / check | Result |
|---------------|--------|
| `npx vitest run tests/purchase-planning-workflow.test.ts` | **5/5** |
| `npx vitest run tests/purchase-planning-sheet.test.ts --hookTimeout=120000` | **4/4** (live MySQL) |
| `npx tsc --noEmit` (backend) | **PASS** |

### 2026-07-20 — Purchase Requisition backend

| Suite / check | Result |
|---------------|--------|
| `npx vitest run tests/purchase-requisition-workflow.test.ts` | **8/8** |
| `npx vitest run tests/purchase-requisition-lifecycle.test.ts --hookTimeout=120000` | **5/5** (live MySQL) |
| `npx tsc --noEmit` (backend) | **PASS** |
| `npx tsx scripts/prisma-cli.ts migrate deploy` | **PASS** (`20260720130000_add_purchase_code_series_entities`) |
## 2026-07-20 — Manufacturing Phase 5B WIP Transfers

| Suite / check | Result |
|---|---|
| Prisma migration `20260720230000_manufacturing_phase5b_wip_transfers` (+ `PRODUCTION_WIP_MOVEMENT` / `WM-`) | **PASS** |
| `npx vitest run tests/manufacturing-phase5b.test.ts` | **5/5 PASS** |
| `npm run test:manufacturing-phase5b` (frontend smoke) | **14/14 PASS** |

Deferred: WO split, stock reversals, inventory transfer docs, costing.

## 2026-07-20 — Manufacturing Phase 5A Runtime Changes

| Suite / check | Result |
|---|---|
| Prisma migration `20260720220000_manufacturing_phase5a_runtime_changes` (+ `PRODUCTION_RUNTIME_CHANGE` / `RC-`) | **PASS** |
| `npx vitest run tests/manufacturing-phase5a.test.ts` | **6/6 PASS** |
| `npm run test:manufacturing-phase5a` (frontend smoke) | **17/17 PASS** |

Known cleanup noise: `tenant.delete` FK on test teardown (same as other manufacturing suites).

Deferred: Phase 5B transfers/split/reversals.

## 2026-07-20 — Manufacturing Phase 4B Job Work

| Suite / check | Result |
|---|---|
| Prisma migration `20260720210000_manufacturing_phase4b_job_work` (+ `JOB_WORK_ORDER` on `code_series.entityType`) | **PASS** |
| `npx prisma generate` | **PASS** |
| `npx vitest run tests/manufacturing-phase4b.test.ts` | **6/6 PASS** |
| `npm run test:manufacturing-phase4b` (frontend smoke) | **17/17 PASS** |

Known cleanup noise: `tenant.delete` FK on test teardown (same as other manufacturing suites).

Deferred verification: cancel-after-dispatch stock reverse; AP/GL costing; full Quality SPA for subcontract returns.

Last run: **2026-07-18** (Finance Phase 3B4 atomic customer receipt posting).

### 2026-07-18 — Finance Phase 3B4: Atomic customer receipt posting

| Suite / check | Result |
|---------------|--------|
| `npx vitest run tests/finance/finance-ar-receipt-posting.test.ts --hookTimeout=120000` (new) | **12/12** |
| `npx vitest run tests/finance --hookTimeout=120000` (full finance suite) | **218/218** (17 files) |
| `npx tsc --noEmit` (backend) | **PASS** |
| `npm run typecheck` (frontend) | **PASS** |
| Fix applied during verification | `finance-ar-receipt-drafts.test.ts` mark-ready test asserted `allowedActions.post === false`; now `true` once `READY_TO_POST` + `finance.ar.receipt.post` permission (expected behavior change from 3B4) |
| Flake observed (unrelated) | `finance-journals.test.ts` hit a MariaDB `P2034` transaction write-conflict on one mixed parallel run across all 17 finance files; re-ran green both in isolation and in a subsequent full-suite run — pre-existing DB-contention flake, not caused by this phase |

### 2026-07-18 — Finance Phase 3B3: Customer receipt draft workflow

| Suite / check | Result |
|---------------|--------|
| `npx vitest run tests/finance/finance-ar-receipt-drafts.test.ts` (new) | **12/12** |
| `npx vitest run tests/finance --hookTimeout=120000` (full finance suite) | **206/206** (16 files) |
| `npx tsc --noEmit` (backend) | **PASS** |
| `npm run typecheck` (frontend) | **FAIL** — pre-existing, unrelated (`PurchaseApprovalsPage.tsx` TS2304, `PurchaseSetupPage.tsx` TS17001); no frontend files touched this phase |
| Fix applied during verification | Circular ES module import between `customer-receipt.schemas.ts` and `calculation/customer-receipt-calculation.schemas.ts` was causing an intermittent `ZodObject._parse` crash (HTTP 500) on every receipt-create call — resolved by moving `customerReceiptPaymentMethodSchema` into the calculation schema file |

### 2026-07-15 — Purchase frontend quality review

| Suite / check | Result |
|---------------|--------|
| `npx tsx scripts/smoke-purchase-e2e-flow.ts` | **PASS** — full PR→…→Return→report |
| `npm run test:purchase:production` | **39/39** |
| `npx tsx scripts/smoke-purchase-orders.ts` | **PASS** |
| `npx tsx scripts/smoke-purchase-return.ts` | **PASS** |
| `npx oxlint src/modules/purchase` | **PASS** (0 errors; warnings only) |
| `npm run lint` (repo) | **FAIL** — pre-existing hooks errors in `CrmMasterPages`, `BomPages` (not purchase) |
| `npm run typecheck` | **FAIL** — pre-existing non-purchase (`bomStore`, CRM bridge/seed, etc.); **no purchase module errors** in last filtered pass |
| `npm run build` | See session entry below / build-out |
| Browser UAT | **Not run** — service + route evidence only |

### 2026-07-15 — Convert Quotation → Sales Order

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `npx tsc --noEmit` (frontend, convert-related) | **PASS** (no errors in changed convert files) |
| `npm run test:crm-live` | **50/50** (e2e 43 + tenant isolation 7) |
| Coverage added | Convert success asserts Won + open SO; duplicate → **409**; lost opportunity → 422 |

### 2026-07-14 — Edit Opportunity header actions

| Suite / check | Result |
|---------------|--------|
| `npm run test:uat-03-opportunities` | **86/86** (78 automated + 8 live) |
| `npm run test:crm-opportunity-item-lines` | 29/31 (2 pre-existing failures: 360 items tab label, New page "Save & Create Quotation" copy) |
| `npm run test:crm-opportunity-full-page` | 15/20 (pre-existing New/360 string assertions) |
| FE typecheck (changed files) | OpportunityEdit / useOpportunityEditor clean |

### 2026-07-14 — Phase 1 Sales Order API

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `npm run test:crm-live` | **49/49** (e2e 42 + tenant isolation 7) |
| New cases | Direct SO create→patch→confirm→close; draft soft-delete |

### 2026-07-14 — Dashboard quotation approval panel (P1 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `npx tsc --noEmit` (frontend) | **PASS** |
| `npm run test:crm-live` | **47/47** (e2e 40 + tenant isolation 7) |
| New case | `dashboard metrics include pending quotation approval panel from DB` |
| Payload | `GET /crm/dashboard/metrics` → `panels.pendingApprovalCount` + `panels.pendingApprovalQuotations` |
| FE | API mode: `applyApiDashboardPanelOverlay`; demo keeps store derivation |

### 2026-07-14 — Quotation templates + CRM search live E2E (P2 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run test:crm-live` | **46/46** (e2e 39 + tenant isolation 7; superseded by 47/47 above) |
| New cases | `creates, lists, gets, updates, duplicates, and soft-deletes quotation template`; `searches CRM companies, contacts, leads, and opportunities` |
| Template endpoints | `POST/GET/PATCH/DELETE …/quotation-templates`, `POST …/:id/duplicate` |
| Search endpoints | `GET …/crm/search?q=` (missing/empty `q` → 400) |

APIs already existed; gap was live coverage only.

### 2026-07-14 — Sales forecast API (P2 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `tests/crm-forecast.test.ts` | **2/2** — weighted = Σ(amount × probability/100) + bucket/at-risk |
| `npm test` (no live) | **39 passed / 49 skipped** |
| `npm run test:crm-live` | **47/47** (e2e 40 + tenant isolation 7) — includes forecast GET + tenant-scoped assert |

API: `GET /t/:tenantSlug/crm/forecast`. FE API mode: `useCrmSalesForecast` (no mix with demo rollup).

### 2026-07-14 — Entity notes live E2E (P1 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run test:crm-live` | **42/42** (e2e 36 + tenant isolation 6; superseded by 46/46 above) |
| New case | `creates, lists, updates, and soft-deletes entity notes on LEAD` |
| Endpoints | `POST/GET …/entities/LEAD/:id/notes`, `PATCH/DELETE …/entities/notes/:noteId` |

Notes API already existed (FE `useEntityNotes`); gap was live coverage only. Attachments remain covered separately.

### 2026-07-14 — CRM FE ↔ API ↔ DB verification

Full page-/function-wise report: [`docs/CRM_FE_API_DB_VERIFICATION_REPORT.md`](CRM_FE_API_DB_VERIFICATION_REPORT.md).

| Suite / check | Result |
|---------------|--------|
| Stack | MySQL :3306 up; backend :5000 health 200 (`database: connected`); FE :5173 with `VITE_USE_API=true` |
| `npm run typecheck` (backend) | **PASS** |
| `npm test` (no live) | **37 passed / 44 skipped** |
| `npm run test:crm-live` | **47/47** (e2e 40 + tenant isolation 7) |
| HTTP probes | login + dashboard/leads/opportunities/quotations + `/crm/masters/sync` + `/masters/locations` → **200** |
| Browser smoke | Login → `/crm`, `/crm/leads`, `/crm/opportunities` in API mode |

Verdict: CRM commercial funnel **Working**; remaining gaps = mobile CRM live coverage, deferred transactional ERP. Forecast / templates / search / notes / dashboard approval live gaps closed.

### 2026-07-14 — CRM/master API sync

| Suite | Result |
|-------|--------|
| `npm run typecheck` | **PASS** (seed rows moved under `src/modules/crm/masters/crm-master.seed-data.ts`) |
| `tests/crm-validation.test.ts` | **10/10** — optionalUuid, quotation `locationId: ""`, attachment `documentType`, opportunity-stages seed |
| `tests/lead-workflow.test.ts` | **4/4** |
| `npm test` (no live) | **37 passed / 43 skipped** (crm-e2e + tenant isolation skipped) |
| `npm run db:seed` | **PASS** — 8 warehouses, 8 locations |
| `npm run test:crm-live` | **42/42** — prior coverage + entity notes create/list/PATCH/soft-delete on LEAD |

### 2026-07-14 — Lead convert gate

| Suite | Result |
|-------|--------|
| `backend/tests/lead-workflow.test.ts` | **4/4 passed** — `assertLeadConvertible` requires qualified |

## Commands reference

### Backend (`backend/`)

| Command | Description |
|---------|-------------|
| `npm run typecheck` | TypeScript compile check |
| `npm test` | Vitest — unit/integration (live CRM tests **skipped**) |
| `npm run test:crm-live` | Sets `RUN_CRM_E2E=true`; runs CRM E2E + tenant isolation |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:setup` | generate + migrate deploy + seed |
| `npx tsx scripts/prisma-cli.ts migrate deploy` | Apply migrations (CI-safe) |
| `npm run db:seed` | Seed only |

### Frontend (`trailer-erp/`)

| Command | Description |
|---------|-------------|
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run build` | Production build |
| `npm run test:route-integrity` | Route path baseline gate (`--write-baseline` after alias changes) |
| `npm run test:crm-integration` | Demo-mode CRM ↔ ERP integration (18 cases) |
| `npm run test:crm` | masters + integration + eeata fix |
| `npm run test:regression` | Large demo regression bundle |
| `npm run test:crm-live` | ❌ Not defined on frontend — use backend script |

## Last verified results (2026-07-13) — Master consolidation

### Frontend typecheck

```
npx tsc --noEmit → EXIT 0
```

### Route integrity

```
npm run test:route-integrity -- --write-baseline → 443 paths
npm run test:route-integrity → PASSED
```

---

## Last verified results (2026-07-11)

### Backend typecheck

```
npm run typecheck → EXIT 0
```

### Frontend typecheck

```
npm run typecheck → EXIT 0
```

### Backend `npm test` (Vitest, RUN_CRM_E2E not set) — re-run 2026-07-11

| Metric | Count |
|--------|-------|
| Test files passed | 5 |
| Test files skipped (live-only) | 2 |
| Tests passed | **23** |
| Tests skipped | **29** |
| Tests failed | **0** |
| Duration | ~6.8s |

Skipped files (require `RUN_CRM_E2E=true`):

- `tests/crm-e2e.test.ts` — 21 tests skipped
- `tests/crm-tenant-isolation.test.ts` — 6 tests skipped (also 2 auth tests skipped in integration.test.ts when DB unavailable)

**Important:** Skipped live tests are **not** counted as passed.

### Backend `npm run test:crm-live` (MySQL required) — re-run 2026-07-11

| Metric | Count |
|--------|-------|
| Test files passed | 2 |
| Tests passed | **27** |
| Tests failed | **0** |
| Duration | ~4.3s |

Breakdown:

- `crm-e2e.test.ts` — **21 passed** (company/contact/lead/activity/opportunity full lifecycle)
- `crm-tenant-isolation.test.ts` — **6 passed**

### Frontend `npm run test:crm-integration` (demo mode) — re-run 2026-07-11

| Metric | Count |
|--------|-------|
| Tests passed | **18** |
| Tests failed | **0** |

Note: Runs against Zustand stores, not live API.

## Test file inventory (backend)

| File | Live DB | Purpose |
|------|---------|---------|
| `integration.test.ts` | Optional | Health + auth reject + tenant isolation setup |
| `crm-e2e.test.ts` | **Required** (`RUN_CRM_E2E=true`) | CRM CRUD lifecycle |
| `crm-tenant-isolation.test.ts` | **Required** | Cross-tenant access denied |
| `masters.test.ts` | Required | Geography/UOM CRUD |
| `master-batch.test.ts` | Required | Item/vendor/GST batch |
| `master-import.test.ts` | Required | Import pipelines |
| `master-tenant-isolation.test.ts` | Required | Master tenant isolation |

## Not verified live (pending)

| Area | Reason |
|------|--------|
| Attachments download E2E | Upload/list covered live; download path not separately asserted |
| Quotation export API E2E | Tables exist; no live test case; export returns empty until quotation CRUD writes data |
| Dashboard chart series API | Wired in code; manual `/crm` visual check not automated |
| Master import on CI | Requires MySQL |
| Frontend tests in API mode | Most scripts assume demo stores |
| Full `npm run test:regression` | Not run this session (long demo suite) |

## How to run live CRM tests

```bash
cd backend
# Ensure .env has DATABASE_URL or DB_* pointing to seeded database
npm run db:setup   # if fresh
npm run test:crm-live
```

Prerequisites: MySQL 8+, migrations applied, seed data present.

## CI recommendation

1. Job A: `typecheck` both packages (no DB).
2. Job B: `npm test` backend (expect 29 skipped).
3. Job C: MySQL service → `npm run test:crm-live` (must pass 27/27).
4. Job D: frontend `npm run test:crm-integration` (demo, 18/18).

## Historical note

Prior session reported CRM live E2E **27/27** — **re-verified 2026-07-11** with same result.
