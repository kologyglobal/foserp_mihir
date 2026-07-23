/** Canonical seed for the two VF ISO quotation templates (76 + 109 Word docs). */

export interface QuotationTemplateSeedRow {
  code: string
  templateName: string
  productFamily: string
  version: number
  defaultTerms: string
  defaultWarranty: string
  defaultExclusions: string
  sections: Array<Record<string, unknown>>
}

function isoShellSections(title: string, subject: string): Array<Record<string, unknown>> {
  return [
    {
      sectionType: 'cover',
      title: 'Quotation',
      content: ['QUOTATION', '', `Sub: ${subject}`].join('\n'),
      sequenceNo: 1,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'customer_details',
      title: 'Customer Details',
      content: 'To,\n{{customer_name}}\n{{customer_address}}\n\nKind Attn: {{contact_person}}',
      sequenceNo: 2,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'introduction',
      title: 'Introduction',
      content: `We thank you for your enquiry and are pleased to submit our offer for ${title}.`,
      sequenceNo: 3,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'scope',
      title: 'Scope of Supply',
      content: `Supply of ${title} as per agreed specifications.`,
      sequenceNo: 4,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'specification',
      title: 'Technical Specification',
      content: 'As per attached / agreed technical data sheet.',
      sequenceNo: 5,
      editable: true,
      contentFormat: 'spec_table',
      specRows: [],
    },
    {
      sectionType: 'commercial',
      title: 'Commercial Offer',
      content: 'Pricing as per price table. GST extra as applicable.',
      sequenceNo: 6,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'price_table',
      title: 'Price Table',
      content: '',
      sequenceNo: 7,
      editable: true,
    },
    {
      sectionType: 'delivery',
      title: 'Delivery Terms',
      content: 'Ex works Chhapi, Banaskantha, North Gujarat unless otherwise agreed.',
      sequenceNo: 8,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'payment',
      title: 'Payment Terms',
      content: 'As per commercial offer / advance against order.',
      sequenceNo: 9,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'warranty',
      title: 'Warranty',
      content: '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
      sequenceNo: 10,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'exclusions',
      title: 'Exclusions',
      content: 'Freight, insurance, and statutory registrations excluded unless specified.',
      sequenceNo: 11,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'terms',
      title: 'Terms & Conditions',
      content: 'Subject to Chhapi jurisdiction.',
      sequenceNo: 12,
      editable: true,
      contentFormat: 'richtext',
    },
    {
      sectionType: 'signature',
      title: 'Signature Block',
      content: 'Authorized signatory — Sales & Marketing',
      sequenceNo: 13,
      editable: true,
      contentFormat: 'richtext',
    },
  ]
}

export const QUOTATION_TEMPLATE_SEED_ROWS: QuotationTemplateSeedRow[] = [
  {
    code: 'ISO-TANK-26KL',
    templateName: '76 — 26 KL ISO Tank Container Quotation',
    productFamily: 'ISO Tank',
    version: 7,
    defaultTerms: 'Ex works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 60 days. Subject to Chhapi jurisdiction.',
    defaultWarranty: '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
    defaultExclusions: 'Freight, insurance, extra connections/flanges, and statutory registrations excluded unless specified.',
    sections: isoShellSections(
      '26 KL ISO Tank Container',
      'Quotation for supply of 26 KL ISO Tank Container',
    ),
  },
  {
    code: 'ISO-DRY-BULK-25CBM',
    templateName: '109 — 25 m³ ISO Tank Container Quotation',
    productFamily: 'ISO Dry Bulk',
    version: 4,
    defaultTerms: 'Ex works Chhapi, Banaskantha, North Gujarat. GST extra. Validity 20 days. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty: '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
    defaultExclusions: 'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
    sections: isoShellSections(
      '25 m³ ISO Tank Container',
      "Quotation for supply of 25 m³ ISO Tank Container (20' dry bulk / Model 25 CBM)",
    ),
  },
]

export const VF_WORD_PRINT_LAYOUT_SEED = {
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
} as const
