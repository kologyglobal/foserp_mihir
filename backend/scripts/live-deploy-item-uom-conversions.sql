/* LIVE DEPLOY — Item UOM Conversion mappings (20260804100000)
   Idempotent — safe to re-run on stage DB. */

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'item_uom_conversions' AS script;
SET @db := DATABASE();

SET @sql := (SELECT IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='master_item_uom_conversions'),
  'SELECT ''OK master_item_uom_conversions'' AS msg',
  'CREATE TABLE `master_item_uom_conversions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `uomId` VARCHAR(191) NOT NULL,
    `conversionFactor` DECIMAL(18, 4) NOT NULL DEFAULT 1,
    `isPurchaseAllowed` BOOLEAN NOT NULL DEFAULT true,
    `isDefaultPurchase` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `master_item_uom_conversions_tenantId_itemId_uomId_key`(`tenantId`, `itemId`, `uomId`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `master_item_uom_conversions` (
  `id`, `tenantId`, `itemId`, `uomId`, `conversionFactor`, `isPurchaseAllowed`, `isDefaultPurchase`, `createdAt`, `updatedAt`
)
SELECT UUID(), i.`tenantId`, i.`id`, i.`baseUomId`, 1, true,
  CASE WHEN i.`purchaseUomId` IS NULL OR i.`purchaseUomId` = i.`baseUomId` THEN true ELSE false END,
  NOW(3), NOW(3)
FROM `master_items` i
WHERE i.`deletedAt` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `master_item_uom_conversions` c
    WHERE c.`tenantId` = i.`tenantId` AND c.`itemId` = i.`id` AND c.`uomId` = i.`baseUomId`
  );

INSERT INTO `master_item_uom_conversions` (
  `id`, `tenantId`, `itemId`, `uomId`, `conversionFactor`, `isPurchaseAllowed`, `isDefaultPurchase`, `createdAt`, `updatedAt`
)
SELECT UUID(), i.`tenantId`, i.`id`, i.`purchaseUomId`,
  CASE WHEN i.`uomConversionFactor` IS NULL OR i.`uomConversionFactor` <= 0 THEN 1 ELSE i.`uomConversionFactor` END,
  true, true, NOW(3), NOW(3)
FROM `master_items` i
WHERE i.`deletedAt` IS NULL
  AND i.`purchaseUomId` IS NOT NULL
  AND i.`purchaseUomId` <> i.`baseUomId`
  AND NOT EXISTS (
    SELECT 1 FROM `master_item_uom_conversions` c
    WHERE c.`tenantId` = i.`tenantId` AND c.`itemId` = i.`id` AND c.`uomId` = i.`purchaseUomId`
  );

INSERT IGNORE INTO `_prisma_migrations`
(`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`)
VALUES (UUID(),'manual-live-repair',NOW(3),'20260804100000_item_uom_conversions',NULL,NULL,NOW(3),1);

SELECT COUNT(*) AS conversion_rows FROM `master_item_uom_conversions`;
