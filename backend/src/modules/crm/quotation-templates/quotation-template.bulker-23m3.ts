/**
 * 175 — 23 m³ Bulker quotation sections.
 * Source: `175.23m3 Bulker.docx` (VF/QUO/26-27/175).
 */

function specRow(sectionNo: string, label: string, value: string, required = true) {
  return { sectionNo, label, value, required }
}

export const BULKER_23M3_SEED_VERSION = 1

export const BULKER_23M3_SEED_SECTIONS: Array<Record<string, unknown>> = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 23 m³ Bulker',
      'Model VFB-23 — 23 m³ Bulker',
      'Pneumatic discharge with dry / oil-free air',
      'Vehicle — 35 GVW',
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
      'We thank you for interest shown in our products and are pleased to offer pricing as under for {{product_name}}.',
      '',
      'Quantity: {{quantity}}',
      'Vehicle — 35 GVW',
      'Tanker Material: Raw Material',
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
      specRow('1.1', 'Model No.', 'VFB-23'),
      specRow('1.2', 'Type', '23 m³ Bulker'),
      specRow('1.3', 'Construction', 'Self-supported pressure vessel made of Mild Steel'),
      specRow('1.4', 'Shell', 'High Tensile Steel, 3 mm thick'),
      specRow('1.5', 'Dish End', 'IS 2062, 5 mm thick'),
      specRow('1.6', 'Leg Supports', 'High Tensile Steel, 4 mm thick'),
      specRow('1.7', 'Vehicle', '35 GVW'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Pipeline & Discharge',
    content: '',
    sequenceNo: 6,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '2.1',
        'Air Inlet Pipeline',
        '3" connection for air inlet with pressure relief valve',
      ),
      specRow(
        '2.2',
        'Material Outlet Pipeline',
        '5" connection for material outlet at rear end of the tanker',
      ),
      specRow('2.3', 'Discharge Method', 'By means of pneumatic pressure with dry and oil-free air'),
      specRow('2.4', 'Material Outlet', 'DN 125 with butterfly valve under 1.95 kg/cm² pressure'),
      specRow(
        '2.5',
        'Aeration Cloth',
        'Synthetic aeration cloth inside tanker for better fluidization and long life',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Manhole, Safety & Access',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('3.1', 'Manhole', 'DN 600 × 2 Nos.'),
      specRow('3.2', 'Pressure Relief Valve', 'Pressure relief valve on vessel'),
      specRow('3.3', 'Inlet Safety Valve', '1" ball valve on inlet pipe to maintain pressure'),
      specRow('3.4', 'Vessel Connection', 'One 3" connection with butterfly valve on vessel'),
      specRow('3.5', 'Catwalk', 'M.S. catwalk on one side — 300 mm wide with handrail and ladder'),
      specRow(
        '3.6',
        'Accessories',
        'Female coupler with cam locks at inlet and outlet, mud guards, 4" pressure gauge with limit marker',
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
      specRow('4.1', 'Surface Preparation', 'Completely shot blasted'),
      specRow(
        '4.2',
        'External Primer',
        'Two layers of anti-corrosive metal primer (heavy duty — zinc phosphate)',
      ),
      specRow('4.3', 'External Finish', 'Two coats of synthetic paint (without lettering)'),
      specRow('4.4', 'Internal Finish', 'Enamel paint'),
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
    sequenceNo: 9,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'scope',
    title: 'Scope of Work',
    content: [
      '1. We will manufacture the 23 m³ Bulker as per the above specifications.',
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
      specRow('T.2', 'Terms of Delivery', 'Ex-works Chhapi, Banaskantha, North Gujarat'),
      specRow(
        'T.3',
        'Payment Terms',
        '30% advance and balance against proforma invoice. Advance is non-refundable on cancellation.',
      ),
      specRow('T.4', 'Delivery Time', '8 weeks from receipt of confirmed order with advance'),
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
      '',
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
