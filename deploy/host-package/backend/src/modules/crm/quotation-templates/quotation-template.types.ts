import type { CrmQuotationTemplate } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export interface QuotationTemplateDto {
  id: string
  code: string
  templateName: string
  productFamily: string
  version: number
  sections: unknown[]
  defaultTerms: string
  defaultWarranty: string
  defaultExclusions: string
  printLayout: unknown | null
  isActive: boolean
  createdAt: string
  createdById: string | null
  createdByName: string | null
  modifiedAt: string | null
  modifiedById: string | null
  modifiedByName: string | null
  approvedById: null
  approvedByName: null
  approvedAt: null
}

export function mapQuotationTemplateToDto(
  row: CrmQuotationTemplate,
  names?: { createdByName?: string; modifiedByName?: string },
): QuotationTemplateDto {
  const sections = Array.isArray(row.sections) ? row.sections : []
  return {
    id: row.id,
    code: row.code,
    templateName: row.templateName,
    productFamily: row.productFamily,
    version: row.version,
    sections: sections as unknown[],
    defaultTerms: row.defaultTerms,
    defaultWarranty: row.defaultWarranty,
    defaultExclusions: row.defaultExclusions,
    printLayout: row.printLayout ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdBy,
    createdByName: names?.createdByName ?? null,
    modifiedAt: row.updatedAt.toISOString(),
    modifiedById: row.updatedBy,
    modifiedByName: names?.modifiedByName ?? null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

export function toTemplateJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
