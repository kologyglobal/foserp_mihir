import type { QuotationSection, QuotationSpecRow, QuotationTemplateSection } from '../../types/crm'

export function cloneTemplateSections(
  sections: QuotationTemplateSection[],
  genId: (prefix: string) => string,
): QuotationSection[] {
  return sections.map((s, i) => ({
    ...s,
    id: genId('sec'),
    sequenceNo: i + 1,
    specRows: s.specRows?.map((r) => cloneSpecRow(r, genId)),
  }))
}

export function cloneSpecRow(row: Omit<QuotationSpecRow, 'id'> | QuotationSpecRow, genId: (prefix: string) => string): QuotationSpecRow {
  return { ...row, id: 'id' in row && row.id ? row.id : genId('spec') }
}
