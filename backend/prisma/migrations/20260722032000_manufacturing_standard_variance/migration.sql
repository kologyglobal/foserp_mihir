-- Manufacturing Wave 2: standard costing with component variances.
ALTER TABLE `manufacturing_costing_policies`
  MODIFY COLUMN `costingMethod`
  ENUM('ACTUAL', 'PLANNED_AS_PROVISIONAL', 'STANDARD_WITH_VARIANCE')
  NOT NULL DEFAULT 'PLANNED_AS_PROVISIONAL';
