import type { QuotationDocument } from '../../types/crm'
import type { Customer } from '../../types/master'
import { syncLineTotals } from '../crmQuotationCalc'
import { sectionContent } from '../crmIntegration'

export interface QuotationValidationIssue {
  id: string
  severity: 'error' | 'warning'
  message: string
  sectionId?: string
}

export function validateQuotationForPrint(
  doc: QuotationDocument,
  customer?: Customer,
): QuotationValidationIssue[] {
  const issues: QuotationValidationIssue[] = []
  const lines = syncLineTotals(doc.priceLines)

  if (!customer?.customerName) {
    issues.push({ id: 'customer', severity: 'error', message: 'Customer name is missing' })
  }
  if (!customer?.addressLine1 && !customer?.city) {
    issues.push({ id: 'address', severity: 'warning', message: 'Customer address is incomplete' })
  }
  if (!customer?.contactPerson) {
    issues.push({ id: 'contact', severity: 'warning', message: 'Contact person not set' })
  }
  if (!lines.length || lines.every((l) => l.unitPrice <= 0)) {
    issues.push({ id: 'price', severity: 'error', message: 'Commercial price table has no valued lines' })
  }
  if (!sectionContent(doc, 'payment')?.trim()) {
    issues.push({ id: 'payment', severity: 'warning', message: 'Payment terms section is empty' })
  }
  if (!sectionContent(doc, 'terms')?.trim() && !sectionContent(doc, 'commercial')?.trim()) {
    issues.push({ id: 'terms', severity: 'warning', message: 'General sales terms are missing' })
  }
  if (!sectionContent(doc, 'signature')?.trim()) {
    issues.push({ id: 'signature', severity: 'warning', message: 'Signature block is not configured' })
  }

  const tech = doc.sections.find((s) => s.sectionType === 'specification' || s.contentFormat === 'spec_table')
  if (tech?.contentFormat === 'spec_table' && (!tech.specRows || tech.specRows.length === 0)) {
    issues.push({ id: 'specs', severity: 'warning', message: 'Technical specifications have no rows', sectionId: tech.id })
  }

  return issues
}

export function sectionCompletionStatus(doc: QuotationDocument): { complete: number; total: number; missing: string[] } {
  const required = doc.sections.filter((s) => s.sectionType !== 'cover')
  const missing: string[] = []
  for (const s of required) {
    if (s.sectionType === 'price_table') {
      if (!doc.priceLines.length) missing.push(s.title)
      continue
    }
    if (s.contentFormat === 'spec_table') {
      if (!s.specRows?.length) missing.push(s.title)
      continue
    }
    if (!s.content?.trim()) missing.push(s.title)
  }
  return { complete: required.length - missing.length, total: required.length, missing }
}
