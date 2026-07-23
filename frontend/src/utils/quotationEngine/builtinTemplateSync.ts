import type { QuotationTemplate } from '../../types/crm'
import {
  DEFAULT_QUOTATION_TEMPLATES,
  RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS,
} from '../../data/quotations/quotationTemplates'

/** Demo ids for the only two VF Word-source quotation templates. */
export const ALLOWED_QUOTATION_TEMPLATE_IDS = new Set(
  DEFAULT_QUOTATION_TEMPLATES.map((t) => t.id),
)

/** API seed codes for the same two templates (76 + 109 Word docs). */
export const ALLOWED_QUOTATION_TEMPLATE_CODES = new Set([
  'ISO-TANK-26KL',
  'ISO-DRY-BULK-25CBM',
])

const RETIRED_IDS = new Set<string>(RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS)

export function isAllowedQuotationTemplate(
  template: Pick<QuotationTemplate, 'id'> & { code?: string | null },
): boolean {
  if (ALLOWED_QUOTATION_TEMPLATE_IDS.has(template.id)) return true
  if (template.code && ALLOWED_QUOTATION_TEMPLATE_CODES.has(template.code)) return true
  return false
}

/** Drop copies / retired / blank customs — catalog is only the two ISO Word templates. */
export function filterAllowedQuotationTemplates(
  templates: QuotationTemplate[] | null | undefined,
): QuotationTemplate[] {
  const list = Array.isArray(templates) ? templates : []
  return list.filter((t) => isAllowedQuotationTemplate(t) && !RETIRED_IDS.has(t.id))
}

/** Built-in templates shipped with the app — always refreshed when seed version increases */
export function mergeBuiltinQuotationTemplates(
  current: QuotationTemplate[] | null | undefined,
): QuotationTemplate[] {
  const list = Array.isArray(current) ? current : []
  const currentById = new Map(list.map((t) => [t.id, t]))
  return DEFAULT_QUOTATION_TEMPLATES.map((builtin) => {
    const existing = currentById.get(builtin.id)
    const builtinVersion = builtin.version ?? 1
    const existingVersion = existing?.version ?? 0
    const existingSections = existing?.sections.length ?? 0
    const builtinSections = builtin.sections.length

    const forceIsoRefresh =
      (builtin.id === 'qtpl-iso-tank' || builtin.id === 'qtpl-iso-dry-bulk-25cbm')
      && existingSections < 12
    const shouldReplace =
      !existing
      || existingVersion < builtinVersion
      || forceIsoRefresh
      || existingSections < Math.min(3, builtinSections)
      || !existing.printLayout
      || existing.printLayout.printSkin !== 'vf_word'
      || existing.templateName !== builtin.templateName

    return shouldReplace ? builtin : existing
  })
}

export function isBuiltinQuotationTemplate(templateId: string): boolean {
  return ALLOWED_QUOTATION_TEMPLATE_IDS.has(templateId)
}
