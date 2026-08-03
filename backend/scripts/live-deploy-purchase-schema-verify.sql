/* =========================================================
   PURCHASE schema verify — run after any PO P2022 fix
   Shows MISSING columns/tables Prisma expects for PurchaseOrder API.
   Safe read-only except you choose to run fix scripts after.
   ========================================================= */

-- USE `u233611619_foserp`;  /* Hostinger */
-- USE `fos_erp`;             /* local */

SET @db := DATABASE();
SELECT @db AS current_db, NOW() AS ran_at;

SELECT need.obj,
  CASE
    WHEN need.kind = 'table' THEN IF(t.TABLE_NAME IS NULL, 'MISSING', 'OK')
    ELSE IF(c.COLUMN_NAME IS NULL, 'MISSING', 'OK')
  END AS status
FROM (
  /* purchase_orders header */
  SELECT 'col' kind, 'purchase_orders' tbl, 'deliveryWarehouseId' col, 'purchase_orders.deliveryWarehouseId' obj
  UNION SELECT 'col','purchase_orders','revisionNo','purchase_orders.revisionNo'
  UNION SELECT 'col','purchase_orders','rejectedAt','purchase_orders.rejectedAt'
  UNION SELECT 'col','purchase_orders','rejectionReason','purchase_orders.rejectionReason'
  UNION SELECT 'col','purchase_orders','sentBackAt','purchase_orders.sentBackAt'
  UNION SELECT 'col','purchase_orders','sendBackReason','purchase_orders.sendBackReason'
  /* purchase_order_lines */
  UNION SELECT 'col','purchase_order_lines','uomQuantity','purchase_order_lines.uomQuantity'
  UNION SELECT 'col','purchase_order_lines','uomConversionFactor','purchase_order_lines.uomConversionFactor'
  UNION SELECT 'col','purchase_order_lines','unitCostPrimary','purchase_order_lines.unitCostPrimary'
  UNION SELECT 'col','purchase_order_lines','acceptedQuantity','purchase_order_lines.acceptedQuantity'
  UNION SELECT 'col','purchase_order_lines','rejectedQuantity','purchase_order_lines.rejectedQuantity'
  UNION SELECT 'col','purchase_order_lines','returnedQuantity','purchase_order_lines.returnedQuantity'
  UNION SELECT 'col','purchase_order_lines','invoicedQuantity','purchase_order_lines.invoicedQuantity'
  UNION SELECT 'col','purchase_order_lines','requisitionNumber','purchase_order_lines.requisitionNumber'
  UNION SELECT 'col','purchase_order_lines','gstGroupId','purchase_order_lines.gstGroupId'
  UNION SELECT 'col','purchase_order_lines','hsnId','purchase_order_lines.hsnId'
  UNION SELECT 'col','purchase_order_lines','hsnCodeSnapshot','purchase_order_lines.hsnCodeSnapshot'
  UNION SELECT 'col','purchase_order_lines','gstGroupCodeSnapshot','purchase_order_lines.gstGroupCodeSnapshot'
  UNION SELECT 'col','purchase_order_lines','binId','purchase_order_lines.binId'
  UNION SELECT 'col','purchase_order_lines','qcRequiredSnapshot','purchase_order_lines.qcRequiredSnapshot'
  UNION SELECT 'col','purchase_order_lines','qualityTestGroupCodeSnapshot','purchase_order_lines.qualityTestGroupCodeSnapshot'
  /* related tables */
  UNION SELECT 'table','purchase_order_revisions',NULL,'table:purchase_order_revisions'
  UNION SELECT 'table','purchase_order_archived',NULL,'table:purchase_order_archived'
  UNION SELECT 'table','purchase_line_archived',NULL,'table:purchase_line_archived'
  UNION SELECT 'table','master_bins',NULL,'table:master_bins'
) need
LEFT JOIN information_schema.TABLES t
  ON need.kind='table' AND t.TABLE_SCHEMA=@db AND t.TABLE_NAME=need.tbl
LEFT JOIN information_schema.COLUMNS c
  ON need.kind='col' AND c.TABLE_SCHEMA=@db AND c.TABLE_NAME=need.tbl AND c.COLUMN_NAME=need.col
ORDER BY status DESC, obj;

SELECT COUNT(*) AS missing_count
FROM (
  SELECT CASE
    WHEN need.kind = 'table' THEN IF(t.TABLE_NAME IS NULL, 1, 0)
    ELSE IF(c.COLUMN_NAME IS NULL, 1, 0)
  END AS miss
  FROM (
    SELECT 'col' kind, 'purchase_orders' tbl, 'revisionNo' col
    UNION SELECT 'col','purchase_order_lines','binId'
    UNION SELECT 'col','purchase_order_lines','gstGroupId'
    UNION SELECT 'col','purchase_order_lines','uomQuantity'
    UNION SELECT 'table','purchase_order_revisions',NULL
  ) need
  LEFT JOIN information_schema.TABLES t ON need.kind='table' AND t.TABLE_SCHEMA=@db AND t.TABLE_NAME=need.tbl
  LEFT JOIN information_schema.COLUMNS c ON need.kind='col' AND c.TABLE_SCHEMA=@db AND c.TABLE_NAME=need.tbl AND c.COLUMN_NAME=need.col
) x WHERE miss = 1;
