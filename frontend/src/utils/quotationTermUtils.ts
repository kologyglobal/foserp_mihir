import type { QuotationSection, QuotationSectionType } from '../types/crm'
import { getCrmMasterEntries, getCrmMasterLabel } from '../store/crmMasterStore'
import { formatDate, isValidTimestamp } from './dates/format'

export type QuotationCommercialTermKind = 'payment-terms' | 'delivery-terms' | 'warranty-terms'

const SECTION_TO_KIND: Partial<Record<QuotationSectionType, QuotationCommercialTermKind>> = {
  payment: 'payment-terms',
  delivery: 'delivery-terms',
  warranty: 'warranty-terms',
}

const DEFAULT_CODES: Record<QuotationCommercialTermKind, string> = {
  'payment-terms': '30_pi',
  'delivery-terms': 'ex_works',
  'warranty-terms': 'std_12m',
}

const FALLBACK_LABELS: Record<QuotationCommercialTermKind, string> = {
  'payment-terms': '30% advance, balance before dispatch',
  'delivery-terms': 'Ex-works / FOR destination as agreed',
  'warranty-terms': '12 months from date of delivery against manufacturing defects',
}

export function commercialTermKindForSection(sectionType: QuotationSectionType): QuotationCommercialTermKind | null {
  return SECTION_TO_KIND[sectionType] ?? null
}

function masterEntries(kind: QuotationCommercialTermKind, activeOnly: boolean) {
  const entries = getCrmMasterEntries(kind, activeOnly)
  return Array.isArray(entries) ? entries : []
}

export function resolveCommercialTermOptions(kind: QuotationCommercialTermKind) {
  return masterEntries(kind, true).map((e) => ({
    value: e.code,
    label: e.name,
    approvalRequired: Boolean(e.attributes.approvalRequired),
  }))
}

export function commercialTermRequiresApproval(kind: QuotationCommercialTermKind, code: string): boolean {
  const entry = masterEntries(kind, false).find((e) => e.code === code)
  return Boolean(entry?.attributes.approvalRequired)
}

export function buildCommercialTermText(kind: QuotationCommercialTermKind, code: string): string {
  const entry = masterEntries(kind, false).find((e) => e.code === code)
  if (!entry) return getCrmMasterLabel(kind, code)

  const lines = [entry.name]
  if (kind === 'payment-terms') {
    const adv = entry.attributes.advancePct
    const credit = entry.attributes.creditDays
    if (typeof adv === 'number' && adv > 0) lines.push(`Advance: ${adv}%`)
    if (typeof credit === 'number' && credit > 0) lines.push(`Credit period: ${credit} days`)
  }
  if (kind === 'delivery-terms') {
    const time = entry.attributes.defaultDeliveryTime
    if (time != null && String(time).trim()) {
      const raw = String(time).trim()
      const pretty = isValidTimestamp(raw) && /^\d{4}-\d{2}-\d{2}/.test(raw) ? formatDate(raw) : raw
      lines.push(`Delivery time: ${pretty}`)
    }
  }
  if (kind === 'warranty-terms') {
    const dur = entry.attributes.warrantyDuration
    if (dur != null && String(dur).trim() && !entry.name.toLowerCase().includes(String(dur).toLowerCase())) {
      lines.push(`Duration: ${String(dur)}`)
    }
  }
  if (entry.description?.trim()) lines.push(entry.description.trim())
  return lines.join('\n')
}

export function matchCommercialTermCode(kind: QuotationCommercialTermKind, content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed) return null
  const entries = masterEntries(kind, false)
  const exact = entries.find((e) => e.code === trimmed || e.name === trimmed)
  if (exact) return exact.code
  const byContent = entries.find((e) => trimmed === buildCommercialTermText(kind, e.code) || trimmed.startsWith(e.name))
  return byContent?.code ?? null
}

export function resolveDefaultCommercialTerm(kind: QuotationCommercialTermKind): { code: string | null; text: string } {
  const entries = masterEntries(kind, true)
  if (entries.length === 0) {
    return { code: null, text: FALLBACK_LABELS[kind] }
  }
  const preferred = entries.find((e) => e.code === DEFAULT_CODES[kind]) ?? entries[0]
  return { code: preferred.code, text: buildCommercialTermText(kind, preferred.code) }
}

