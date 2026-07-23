-- Live fix: keep only ISO-TANK-26KL + ISO-DRY-BULK-25CBM, and CREATE either if missing.
-- Safe to re-run in phpMyAdmin. Existing quotations are untouched.

-- 1) Soft-delete every other template
UPDATE `crm_quotation_templates`
SET `deletedAt` = UTC_TIMESTAMP(3), `isActive` = 0, `updatedAt` = UTC_TIMESTAMP(3)
WHERE `deletedAt` IS NULL
  AND `code` NOT IN ('ISO-TANK-26KL', 'ISO-DRY-BULK-25CBM');

-- 2) Restore keep templates if previously soft-deleted / inactive
UPDATE `crm_quotation_templates`
SET `deletedAt` = NULL, `isActive` = 1, `updatedAt` = UTC_TIMESTAMP(3)
WHERE `code` IN ('ISO-TANK-26KL', 'ISO-DRY-BULK-25CBM')
  AND (`deletedAt` IS NOT NULL OR `isActive` = 0);

-- 3) Create ISO-TANK-26KL for tenants that never had it
INSERT INTO `crm_quotation_templates`
  (`id`, `tenantId`, `code`, `templateName`, `productFamily`, `version`, `sections`, `defaultTerms`, `defaultWarranty`, `defaultExclusions`, `printLayout`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), t.`id`, 'ISO-TANK-26KL', '76 — 26 KL ISO Tank Container Quotation', 'ISO Tank', 7,
  '[{"sectionType":"cover","title":"Quotation","content":"QUOTATION\\n\\nSub: Quotation for supply of 26 KL ISO Tank Container","sequenceNo":1,"editable":true,"contentFormat":"richtext"},{"sectionType":"customer_details","title":"Customer Details","content":"To,\\n{{customer_name}}\\n{{customer_address}}\\n\\nKind Attn: {{contact_person}}","sequenceNo":2,"editable":true,"contentFormat":"richtext"},{"sectionType":"introduction","title":"Introduction","content":"We thank you for your enquiry and are pleased to submit our offer for 26 KL ISO Tank Container.","sequenceNo":3,"editable":true,"contentFormat":"richtext"},{"sectionType":"scope","title":"Scope of Supply","content":"Supply of 26 KL ISO Tank Container as per agreed specifications.","sequenceNo":4,"editable":true,"contentFormat":"richtext"},{"sectionType":"specification","title":"Technical Specification","content":"As per attached / agreed technical data sheet.","sequenceNo":5,"editable":true,"contentFormat":"spec_table","specRows":[]},{"sectionType":"commercial","title":"Commercial Offer","content":"Pricing as per price table. GST extra as applicable.","sequenceNo":6,"editable":true,"contentFormat":"richtext"},{"sectionType":"price_table","title":"Price Table","content":"","sequenceNo":7,"editable":true},{"sectionType":"delivery","title":"Delivery Terms","content":"Ex works Chhapi, Banaskantha, North Gujarat unless otherwise agreed.","sequenceNo":8,"editable":true,"contentFormat":"richtext"},{"sectionType":"payment","title":"Payment Terms","content":"As per commercial offer / advance against order.","sequenceNo":9,"editable":true,"contentFormat":"richtext"},{"sectionType":"warranty","title":"Warranty","content":"12 months against defective material and workmanship. Bought-out items carry OEM warranty.","sequenceNo":10,"editable":true,"contentFormat":"richtext"},{"sectionType":"exclusions","title":"Exclusions","content":"Freight, insurance, and statutory registrations excluded unless specified.","sequenceNo":11,"editable":true,"contentFormat":"richtext"},{"sectionType":"terms","title":"Terms & Conditions","content":"Subject to Chhapi jurisdiction.","sequenceNo":12,"editable":true,"contentFormat":"richtext"},{"sectionType":"signature","title":"Signature Block","content":"Authorized signatory — Sales & Marketing","sequenceNo":13,"editable":true,"contentFormat":"richtext"}]',
  'Ex works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 60 days. Subject to Chhapi jurisdiction.',
  '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
  'Freight, insurance, extra connections/flanges, and statutory registrations excluded unless specified.',
  '{"pageSize":"A4","marginMm":18,"fontScale":1,"headerStyle":"minimal","showLogo":false,"showCompanyHeader":false,"showCustomerBlock":false,"showPageFooter":true,"showSignatureBlock":true,"pageBreakBefore":["price_table"],"printSkin":"vf_word"}',
  1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
FROM `tenants` t
WHERE t.`deletedAt` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `crm_quotation_templates` q
    WHERE q.`tenantId` = t.`id` AND q.`code` = 'ISO-TANK-26KL'
  );

