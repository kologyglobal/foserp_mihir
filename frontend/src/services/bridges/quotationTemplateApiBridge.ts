import type { QuotationTemplate } from '../../types/crm'
import { formatApiError } from '../api/apiErrors'
import * as api from '../api/quotationTemplateApi'
import { useCrmStore } from '../../store/crmStore'
import type { StoreActionResult } from '../../store/storeAction'

const submitLocks = new Set<string>()

function lockKey(scope: string, id?: string): string {
  return id ? `${scope}:${id}` : scope
}

async function withSubmitLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (submitLocks.has(key)) throw new Error('Operation already in progress')
  submitLocks.add(key)
  try {
    return await fn()
  } finally {
    submitLocks.delete(key)
  }
}

function fail(err: unknown): StoreActionResult & { templateId?: string } {
  return { ok: false, error: formatApiError(err) }
}

function upsertTemplate(row: QuotationTemplate): void {
  useCrmStore.setState((s) => {
    const existing = Array.isArray(s.quotationTemplates) ? s.quotationTemplates : []
    return {
      quotationTemplates: [row, ...existing.filter((t) => t.id !== row.id)],
    }
  })
}

export async function syncQuotationTemplatesFromApi(): Promise<QuotationTemplate[]> {
  const rows = await api.fetchQuotationTemplatesApi()
  const templates = (Array.isArray(rows) ? rows : []).map(api.mapQuotationTemplateDto)
  useCrmStore.setState({ quotationTemplates: templates })
  return templates
}

export async function apiCreateQuotationTemplate(input: {
  templateName: string
  productFamily?: string
  sections?: QuotationTemplate['sections']
  defaultTerms?: string
  defaultWarranty?: string
  defaultExclusions?: string
  sourceTemplateId?: string
  printLayout?: QuotationTemplate['printLayout']
}): Promise<StoreActionResult & { templateId?: string }> {
  return withSubmitLock(lockKey('quotation-template:create'), async () => {
    try {
      const source = input.sourceTemplateId
        ? useCrmStore.getState().getTemplate(input.sourceTemplateId)
        : undefined
      const res = await api.createQuotationTemplateApi(
        api.templateToApiPayload(
          {
            templateName: input.templateName,
            productFamily: input.productFamily || source?.productFamily || 'Custom',
            sections: input.sections ?? source?.sections ?? [],
            defaultTerms: input.defaultTerms ?? source?.defaultTerms ?? '',
            defaultWarranty: input.defaultWarranty ?? source?.defaultWarranty ?? '',
            defaultExclusions: input.defaultExclusions ?? source?.defaultExclusions ?? '',
            printLayout: input.printLayout ?? source?.printLayout,
            isActive: true,
            version: 1,
          },
          { sourceTemplateId: input.sourceTemplateId },
        ),
      )
      const mapped = api.mapQuotationTemplateDto(res.data)
      upsertTemplate(mapped)
      return { ok: true, templateId: mapped.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateQuotationTemplate(
  id: string,
  patch: Partial<
    Pick<
      QuotationTemplate,
      | 'templateName'
      | 'productFamily'
      | 'sections'
      | 'defaultTerms'
      | 'defaultWarranty'
      | 'defaultExclusions'
      | 'isActive'
      | 'version'
      | 'printLayout'
    >
  >,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation-template:update', id), async () => {
    try {
      const existing = useCrmStore.getState().getTemplate(id)
      if (!existing) return { ok: false, error: 'Template not found' }
      const merged = { ...existing, ...patch }
      const res = await api.updateQuotationTemplateApi(id, api.templateToApiPayload(merged))
      upsertTemplate(api.mapQuotationTemplateDto(res.data))
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDuplicateQuotationTemplate(
  sourceId: string,
  templateName?: string,
): Promise<StoreActionResult & { templateId?: string }> {
  return withSubmitLock(lockKey('quotation-template:duplicate', sourceId), async () => {
    try {
      const res = await api.duplicateQuotationTemplateApi(sourceId, templateName)
      const mapped = api.mapQuotationTemplateDto(res.data)
      upsertTemplate(mapped)
      return { ok: true, templateId: mapped.id }
    } catch (err) {
      return fail(err)
    }
  })
}
