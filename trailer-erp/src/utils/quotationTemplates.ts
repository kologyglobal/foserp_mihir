import type { QuotationTemplate } from '../types/crm'

/** Demo id or API seed code for the featured ISO tank template. */
export function isIsoTankQuotationTemplate(template: Pick<QuotationTemplate, 'id' | 'code' | 'productFamily'>): boolean {
  return (
    template.id === 'qtpl-iso-tank' ||
    template.code === 'ISO-TANK-26KL' ||
    template.productFamily === 'ISO Tank'
  )
}

export function findFeaturedQuotationTemplate(templates: QuotationTemplate[]): QuotationTemplate | undefined {
  return templates.find(isIsoTankQuotationTemplate) ?? templates[0]
}
