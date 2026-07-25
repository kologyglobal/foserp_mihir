-- IndiaMART Lead Integration — Phase 1–4 foundation
-- CRM Pull API v2: https://help.indiamart.com/knowledge-base/lms-crm-integration-v2/

-- AlterTable: CrmLead external source fields
ALTER TABLE `crm_leads`
  ADD COLUMN `externalSource` VARCHAR(64) NULL,
  ADD COLUMN `externalSourceId` VARCHAR(128) NULL,
  ADD COLUMN `externalSourceReference` VARCHAR(255) NULL,
  ADD COLUMN `sourceEnquiryDate` DATETIME(3) NULL,
  ADD COLUMN `integrationEnquiryId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `crm_leads_tenantId_externalSource_externalSourceId_key`
  ON `crm_leads`(`tenantId`, `externalSource`, `externalSourceId`);

CREATE INDEX `crm_leads_tenantId_externalSource_externalSourceId_idx`
  ON `crm_leads`(`tenantId`, `externalSource`, `externalSourceId`);

CREATE INDEX `crm_leads_tenantId_integrationEnquiryId_idx`
  ON `crm_leads`(`tenantId`, `integrationEnquiryId`);

-- Enums as MySQL ENUM columns via Prisma

CREATE TABLE `indiamart_connections` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NULL,
  `accountName` VARCHAR(200) NULL,
  `registeredMobileMasked` VARCHAR(32) NULL,
  `registeredEmailMasked` VARCHAR(255) NULL,
  `apiBaseUrl` VARCHAR(500) NOT NULL DEFAULT 'https://mapi.indiamart.com',
  `leadFetchEndpoint` VARCHAR(500) NOT NULL DEFAULT '/wservce/crm/crmListing/v2/',
  `authenticationType` ENUM('QUERY_PARAMETER', 'API_KEY_HEADER', 'BEARER_TOKEN', 'CUSTOM') NOT NULL DEFAULT 'QUERY_PARAMETER',
  `encryptedCredentials` TEXT NOT NULL,
  `configurationJson` JSON NULL,
  `status` ENUM('NOT_CONFIGURED', 'CONNECTED', 'CONNECTION_FAILED', 'DISABLED', 'EXPIRED') NOT NULL DEFAULT 'NOT_CONFIGURED',
  `syncEnabled` BOOLEAN NOT NULL DEFAULT false,
  `autoCreateLead` BOOLEAN NOT NULL DEFAULT true,
  `defaultLeadSourceId` VARCHAR(191) NULL,
  `defaultLeadOwnerId` VARCHAR(191) NULL,
  `defaultTerritoryId` VARCHAR(191) NULL,
  `defaultPriority` VARCHAR(32) NULL,
  `defaultIndustryId` VARCHAR(191) NULL,
  `duplicateBehaviour` ENUM('CREATE_NEW_LEAD', 'UPDATE_EXISTING_LEAD', 'CREATE_ACTIVITY_ON_EXISTING_LEAD', 'SEND_TO_REVIEW') NOT NULL DEFAULT 'CREATE_ACTIVITY_ON_EXISTING_LEAD',
  `assignmentMode` ENUM('DEFAULT_OWNER', 'ROUND_ROBIN', 'PRODUCT_BASED', 'TERRITORY_BASED', 'CITY_STATE_BASED', 'MANUAL') NOT NULL DEFAULT 'DEFAULT_OWNER',
  `syncIntervalMinutes` INTEGER NOT NULL DEFAULT 15,
  `initialLookbackDays` INTEGER NOT NULL DEFAULT 7,
  `maxRecordsPerRun` INTEGER NOT NULL DEFAULT 500,
  `lastSuccessfulSyncAt` DATETIME(3) NULL,
  `lastAttemptedSyncAt` DATETIME(3) NULL,
  `nextScheduledSyncAt` DATETIME(3) NULL,
  `lastCursor` VARCHAR(255) NULL,
  `lastExternalTimestamp` DATETIME(3) NULL,
  `syncLockUntil` DATETIME(3) NULL,
  `syncLockToken` VARCHAR(64) NULL,
  `createdById` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `indiamart_connections_tenantId_key`(`tenantId`),
  INDEX `indiamart_connections_tenantId_status_idx`(`tenantId`, `status`),
  INDEX `indiamart_connections_syncEnabled_nextScheduledSyncAt_idx`(`syncEnabled`, `nextScheduledSyncAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `indiamart_sync_runs` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `connectionId` VARCHAR(191) NOT NULL,
  `triggerType` ENUM('MANUAL', 'SCHEDULED', 'RETRY', 'INITIAL_IMPORT') NOT NULL,
  `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
  `requestedFrom` DATETIME(3) NULL,
  `requestedTo` DATETIME(3) NULL,
  `cursorBefore` VARCHAR(255) NULL,
  `cursorAfter` VARCHAR(255) NULL,
  `recordsFetched` INTEGER NOT NULL DEFAULT 0,
  `recordsInserted` INTEGER NOT NULL DEFAULT 0,
  `recordsUpdated` INTEGER NOT NULL DEFAULT 0,
  `recordsDuplicated` INTEGER NOT NULL DEFAULT 0,
  `leadsCreated` INTEGER NOT NULL DEFAULT 0,
  `leadsLinked` INTEGER NOT NULL DEFAULT 0,
  `recordsFailed` INTEGER NOT NULL DEFAULT 0,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `durationMs` INTEGER NULL,
  `errorCode` VARCHAR(64) NULL,
  `errorMessage` TEXT NULL,
  `errorDetails` JSON NULL,
  `triggeredById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `indiamart_sync_runs_tenantId_startedAt_idx`(`tenantId`, `startedAt`),
  INDEX `indiamart_sync_runs_connectionId_status_idx`(`connectionId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `indiamart_enquiries` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `connectionId` VARCHAR(191) NOT NULL,
  `externalEnquiryId` VARCHAR(128) NOT NULL,
  `externalUniqueKey` VARCHAR(255) NULL,
  `enquiryDate` DATETIME(3) NULL,
  `receivedAt` DATETIME(3) NULL,
  `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `buyerName` VARCHAR(300) NULL,
  `buyerCompanyName` VARCHAR(300) NULL,
  `buyerMobile` VARCHAR(40) NULL,
  `buyerAlternateMobile` VARCHAR(40) NULL,
  `buyerEmail` VARCHAR(255) NULL,
  `buyerAddress` TEXT NULL,
  `buyerCity` VARCHAR(120) NULL,
  `buyerState` VARCHAR(120) NULL,
  `buyerCountry` VARCHAR(120) NULL,
  `buyerPincode` VARCHAR(20) NULL,
  `subject` VARCHAR(500) NULL,
  `requirementText` TEXT NULL,
  `productName` VARCHAR(500) NULL,
  `productCategory` VARCHAR(255) NULL,
  `quantityText` VARCHAR(120) NULL,
  `quantityValue` DECIMAL(18, 6) NULL,
  `quantityUom` VARCHAR(32) NULL,
  `estimatedOrderValue` DECIMAL(18, 2) NULL,
  `sourceType` VARCHAR(64) NULL,
  `sourceUrl` VARCHAR(500) NULL,
  `senderIp` VARCHAR(64) NULL,
  `normalizedMobile` VARCHAR(32) NULL,
  `normalizedEmail` VARCHAR(255) NULL,
  `normalizedCompanyName` VARCHAR(300) NULL,
  `dedupeFingerprint` VARCHAR(255) NULL,
  `processingStatus` ENUM('NEW', 'NORMALIZED', 'VALIDATION_FAILED', 'READY', 'PROCESSED', 'IGNORED', 'FAILED') NOT NULL DEFAULT 'NEW',
  `matchStatus` ENUM('NOT_CHECKED', 'NO_MATCH', 'EXISTING_LEAD', 'EXISTING_COMPANY', 'EXISTING_CONTACT', 'POSSIBLE_DUPLICATE', 'EXACT_DUPLICATE') NOT NULL DEFAULT 'NOT_CHECKED',
  `importStatus` ENUM('NOT_IMPORTED', 'AUTO_IMPORTED', 'MANUALLY_IMPORTED', 'LINKED_TO_EXISTING', 'DUPLICATE_SKIPPED', 'IGNORED', 'IMPORT_FAILED') NOT NULL DEFAULT 'NOT_IMPORTED',
  `matchedLeadId` VARCHAR(191) NULL,
  `matchedCompanyId` VARCHAR(191) NULL,
  `matchedContactId` VARCHAR(191) NULL,
  `createdLeadId` VARCHAR(191) NULL,
  `assignedUserId` VARCHAR(191) NULL,
  `assignedAt` DATETIME(3) NULL,
  `duplicateOfEnquiryId` VARCHAR(191) NULL,
  `duplicateReason` VARCHAR(255) NULL,
  `validationErrors` JSON NULL,
  `matchDetails` JSON NULL,
  `rawPayload` JSON NOT NULL,
  `syncRunId` VARCHAR(191) NULL,
  `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processedAt` DATETIME(3) NULL,
  `importedAt` DATETIME(3) NULL,
  `ignoredAt` DATETIME(3) NULL,
  `ignoredById` VARCHAR(191) NULL,
  `ignoreReason` TEXT NULL,
  `firstContactedAt` DATETIME(3) NULL,
  `slaStatus` ENUM('WITHIN_SLA', 'DUE_SOON', 'OVERDUE', 'CONTACTED', 'CLOSED') NULL,
  `failureCode` VARCHAR(64) NULL,
  `failureMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `indiamart_enquiries_tenantId_externalEnquiryId_key`(`tenantId`, `externalEnquiryId`),
  INDEX `indiamart_enquiries_tenantId_processingStatus_enquiryDate_idx`(`tenantId`, `processingStatus`, `enquiryDate`),
  INDEX `indiamart_enquiries_tenantId_normalizedMobile_idx`(`tenantId`, `normalizedMobile`),
  INDEX `indiamart_enquiries_tenantId_normalizedEmail_idx`(`tenantId`, `normalizedEmail`),
  INDEX `indiamart_enquiries_tenantId_dedupeFingerprint_idx`(`tenantId`, `dedupeFingerprint`),
  INDEX `indiamart_enquiries_tenantId_createdLeadId_idx`(`tenantId`, `createdLeadId`),
  INDEX `indiamart_enquiries_tenantId_importStatus_idx`(`tenantId`, `importStatus`),
  INDEX `indiamart_enquiries_tenantId_matchStatus_idx`(`tenantId`, `matchStatus`),
  INDEX `indiamart_enquiries_tenantId_assignedUserId_idx`(`tenantId`, `assignedUserId`),
  INDEX `indiamart_enquiries_connectionId_fetchedAt_idx`(`connectionId`, `fetchedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `indiamart_product_mappings` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `externalProductKey` VARCHAR(255) NULL,
  `externalProductName` VARCHAR(500) NOT NULL,
  `normalizedProductName` VARCHAR(500) NOT NULL,
  `itemId` VARCHAR(191) NULL,
  `itemCategoryId` VARCHAR(191) NULL,
  `mappingStatus` ENUM('UNMAPPED', 'SUGGESTED', 'MAPPED', 'IGNORED') NOT NULL DEFAULT 'UNMAPPED',
  `confidenceScore` DECIMAL(5, 2) NULL,
  `createdById` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `indiamart_product_mappings_tenantId_normalizedProductName_key`(`tenantId`, `normalizedProductName`),
  INDEX `indiamart_product_mappings_tenantId_mappingStatus_idx`(`tenantId`, `mappingStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `indiamart_connections`
  ADD CONSTRAINT `indiamart_connections_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `indiamart_sync_runs`
  ADD CONSTRAINT `indiamart_sync_runs_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `indiamart_sync_runs`
  ADD CONSTRAINT `indiamart_sync_runs_connectionId_fkey`
  FOREIGN KEY (`connectionId`) REFERENCES `indiamart_connections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `indiamart_enquiries`
  ADD CONSTRAINT `indiamart_enquiries_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `indiamart_enquiries`
  ADD CONSTRAINT `indiamart_enquiries_connectionId_fkey`
  FOREIGN KEY (`connectionId`) REFERENCES `indiamart_connections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `indiamart_enquiries`
  ADD CONSTRAINT `indiamart_enquiries_syncRunId_fkey`
  FOREIGN KEY (`syncRunId`) REFERENCES `indiamart_sync_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `indiamart_enquiries`
  ADD CONSTRAINT `indiamart_enquiries_createdLeadId_fkey`
  FOREIGN KEY (`createdLeadId`) REFERENCES `crm_leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `indiamart_enquiries`
  ADD CONSTRAINT `indiamart_enquiries_matchedLeadId_fkey`
  FOREIGN KEY (`matchedLeadId`) REFERENCES `crm_leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `indiamart_product_mappings`
  ADD CONSTRAINT `indiamart_product_mappings_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
