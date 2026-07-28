-- AlterTable: SERVICES packaging profile (do not branch on tenant slug in app code)
ALTER TABLE `tenants` ADD COLUMN `businessType` ENUM('MANUFACTURING', 'SERVICES') NOT NULL DEFAULT 'MANUFACTURING';

ALTER TABLE `tenants` ADD COLUMN `displayTerminology` JSON NOT NULL DEFAULT (JSON_OBJECT());
