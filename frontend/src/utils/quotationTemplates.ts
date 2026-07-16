import type { QuotationTemplate } from '../types/crm'

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

/** Demo id or API seed code for the featured ISO tank template. */
export function isIsoTankQuotationTemplate(template: QuotationTemplateIdentity): boolean {
  return (
    template.id === 'qtpl-iso-tank' ||
    template.code === 'ISO-TANK-26KL' ||
    template.productFamily === 'ISO Tank'
  )
}

export function findFeaturedQuotationTemplate<T extends QuotationTemplateIdentity>(
  templates: T[] | null | undefined,
): T | undefined {
  const list = Array.isArray(templates) ? templates : []
  return list.find(isIsoTankQuotationTemplate) ?? list[0]
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
