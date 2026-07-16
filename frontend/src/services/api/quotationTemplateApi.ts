import { apiRequest, tenantPath } from './client'
import { fetchAllCrmPages } from './crmApi'
import type { QuotationTemplate } from '../../types/crm'

export interface QuotationTemplateApiDto extends QuotationTemplate {
  code: string
}

export async function fetchQuotationTemplatesApi() {
  return fetchAllCrmPages<QuotationTemplateApiDto>('/crm/quotation-templates')
}

export async function fetchQuotationTemplateApi(id: string) {
  return apiRequest<QuotationTemplateApiDto>(tenantPath(`/crm/quotation-templates/${id}`))
}

export async function createQuotationTemplateApi(data: Record<string, unknown>) {
  return apiRequest<QuotationTemplateApiDto>(tenantPath('/crm/quotation-templates'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateQuotationTemplateApi(id: string, data: Record<string, unknown>) {
  return apiRequest<QuotationTemplateApiDto>(tenantPath(`/crm/quotation-templates/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function duplicateQuotationTemplateApi(id: string, templateName?: string) {
  return apiRequest<QuotationTemplateApiDto>(tenantPath(`/crm/quotation-templates/${id}/duplicate`), {
    method: 'POST',
    body: JSON.stringify({ templateName }),
  })
}

export async function deleteQuotationTemplateApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/quotation-templates/${id}`), { method: 'DELETE' })
}

export function mapQuotationTemplateDto(row: QuotationTemplateApiDto): QuotationTemplate {
  return {
    id: row.id,
    code: row.code,
    templateName: row.templateName,
    productFamily: row.productFamily,
    version: row.version,
    sections: row.sections ?? [],
    defaultTerms: row.defaultTerms ?? '',
    defaultWarranty: row.defaultWarranty ?? '',
    defaultExclusions: row.defaultExclusions ?? '',
    printLayout: row.printLayout ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt,
    createdById: row.createdById ?? 'system',
    createdByName: row.createdByName ?? 'System',
    modifiedAt: row.modifiedAt,
    modifiedById: row.modifiedById,
    modifiedByName: row.modifiedByName,
    approvedById: row.approvedById ?? null,
    approvedByName: row.approvedByName ?? null,
    approvedAt: row.approvedAt ?? null,
  }
}

export function templateToApiPayload(
  data: Partial<QuotationTemplate> & Pick<QuotationTemplate, 'templateName'>,
  extras?: { sourceTemplateId?: string; code?: string },
) {
  return {
    code: extras?.code ?? data.code,
    templateName: data.templateName.trim(),
    productFamily: data.productFamily,
    version: data.version,
    sections: data.sections,
    defaultTerms: data.defaultTerms,
    defaultWarranty: data.defaultWarranty,
    defaultExclusions: data.defaultExclusions,
    printLayout: data.printLayout ?? null,
    isActive: data.isActive,
    sourceTemplateId: extras?.sourceTemplateId,
  }
}
