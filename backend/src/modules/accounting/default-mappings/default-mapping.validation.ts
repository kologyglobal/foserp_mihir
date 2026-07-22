import { z } from 'zod'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const defaultMappingsQuerySchema = legalEntityIdQuerySchema

const mappingItemSchema = z.object({
  mappingKey: z.enum([
    'CUSTOMER_RECEIVABLE', 'VENDOR_PAYABLE', 'SALES_REVENUE', 'SALES_RETURN', 'PURCHASE', 'PURCHASE_RETURN',
    'RAW_MATERIAL_INVENTORY', 'WIP_INVENTORY', 'FINISHED_GOODS_INVENTORY', 'STOCK_ADJUSTMENT', 'MATERIAL_CONSUMPTION',
    'PRODUCTION_VARIANCE', 'SCRAP_INVENTORY', 'SCRAP_LOSS', 'SUBCONTRACTING_EXPENSE', 'FREIGHT_INWARD', 'FREIGHT_OUTWARD',
    'GST_INPUT_CGST', 'GST_INPUT_SGST', 'GST_INPUT_IGST', 'GST_OUTPUT_CGST', 'GST_OUTPUT_SGST', 'GST_OUTPUT_IGST', 'GST_OUTPUT_CESS',
    'TDS_RECEIVABLE', 'TDS_PAYABLE', 'BANK_CHARGES', 'ROUNDING', 'DEPRECIATION_EXPENSE', 'ACCUMULATED_DEPRECIATION',
    'ASSET_DISPOSAL_GAIN', 'ASSET_DISPOSAL_LOSS', 'FIXED_ASSET_CLEARING', 'RETAINED_EARNINGS', 'INTERNAL_TRANSFER_CLEARING',
    'CHEQUE_RECEIPT_CLEARING', 'CHEQUE_PAYMENT_CLEARING',
    'BANK_INTEREST_INCOME', 'BANK_INTEREST_EXPENSE', 'COLLECTION_FEE_EXPENSE', 'MERCHANT_FEE_EXPENSE',
  ]),
  accountId: z.string().uuid(),
  isMandatory: z.boolean().optional(),
  description: z.string().trim().max(500).optional(),
})

export const upsertDefaultMappingsSchema = z.object({
  legalEntityId: z.string().uuid(),
  mappings: z.array(mappingItemSchema).min(1),
})

export type DefaultMappingsQuery = z.infer<typeof defaultMappingsQuerySchema>
export type UpsertDefaultMappingsInput = z.infer<typeof upsertDefaultMappingsSchema>
