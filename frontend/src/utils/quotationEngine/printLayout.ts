import type { CSSProperties } from 'react'
import type { QuotationPrintLayout, QuotationSectionType, QuotationTemplate } from '../../types/crm'

export const DEFAULT_QUOTATION_PRINT_LAYOUT: QuotationPrintLayout = {
  pageSize: 'A4',
  marginMm: 12,
  fontScale: 1,
  headerStyle: 'standard',
  showLogo: true,
  showCompanyHeader: true,
  showCustomerBlock: true,
  showPageFooter: true,
  showSignatureBlock: true,
  pageBreakBefore: ['price_table', 'terms', 'bank', 'signature'],
  printSkin: 'default',
}

/**
 * Word-like print layout for VF ISO tank / dry-bulk quotations.
 * Customer & cover text come from template sections (not the ERP chrome blocks).
 */
export const VF_WORD_PRINT_LAYOUT: QuotationPrintLayout = {
  pageSize: 'A4',
  marginMm: 18,
  fontScale: 1,
  headerStyle: 'minimal',
  showLogo: false,
  showCompanyHeader: false,
  showCustomerBlock: false,
  showPageFooter: true,
  showSignatureBlock: true,
  pageBreakBefore: ['price_table'],
  printSkin: 'vf_word',
}

export const PRINT_LAYOUT_SECTION_OPTIONS: { id: QuotationSectionType; label: string }[] = [
  { id: 'cover', label: 'Cover Page' },
  { id: 'customer_details', label: 'Customer Details' },
  { id: 'introduction', label: 'Introduction' },
  { id: 'scope', label: 'Scope of Supply' },
  { id: 'specification', label: 'Product Specification' },
  { id: 'technical', label: 'Technical Details' },
  { id: 'commercial', label: 'Commercial Offer' },
  { id: 'price_table', label: 'Price Table' },
  { id: 'taxes', label: 'Taxes' },
  { id: 'delivery', label: 'Delivery Terms' },
  { id: 'payment', label: 'Payment Terms' },
  { id: 'warranty', label: 'Warranty Terms' },
  { id: 'exclusions', label: 'Exclusions' },
  { id: 'terms', label: 'Terms & Conditions' },
  { id: 'bank', label: 'Bank Details' },
  { id: 'signature', label: 'Signature Block' },
  { id: 'annexure', label: 'Annexure' },
  { id: 'custom', label: 'Custom Section' },
]

export function resolveQuotationPrintLayout(template?: Pick<QuotationTemplate, 'printLayout'> | null): QuotationPrintLayout {
  if (!template?.printLayout) return { ...DEFAULT_QUOTATION_PRINT_LAYOUT }
  return {
    ...DEFAULT_QUOTATION_PRINT_LAYOUT,
    ...template.printLayout,
    pageBreakBefore: template.printLayout.pageBreakBefore ?? DEFAULT_QUOTATION_PRINT_LAYOUT.pageBreakBefore,
    printSkin: template.printLayout.printSkin ?? DEFAULT_QUOTATION_PRINT_LAYOUT.printSkin,
  }
}

export function printLayoutStyleVars(layout: QuotationPrintLayout): CSSProperties {
  return {
    ['--quo-print-margin' as string]: `${layout.marginMm}mm`,
    ['--quo-print-font-scale' as string]: String(layout.fontScale),
    ['--quo-print-page-size' as string]: layout.pageSize,
  }
}

export function printLayoutClassNames(layout: QuotationPrintLayout): string {
  const skin = layout.printSkin && layout.printSkin !== 'default'
    ? `quo-print-doc--skin-${layout.printSkin.replace(/_/g, '-')}`
    : ''
  return [
    `quo-print-doc--${layout.pageSize.toLowerCase()}`,
    `quo-print-doc--header-${layout.headerStyle}`,
    skin,
    layout.showLogo ? '' : 'quo-print-doc--no-logo',
    layout.showCompanyHeader ? '' : 'quo-print-doc--no-company-header',
    layout.showCustomerBlock ? '' : 'quo-print-doc--no-customer',
    layout.showPageFooter ? '' : 'quo-print-doc--no-footer',
    layout.showSignatureBlock ? '' : 'quo-print-doc--no-signature',
  ].filter(Boolean).join(' ')
}

export function sectionHasPageBreak(sectionType: QuotationSectionType, layout: QuotationPrintLayout): boolean {
  return layout.pageBreakBefore.includes(sectionType)
}
