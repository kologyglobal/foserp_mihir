import type { QuotationTemplate } from '../types/crm'
import { useTenantProfileStore } from '../store/tenantProfileStore'

type QuotationTemplateIdentity = Pick<QuotationTemplate, 'id' | 'productFamily'> & {
  code?: string | null
}

type QuotationTemplateMeta = {
  defaultTerms?: string | null
  sections?: Array<{
    title?: string
    content?: string
    sectionType?: string
    sequenceNo?: number
  }>
}

/** Demo id or API seed code for the featured dry-bulk ISO template. */
export function isFeaturedDryBulkQuotationTemplate(template: QuotationTemplateIdentity): boolean {
  return (
    template.id === 'qtpl-iso-dry-bulk-25cbm' ||
    template.code === 'ISO-DRY-BULK-25CBM' ||
    template.productFamily === 'ISO Dry Bulk'
  )
}

/** Demo id or API seed code for the 26 KL liquid ISO Tank template (VF/QUO 76). */
export function isIsoTankQuotationTemplate(template: QuotationTemplateIdentity): boolean {
  return (
    template.id === 'qtpl-iso-tank' ||
    template.code === 'ISO-TANK-26KL' ||
    template.productFamily === 'ISO Tank'
  )
}

/** Demo id or API seed code for the Kology SERVICES outbound pilot proposal. */
export function isKologyOutboundPilotTemplate(template: QuotationTemplateIdentity): boolean {
  return (
    template.id === 'qtpl-kology-outbound-pilot' ||
    template.code === 'KOLOGY-OUTBOUND-PILOT' ||
    template.productFamily === 'Outbound Services'
  )
}

export function findFeaturedQuotationTemplate<T extends QuotationTemplateIdentity>(
  templates: T[] | null | undefined,
): T | undefined {
  const list = Array.isArray(templates) ? templates : []
  if (useTenantProfileStore.getState().isServices()) {
    return list.find(isKologyOutboundPilotTemplate) ?? list[0]
  }
  return list.find(isFeaturedDryBulkQuotationTemplate) ?? list[0]
}

export function countQuotationTemplateSections(
  template: QuotationTemplateMeta | null | undefined,
): number {
  return Array.isArray(template?.sections) ? template.sections.length : 0
}

/** First section titles in document order for picker previews. */
export function quotationTemplateSectionTitles(
  template: QuotationTemplateMeta | null | undefined,
  limit = 5,
): string[] {
  if (!template || !Array.isArray(template.sections) || limit <= 0) return []
  return [...template.sections]
    .sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0))
    .map((s) => (typeof s.title === 'string' ? s.title.trim() : ''))
    .filter(Boolean)
    .slice(0, limit)
}

/**
 * Short blurb from real template fields: intro/cover content, else defaultTerms.
 */
export function quotationTemplateSummaryText(
  template: QuotationTemplateMeta | null | undefined,
): string | null {
  if (!template) return null
  const preferredTypes = new Set(['introduction', 'cover', 'scope'])
  const sections = Array.isArray(template.sections) ? template.sections : []
  const fromSection = [...sections]
    .sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0))
    .find((s) => {
      const content = typeof s.content === 'string' ? s.content.trim() : ''
      return content.length > 12 && (!s.sectionType || preferredTypes.has(s.sectionType))
    })?.content?.trim()

  const raw = fromSection || (typeof template.defaultTerms === 'string' ? template.defaultTerms.trim() : '')
  if (!raw) return null
  const firstSentence = raw.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? raw
  const clipped = firstSentence.length > 110 ? `${firstSentence.slice(0, 107).trimEnd()}…` : firstSentence
  return clipped || null
}
