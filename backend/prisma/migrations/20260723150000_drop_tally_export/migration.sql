-- Remove Tally export Phase 1 (deferred — reintroduce when Tally integration ships).

DELETE FROM `finance_feature_controls` WHERE `featureKey` = 'TALLY_EXPORT';

ALTER TABLE `finance_feature_controls`
  MODIFY COLUMN `featureKey` ENUM(
    'RECEIVABLES',
    'PAYABLES',
    'BANK_RECONCILIATION',
    'GST',
    'TDS',
    'FIXED_ASSETS',
    'MANUFACTURING_ACCOUNTING',
    'INVENTORY_ACCOUNTING',
    'BUDGETING',
    'MULTI_CURRENCY',
    'COST_CENTRES',
    'PROJECT_ACCOUNTING',
    'APPROVALS'
  ) NOT NULL;

DROP TABLE IF EXISTS `tally_export_outbox`;
DROP TABLE IF EXISTS `tally_ledger_mappings`;
DROP TABLE IF EXISTS `tally_connector_configs`;
