/* =========================================================
   LIVE DEPLOY — Part A (READ-ONLY diagnostic)
   DB:   u233611619_fos_erp
   Pack: purchase multi-unit + GRN tolerance + PO versioning + LE
   Run:  1st (before any ALTER). Safe — SELECT only.
   ========================================================= */

USE `u233611619_fos_erp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at;

SET @db := DATABASE();
SET @tenantSlug := 'vasant-trailers';
SET @tenantId := (
  SELECT id FROM tenants
  WHERE slug = @tenantSlug AND deletedAt IS NULL
  LIMIT 1
);

SELECT @tenantSlug AS tenant_slug, @tenantId AS tenant_id;

/* ---------- Columns / tables needed by 2026-07-27..28 purchase work ---------- */
SELECT
  need.obj AS object_name,
  CASE
    WHEN need.kind = 'table' THEN
      CASE WHEN t.TABLE_NAME IS NULL THEN 'MISSING' ELSE 'OK' END
    ELSE
      CASE WHEN c.COLUMN_NAME IS NULL THEN 'MISSING' ELSE 'OK' END
  END AS status
FROM (
  SELECT 'col' AS kind, 'master_items' AS tbl, 'uomConversionFactor' AS col, 'master_items.uomConversionFactor' AS obj
  UNION ALL SELECT 'col', 'master_items', 'receivingTolerancePercentage', 'master_items.receivingTolerancePercentage'
  UNION ALL SELECT 'col', 'purchase_order_lines', 'uomQuantity', 'purchase_order_lines.uomQuantity'
  UNION ALL SELECT 'col', 'purchase_order_lines', 'uomConversionFactor', 'purchase_order_lines.uomConversionFactor'
  UNION ALL SELECT 'col', 'purchase_order_lines', 'unitCostPrimary', 'purchase_order_lines.unitCostPrimary'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'uomConversionFactor', 'goods_receipt_lines.uomConversionFactor'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'unitCostPrimary', 'goods_receipt_lines.unitCostPrimary'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'orderedUomQuantity', 'goods_receipt_lines.orderedUomQuantity'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'receivedUomQuantity', 'goods_receipt_lines.receivedUomQuantity'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'acceptedUomQuantity', 'goods_receipt_lines.acceptedUomQuantity'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'rejectedUomQuantity', 'goods_receipt_lines.rejectedUomQuantity'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'tolerancePercentage', 'goods_receipt_lines.tolerancePercentage'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'variancePercentage', 'goods_receipt_lines.variancePercentage'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'toleranceStatus', 'goods_receipt_lines.toleranceStatus'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'closeOpenQuantity', 'goods_receipt_lines.closeOpenQuantity'
  UNION ALL SELECT 'col', 'goods_receipts', 'toleranceApprovalRequired', 'goods_receipts.toleranceApprovalRequired'
  UNION ALL SELECT 'col', 'goods_receipts', 'toleranceApprovedAt', 'goods_receipts.toleranceApprovedAt'
  UNION ALL SELECT 'col', 'goods_receipts', 'toleranceApprovedById', 'goods_receipts.toleranceApprovedById'
  UNION ALL SELECT 'col', 'purchase_orders', 'revisionNo', 'purchase_orders.revisionNo'
  UNION ALL SELECT 'col', 'purchase_settings', 'requireApprovalOnPoRevision', 'purchase_settings.requireApprovalOnPoRevision'
  UNION ALL SELECT 'col', 'inventory_stock_movements', 'uomQuantity', 'inventory_stock_movements.uomQuantity'
  UNION ALL SELECT 'col', 'inventory_stock_movements', 'uomId', 'inventory_stock_movements.uomId'
  UNION ALL SELECT 'col', 'inventory_stock_movements', 'uomConversionFactor', 'inventory_stock_movements.uomConversionFactor'
  UNION ALL SELECT 'table', 'purchase_order_revisions', NULL, 'table:purchase_order_revisions'
  UNION ALL SELECT 'table', 'legal_entities', NULL, 'table:legal_entities'
  UNION ALL SELECT 'table', 'finance_settings', NULL, 'table:finance_settings'
  UNION ALL SELECT 'table', 'branches', NULL, 'table:branches'
) AS need
LEFT JOIN information_schema.TABLES AS t
  ON need.kind = 'table'
 AND t.TABLE_SCHEMA = @db
 AND t.TABLE_NAME = need.tbl
LEFT JOIN information_schema.COLUMNS AS c
  ON need.kind = 'col'
 AND c.TABLE_SCHEMA = @db
 AND c.TABLE_NAME = need.tbl
 AND c.COLUMN_NAME = need.col
ORDER BY status DESC, object_name;

/* ---------- Enum / status peek (before MODIFY) ---------- */
SELECT 'goods_receipts.status values' AS probe, status AS value, COUNT(*) AS cnt
FROM goods_receipts
GROUP BY status
ORDER BY cnt DESC;

SELECT 'purchase_approvals.documentType values' AS probe, documentType AS value, COUNT(*) AS cnt
FROM purchase_approvals
GROUP BY documentType
ORDER BY cnt DESC;

/* Does GRN status enum already include PENDING_TOLERANCE_APPROVAL? */
SELECT
  COLUMN_TYPE AS goods_receipts_status_enum,
  CASE
    WHEN COLUMN_TYPE LIKE '%PENDING_TOLERANCE_APPROVAL%' THEN 'OK'
    ELSE 'MISSING_ENUM_VALUE'
  END AS pending_tolerance_enum
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'goods_receipts'
  AND COLUMN_NAME = 'status';

SELECT
  COLUMN_TYPE AS purchase_approvals_documentType_enum,
  CASE
    WHEN COLUMN_TYPE LIKE '%GOODS_RECEIPT%' THEN 'OK'
    ELSE 'MISSING_ENUM_VALUE'
  END AS goods_receipt_doc_type
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'purchase_approvals'
  AND COLUMN_NAME = 'documentType';

/* ---------- Prisma migration bookkeeping ---------- */
SELECT
  need.migration_name,
  CASE WHEN m.migration_name IS NULL THEN 'NOT_RECORDED' ELSE 'RECORDED' END AS status,
  m.finished_at,
  LEFT(COALESCE(m.checksum, ''), 16) AS checksum_prefix
FROM (
  SELECT '20260727180000_purchase_multi_unit_uom' AS migration_name
  UNION ALL SELECT '20260728140000_grn_receiving_tolerance'
  UNION ALL SELECT '20260728180000_po_versioning'
) AS need
LEFT JOIN `_prisma_migrations` AS m
  ON m.migration_name = need.migration_name
ORDER BY need.migration_name;

/* ---------- Legal entity / finance readiness for tenant ---------- */
SELECT
  (SELECT COUNT(*) FROM legal_entities WHERE tenantId = @tenantId AND isActive = 1) AS active_legal_entities,
  (SELECT COUNT(*) FROM finance_settings WHERE tenantId = @tenantId) AS finance_settings_rows,
  (SELECT COUNT(*) FROM branches WHERE tenantId = @tenantId AND isActive = 1) AS active_branches,
  (SELECT COUNT(*) FROM financial_years WHERE tenantId = @tenantId AND isCurrent = 1) AS current_fy_rows;
