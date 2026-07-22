import type { AccountCategory, AccountType, DefaultAccountMappingKey } from '@prisma/client'

export const MAX_ACCOUNT_DEPTH = 6
export const MAX_COST_CENTRE_DEPTH = 6

/** Mapping keys required before finance activation. */
export const MANDATORY_MAPPING_KEYS: DefaultAccountMappingKey[] = [
  'CUSTOMER_RECEIVABLE',
  'VENDOR_PAYABLE',
  'SALES_REVENUE',
  'PURCHASE',
  'GST_INPUT_CGST',
  'GST_INPUT_SGST',
  'GST_INPUT_IGST',
  'GST_OUTPUT_CGST',
  'GST_OUTPUT_SGST',
  'GST_OUTPUT_IGST',
  'RETAINED_EARNINGS',
]

/** All finance document types that need number series at activation. SALES_INVOICE is optional (AR numbering, not voucher posting). */
export const REQUIRED_NUMBER_SERIES_TYPES = [
  'JOURNAL',
  'RECEIPT',
  'PAYMENT',
  'CONTRA',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'OPENING_BALANCE',
  'REVERSAL',
] as const

/** Optional AR number series — not required for finance activation (Phase 3A1). CUSTOMER_RECEIPT added Phase 3B1. */
export const OPTIONAL_AR_NUMBER_SERIES_TYPES = ['SALES_INVOICE', 'CUSTOMER_RECEIPT'] as const

/** Expected account types per mapping key (posting accounts only). */
export const MAPPING_KEY_ACCOUNT_TYPES: Partial<Record<DefaultAccountMappingKey, AccountType[]>> = {
  CUSTOMER_RECEIVABLE: ['CUSTOMER_RECEIVABLE'],
  VENDOR_PAYABLE: ['VENDOR_PAYABLE'],
  SALES_REVENUE: ['SALES', 'OTHER_INCOME'],
  SALES_RETURN: ['SALES_RETURN'],
  PURCHASE: ['PURCHASE'],
  PURCHASE_RETURN: ['PURCHASE_RETURN'],
  RAW_MATERIAL_INVENTORY: ['RAW_MATERIAL_INVENTORY'],
  WIP_INVENTORY: ['WIP_INVENTORY'],
  FINISHED_GOODS_INVENTORY: ['FINISHED_GOODS_INVENTORY'],
  GST_INPUT_CGST: ['GST_INPUT'],
  GST_INPUT_SGST: ['GST_INPUT'],
  GST_INPUT_IGST: ['GST_INPUT'],
  GST_OUTPUT_CGST: ['GST_OUTPUT'],
  GST_OUTPUT_SGST: ['GST_OUTPUT'],
  GST_OUTPUT_IGST: ['GST_OUTPUT'],
  GST_OUTPUT_CESS: ['GST_OUTPUT'],
  TDS_RECEIVABLE: ['TDS_RECEIVABLE'],
  TDS_PAYABLE: ['TDS_PAYABLE'],
  RETAINED_EARNINGS: ['RETAINED_EARNINGS'],
  DEPRECIATION_EXPENSE: ['EXPENSE'],
  ACCUMULATED_DEPRECIATION: ['ACCUMULATED_DEPRECIATION'],
  FIXED_ASSET_CLEARING: ['CASH', 'BANK'],
}

/** Expected categories per mapping key when account type is GENERAL. */
export const MAPPING_KEY_CATEGORIES: Partial<Record<DefaultAccountMappingKey, AccountCategory[]>> = {
  SALES_REVENUE: ['INCOME'],
  SALES_RETURN: ['INCOME', 'EXPENSE'],
  PURCHASE: ['EXPENSE'],
  PURCHASE_RETURN: ['EXPENSE', 'INCOME'],
  STOCK_ADJUSTMENT: ['EXPENSE', 'ASSET'],
  MATERIAL_CONSUMPTION: ['EXPENSE'],
  PRODUCTION_VARIANCE: ['EXPENSE'],
  SCRAP_LOSS: ['EXPENSE'],
  SUBCONTRACTING_EXPENSE: ['EXPENSE'],
  FREIGHT_INWARD: ['EXPENSE'],
  FREIGHT_OUTWARD: ['EXPENSE'],
  BANK_CHARGES: ['EXPENSE'],
  ROUNDING: ['EXPENSE', 'INCOME'],
  DEPRECIATION_EXPENSE: ['EXPENSE'],
  ASSET_DISPOSAL_GAIN: ['INCOME'],
  ASSET_DISPOSAL_LOSS: ['EXPENSE'],
  FIXED_ASSET_CLEARING: ['ASSET', 'LIABILITY'],
}

export type CoaTemplateId = 'MANUFACTURING' | 'TRADING' | 'SERVICE' | 'JOB_WORK'

export const COA_TEMPLATE_LABELS: Record<CoaTemplateId, string> = {
  MANUFACTURING: 'Manufacturing Company',
  TRADING: 'Trading Company',
  SERVICE: 'Service Company',
  JOB_WORK: 'Manufacturing with Job Work',
}
