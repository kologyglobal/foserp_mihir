import type { LegalEntity } from '@prisma/client'
import type { DefaultAccountMappingKey } from '@prisma/client'

/** Product-facing transaction type → DefaultAccountMappingKey */
export const ORG_TRANSACTION_TO_MAPPING: Record<string, DefaultAccountMappingKey> = {
  RAW_MATERIAL_PURCHASE: 'RAW_MATERIAL_INVENTORY',
  WIP_RECEIPT: 'WIP_INVENTORY',
  FG_RECEIPT: 'FINISHED_GOODS_INVENTORY',
  MATERIAL_CONSUMPTION: 'MATERIAL_CONSUMPTION',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  PURCHASE_INVOICE: 'VENDOR_PAYABLE',
  INPUT_GST: 'GST_INPUT_IGST',
  VENDOR_PAYMENT: 'FIXED_ASSET_CLEARING', // bank-like clearing placeholder; UI maps Bank when present
  CUSTOMER_INVOICE: 'CUSTOMER_RECEIVABLE',
  SALES_REVENUE: 'SALES_REVENUE',
  OUTPUT_GST: 'GST_OUTPUT_IGST',
  CUSTOMER_PAYMENT: 'FIXED_ASSET_CLEARING',
  CUSTOMER_RECEIVABLE: 'CUSTOMER_RECEIVABLE',
  VENDOR_PAYABLE: 'VENDOR_PAYABLE',
  PURCHASE: 'PURCHASE',
  GST_INPUT_CGST: 'GST_INPUT_CGST',
  GST_INPUT_SGST: 'GST_INPUT_SGST',
  GST_INPUT_IGST: 'GST_INPUT_IGST',
  GST_OUTPUT_CGST: 'GST_OUTPUT_CGST',
  GST_OUTPUT_SGST: 'GST_OUTPUT_SGST',
  GST_OUTPUT_IGST: 'GST_OUTPUT_IGST',
  RETAINED_EARNINGS: 'RETAINED_EARNINGS',
  RAW_MATERIAL_INVENTORY: 'RAW_MATERIAL_INVENTORY',
  WIP_INVENTORY: 'WIP_INVENTORY',
  FINISHED_GOODS_INVENTORY: 'FINISHED_GOODS_INVENTORY',
}

export type OrgAddress = {
  line1: string
  line2?: string
  district?: string
  city: string
  state: string
  postalCode: string
  country: string
}

export type OrgLegalEntityDto = {
  id: string
  tenantId: string
  code: string
  legalName: string
  tradeName: string
  businessType: string
  gstNumber: string | null
  pan: string | null
  country: string
  state: string
  district: string | null
  city: string
  postalCode: string
  addressLine: string
  status: 'ACTIVE' | 'INACTIVE'
  isDefault: boolean
  fiscalYearStartMonth: number
  createdAt: Date
  updatedAt: Date
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function parseAddressJson(value: unknown): OrgAddress | null {
  const r = asRecord(value)
  const line1 = typeof r.line1 === 'string' ? r.line1 : typeof r.addressLine === 'string' ? r.addressLine : ''
  const city = typeof r.city === 'string' ? r.city : ''
  const state = typeof r.state === 'string' ? r.state : ''
  const postalCode = typeof r.postalCode === 'string' ? r.postalCode : ''
  const country = typeof r.country === 'string' ? r.country : ''
  if (!line1 && !city) return null
  return {
    line1,
    line2: typeof r.line2 === 'string' ? r.line2 : undefined,
    district: typeof r.district === 'string' ? r.district : undefined,
    city,
    state,
    postalCode,
    country,
  }
}

export function toOrgLegalEntityDto(entity: LegalEntity): OrgLegalEntityDto {
  const addr = parseAddressJson(entity.registeredAddressJson)
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    code: entity.code,
    legalName: entity.legalName,
    tradeName: entity.tradeName?.trim() || entity.displayName,
    businessType: entity.entityType,
    gstNumber: entity.gstin,
    pan: entity.pan,
    country: addr?.country || (entity.countryCode === 'IN' ? 'India' : entity.countryCode),
    state: addr?.state || '',
    district: addr?.district ?? null,
    city: addr?.city || '',
    postalCode: addr?.postalCode || '',
    addressLine: addr?.line1 || '',
    status: entity.isActive ? 'ACTIVE' : 'INACTIVE',
    isDefault: entity.isDefault,
    fiscalYearStartMonth: entity.fiscalYearStartMonth,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}

export function buildRegisteredAddressJson(input: {
  addressLine: string
  district?: string
  city: string
  state: string
  postalCode: string
  country: string
}): OrgAddress {
  return {
    line1: input.addressLine,
    district: input.district,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country,
  }
}

export function resolveMappingKey(transactionType: string): DefaultAccountMappingKey | null {
  return ORG_TRANSACTION_TO_MAPPING[transactionType] ?? null
}
