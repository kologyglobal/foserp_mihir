-- GST rate sales/purchase applicability for tax master → finance engine resolution.
ALTER TABLE `master_gst_rates`
  ADD COLUMN `applicableFor` ENUM('SALES', 'PURCHASE', 'BOTH') NOT NULL DEFAULT 'BOTH' AFTER `igst`;

CREATE INDEX `master_gst_rates_resolve_idx`
  ON `master_gst_rates` (`tenantId`, `gstGroupId`, `applicableFor`, `dateFrom`);
