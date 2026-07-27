import type { QuotationTemplateSection, QuotationSpecRow } from '../../../types/crm'

type TemplateSection = QuotationTemplateSection

function specRow(sectionNo: string, label: string, value: string, required = true): Omit<QuotationSpecRow, 'id'> {
  return { sectionNo, label, value, required }
}

/**
 * 40 ft Walking Floor Container — mapped from VF/QUO/26-27/165
 * Source: `165.40ft  Walking Floor.docx`
 * Dynamic merge fields: {{reference_no}}, {{customer_*}}, {{product_*}}, etc.
 */
export const WALKING_FLOOR_40FT_SECTIONS: TemplateSection[] = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 40 ft Walking Floor Container',
      'Without roof panel — floor suitable for walking floor installation',
      'PU paint colour · CSC certificate included',
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
      'Dear Sir,',
      '',
      'We thank you for the interest shown in our products and are pleased to offer pricing as under for {{product_name}}.',
      '',
      'Quantity: {{quantity}}',
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
    title: 'Technical Specifications — Frame & Structure',
    content: '',
    sequenceNo: 5,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('1.1', 'Product', '40 ft Walking Floor Container (without roof panel)'),
      specRow('1.2', 'Standards', 'IS 1496-1, ISO 668 and ISO 1161'),
      specRow(
        '1.3',
        'Side Bottom Rail (Outer)',
        'IS 2062 E350 or equivalent — 4.5 mm thick',
      ),
      specRow('1.4', 'Corner Post', 'IS 2062 E350 or equivalent — 6 mm thick'),
      specRow('1.5', 'Cross Member', 'IS 2062 E350 or equivalent — 4.5 mm thick'),
      specRow(
        '1.6',
        'End Frame',
        'IS 2062 E350 or equivalent — 4.5 mm thick & 6 mm threshold plate',
      ),
      specRow(
        '1.7',
        'Cross Bracings',
        '25 NB pipe cross bracings with screws — 4 Nos.',
      ),
      specRow('1.8', 'Corner Casting', 'SCW49'),
      specRow(
        '1.9',
        'Door Hardware',
        'SAEJIN SJ-13BF model or Bloxwich BE2566 model',
      ),
      specRow('1.10', 'Cam & Keeper', 'SF45A'),
      specRow('1.11', 'CSC', 'CSC certificate included'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Panels & Body',
    content: '',
    sequenceNo: 6,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('2.1', 'Door Panel', 'IS 2062 E350 or equivalent — 2 mm panel'),
      specRow('2.2', 'Roof', 'N/A (without roof panel)'),
      specRow(
        '2.3',
        'Side Panel',
        'IS 2062 E350 or equivalent — 2 mm corrugated with inner side 3 mm flat sheet',
      ),
      specRow(
        '2.4',
        'Front Panel',
        'IS 2062 E350 or equivalent — 2 mm corrugated with bottom side cover plate',
      ),
      specRow('2.5', 'Paint Colour', 'PU paint colour as agreed'),
    ],
  },
  {
    sectionType: 'technical',
    title: 'Dimensions',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('3.1', 'External Length', 'Approx. 12,192 mm'),
      specRow('3.2', 'External Width', 'Approx. 2,438 mm'),
      specRow('3.3', 'External Height', 'Approx. 2,896 mm'),
      specRow('3.4', 'Internal Length', 'Approx. 12,000 mm'),
      specRow('3.5', 'Internal Width', 'Approx. 2,352 mm'),
      specRow('3.6', 'Internal Height', 'Approx. 2,600 mm'),
      specRow('3.7', 'Door Opening Width', 'Approx. 2,340 mm'),
      specRow('3.8', 'Door Opening Height', 'Approx. 2,302 mm'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Ratings & Capacity',
    content: '',
    sequenceNo: 8,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('4.1', 'Internal Capacity', '68.6 m³'),
      specRow('4.2', 'Max. Gross Weight', '32,480 kg'),
      specRow('4.3', 'Tare Weight', 'Approx. 5,900 kg (without walking floor)'),
      specRow('4.4', 'Max. Payload', '26,580 kg'),
      specRow('4.5', 'Stacking Test Load', '2,13,000 kg'),
      specRow('4.6', 'Floor Strength', '7,260 kg'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Walking Floor Attachments',
    content: '',
    sequenceNo: 9,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '5.1',
        'Slat Installation Pipes',
        '25 × 25 × 1.5 mm thick pipes included for slats installation',
      ),
      specRow(
        '5.2',
        'Floor Height',
        '178 mm from the bottom of corner cast',
      ),
      specRow(
        '5.3',
        'Floor Readiness',
        'Floor will be ready for walking floor installation',
      ),
      specRow(
        '5.4',
        'Floor Specification',
        'Suitable for walking floor as per Keith guideline',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Surface Protection & Paint',
    content: '',
    sequenceNo: 10,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '6.1',
        'Surface Preparation',
        'All steel components shot-blasted to SA 2.5 before forming; weldable primer 10–15 µm applied immediately. After assembly, welds and contaminated areas re-blasted manually; slag/spatter removed by grinding or needle hammers.',
      ),
      specRow(
        '6.2',
        'Zinc-Rich Primer',
        'Zinc content of zinc-rich primer not less than 65% by weight of solid',
      ),
      specRow(
        '6.3',
        'Exterior Paint',
        'Solvent-based epoxy zinc-rich primer 10 µm DFT → waterborne zinc-rich primer 20 µm → waterborne epoxy primer 40 µm → waterborne acrylic top coat (Type-I: RAL 7033; Type-II & III: RAL 5017) 40 µm DFT. Total 110 µm DFT.',
      ),
      specRow(
        '6.4',
        'Interior Paint',
        'Solvent-based epoxy zinc-rich primer 10 µm DFT → waterborne epoxy zinc-rich primer 20 µm → waterborne acrylic top coat RAL 8035 50 µm DFT. Total 80 µm DFT.',
      ),
      specRow(
        '6.5',
        'Understructure',
        'Solvent-based epoxy zinc-rich primer 10 µm DFT → waterborne epoxy zinc-rich primer 20 µm → waterborne undercoating (waxy or bituminous) 200 µm on steel parts',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Optional / Chargeable Items',
    content: [
      'Walking floor supply and installation are not in VFPL scope and are chargeable separately if arranged through VFPL.',
      'Any additional fittings, connections, or modifications beyond the above specification will be on a chargeable basis.',
      'Freight, insurance, and statutory charges are extra unless otherwise agreed.',
    ].join('\n'),
    sequenceNo: 11,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'scope',
    title: 'Scope of Work',
    content: [
      '1. Supply of ISO box container with CSC number and plate.',
      '2. Walking-floor-installation-ready container as per the above specifications.',
      '3. Other supply specification as above.',
      '4. Walking floor supply and installation are not in VFPL scope.',
    ].join('\n'),
    sequenceNo: 12,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'terms',
    title: 'General Sales Terms',
    content: '',
    sequenceNo: 13,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('T.1', 'Jurisdiction', 'Subject to Chhapi Jurisdiction'),
      specRow('T.2', 'Terms of Delivery', 'Ex-works Chhapi, Banaskantha, North Gujarat'),
      specRow(
        'T.3',
        'Payment Terms',
        '35% advance and balance against delivery. Advance is non-refundable on cancellation.',
      ),
      specRow(
        'T.4',
        'Delivery Time',
        '3 months from receipt of purchase order with advance payment',
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
    sequenceNo: 14,
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
    sequenceNo: 15,
    editable: true,
    contentFormat: 'richtext',
  },
]

export const WALKING_FLOOR_40FT_TEMPLATE_ID = 'qtpl-walking-floor-40ft'
export const WALKING_FLOOR_40FT_TEMPLATE_VERSION = 1
