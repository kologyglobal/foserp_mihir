/**
 * 146 — 30 m³ Tipper FE Type quotation sections.
 * Source: `146.30 FE m3 Tipper.docx` (VF/QUO/26-27/146).
 */

function specRow(sectionNo: string, label: string, value: string, required = true) {
  return { sectionNo, label, value, required }
}

export const TIPPER_30FE_M3_SEED_VERSION = 1

export const TIPPER_30FE_M3_SEED_SECTIONS: Array<Record<string, unknown>> = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 30 m³ Tipper FE Type',
      'Model VFT-30T — FE type tipper (without PTO)',
      'High tensile steel body with Hyva tipping kit',
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
      'We appreciate your interest in our products and are delighted to provide the following price for {{product_name}}.',
      '',
      'Quantity: {{quantity}}',
      'Tare weight — Approx. 4,200 kg',
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
      specRow('1.1', 'Model No.', 'VFT-30T'),
      specRow('1.2', 'Type', '30 m³ Tipper FE Type'),
      specRow('1.3', 'Vehicle', 'Without PTO'),
      specRow('1.4', 'Tare Weight', 'Approx. 4,200 kg'),
      specRow('1.5', 'Construction', 'Tipper made of High Tensile Steel'),
    ],
  },
  {
    sectionType: 'technical',
    title: 'Body Size / Dimensions',
    content: '',
    sequenceNo: 6,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('2.1', 'Length', '7,700 mm'),
      specRow('2.2', 'Internal Length (Mean)', '6,825 mm'),
      specRow('2.3', 'Width (Internal)', '2,350 mm'),
      specRow('2.4', 'Height (Above Chassis Frame)', '2,331 mm'),
      specRow('2.5', 'Internal Height', '1,810 mm'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Construction (Plate Thickness)',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('3.1', 'Side Wall', 'High Tensile Steel, 3 mm (DX-700)'),
      specRow('3.2', 'Floor', 'High Tensile Steel, 5 mm (DX-700)'),
      specRow('3.3', 'Head Board', 'High Tensile Steel, 4 mm and 3 mm'),
      specRow('3.4', 'Tail Door', 'High Tensile Steel, 4 mm'),
      specRow('3.5', 'Subframe', 'High Tensile Steel, 5 mm (DX-700)'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Tipping, Electrical & Accessories',
    content: '',
    sequenceNo: 8,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '4.1',
        'Tipping Equipment',
        'Hyva Make Cylinder — FE 169-4-4825. Tipping kit without Pump & PTO.',
      ),
      specRow('4.2', 'Electrical', '5 Nos. side markers on both sides of tipper'),
      specRow('4.3', 'Other Accessories', 'Triple axle mud-guards'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Painting',
    content: '',
    sequenceNo: 9,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('5.1', 'Surface Preparation', 'Completely shot blasted'),
      specRow('5.2', 'Primer', 'Two layers of anti-corrosive metal primer'),
      specRow('5.3', 'Finish', 'PU surface and PU paint (without lettering)'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Optional / Chargeable Items',
    content: [
      'Extra cabin supports, extra “U” bolts, flat-belt, chassis support, truck bumper, and male coupler are chargeable if required.',
      'Any other connections and flanges required will be on chargeable basis.',
      'RTO registration tax & other charges, insurance will be extra.',
    ].join('\n'),
    sequenceNo: 10,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'scope',
    title: 'Scope of Work',
    content: [
      '1. We will manufacture the 30 m³ Tipper FE Type as per the above specifications.',
      '2. This is standard equipment; any changes requested by the customer will be subject to revised rates.',
      '3. Major maintenance will be done at our works. Owner has to send the vehicle by own arrangement; all expenses on owner’s account.',
      '4. RTO registration tax & other charges, insurance will be extra.',
    ].join('\n'),
    sequenceNo: 11,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'terms',
    title: 'General Sales Terms',
    content: '',
    sequenceNo: 12,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('T.1', 'Jurisdiction', 'Subject to Chhapi Jurisdiction'),
      specRow('T.2', 'Terms of Delivery', 'Ex-works Chhapi, Banaskantha, North Gujarat'),
      specRow(
        'T.3',
        'Payment Terms',
        '40% advance with purchase order and balance against proforma invoice. Advance is non-refundable on cancellation.',
      ),
      specRow('T.4', 'Delivery Time', '10 weeks from receipt of confirmed order with advance'),
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
      'We believe and hope that our affordable rate and other details will be acceptable to you.',
      '',
      'We anticipate accepting your esteemed buy request.',
      '',
      'Thanking you.',
      'Yours faithfully,',
    ].join('\n'),
    sequenceNo: 13,
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
    sequenceNo: 14,
    editable: true,
    contentFormat: 'richtext',
  },
]
