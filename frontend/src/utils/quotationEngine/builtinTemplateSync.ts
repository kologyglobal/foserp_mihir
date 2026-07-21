import type { QuotationTemplate } from '../../types/crm'
import {
  DEFAULT_QUOTATION_TEMPLATES,
  RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS,
} from '../../data/quotations/quotationTemplates'

const BUILTIN_IDS = new Set(DEFAULT_QUOTATION_TEMPLATES.map((t) => t.id))
const RETIRED_IDS = new Set<string>(RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS)

/** Built-in templates shipped with the app — always refreshed when seed version increases */
export function mergeBuiltinQuotationTemplates(
  current: QuotationTemplate[] | null | undefined,
): QuotationTemplate[] {
  const list = Array.isArray(current) ? current : []
  const custom = list.filter((t) => !BUILTIN_IDS.has(t.id) && !RETIRED_IDS.has(t.id))
  const currentById = new Map(list.map((t) => [t.id, t]))
  const mergedBuiltins = DEFAULT_QUOTATION_TEMPLATES.map((builtin) => {
    const existing = currentById.get(builtin.id)
    const builtinVersion = builtin.version ?? 1
    const existingVersion = existing?.version ?? 0
    const existingSections = existing?.sections.length ?? 0
    const builtinSections = builtin.sections.length

    // Force refresh if outdated, empty, or ISO templates are incomplete
    const forceIsoRefresh =
      (builtin.id === 'qtpl-iso-tank' || builtin.id === 'qtpl-iso-dry-bulk-25cbm')
      && existingSections < 12
    const shouldReplace =
      !existing
      || existingVersion < builtinVersion
      || forceIsoRefresh
      || existingSections < Math.min(3, builtinSections)

    return shouldReplace ? builtin : existing
  })

  return [...mergedBuiltins, ...custom]
}

export function isBuiltinQuotationTemplate(templateId: string): boolean {
  return BUILTIN_IDS.has(templateId)
}
