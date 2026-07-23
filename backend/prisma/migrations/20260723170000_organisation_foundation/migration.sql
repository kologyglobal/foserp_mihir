-- Organisation foundation: tradeName on legal entities + organisation_registrations

-- tradeName may already exist if a prior attempt applied query 1 then failed on the unique index name.
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'legal_entities'
    AND COLUMN_NAME = 'tradeName'
);
SET @sqlstmt := IF(
  @exist = 0,
  'ALTER TABLE `legal_entities` ADD COLUMN `tradeName` VARCHAR(300) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `organisation_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `legalEntityId` VARCHAR(191) NOT NULL,
    `registrationType` ENUM('GST', 'PAN', 'CIN', 'OTHER') NOT NULL,
    `registrationNumber` VARCHAR(64) NOT NULL,
    `country` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NULL,
    `validFrom` DATE NULL,
    `validTo` DATE NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `org_reg_tenant_type_number_key`(`tenantId`, `registrationType`, `registrationNumber`),
    INDEX `organisation_registrations_tenantId_idx`(`tenantId`),
    INDEX `organisation_registrations_legalEntityId_idx`(`legalEntityId`),
    INDEX `organisation_registrations_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FK constraints (safe if table was just created empty)
SET @fk1 := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organisation_registrations'
    AND CONSTRAINT_NAME = 'organisation_registrations_tenantId_fkey'
);
SET @sqlfk1 := IF(
  @fk1 = 0,
  'ALTER TABLE `organisation_registrations` ADD CONSTRAINT `organisation_registrations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmtfk1 FROM @sqlfk1;
EXECUTE stmtfk1;
DEALLOCATE PREPARE stmtfk1;

SET @fk2 := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organisation_registrations'
    AND CONSTRAINT_NAME = 'organisation_registrations_legalEntityId_fkey'
);
SET @sqlfk2 := IF(
  @fk2 = 0,
  'ALTER TABLE `organisation_registrations` ADD CONSTRAINT `organisation_registrations_legalEntityId_fkey` FOREIGN KEY (`legalEntityId`) REFERENCES `legal_entities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmtfk2 FROM @sqlfk2;
EXECUTE stmtfk2;
DEALLOCATE PREPARE stmtfk2;