export function inferSectionMasterCode(section: QuotationSection): string | null {
  if (section.masterCode) return section.masterCode
  const kind = commercialTermKindForSection(section.sectionType)
  if (!kind) return null
  return matchCommercialTermCode(kind, section.content)
}

export function applyCommercialMastersToSections(
  sections: QuotationSection[],
  options?: { replaceTemplateContent?: boolean },
): QuotationSection[] {
  return sections.map((section) => {
    const kind = commercialTermKindForSection(section.sectionType)
    if (!kind) return section

    const existingCode = inferSectionMasterCode(section)
    if (existingCode && section.content.trim() && !options?.replaceTemplateContent) {
      return { ...section, masterCode: existingCode }
    }

    const defaults = resolveDefaultCommercialTerm(kind)
    if (!defaults.code) {
      return section.content.trim() ? section : { ...section, content: defaults.text }
    }
    return {
      ...section,
      masterCode: defaults.code,
      content: defaults.text,
    }
  })
}

export function extractCommercialTermsFromSections(sections: QuotationSection[]) {
  const list = Array.isArray(sections) ? sections : []
  const payment = list.find((s) => s.sectionType === 'payment')
  const delivery = list.find((s) => s.sectionType === 'delivery')
  const warranty = list.find((s) => s.sectionType === 'warranty')
  return {
    paymentTerms: payment?.content?.trim() ?? '',
    deliveryTerms: delivery?.content?.trim() ?? '',
    warrantyTerms: warranty?.content?.trim() ?? '',
    paymentMasterCode: payment ? inferSectionMasterCode(payment) : null,
    deliveryMasterCode: delivery ? inferSectionMasterCode(delivery) : null,
    warrantyMasterCode: warranty ? inferSectionMasterCode(warranty) : null,
  }
}

/** Apply header payment/delivery values onto matching quotation sections (keeps editor + sections in sync). */
export function syncCommercialTermsIntoSections(
  sections: QuotationSection[],
  patch: { paymentTerms?: string; deliveryTerms?: string; warrantyTerms?: string },
): QuotationSection[] {
  return sections.map((section) => {
    if (section.sectionType === 'payment' && patch.paymentTerms != null) {
      const content = patch.paymentTerms.trim()
      return {
        ...section,
        content,
        masterCode: content ? matchCommercialTermCode('payment-terms', content) : section.masterCode,
      }
    }
    if (section.sectionType === 'delivery' && patch.deliveryTerms != null) {
      const content = patch.deliveryTerms.trim()
      return {
        ...section,
        content,
        masterCode: content ? matchCommercialTermCode('delivery-terms', content) : section.masterCode,
      }
    }
    if (section.sectionType === 'warranty' && patch.warrantyTerms != null) {
      const content = patch.warrantyTerms.trim()
      return {
        ...section,
        content,
        masterCode: content ? matchCommercialTermCode('warranty-terms', content) : section.masterCode,
      }
    }
    return section
  })
}

/**
 * Prefer a master term *name* for CommercialTermSelect binding.
 * Falls back to stored text when no master match exists.
 */
export function resolveCommercialTermSelectValue(
  kind: QuotationCommercialTermKind,
  stored: string | null | undefined,
): string {
  const raw = stored?.trim() ?? ''
  if (!raw) return ''
  const code = matchCommercialTermCode(kind, raw)
  if (!code) return raw
  const entries = masterEntries(kind, false)
  const entry = entries.find((e) => e.code === code)
  return entry?.name ?? raw
}

export function commercialTermsNeedApproval(sections: QuotationSection[]): string[] {
  const warnings: string[] = []
  for (const section of sections) {
    const kind = commercialTermKindForSection(section.sectionType)
    if (!kind) continue
    const code = inferSectionMasterCode(section)
    if (code && commercialTermRequiresApproval(kind, code)) {
      warnings.push(`${section.title} (${getCrmMasterLabel(kind, code)}) requires approval`)
    }
  }
  return warnings
}