-- 4) Create ISO-DRY-BULK-25CBM for tenants that never had it (this is why live showed only 1)
INSERT INTO `crm_quotation_templates`
  (`id`, `tenantId`, `code`, `templateName`, `productFamily`, `version`, `sections`, `defaultTerms`, `defaultWarranty`, `defaultExclusions`, `printLayout`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), t.`id`, 'ISO-DRY-BULK-25CBM', '109 — 25 m³ ISO Tank Container Quotation', 'ISO Dry Bulk', 4,
  '[{"sectionType":"cover","title":"Quotation","content":"QUOTATION\\n\\nSub: Quotation for supply of 25 m³ ISO Tank Container (20'' dry bulk / Model 25 CBM)","sequenceNo":1,"editable":true,"contentFormat":"richtext"},{"sectionType":"customer_details","title":"Customer Details","content":"To,\\n{{customer_name}}\\n{{customer_address}}\\n\\nKind Attn: {{contact_person}}","sequenceNo":2,"editable":true,"contentFormat":"richtext"},{"sectionType":"introduction","title":"Introduction","content":"We thank you for your enquiry and are pleased to submit our offer for 25 m³ ISO Tank Container.","sequenceNo":3,"editable":true,"contentFormat":"richtext"},{"sectionType":"scope","title":"Scope of Supply","content":"Supply of 25 m³ ISO Tank Container as per agreed specifications.","sequenceNo":4,"editable":true,"contentFormat":"richtext"},{"sectionType":"specification","title":"Technical Specification","content":"As per attached / agreed technical data sheet.","sequenceNo":5,"editable":true,"contentFormat":"spec_table","specRows":[]},{"sectionType":"commercial","title":"Commercial Offer","content":"Pricing as per price table. GST extra as applicable.","sequenceNo":6,"editable":true,"contentFormat":"richtext"},{"sectionType":"price_table","title":"Price Table","content":"","sequenceNo":7,"editable":true},{"sectionType":"delivery","title":"Delivery Terms","content":"Ex works Chhapi, Banaskantha, North Gujarat unless otherwise agreed.","sequenceNo":8,"editable":true,"contentFormat":"richtext"},{"sectionType":"payment","title":"Payment Terms","content":"As per commercial offer / advance against order.","sequenceNo":9,"editable":true,"contentFormat":"richtext"},{"sectionType":"warranty","title":"Warranty","content":"12 months against defective material and workmanship. Bought-out items carry OEM warranty.","sequenceNo":10,"editable":true,"contentFormat":"richtext"},{"sectionType":"exclusions","title":"Exclusions","content":"Freight, insurance, and statutory registrations excluded unless specified.","sequenceNo":11,"editable":true,"contentFormat":"richtext"},{"sectionType":"terms","title":"Terms & Conditions","content":"Subject to Chhapi jurisdiction.","sequenceNo":12,"editable":true,"contentFormat":"richtext"},{"sectionType":"signature","title":"Signature Block","content":"Authorized signatory — Sales & Marketing","sequenceNo":13,"editable":true,"contentFormat":"richtext"}]',
  'Ex works Chhapi, Banaskantha, North Gujarat. GST extra. Validity 20 days. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
  '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
  'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
  '{"pageSize":"A4","marginMm":18,"fontScale":1,"headerStyle":"minimal","showLogo":false,"showCompanyHeader":false,"showCustomerBlock":false,"showPageFooter":true,"showSignatureBlock":true,"pageBreakBefore":["price_table"],"printSkin":"vf_word"}',
  1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
FROM `tenants` t
WHERE t.`deletedAt` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `crm_quotation_templates` q
    WHERE q.`tenantId` = t.`id` AND q.`code` = 'ISO-DRY-BULK-25CBM'
  );

-- 5) Align names / print skin on existing keep rows
UPDATE `crm_quotation_templates`
SET
  `templateName` = '76 — 26 KL ISO Tank Container Quotation',
  `productFamily` = 'ISO Tank',
  `version` = 7,
  `isActive` = 1,
  `deletedAt` = NULL,
  `printLayout` = '{"pageSize":"A4","marginMm":18,"fontScale":1,"headerStyle":"minimal","showLogo":false,"showCompanyHeader":false,"showCustomerBlock":false,"showPageFooter":true,"showSignatureBlock":true,"pageBreakBefore":["price_table"],"printSkin":"vf_word"}',
  `updatedAt` = UTC_TIMESTAMP(3)
WHERE `code` = 'ISO-TANK-26KL';

UPDATE `crm_quotation_templates`
SET
  `templateName` = CONCAT('109 — 25 m', CHAR(0xC2, 0xB3), ' ISO Tank Container Quotation'),
  `productFamily` = 'ISO Dry Bulk',
  `version` = 4,
  `isActive` = 1,
  `deletedAt` = NULL,
  `printLayout` = '{"pageSize":"A4","marginMm":18,"fontScale":1,"headerStyle":"minimal","showLogo":false,"showCompanyHeader":false,"showCustomerBlock":false,"showPageFooter":true,"showSignatureBlock":true,"pageBreakBefore":["price_table"],"printSkin":"vf_word"}',
  `updatedAt` = UTC_TIMESTAMP(3)
WHERE `code` = 'ISO-DRY-BULK-25CBM';

-- Verify (expect 2 active rows):
SELECT `code`, `templateName`, `isActive`, `deletedAt` IS NOT NULL AS deleted, `version`
FROM `crm_quotation_templates`
WHERE `deletedAt` IS NULL
ORDER BY `code`;
