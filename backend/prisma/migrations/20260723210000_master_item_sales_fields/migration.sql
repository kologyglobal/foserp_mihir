-- CRM Item Phase 2 — MasterItem sales commercial fields (Product → Item migration foundation).
-- Forward-only, idempotent column adds. Does not drop master_products.

SET @db := DATABASE();

-- Fulfilment method enum (MySQL); Prisma maps to ItemSalesFulfilmentMethod
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='defaultFulfilmentMethod'
    ),
    'SELECT 1',
    "ALTER TABLE `master_items` ADD COLUMN `defaultFulfilmentMethod` ENUM('STOCK','PURCHASE','PRODUCTION','SUBCONTRACT','SERVICE','MANUAL') NOT NULL DEFAULT 'MANUAL'"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='salesDescription'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `salesDescription` TEXT NULL'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='salesUomId'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `salesUomId` VARCHAR(191) NULL'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='defaultSalesRate'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `defaultSalesRate` DECIMAL(18,2) NOT NULL DEFAULT 0'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='salesLeadDays'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `salesLeadDays` INT NOT NULL DEFAULT 0'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='salesAllowed'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `salesAllowed` BOOLEAN NOT NULL DEFAULT false'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND COLUMN_NAME='productionAllowed'), 'SELECT 1', 'ALTER TABLE `master_items` ADD COLUMN `productionAllowed` BOOLEAN NOT NULL DEFAULT false'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND INDEX_NAME='master_items_tenantId_salesAllowed_idx'), 'SELECT 1', 'ALTER TABLE `master_items` ADD INDEX `master_items_tenantId_salesAllowed_idx` (`tenantId`, `salesAllowed`)'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_items' AND CONSTRAINT_NAME='master_items_salesUomId_fkey'), 'SELECT 1', 'ALTER TABLE `master_items` ADD CONSTRAINT `master_items_salesUomId_fkey` FOREIGN KEY (`salesUomId`) REFERENCES `master_uoms` (`id`) ON DELETE SET NULL ON UPDATE CASCADE'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill salesAllowed / fulfilment / production by itemType (pilot defaults)
UPDATE `master_items`
SET
  `salesAllowed` = CASE
    WHEN `itemType` IN ('finished_good', 'service', 'bought_out') THEN true
    ELSE false
  END,
  `defaultFulfilmentMethod` = CASE
    WHEN `itemType` = 'finished_good' THEN 'PRODUCTION'
    WHEN `itemType` = 'sub_assembly' THEN 'PRODUCTION'
    WHEN `itemType` = 'bought_out' THEN 'PURCHASE'
    WHEN `itemType` = 'service' THEN 'SERVICE'
    WHEN `itemType` IN ('raw', 'consumable') THEN 'PURCHASE'
    ELSE 'MANUAL'
  END,
  `productionAllowed` = CASE
    WHEN `itemType` IN ('finished_good', 'sub_assembly') THEN true
    ELSE false
  END
WHERE `deletedAt` IS NULL;

-- Copy interim sales price / lead days from linked Product Master (when present)
UPDATE `master_items` i
INNER JOIN `master_products` p
  ON p.`tenantId` = i.`tenantId`
 AND p.`fgItemId` = i.`id`
 AND p.`deletedAt` IS NULL
SET
  i.`defaultSalesRate` = CASE
    WHEN i.`defaultSalesRate` = 0 AND p.`standardPrice` > 0 THEN p.`standardPrice`
    ELSE i.`defaultSalesRate`
  END,
  i.`salesLeadDays` = CASE
    WHEN i.`salesLeadDays` = 0 AND p.`standardLeadDays` > 0 THEN p.`standardLeadDays`
    ELSE i.`salesLeadDays`
  END,
  i.`salesDescription` = CASE
    WHEN (i.`salesDescription` IS NULL OR i.`salesDescription` = '') AND p.`specifications` <> '' THEN p.`specifications`
    ELSE i.`salesDescription`
  END;
