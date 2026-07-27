import type { QuotationTemplateSection, QuotationSpecRow } from '../../../types/crm'

type TemplateSection = QuotationTemplateSection

function specRow(sectionNo: string, label: string, value: string, required = true): Omit<QuotationSpecRow, 'id'> {
  return { sectionNo, label, value, required }
}

/**
 * 16 KL Chemical Tanker — mapped from VF/QUO/26-27/178
 * Source: `178.16KL Chemical Tanker.docx`
 */
export const CHEM_TANKER_16KL_SECTIONS: TemplateSection[] = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 16 KL Chemical Tanker',
      'Model VFT-16 — 16 KL Chemical Tanker',
      'Self-supported circular tanker — Aluminum Steel',
    ].join('\n'),
    sequenceNo: 1,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'customer_details',
    title: 'Customer Details',
    content: [
      'To,',
      '{{customer_name}}',
      '{{customer_address}}',
      '',
      'Kind Attn: {{contact_person}}',
      'Mobile: {{contact_mobile}}',
      'Email: {{contact_email}}',
    ].join('\n'),
    sequenceNo: 2,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'introduction',
    title: 'Opening Paragraph',
    content: [
      'Dear Sir / Ma’am,',
      '',
      'We thank you for interest shown in our products and are pleased to offer pricing as under for {{product_name}}.',
      '',
      'Quantity: {{quantity}}',
      'Tanker Material: Aluminum Steel',
    ].join('\n'),
    sequenceNo: 3,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'price_table',
    title: 'Commercial Price',
    content: '',
    sequenceNo: 4,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'specification',
    title: 'Technical Specifications',
    content: '',
    sequenceNo: 5,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('1.1', 'Model No.', 'VFT-16'),
      specRow('1.2', 'Type', '16 KL Chemical Tanker'),
      specRow('1.3', 'Construction', 'Self-supported tanker made of Aluminum Steel'),
      specRow('1.4', 'Shape', 'Circular'),
      specRow('1.5', 'Shell', 'Aluminum, 12 mm thick'),
      specRow('1.6', 'Dish End', 'Aluminum, 12 mm thick'),
      specRow('1.7', 'Baffle', 'Aluminum, 12 mm thick × 2 Nos.'),
      specRow('1.8', 'Leg Supports', '12 mm thick leg support with ISMB 125 runner'),
      specRow('1.9', 'Tanker Material', 'Aluminum Steel'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Nozzles & Discharge',
    content: '',
    sequenceNo: 6,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('2.1', 'Manhole', 'DN 450 × 1 No.'),
      specRow('2.2', 'Vent', '1 No. 2" vent on top with 1" ball valve'),
      specRow('2.3', 'Material Inlet', '2 Nos. 8" material inlets'),
      specRow('2.4', 'Outlet', '2" outlet at rear side'),
      specRow(
        '2.5',
        'Discharge',
        '2" outlet with CF8M ball valve with PFA lining',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Catwalk & Accessories',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '3.1',
        'Catwalk',
        'M.S. catwalk, 300 mm wide with MS handrail and MS ladder',
      ),
      specRow(
        '3.2',
        'Other Accessories',
        'M.S. nut bolts, PTFE gaskets and mud guards',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Painting',
    content: '',
    sequenceNo: 8,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '4.1',
        'Primer',
        'Two layers of anti-corrosive metal primer (heavy duty — zinc phosphate)',
      ),
      specRow(
        '4.2',
        'Finish',
        'Two coats of synthetic paint (without lettering)',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Optional / Chargeable Items',
    content: [
      'If any other connection and flanges required will be on chargeable basis.',
      'RTO registration tax & other charges, insurance will be extra.',
    ].join('\n'),
    sequenceNo: 9,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'scope',
    title: 'Scope of Work',
    content: [
      '1. We will manufacture the 16 KL Chemical Tanker as per the above specifications.',
      '2. This is standard equipment; any changes requested by the customer will be subject to revised rates.',
      '3. Major maintenance will be done at our works. Owner has to send the vehicle by own arrangement; all expenses on owner’s account.',
      '4. RTO registration tax & other charges, insurance will be extra.',
    ].join('\n'),
    sequenceNo: 10,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'terms',
    title: 'General Sales Terms',
    content: '',
    sequenceNo: 11,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('T.1', 'Jurisdiction', 'Subject to Chhapi Jurisdiction'),
      specRow('T.2', 'Terms of Delivery', 'Ex-works Chhapi, Banaskantha, Gujarat'),
      specRow(
        'T.3',
        'Payment Terms',
        '30% advance with purchase order; balance against delivery. Advance is non-refundable on cancellation.',
      ),
      specRow(
        'T.4',
        'Delivery Time',
        '14 weeks from receipt of confirmed order with advance',
      ),
      specRow(
        'T.5',
        'Warranty',
        '12 months against defective material and workmanship. Not responsible for mishandling, accident damage, or consequential loss. No warranty on hydraulic equipment and parts; bought-out items carry OEM warranty.',
      ),
      specRow('T.6', 'Validity', 'Up to 20 days from quotation date'),
    ],
  },
  {
    sectionType: 'introduction',
    title: 'Closing Paragraph',
    content: [
      'We trust and hope our competitive rate and other information will be up to your approval.',
      'We now look forward to receiving your valued Purchase Order.',
      '',
      'Thanking you.',
      'Yours faithfully,',
    ].join('\n'),
    sequenceNo: 12,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'signature',
    title: 'Authorized Signatory',
    content: [
      'For, {{company_name}}',
      '',
      '',
      '{{authorized_person}}',
      '{{designation}}',
    ].join('\n'),
    sequenceNo: 13,
    editable: true,
    contentFormat: 'richtext',
  },
]

export const CHEM_TANKER_16KL_TEMPLATE_ID = 'qtpl-chem-tanker-16kl'
export const CHEM_TANKER_16KL_TEMPLATE_VERSION = 1
