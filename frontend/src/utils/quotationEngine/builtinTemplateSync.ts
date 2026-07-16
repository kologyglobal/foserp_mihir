import type { QuotationTemplate } from '../../types/crm'
import { DEFAULT_QUOTATION_TEMPLATES } from '../../data/quotations/quotationTemplates'

const BUILTIN_IDS = new Set(DEFAULT_QUOTATION_TEMPLATES.map((t) => t.id))

/** Built-in templates shipped with the app — always refreshed when seed version increases */
export function mergeBuiltinQuotationTemplates(
  current: QuotationTemplate[] | null | undefined,
): QuotationTemplate[] {
  const list = Array.isArray(current) ? current : []
  const custom = list.filter((t) => !BUILTIN_IDS.has(t.id))
  const currentById = new Map(list.map((t) => [t.id, t]))
  const mergedBuiltins = DEFAULT_QUOTATION_TEMPLATES.map((builtin) => {
    const existing = currentById.get(builtin.id)
    const builtinVersion = builtin.version ?? 1
    const existingVersion = existing?.version ?? 0
    const existingSections = existing?.sections.length ?? 0
    const builtinSections = builtin.sections.length

    // Force refresh if outdated, empty, or ISO tank is incomplete
    const forceIsoTank =
      builtin.id === 'qtpl-iso-tank' && existingSections < 15
    const shouldReplace =
      !existing || existingVersion < builtinVersion || forceIsoTank || existingSections < Math.min(3, builtinSections)

    return shouldReplace ? builtin : existing
  })

  return [...mergedBuiltins, ...custom]
}

export function isBuiltinQuotationTemplate(templateId: string): boolean {
  return BUILTIN_IDS.has(templateId)
}
