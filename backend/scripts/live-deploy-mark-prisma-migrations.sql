/* =========================================================
   LIVE DEPLOY — Part B4 Prisma bookkeeping
   File: live-deploy-mark-prisma-migrations.sql
   Order: 5th (after schema scripts 2–4).
   Inserts _prisma_migrations rows so `migrate deploy` will not
   re-apply SQL you already ran by hand.

   Checksums = sha256 of each prisma/migrations/*/migration.sql
   (computed from repo on 2026-07-28).

   Safe to re-run: skips names that already exist.
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'mark_prisma_migrations' AS script;

/* 20260727180000_purchase_multi_unit_uom */
INSERT INTO `_prisma_migrations`
  (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT
  UUID(),
  '1bf6f3b4a500b8807c2fc330f0f485dbbbdda5d4a68f621aad5894811d9f2377',
  NOW(3),
  '20260727180000_purchase_multi_unit_uom',
  NULL,
  NULL,
  NOW(3),
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `_prisma_migrations`
  WHERE `migration_name` = '20260727180000_purchase_multi_unit_uom'
);

/* 20260728140000_grn_receiving_tolerance */
INSERT INTO `_prisma_migrations`
  (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT
  UUID(),
  'a04bb9ba14e8b81df944ede1bf3c23a4d503915d10274e52118d1854a9fa57ae',
  NOW(3),
  '20260728140000_grn_receiving_tolerance',
  NULL,
  NULL,
  NOW(3),
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `_prisma_migrations`
  WHERE `migration_name` = '20260728140000_grn_receiving_tolerance'
);

/* 20260728180000_po_versioning */
INSERT INTO `_prisma_migrations`
  (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT
  UUID(),
  'a82a31413b631749390c71865f2965bc3fa021e39dc0866a531bfa77581c8511',
  NOW(3),
  '20260728180000_po_versioning',
  NULL,
  NULL,
  NOW(3),
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `_prisma_migrations`
  WHERE `migration_name` = '20260728180000_po_versioning'
);

SELECT
  migration_name,
  finished_at,
  LEFT(checksum, 16) AS checksum_prefix,
  applied_steps_count
FROM `_prisma_migrations`
WHERE migration_name IN (
  '20260727180000_purchase_multi_unit_uom',
  '20260728140000_grn_receiving_tolerance',
  '20260728180000_po_versioning'
)
ORDER BY migration_name;
