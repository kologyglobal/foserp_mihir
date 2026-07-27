import type { QuotationTemplateSection, QuotationSpecRow } from '../../../types/crm'

type TemplateSection = QuotationTemplateSection

function specRow(sectionNo: string, label: string, value: string, required = true): Omit<QuotationSpecRow, 'id'> {
  return { sectionNo, label, value, required }
}

/**
 * 31 m³ Tipping Tank — mapped from VF/QUO/26-27/183
 * Source: `183.31m3 Tipping Tank.docx`
 * Dynamic merge fields: {{reference_no}}, {{customer_*}}, {{product_name}}, etc.
 */
export const TIPPING_TANK_31M3_SECTIONS: TemplateSection[] = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 31 m³ Tipping Tanker',
      'Model VFTT-31 — 31 m³ Tipping Tanker',
      'With Complete Hydraulic System',
      'Self-supported SS 316L pressure vessel',
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
      'With Complete Hydraulic System',
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
      specRow('1.1', 'Model No.', 'VFTT-31'),
      specRow('1.2', 'Type', '31 m³ Tipping Tanker'),
      specRow(
        '1.3',
        'Construction',
        'Self-supported pressure vessel made of Stainless Steel',
      ),
      specRow('1.4', 'Shell', 'S.S. 316L, 4 mm thick'),
      specRow('1.5', 'Dish End', 'S.S. 316L, 5 mm thick'),
    ],
  },
  {
    sectionType: 'technical',
    title: 'Chassis & Sub-frame',
    content: '',
    sequenceNo: 6,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '2.1',
        'Chassis',
        'IS 2062, 5 mm thick — fabricated sub-frame, welded with adequate cross members',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Pipeline, Aeration & Discharge',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '3.1',
        'Air Inlet Pipeline',
        '3" connection for air inlet with pressure relief valve',
      ),
      specRow(
        '3.2',
        'Material Outlet Pipeline',
        '5" connection for material outlet at rear end of the trailer',
      ),
      specRow(
        '3.3',
        'Aeration',
        'Aeration cloth inside provided for proper flowability of material',
      ),
      specRow(
        '3.4',
        'Discharge Method',
        'By tipping the tanker with hydraulic cylinder along with air pressure and VFPL discharge hopper DN 300',
      ),
      specRow(
        '3.5',
        'Material Outlet',
        'DN 300 with SS flap butterfly valve under 1.95 kg/cm² pressure. Design pressure 2.5 kg/cm². Venturi and discharge hopper in SS 304',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Manhole, Catwalk & Safety',
    content: '',
    sequenceNo: 8,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('4.1', 'Manhole', 'DN 600 × 3 Nos. M.S.'),
      specRow(
        '4.2',
        'Catwalk',
        'Aluminum catwalk, both sides 300 mm wide with M.S. handrail and ladder',
      ),
      specRow(
        '4.3',
        'Safety',
        'Pressure relief valve on vessel; catwalk with toe guard and railing',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Tipping Equipment',
    content: '',
    sequenceNo: 9,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '5.1',
        'Safety Legs',
        '2 mechanical safety supporting legs at rear of chassis',
      ),
      specRow(
        '5.2',
        'Tipping Kit',
        'Tipping kit with 82 cc/rev with PTO & pump and hydraulic kit FC169/170-4-4640',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Paint & Accessories',
    content: '',
    sequenceNo: 10,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('6.1', 'Surface Preparation', 'Completely shot blasted'),
      specRow(
        '6.2',
        'External Primer',
        'Two layers of heavy-duty primer',
      ),
      specRow(
        '6.3',
        'External Finish',
        'Two coats of synthetic enamel paint (without lettering)',
      ),
      specRow('6.4', 'Internal Finish', 'Enamel paint'),
      specRow('6.5', 'Accessories', 'Aluminum mudguard'),
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
    sequenceNo: 11,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'scope',
    title: 'Scope of Work',
    content: [
      '1. We will manufacture the 31 m³ Tipping Tanker as per the above specifications.',
      '2. This is standard equipment; any changes requested by the customer will be subject to revised rates.',
      '3. Major maintenance will be done at our works. Owner has to send the vehicle by own arrangement; all expenses on owner’s account.',
      '4. RTO registration tax & other charges, insurance will be extra.',
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
        '30% advance and balance against proforma invoice. Advance is non-refundable on cancellation.',
      ),
      specRow('T.4', 'Delivery Time', '12 weeks from receipt of confirmed order with advance'),
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

export const TIPPING_TANK_31M3_TEMPLATE_ID = 'qtpl-tipping-tank-31m3'
export const TIPPING_TANK_31M3_TEMPLATE_VERSION = 1
