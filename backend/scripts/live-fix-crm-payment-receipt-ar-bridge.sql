/* =========================================================
   LIVE FIX — P2022 crm_payment_receipts.accountingReceiptId
   Hostinger-safe: NO information_schema, NO PREPARE.

   phpMyAdmin: select u233611619_foserp → SQL tab → paste all → Go.
   If a column/index already exists, MySQL shows "Duplicate" — skip that line.
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at;

/* 1) Check columns (uses SHOW — works on Hostinger) */
SHOW COLUMNS FROM `crm_payment_receipts` LIKE 'accountingStatus';
SHOW COLUMNS FROM `crm_payment_receipts` LIKE 'accountingReceiptId';
SHOW COLUMNS FROM `crm_payment_receipts` LIKE 'accountingReceiptNumber';
SHOW COLUMNS FROM `crm_payment_receipts` LIKE 'accountingSubmittedAt';
SHOW COLUMNS FROM `crm_payment_receipts` LIKE 'accountingConvertedAt';

/* 2) Add bridge columns — run each block; ignore "Duplicate column name" if re-running */

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingStatus` ENUM('none', 'pending_review', 'converted', 'rejected') NOT NULL DEFAULT 'none';

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingReceiptId` VARCHAR(191) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingReceiptNumber` VARCHAR(64) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingSubmittedAt` DATETIME(3) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingConvertedAt` DATETIME(3) NULL;

/* 3) Indexes — ignore "Duplicate key name" if re-running */

CREATE INDEX `crm_payment_receipts_tenantId_accountingStatus_idx`
  ON `crm_payment_receipts`(`tenantId`, `accountingStatus`);

CREATE UNIQUE INDEX `crm_payment_receipts_tenantId_accountingReceiptId_key`
  ON `crm_payment_receipts`(`tenantId`, `accountingReceiptId`);

/* 4) Verify */
SHOW COLUMNS FROM `crm_payment_receipts`
  WHERE Field IN (
    'accountingStatus',
    'accountingReceiptId',
    'accountingReceiptNumber',
    'accountingSubmittedAt',
    'accountingConvertedAt'
  );

SELECT 'CRM payment receipt AR bridge — done. Retry the API.' AS status;

/* =========================================================
   PHASE 3 — if API still returns P2022 for accountingMigrationStatus
   (stage deploy is ahead of repo; add remaining bridge cols)
   ========================================================= */

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingMigrationStatus` ENUM('none', 'pending', 'migrated', 'failed', 'skipped') NOT NULL DEFAULT 'none';

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingMigrationError` TEXT NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingMigratedAt` DATETIME(3) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `createdByNameSnapshot` VARCHAR(200) NULL;

CREATE INDEX `crm_payment_receipts_tenantId_accountingMigrationStatus_idx`
  ON `crm_payment_receipts`(`tenantId`, `accountingMigrationStatus`);

SHOW COLUMNS FROM `crm_payment_receipts` LIKE 'accounting%';

/* =========================================================
   PHASE 4 — P2022 accountingMigratedBy (+ related audit cols)
   Run one ALTER at a time; skip #1060 Duplicate column
   ========================================================= */

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingMigratedBy` VARCHAR(191) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingSubmittedBy` VARCHAR(191) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingConvertedBy` VARCHAR(191) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingRejectedAt` DATETIME(3) NULL;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `accountingRejectedBy` VARCHAR(191) NULL;

SHOW COLUMNS FROM `crm_payment_receipts`
WHERE Field LIKE 'accounting%' OR Field = 'createdByNameSnapshot';

/* =========================================================
   PHASE 5 — P2022 commercialOnly (Money In bridge migration)
   Run ONLY this block if API says column commercialOnly is missing.
   Default true = existing receipts stay commercial-only until migrated.
   ========================================================= */

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `commercialOnly` BOOLEAN NOT NULL DEFAULT true;

SHOW COLUMNS FROM `crm_payment_receipts` LIKE 'commercialOnly';

/* =========================================================
   PHASE 6 — optional indexes from 20260803210000 migration
   Ignore "Duplicate key name" if re-running
   ========================================================= */

CREATE INDEX `crm_payment_receipts_tenantId_receiptDate_idx`
  ON `crm_payment_receipts`(`tenantId`, `receiptDate`);

CREATE INDEX `crm_payment_receipts_tenantId_transactionRef_idx`
  ON `crm_payment_receipts`(`tenantId`, `transactionRef`);

SELECT 'Phase 5+6 done — retry CRM payment receipt API.' AS status;

/* =========================================================
   PHASE 7 — FIX accountingMigrationStatus enum (critical)
   Phase 3 used wrong values (none/pending/…). Stage Prisma
   expects UNREVIEWED/MIGRATED/… — causes generic 500 on sync.
   Run this block ONLY. Ignore #1060 on commercialOnly if exists.
   ========================================================= */

USE `u233611619_foserp`;

ALTER TABLE `crm_payment_receipts`
  ADD COLUMN `commercialOnly` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `crm_payment_receipts`
  MODIFY COLUMN `accountingMigrationStatus` ENUM(
    'none', 'pending', 'migrated', 'failed', 'skipped',
    'UNREVIEWED', 'NON_ACCOUNTING', 'READY_TO_MIGRATE', 'DRAFT_CREATED',
    'MIGRATED', 'DUPLICATE', 'REJECTED', 'FAILED'
  ) NOT NULL DEFAULT 'UNREVIEWED';

UPDATE `crm_payment_receipts`
SET `accountingMigrationStatus` = 'UNREVIEWED'
WHERE `accountingMigrationStatus` IN ('none', '');

UPDATE `crm_payment_receipts`
SET `accountingMigrationStatus` = 'READY_TO_MIGRATE'
WHERE `accountingMigrationStatus` = 'pending';

UPDATE `crm_payment_receipts`
SET `accountingMigrationStatus` = 'MIGRATED'
WHERE `accountingMigrationStatus` = 'migrated';

UPDATE `crm_payment_receipts`
SET `accountingMigrationStatus` = 'FAILED'
WHERE `accountingMigrationStatus` = 'failed';

UPDATE `crm_payment_receipts`
SET `accountingMigrationStatus` = 'NON_ACCOUNTING'
WHERE `accountingMigrationStatus` = 'skipped';

ALTER TABLE `crm_payment_receipts`
  MODIFY COLUMN `accountingMigrationStatus` ENUM(
    'UNREVIEWED', 'NON_ACCOUNTING', 'READY_TO_MIGRATE', 'DRAFT_CREATED',
    'MIGRATED', 'DUPLICATE', 'REJECTED', 'FAILED'
  ) NOT NULL DEFAULT 'UNREVIEWED';

SHOW COLUMNS FROM `crm_payment_receipts`
WHERE Field IN ('commercialOnly', 'accountingMigrationStatus', 'accountingReceiptId');

SELECT 'Phase 7 enum fix done — retry GET /crm/commercial/sync' AS status;
