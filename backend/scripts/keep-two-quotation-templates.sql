UPDATE crm_quotation_templates
SET deletedAt = UTC_TIMESTAMP(3), isActive = 0, updatedAt = UTC_TIMESTAMP(3)
WHERE deletedAt IS NULL
  AND code NOT IN ('ISO-TANK-26KL', 'ISO-DRY-BULK-25CBM');

UPDATE crm_quotation_templates
SET
  templateName = '26 KL ISO Tank Container Quotation',
  productFamily = 'ISO Tank',
  version = 6,
  isActive = 1,
  deletedAt = NULL,
  printLayout = '{"pageSize":"A4","marginMm":18,"fontScale":1,"headerStyle":"minimal","showLogo":false,"showCompanyHeader":false,"showCustomerBlock":false,"showPageFooter":true,"showSignatureBlock":true,"pageBreakBefore":["price_table"],"printSkin":"vf_word"}',
  updatedAt = UTC_TIMESTAMP(3)
WHERE code = 'ISO-TANK-26KL';

UPDATE crm_quotation_templates
SET
  templateName = CONCAT('25 m', CHAR(0xC2, 0xB3), ' ISO Tank Container Quotation'),
  productFamily = 'ISO Dry Bulk',
  version = 3,
  isActive = 1,
  deletedAt = NULL,
  printLayout = '{"pageSize":"A4","marginMm":18,"fontScale":1,"headerStyle":"minimal","showLogo":false,"showCompanyHeader":false,"showCustomerBlock":false,"showPageFooter":true,"showSignatureBlock":true,"pageBreakBefore":["price_table"],"printSkin":"vf_word"}',
  updatedAt = UTC_TIMESTAMP(3)
WHERE code = 'ISO-DRY-BULK-25CBM';

SELECT code, templateName, isActive, deletedAt IS NOT NULL AS deleted,
       JSON_UNQUOTE(JSON_EXTRACT(printLayout, '$.printSkin')) AS skin
FROM crm_quotation_templates
WHERE deletedAt IS NULL;
