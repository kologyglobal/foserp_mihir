-- AlterEnum: extend CodeSeriesEntity for purchase requisition + planning numbers
ALTER TABLE `code_series` MODIFY `entityType` ENUM(
  'USER',
  'LEAD',
  'CONTACT',
  'CRM_COMPANY',
  'OPPORTUNITY',
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_REQUISITION',
  'PURCHASE_PLANNING'
) NOT NULL;
