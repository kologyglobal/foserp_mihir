/* =========================================================
   POST-MIGRATE FIX — POST /purchase/requisitions → 500
   (and RFQ / VQ / Return / PO tax snapshot columns)

   Run in phpMyAdmin on stage/live DB (e.g. u233611619_foserp).
   Safe to re-run: skip any line that errors "Duplicate column name".

   Migrations:
     20260805140000_purchase_tax_snapshots  (PO → GRN → Invoice)
     20260805180000_purchase_upstream_tax_snapshots (PR → RFQ → VQ → Return)

   Also deploy backend fix: warehouseId before preparePrLines in
   purchase-requisition.service.ts (ReferenceError without it).
   ========================================================= */

USE `u233611619_foserp`;

/* ── 1) AUDIT — missing columns (expect 0 rows per table when OK) ── */

SELECT 'purchase_requisition_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'hsnId' AS col UNION ALL SELECT 'gstGroupId' UNION ALL SELECT 'hsnCodeSnapshot'
  UNION ALL SELECT 'gstGroupCodeSnapshot' UNION ALL SELECT 'gstRatePctSnapshot'
  UNION ALL SELECT 'cgstRateSnapshot' UNION ALL SELECT 'sgstRateSnapshot'
  UNION ALL SELECT 'igstRateSnapshot' UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchase_requisition_lines'
    AND COLUMN_NAME = c.col
);

SELECT 'request_for_quotation_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'hsnId' AS col UNION ALL SELECT 'gstGroupId' UNION ALL SELECT 'hsnCodeSnapshot'
  UNION ALL SELECT 'gstGroupCodeSnapshot' UNION ALL SELECT 'gstRatePctSnapshot'
  UNION ALL SELECT 'cgstRateSnapshot' UNION ALL SELECT 'sgstRateSnapshot'
  UNION ALL SELECT 'igstRateSnapshot' UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_for_quotation_lines'
    AND COLUMN_NAME = c.col
);

SELECT 'vendor_quotation_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'hsnId' AS col UNION ALL SELECT 'gstGroupId' UNION ALL SELECT 'hsnCodeSnapshot'
  UNION ALL SELECT 'gstGroupCodeSnapshot' UNION ALL SELECT 'gstRatePctSnapshot'
  UNION ALL SELECT 'cgstRateSnapshot' UNION ALL SELECT 'sgstRateSnapshot'
  UNION ALL SELECT 'igstRateSnapshot' UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor_quotation_lines'
    AND COLUMN_NAME = c.col
);

SELECT 'purchase_return_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'hsnIdSnapshot' AS col UNION ALL SELECT 'hsnCodeSnapshot'
  UNION ALL SELECT 'gstGroupIdSnapshot' UNION ALL SELECT 'gstGroupCodeSnapshot'
  UNION ALL SELECT 'gstRatePctSnapshot' UNION ALL SELECT 'cgstRateSnapshot'
  UNION ALL SELECT 'sgstRateSnapshot' UNION ALL SELECT 'igstRateSnapshot'
  UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchase_return_lines'
    AND COLUMN_NAME = c.col
);

SELECT 'purchase_order_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'gstRatePctSnapshot' AS col UNION ALL SELECT 'cgstRateSnapshot'
  UNION ALL SELECT 'sgstRateSnapshot' UNION ALL SELECT 'igstRateSnapshot'
  UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchase_order_lines'
    AND COLUMN_NAME = c.col
);

SELECT 'goods_receipt_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'hsnIdSnapshot' AS col UNION ALL SELECT 'hsnCodeSnapshot'
  UNION ALL SELECT 'gstGroupIdSnapshot' UNION ALL SELECT 'gstGroupCodeSnapshot'
  UNION ALL SELECT 'gstRatePctSnapshot' UNION ALL SELECT 'cgstRateSnapshot'
  UNION ALL SELECT 'sgstRateSnapshot' UNION ALL SELECT 'igstRateSnapshot'
  UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'goods_receipt_lines'
    AND COLUMN_NAME = c.col
);

SELECT 'purchase_invoice_lines' AS tbl, c.col AS missing_column
FROM (
  SELECT 'hsnIdSnapshot' AS col UNION ALL SELECT 'hsnCodeSnapshot'
  UNION ALL SELECT 'gstGroupIdSnapshot' UNION ALL SELECT 'gstGroupCodeSnapshot'
  UNION ALL SELECT 'cgstRateSnapshot' UNION ALL SELECT 'sgstRateSnapshot'
  UNION ALL SELECT 'igstRateSnapshot' UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchase_invoice_lines'
    AND COLUMN_NAME = c.col
);

/* Prisma migration history (optional check) */
SELECT migration_name, finished_at
FROM `_prisma_migrations`
WHERE migration_name IN (
  '20260805140000_purchase_tax_snapshots',
  '20260805180000_purchase_upstream_tax_snapshots'
)
ORDER BY migration_name;

/* ── 2) FIX — purchase_requisition_lines (PR create 500 if missing) ── */

ALTER TABLE `purchase_requisition_lines`
  ADD COLUMN `hsnId` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupId` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

/* ── 3) FIX — RFQ / VQ / Return upstream lines ── */

ALTER TABLE `request_for_quotation_lines`
  ADD COLUMN `hsnId` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupId` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `vendor_quotation_lines`
  ADD COLUMN `hsnId` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupId` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `purchase_return_lines`
  ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

/* ── 4) FIX — PO / GRN / Invoice chain (Phase 1 tax snapshots) ── */

ALTER TABLE `purchase_order_lines`
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `goods_receipt_lines`
  ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `gstRatePctSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

ALTER TABLE `purchase_invoice_lines`
  ADD COLUMN `hsnIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `hsnCodeSnapshot` VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN `gstGroupIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `gstGroupCodeSnapshot` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `cgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `sgstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `igstRateSnapshot` DECIMAL(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `gstSchemeSnapshot` VARCHAR(16) NOT NULL DEFAULT 'cgst_sgst';

/* ── 5) VERIFY — re-run audit; all should return 0 rows ── */

SELECT 'purchase_requisition_lines_after' AS check_item, COUNT(*) AS missing_cnt
FROM (
  SELECT 'hsnId' AS col UNION ALL SELECT 'gstGroupId' UNION ALL SELECT 'hsnCodeSnapshot'
  UNION ALL SELECT 'gstGroupCodeSnapshot' UNION ALL SELECT 'gstRatePctSnapshot'
  UNION ALL SELECT 'cgstRateSnapshot' UNION ALL SELECT 'sgstRateSnapshot'
  UNION ALL SELECT 'igstRateSnapshot' UNION ALL SELECT 'gstSchemeSnapshot'
) c
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchase_requisition_lines'
    AND COLUMN_NAME = c.col
);

SELECT 'Purchase upstream tax snapshot fix done — redeploy backend + retry POST /purchase/requisitions' AS status;
