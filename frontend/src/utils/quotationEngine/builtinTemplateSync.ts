import type { QuotationTemplate } from '../../types/crm'
import {
  DEFAULT_QUOTATION_TEMPLATES,
  RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS,
  SERVICES_DEFAULT_QUOTATION_TEMPLATES,
} from '../../data/quotations/quotationTemplates'
import { useTenantProfileStore } from '../../store/tenantProfileStore'

/** Demo ids for VF Word-source quotation templates. */
export const ALLOWED_QUOTATION_TEMPLATE_IDS = new Set(
  DEFAULT_QUOTATION_TEMPLATES.map((t) => t.id),
)

/** API seed codes for the same Word-mapped templates (76 + 109 + 152 + 146 + 154 + 156 + 164 + 165 + 175 + 178 + 183 + 184). */
export const ALLOWED_QUOTATION_TEMPLATE_CODES = new Set([
  'ISO-TANK-26KL',
  'ISO-DRY-BULK-25CBM',
  'FLOUR-BULKER-42M3',
  'TIPPER-30FE-M3',
  'BULKER-TRAILER-45M3',
  'SIDEWALL-34FT-5FT',
  'CHEM-TANKER-30-5KL',
  'WALKING-FLOOR-40FT',
  'BULKER-23M3',
  'CHEM-TANKER-16KL',
  'TIPPING-TANK-31M3',
  'TIP-TRAILER-34M3',
])

/** SERVICES (Kology) standard templates — allowed through API sync / picker filters. */
export const SERVICES_QUOTATION_TEMPLATE_CODES = new Set([
  'KOLOGY-OUTBOUND-PILOT',
])

export const SERVICES_QUOTATION_TEMPLATE_IDS = new Set([
  'qtpl-kology-outbound-pilot',
])

const RETIRED_IDS = new Set<string>(RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS)

const VF_LETTERHEAD_TEMPLATE_IDS = new Set([
  'qtpl-iso-tank',
  'qtpl-iso-dry-bulk-25cbm',
  'qtpl-flour-bulker-42m3',
  'qtpl-tipper-30fe-m3',
  'qtpl-bulker-trailer-45m3',
  'qtpl-sidewall-34ft-5ft',
  'qtpl-chem-tanker-30-5kl',
  'qtpl-walking-floor-40ft',
  'qtpl-bulker-23m3',
  'qtpl-chem-tanker-16kl',
  'qtpl-tipping-tank-31m3',
  'qtpl-tip-trailer-34m3',
])

export function isAllowedQuotationTemplate(
  template: Pick<QuotationTemplate, 'id'> & { code?: string | null },
): boolean {
  if (ALLOWED_QUOTATION_TEMPLATE_IDS.has(template.id)) return true
  if (SERVICES_QUOTATION_TEMPLATE_IDS.has(template.id)) return true
  if (template.code && ALLOWED_QUOTATION_TEMPLATE_CODES.has(template.code)) return true
  if (template.code && SERVICES_QUOTATION_TEMPLATE_CODES.has(template.code)) return true
  return false
}

function isServicesCatalogTemplate(
  template: Pick<QuotationTemplate, 'id'> & { code?: string | null },
): boolean {
  if (SERVICES_QUOTATION_TEMPLATE_IDS.has(template.id)) return true
  if (template.code && SERVICES_QUOTATION_TEMPLATE_CODES.has(template.code)) return true
  return false
}

function isManufacturingCatalogTemplate(
  template: Pick<QuotationTemplate, 'id'> & { code?: string | null },
): boolean {
  if (ALLOWED_QUOTATION_TEMPLATE_IDS.has(template.id)) return true
  if (template.code && ALLOWED_QUOTATION_TEMPLATE_CODES.has(template.code)) return true
  return false
}

/** Drop copies / retired / wrong packaging — SERVICES vs MANUFACTURING catalogs stay separate. */
export function filterAllowedQuotationTemplates(
  templates: QuotationTemplate[] | null | undefined,
): QuotationTemplate[] {
  const list = Array.isArray(templates) ? templates : []
  const profile = useTenantProfileStore.getState()
  const isServices = profile.isServices()
  // Until /auth/me hydrates packaging, keep either catalog so SERVICES API rows are not dropped
  // when CRM sync races ahead of tenant profile hydrate.
  const packagingKnown = profile.hydrated
  return list.filter((t) => {
    if (RETIRED_IDS.has(t.id)) return false
    if (!packagingKnown) {
      return isServicesCatalogTemplate(t) || isManufacturingCatalogTemplate(t)
    }
    return isServices ? isServicesCatalogTemplate(t) : isManufacturingCatalogTemplate(t)
  })
}

/** Built-in templates shipped with the app — always refreshed when seed version increases */
export function mergeBuiltinQuotationTemplates(
  current: QuotationTemplate[] | null | undefined,
): QuotationTemplate[] {
  const list = Array.isArray(current) ? current : []
  const currentById = new Map(list.map((t) => [t.id, t]))
  const isServices = useTenantProfileStore.getState().isServices()
  const builtins = isServices ? SERVICES_DEFAULT_QUOTATION_TEMPLATES : DEFAULT_QUOTATION_TEMPLATES
  const merged = builtins.map((builtin) => {
    const existing = currentById.get(builtin.id)
    const builtinVersion = builtin.version ?? 1
    const existingVersion = existing?.version ?? 0
    const existingSections = existing?.sections.length ?? 0
    const builtinSections = builtin.sections.length

    const forceLetterheadRefresh =
      !isServices
      && VF_LETTERHEAD_TEMPLATE_IDS.has(builtin.id)
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
      || (!isServices && existing.printLayout.printSkin !== 'vf_word')
      || (isServices && existing.printLayout.printSkin !== 'kology_proposal')
      || existing.templateName !== builtin.templateName

    return shouldReplace ? builtin : existing
  })

  // Drop retired built-ins from persisted demo state.
  return merged.filter((t) => !RETIRED_IDS.has(t.id))
}

export function isBuiltinQuotationTemplate(templateId: string): boolean {
  return (
    ALLOWED_QUOTATION_TEMPLATE_IDS.has(templateId)
    || SERVICES_QUOTATION_TEMPLATE_IDS.has(templateId)
  )
}
