# FIN-CLOSE-1 Hostinger migration runbook

> Preparation only. Production migration and redeploy are human actions. Do not run these commands until a backup and maintenance window are confirmed.

## Scope

The production migration batch must include, in Prisma filename order:

1. `20260729160000_fin_close_1_grir_ppv_return_ap`
2. `20260729160000_po_require_approval_on_po`
3. `20260729170000_po_revise_archive_tables`
4. `20260729180000_maintenance_client_feedback`
5. `20260730110000_purchase_qi_parameter_checklist`
6. `20260730120000_maintenance_issue_to_spare_parts`
7. `20260730121000_finance_year_end_close`

Prisma orders duplicate timestamp prefixes by the complete migration directory name. Do not rename an already-shared migration to change that order.

The retro-cost implementation is code-only and adds no schema migration.

## Pre-deploy checks

From the checked-out repository root on the Hostinger application host:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/main
cd backend
npx tsx scripts/prisma-cli.ts migrate status
```

Confirm:

- the worktree is clean and `HEAD` is the approved `origin/main` revision;
- database environment variables point to the intended production database;
- a fresh logical database backup exists and its size is plausible;
- no failed row exists in `_prisma_migrations`;
- the application maintenance window is active.

## Human deployment commands

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx tsx scripts/prisma-cli.ts migrate status
npx tsx scripts/map-fin-close-1-grir-ppv.ts
cd ..
npm run build
```

Then use hPanel **Settings & Redeploy** with the settings in `docs/HOSTINGER_GIT_DEPLOYMENT.md`.

The mapping script is idempotent. It creates/maps `GRIR_CLEARING` and `PURCHASE_PRICE_VARIANCE` only for active legal entities that already have a chart of accounts. It does **not** enable `INVENTORY_ACCOUNTING`.

## Expected checks

Migration output must report every pending migration as applied and end without `P3009`, `P3015`, or SQL errors. Afterwards:

```text
GET https://erp.dhurandharcrm.com/build-meta.json
GET https://erp.dhurandharcrm.com/api/v1/health
```

Confirm the build revision equals the approved commit, health reports the database connected, and mappings exist for every inventory-accounting legal entity before enabling or using the flow.

## Recovery

- Do not edit or delete `_prisma_migrations` rows manually.
- Do not re-run a partially executed migration blindly.
- If `migrate deploy` fails, stop the application rollout, retain the migration log, and restore the pre-deploy backup when the failed DDL cannot be safely completed forward.
- For a recoverable failed migration, diagnose the exact applied DDL first, create an approved forward repair, and only then use Prisma `migrate resolve` as documented by Prisma.
- The FIN-CLOSE-1 migration changes MySQL enums and adds nullable columns only; rollback is backup restore or an explicitly reviewed forward migration. There is no automatic down migration.
- `purchase-multi-unit-uom-hostinger.sql` is a historical, migration-specific repair helper. It is not a substitute for this batch and must not be run for FIN-CLOSE-1.

## Post-deploy verification

Run against the approved production tenant only during the window:

1. Verify GR/IR and PPV mappings.
2. Post a controlled GRN/invoice scenario or use an approved non-production clone.
3. Confirm remaining stock receives the retro cost entry, consumed value remains PPV, and Inventory↔GL is matched without Force Balance.
4. Confirm a Vendor Invoice reversal creates the inverse cost entry and inverse voucher lines.

Production deploy remains a human decision and was not performed while preparing this runbook.
