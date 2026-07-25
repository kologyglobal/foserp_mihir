/** Canonical seed for the VF Word quotation templates (76 + 109 + 152 + 146). */

import {
  ISO_TANK_26KL_SEED_SECTIONS,
  ISO_TANK_26KL_SEED_VERSION,
} from './quotation-template.iso-tank-26kl.js'
import {
  ISO_DRY_BULK_25CBM_SEED_SECTIONS,
  ISO_DRY_BULK_25CBM_SEED_VERSION,
} from './quotation-template.iso-dry-bulk-25cbm.js'
import {
  FLOUR_BULKER_42M3_SEED_SECTIONS,
  FLOUR_BULKER_42M3_SEED_VERSION,
} from './quotation-template.flour-bulker-42m3.js'
import {
  TIPPER_30FE_M3_SEED_SECTIONS,
  TIPPER_30FE_M3_SEED_VERSION,
} from './quotation-template.tipper-30fe-m3.js'

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
    version: ISO_TANK_26KL_SEED_VERSION,
    defaultTerms:
      'Ex works Chhapi, Banaskantha, North Gujarat. 30% advance with PO; balance against PI. Validity 60 days. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment.',
    defaultExclusions:
      'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
    sections: ISO_TANK_26KL_SEED_SECTIONS,
  },
  {
    code: 'ISO-DRY-BULK-25CBM',
    templateName: '109 — 25 m³ ISO Tank Container Quotation',
    productFamily: 'ISO Dry Bulk',
    version: ISO_DRY_BULK_25CBM_SEED_VERSION,
    defaultTerms:
      'Ex works Chhapi, Banaskantha, North Gujarat. GST extra. Validity 20 days. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
    defaultExclusions:
      'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
    // Full Word/PDF-mapped sections (dynamic {{placeholders}} + spec tables).
    sections: ISO_DRY_BULK_25CBM_SEED_SECTIONS,
  },
  {
    code: 'FLOUR-BULKER-42M3',
    templateName: '152 — 42 m³ Hopper Type Flour Bulker Quotation',
    productFamily: 'Flour Bulker',
    version: FLOUR_BULKER_42M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, and statutory charges excluded unless specified.',
    sections: FLOUR_BULKER_42M3_SEED_SECTIONS,
  },
  {
    code: 'TIPPER-30FE-M3',
    templateName: '146 — 30 m³ Tipper FE Type Quotation',
    productFamily: 'Tipper',
    version: TIPPER_30FE_M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 40% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, pump/PTO, and statutory charges excluded unless specified.',
    sections: TIPPER_30FE_M3_SEED_SECTIONS,
  },
]

export const VF_WORD_PRINT_LAYOUT_SEED = {
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
} as const
