import type { QuotationTemplateSection, QuotationSpecRow } from '../../../types/crm'

type TemplateSection = QuotationTemplateSection

function specRow(sectionNo: string, label: string, value: string, required = true): Omit<QuotationSpecRow, 'id'> {
  return { sectionNo, label, value, required }
}

/**
 * 42 m³ Hopper Type Flour Bulker — mapped from VF/QUO/26-27/152
 * Source: `152. 42m3 Hopper Type Flour Bulker.docx`
 * Dynamic merge fields: {{quotation_no}}, {{customer_*}}, {{product_*}}, etc.
 */
export const FLOUR_BULKER_42M3_SECTIONS: TemplateSection[] = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 42 m³ Hopper Type Flour Bulker',
      'Model VFB-32 — Hopper type bulker for wheat flour',
      'Pneumatic discharge with dry / oil-free air',
      'Note: 30 ft chassis length required',
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
      'Unladen weight — Approx. 4,590 kg',
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
      specRow('1.1', 'Model No.', 'VFB-32'),
      specRow('1.2', 'Type', '42 m³ Hopper Type Bulker for Flour'),
      specRow(
        '1.3',
        'Construction',
        'Self-supported pressure vessel made of High Tensile Steel',
      ),
      specRow('1.4', 'Shell', 'High Tensile Steel'),
      specRow('1.5', 'Dish End', 'IS 2062 — 5 mm thick'),
      specRow('1.6', 'Leg Supports', 'IS 2062 — 5 mm thick'),
      specRow('1.7', 'Compartments', 'Single'),
      specRow('1.8', 'Unladen Weight', 'Approx. 4,590 kg'),
    ],
  },
  {
    sectionType: 'technical',
    title: 'Dimensions',
    content: '',
    sequenceNo: 6,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('2.1', 'Overall Length', '9,270 mm'),
      specRow('2.2', 'Width', '2,600 mm'),
      specRow('2.3', 'Height above Chassis', '3,050 mm'),
      specRow('2.4', 'Height from Ground Level', '4,250 mm'),
      specRow('2.5', 'Chassis Requirement', '30 ft chassis length required'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Pipeline & Discharge',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '3.1',
        'Air Inlet Pipeline',
        '3" connection for air inlet with pressure relief valve — all pipelines in SS 304',
      ),
      specRow(
        '3.2',
        'Material Outlet Pipeline',
        '5" connection for material outlet at rear end of the tanker — SS 304',
      ),
      specRow(
        '3.3',
        'Discharge Method',
        'By means of pneumatic pressure with dry and oil-free air',
      ),
      specRow(
        '3.4',
        'Material Outlet',
        'DN 125 with butterfly valve under 1.95 kg/cm² pressure',
      ),
      specRow(
        '3.5',
        'Aeration Cloth',
        'Synthetic aeration cloth inside tanker for better fluidization and long life',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Manhole, Safety & Access',
    content: '',
    sequenceNo: 8,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('4.1', 'Manhole', '450 mm × 4 Nos. — S.S. 304'),
      specRow('4.2', 'Pressure Relief Valve', 'Pressure relief valve on vessel'),
      specRow('4.3', 'Inlet Safety Valve', '1" ball valve on inlet pipe to maintain pressure'),
      specRow(
        '4.4',
        'Vessel Connection',
        'One 3" connection with butterfly valve — SS flap with CI body on vessel',
      ),
      specRow(
        '4.5',
        'Catwalk',
        'M.S. catwalk on both sides — 300 mm wide with handrail and ladder',
      ),
      specRow('4.6', 'Accessories', 'Mud guards, 4" pressure gauge with limit marker'),
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
      specRow('5.2', 'External Primer', 'Two layers of heavy-duty primer'),
      specRow('5.3', 'External Finish', 'Two coats of synthetic enamel paint (without lettering)'),
      specRow('5.4', 'Internal Finish', 'Two coats of food-grade epoxy paint'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Optional / Chargeable Items (as quoted)',
    content: [
      'Typical optional lines that may appear on the commercial price table:',
      '• Vibrating motors — 2 Nos.',
      '• Aluminium platform with SS support, SS body butterfly valve',
      '',
      'Extra cabin supports, extra “U” bolts, flat-belt, chassis support, truck bumper, and male coupler are chargeable if required.',
      'Any other connections and flanges required will be on chargeable basis.',
    ].join('\n'),
    sequenceNo: 10,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'scope',
    title: 'Scope of Work',
    content: [
      '1. We will manufacture the hopper type flour bulker as per the above specifications.',
      '2. This is standard equipment; any changes requested by the customer will be subject to revised rates.',
      '3. Major maintenance will be done at our works. Owner has to send the vehicle by own arrangement.',
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
        '30% advance and balance against proforma invoice',
      ),
      specRow('T.4', 'Delivery Time', '60 days from receipt of confirmed order with advance'),
      specRow(
        'T.5',
        'Warranty',
        '12 months against defective material and workmanship. Not responsible for mishandling, accident damage, or consequential loss. No warranty on hydraulic equipment; bought-out items carry OEM warranty.',
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

export const FLOUR_BULKER_42M3_TEMPLATE_ID = 'qtpl-flour-bulker-42m3'
export const FLOUR_BULKER_42M3_TEMPLATE_VERSION = 1
