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
 * Letter-style print layout for VF ISO tank / dry-bulk quotations.
 * Shows company letterhead (logo + details); customer block comes from template sections.
 */
export const VF_WORD_PRINT_LAYOUT: QuotationPrintLayout = {
  pageSize: 'A4',
  marginMm: 14,
  fontScale: 1,
  headerStyle: 'standard',
  showLogo: true,
  showCompanyHeader: true,
  showCustomerBlock: false,
  showPageFooter: true,
  showSignatureBlock: true,
  pageBreakBefore: ['price_table'],
  printSkin: 'vf_word',
}

/** Kology SERVICES outbound pilot proposal — matches the standard printable proposal PDF. */
export const KOLOGY_PROPOSAL_PRINT_LAYOUT: QuotationPrintLayout = {
  pageSize: 'A4',
  marginMm: 10,
  fontScale: 1,
  headerStyle: 'cover',
  showLogo: false,
  showCompanyHeader: false,
  showCustomerBlock: false,
  showPageFooter: false,
  showSignatureBlock: false,
  pageBreakBefore: [],
  printSkin: 'kology_proposal',
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

export function resolveQuotationPrintLayout(
  template?: Pick<QuotationTemplate, 'printLayout' | 'productFamily'> | null,
): QuotationPrintLayout {
  const isVfWordProduct =
    template?.productFamily === 'ISO Tank'
    || template?.productFamily === 'ISO Dry Bulk'
    || template?.productFamily === 'Flour Bulker'
    || template?.productFamily === 'Tipper'
  const isKologyProposal =
    template?.productFamily === 'Outbound Services'
    || template?.printLayout?.printSkin === 'kology_proposal'
  const fallback = isVfWordProduct
    ? VF_WORD_PRINT_LAYOUT
    : isKologyProposal
      ? KOLOGY_PROPOSAL_PRINT_LAYOUT
      : DEFAULT_QUOTATION_PRINT_LAYOUT
  if (!template?.printLayout) return { ...fallback }
  return {
    ...fallback,
    ...template.printLayout,
    pageBreakBefore: template.printLayout.pageBreakBefore ?? fallback.pageBreakBefore,
    // VF Word product templates always render with the professional letter skin.
    printSkin: isVfWordProduct
      ? 'vf_word'
      : isKologyProposal
        ? 'kology_proposal'
        : (template.printLayout.printSkin ?? fallback.printSkin),
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
