/* =========================================================
   LIVE DEPLOY — Part D verify
   File: live-deploy-purchase-20260728-verify.sql
   Order: 7th (last). READ-ONLY smoke report.
   Expect: all schema rows OK + LE/finance ready for tenant.
   ========================================================= */

USE `u233611619_fos_erp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'verify' AS script;

SET @db := DATABASE();
SET @tenantSlug := 'vasant-trailers';
SET @tenantId := (
  SELECT id FROM tenants
  WHERE slug = @tenantSlug AND deletedAt IS NULL
  LIMIT 1
);

/* Schema checklist — all should be OK */
SELECT
  need.obj AS object_name,
  CASE
    WHEN need.kind = 'table' THEN
      CASE WHEN t.TABLE_NAME IS NULL THEN 'MISSING' ELSE 'OK' END
    WHEN need.kind = 'enum' THEN
      CASE WHEN c.COLUMN_TYPE LIKE CONCAT('%', need.col, '%') THEN 'OK' ELSE 'MISSING' END
    ELSE
      CASE WHEN c.COLUMN_NAME IS NULL THEN 'MISSING' ELSE 'OK' END
  END AS status
FROM (
  SELECT 'col' AS kind, 'master_items' AS tbl, 'uomConversionFactor' AS col, 'master_items.uomConversionFactor' AS obj
  UNION ALL SELECT 'col', 'master_items', 'receivingTolerancePercentage', 'master_items.receivingTolerancePercentage'
  UNION ALL SELECT 'col', 'purchase_order_lines', 'uomQuantity', 'purchase_order_lines.uomQuantity'
  UNION ALL SELECT 'col', 'purchase_order_lines', 'uomConversionFactor', 'purchase_order_lines.uomConversionFactor'
  UNION ALL SELECT 'col', 'purchase_order_lines', 'unitCostPrimary', 'purchase_order_lines.unitCostPrimary'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'receivedUomQuantity', 'goods_receipt_lines.receivedUomQuantity'
  UNION ALL SELECT 'col', 'goods_receipt_lines', 'toleranceStatus', 'goods_receipt_lines.toleranceStatus'
  UNION ALL SELECT 'col', 'goods_receipts', 'toleranceApprovalRequired', 'goods_receipts.toleranceApprovalRequired'
  UNION ALL SELECT 'col', 'purchase_orders', 'revisionNo', 'purchase_orders.revisionNo'
  UNION ALL SELECT 'col', 'purchase_settings', 'requireApprovalOnPoRevision', 'purchase_settings.requireApprovalOnPoRevision'
  UNION ALL SELECT 'table', 'purchase_order_revisions', NULL, 'table:purchase_order_revisions'
  UNION ALL SELECT 'enum', 'goods_receipts', 'PENDING_TOLERANCE_APPROVAL', 'enum:goods_receipts.status.PENDING_TOLERANCE_APPROVAL'
  UNION ALL SELECT 'enum', 'purchase_approvals', 'GOODS_RECEIPT', 'enum:purchase_approvals.documentType.GOODS_RECEIPT'
) AS need
LEFT JOIN information_schema.TABLES AS t
  ON need.kind = 'table'
 AND t.TABLE_SCHEMA = @db
 AND t.TABLE_NAME = need.tbl
LEFT JOIN information_schema.COLUMNS AS c
  ON need.kind IN ('col', 'enum')
 AND c.TABLE_SCHEMA = @db
 AND c.TABLE_NAME = need.tbl
 AND (
   (need.kind = 'col' AND c.COLUMN_NAME = need.col)
   OR (need.kind = 'enum' AND c.COLUMN_NAME = CASE need.tbl
        WHEN 'goods_receipts' THEN 'status'
        WHEN 'purchase_approvals' THEN 'documentType'
        ELSE need.col
      END)
 )
ORDER BY status DESC, object_name;

/* Prisma migrations recorded */
SELECT
  need.migration_name,
  CASE WHEN m.migration_name IS NULL THEN 'NOT_RECORDED' ELSE 'RECORDED' END AS status
FROM (
  SELECT '20260727180000_purchase_multi_unit_uom' AS migration_name
  UNION ALL SELECT '20260728140000_grn_receiving_tolerance'
  UNION ALL SELECT '20260728180000_po_versioning'
) AS need
LEFT JOIN `_prisma_migrations` AS m ON m.migration_name = need.migration_name
ORDER BY need.migration_name;

/* Tenant LE / finance readiness */
SELECT
  @tenantSlug AS tenant_slug,
  @tenantId AS tenant_id,
  le.id AS legal_entity_id,
  le.code AS le_code,
  le.displayName AS le_name,
  le.gstin,
  le.isDefault,
  le.isActive,
  fs.financeActivated,
  fy.name AS current_fy,
  (SELECT COUNT(*) FROM branches b WHERE b.legalEntityId = le.id AND b.isActive = 1) AS active_branches,
  (SELECT COUNT(*) FROM accounting_periods p WHERE p.legalEntityId = le.id AND p.status = 'OPEN') AS open_periods
FROM legal_entities le
LEFT JOIN finance_settings fs ON fs.legalEntityId = le.id
LEFT JOIN financial_years fy ON fy.legalEntityId = le.id AND fy.isCurrent = 1
WHERE le.tenantId = @tenantId
ORDER BY le.isDefault DESC, le.createdAt ASC;

/* Rollup: missing schema objects count (0 = ready) */
SELECT
  SUM(CASE WHEN status = 'MISSING' THEN 1 ELSE 0 END) AS missing_schema_objects
FROM (
  SELECT
    CASE
      WHEN need.kind = 'table' THEN
        CASE WHEN t.TABLE_NAME IS NULL THEN 'MISSING' ELSE 'OK' END
      WHEN need.kind = 'enum' THEN
        CASE WHEN c.COLUMN_TYPE LIKE CONCAT('%', need.col, '%') THEN 'OK' ELSE 'MISSING' END
      ELSE
        CASE WHEN c.COLUMN_NAME IS NULL THEN 'MISSING' ELSE 'OK' END
    END AS status
  FROM (
    SELECT 'col' AS kind, 'master_items' AS tbl, 'uomConversionFactor' AS col
    UNION ALL SELECT 'col', 'master_items', 'receivingTolerancePercentage'
    UNION ALL SELECT 'col', 'purchase_orders', 'revisionNo'
    UNION ALL SELECT 'col', 'purchase_settings', 'requireApprovalOnPoRevision'
    UNION ALL SELECT 'col', 'goods_receipt_lines', 'toleranceStatus'
    UNION ALL SELECT 'table', 'purchase_order_revisions', NULL
    UNION ALL SELECT 'enum', 'goods_receipts', 'PENDING_TOLERANCE_APPROVAL'
    UNION ALL SELECT 'enum', 'purchase_approvals', 'GOODS_RECEIPT'
  ) AS need
  LEFT JOIN information_schema.TABLES AS t
    ON need.kind = 'table' AND t.TABLE_SCHEMA = @db AND t.TABLE_NAME = need.tbl
  LEFT JOIN information_schema.COLUMNS AS c
    ON need.kind IN ('col', 'enum')
   AND c.TABLE_SCHEMA = @db
   AND c.TABLE_NAME = need.tbl
   AND (
     (need.kind = 'col' AND c.COLUMN_NAME = need.col)
     OR (need.kind = 'enum' AND c.COLUMN_NAME = CASE need.tbl
          WHEN 'goods_receipts' THEN 'status'
          WHEN 'purchase_approvals' THEN 'documentType'
          ELSE need.col
        END)
   )
) AS checklist;
