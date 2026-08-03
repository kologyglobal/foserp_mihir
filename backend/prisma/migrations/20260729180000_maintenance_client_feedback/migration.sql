-- Maintenance client feedback: operator name + location capture

ALTER TABLE `maintenance_tickets`
  ADD COLUMN `operatorName` VARCHAR(200) NULL,
  ADD COLUMN `reportedLatitude` DECIMAL(10, 7) NULL,
  ADD COLUMN `reportedLongitude` DECIMAL(10, 7) NULL,
  ADD COLUMN `reportedAccuracyM` DECIMAL(10, 2) NULL,
  ADD COLUMN `reportedLocationLabel` VARCHAR(300) NULL;
