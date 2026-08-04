-- Item UOM Conversion mappings (multi purchase UOM per item)

CREATE TABLE `master_item_uom_conversions` (
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
  UNIQUE INDEX `master_item_uom_conversions_tenantId_itemId_uomId_key`(`tenantId`, `itemId`, `uomId`),
  INDEX `master_item_uom_conversions_tenantId_idx`(`tenantId`),
  INDEX `master_item_uom_conversions_tenantId_itemId_idx`(`tenantId`, `itemId`),
  INDEX `master_item_uom_conversions_tenantId_uomId_idx`(`tenantId`, `uomId`),
  CONSTRAINT `master_item_uom_conversions_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `master_item_uom_conversions_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `master_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `master_item_uom_conversions_uomId_fkey`
    FOREIGN KEY (`uomId`) REFERENCES `master_uoms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: base UOM row (factor 1) for every item
INSERT INTO `master_item_uom_conversions` (
  `id`, `tenantId`, `itemId`, `uomId`, `conversionFactor`, `isPurchaseAllowed`, `isDefaultPurchase`, `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  i.`tenantId`,
  i.`id`,
  i.`baseUomId`,
  1,
  true,
  CASE
    WHEN i.`purchaseUomId` IS NULL OR i.`purchaseUomId` = i.`baseUomId` THEN true
    ELSE false
  END,
  NOW(3),
  NOW(3)
FROM `master_items` i
WHERE i.`deletedAt` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `master_item_uom_conversions` c
    WHERE c.`tenantId` = i.`tenantId` AND c.`itemId` = i.`id` AND c.`uomId` = i.`baseUomId`
  );

-- Backfill: legacy purchase UOM when different from base
INSERT INTO `master_item_uom_conversions` (
  `id`, `tenantId`, `itemId`, `uomId`, `conversionFactor`, `isPurchaseAllowed`, `isDefaultPurchase`, `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  i.`tenantId`,
  i.`id`,
  i.`purchaseUomId`,
  CASE
    WHEN i.`uomConversionFactor` IS NULL OR i.`uomConversionFactor` <= 0 THEN 1
    ELSE i.`uomConversionFactor`
  END,
  true,
  true,
  NOW(3),
  NOW(3)
FROM `master_items` i
WHERE i.`deletedAt` IS NULL
  AND i.`purchaseUomId` IS NOT NULL
  AND i.`purchaseUomId` <> i.`baseUomId`
  AND NOT EXISTS (
    SELECT 1 FROM `master_item_uom_conversions` c
    WHERE c.`tenantId` = i.`tenantId` AND c.`itemId` = i.`id` AND c.`uomId` = i.`purchaseUomId`
  );

-- Ensure exactly one default purchase mapping per item
UPDATE `master_item_uom_conversions` c
INNER JOIN (
  SELECT `tenantId`, `itemId`, MIN(`id`) AS pickId
  FROM `master_item_uom_conversions`
  WHERE `isDefaultPurchase` = true AND `isPurchaseAllowed` = true
  GROUP BY `tenantId`, `itemId`
  HAVING COUNT(*) > 1
) d ON c.`tenantId` = d.`tenantId` AND c.`itemId` = d.`itemId` AND c.`id` <> d.pickId
SET c.`isDefaultPurchase` = false;

UPDATE `master_item_uom_conversions` c
INNER JOIN `master_items` i ON i.`id` = c.`itemId` AND i.`tenantId` = c.`tenantId`
SET c.`isDefaultPurchase` = true
WHERE c.`isPurchaseAllowed` = true
  AND NOT EXISTS (
    SELECT 1 FROM `master_item_uom_conversions` x
    WHERE x.`tenantId` = c.`tenantId` AND x.`itemId` = c.`itemId` AND x.`isDefaultPurchase` = true
  )
  AND (
    (i.`purchaseUomId` IS NOT NULL AND c.`uomId` = i.`purchaseUomId`)
    OR (i.`purchaseUomId` IS NULL AND c.`uomId` = i.`baseUomId`)
  );
