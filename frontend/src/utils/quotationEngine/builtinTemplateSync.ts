import type { QuotationTemplate } from '../../types/crm'
import {
  DEFAULT_QUOTATION_TEMPLATES,
  RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS,
} from '../../data/quotations/quotationTemplates'

/** Demo ids for VF Word-source quotation templates. */
export const ALLOWED_QUOTATION_TEMPLATE_IDS = new Set(
  DEFAULT_QUOTATION_TEMPLATES.map((t) => t.id),
)

/** API seed codes for the same Word-mapped templates (76 + 109 + 152 + 146). */
export const ALLOWED_QUOTATION_TEMPLATE_CODES = new Set([
  'ISO-TANK-26KL',
  'ISO-DRY-BULK-25CBM',
  'FLOUR-BULKER-42M3',
  'TIPPER-30FE-M3',
])

const RETIRED_IDS = new Set<string>(RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS)

const VF_LETTERHEAD_TEMPLATE_IDS = new Set([
  'qtpl-iso-tank',
  'qtpl-iso-dry-bulk-25cbm',
  'qtpl-flour-bulker-42m3',
  'qtpl-tipper-30fe-m3',
])

export function isAllowedQuotationTemplate(
  template: Pick<QuotationTemplate, 'id'> & { code?: string | null },
): boolean {
  if (ALLOWED_QUOTATION_TEMPLATE_IDS.has(template.id)) return true
  if (template.code && ALLOWED_QUOTATION_TEMPLATE_CODES.has(template.code)) return true
  return false
}

/** Drop copies / retired / blank customs — catalog is only the VF Word templates. */
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
  const merged = DEFAULT_QUOTATION_TEMPLATES.map((builtin) => {
    const existing = currentById.get(builtin.id)
    const builtinVersion = builtin.version ?? 1
    const existingVersion = existing?.version ?? 0
    const existingSections = existing?.sections.length ?? 0
    const builtinSections = builtin.sections.length

    const forceLetterheadRefresh =
      VF_LETTERHEAD_TEMPLATE_IDS.has(builtin.id)
      && (
        existingSections < 10
        || existing?.printLayout?.showCompanyHeader !== true
        || existing?.printLayout?.showLogo !== true
      )
    const shouldReplace =
      !existing
      || existingVersion < builtinVersion
      || forceLetterheadRefresh
      || existingSections < Math.min(3, builtinSections)
      || !existing.printLayout
      || existing.printLayout.printSkin !== 'vf_word'
      || existing.templateName !== builtin.templateName

    return shouldReplace ? builtin : existing
  })

  // Drop retired built-ins from persisted demo state.
  return merged.filter((t) => !RETIRED_IDS.has(t.id))
}

export function isBuiltinQuotationTemplate(templateId: string): boolean {
  return ALLOWED_QUOTATION_TEMPLATE_IDS.has(templateId)
}
