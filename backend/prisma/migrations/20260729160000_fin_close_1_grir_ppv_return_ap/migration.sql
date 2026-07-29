-- FIN-CLOSE-1 — accounting integration closure (decisions 1–4)
--   1. GRIR_CLEARING default account mapping (GRN counterpart, replaces PURCHASE proxy)
--   2. PURCHASE_PRICE_VARIANCE default account mapping (invoice vs receipt / standard)
--   3. Purchase Return -> Vendor Debit Note soft link + PURCHASE_RETURN source link type
--   4. No data change — GR/IR GL stays gated by the INVENTORY_ACCOUNTING feature flag
--
-- Forward-only. Historical inventory accounting events keep their original PURCHASE
-- counterpart; only new GRN events credit GRIR_CLEARING.

-- 1 + 2 — default account mapping keys
ALTER TABLE `default_account_mappings`
  MODIFY `mappingKey` ENUM(
    'CUSTOMER_RECEIVABLE',
    'VENDOR_PAYABLE',
    'SALES_REVENUE',
    'SALES_RETURN',
    'PURCHASE',
    'PURCHASE_RETURN',
    'RAW_MATERIAL_INVENTORY',
    'WIP_INVENTORY',
    'FINISHED_GOODS_INVENTORY',
    'STOCK_ADJUSTMENT',
    'MATERIAL_CONSUMPTION',
    'GRIR_CLEARING',
    'PURCHASE_PRICE_VARIANCE',
    'COST_OF_GOODS_SOLD',
    'LABOUR_ABSORPTION',
    'MACHINE_ABSORPTION',
    'JOB_WORK_ABSORPTION',
    'PRODUCTION_OVERHEAD_ABSORPTION',
    'PRODUCTION_VARIANCE',
    'SCRAP_INVENTORY',
    'SCRAP_LOSS',
    'SUBCONTRACTING_EXPENSE',
    'FREIGHT_INWARD',
    'FREIGHT_OUTWARD',
    'GST_INPUT_CGST',
    'GST_INPUT_SGST',
    'GST_INPUT_IGST',
    'GST_OUTPUT_CGST',
    'GST_OUTPUT_SGST',
    'GST_OUTPUT_IGST',
    'GST_OUTPUT_CESS',
    'TDS_RECEIVABLE',
    'TDS_PAYABLE',
    'BANK_CHARGES',
    'ROUNDING',
    'DEPRECIATION_EXPENSE',
    'ACCUMULATED_DEPRECIATION',
    'ASSET_DISPOSAL_GAIN',
    'ASSET_DISPOSAL_LOSS',
    'FIXED_ASSET_CLEARING',
    'ASSET_REVALUATION_SURPLUS',
    'ASSET_IMPAIRMENT_LOSS',
    'RETAINED_EARNINGS',
    'INTERNAL_TRANSFER_CLEARING',
    'CHEQUE_RECEIPT_CLEARING',
    'CHEQUE_PAYMENT_CLEARING',
    'BANK_INTEREST_INCOME',
    'BANK_INTEREST_EXPENSE',
    'COLLECTION_FEE_EXPENSE',
    'MERCHANT_FEE_EXPENSE'
  ) NOT NULL;

-- 3 — vendor adjustment source link type gains PURCHASE_RETURN
ALTER TABLE `vendor_adjustment_source_links`
  MODIFY `sourceType` ENUM(
    'VENDOR_INVOICE',
    'PURCHASE_ORDER',
    'GOODS_RECEIPT',
    'PURCHASE_RECEIPT',
    'PURCHASE_RETURN',
    'CONTRACT',
    'PROJECT',
    'OTHER'
  ) NOT NULL;

ALTER TABLE `vendor_adjustment_lines`
  MODIFY `sourceLinkType` ENUM(
    'VENDOR_INVOICE',
    'PURCHASE_ORDER',
    'GOODS_RECEIPT',
    'PURCHASE_RECEIPT',
    'PURCHASE_RETURN',
    'CONTRACT',
    'PROJECT',
    'OTHER'
  ) NULL;

-- 3 — Purchase Return soft link to the AP debit note
ALTER TABLE `purchase_returns`
  ADD COLUMN `vendorAdjustmentId` VARCHAR(36) NULL,
  ADD COLUMN `vendorAdjustmentDraftRef` VARCHAR(64) NULL;
