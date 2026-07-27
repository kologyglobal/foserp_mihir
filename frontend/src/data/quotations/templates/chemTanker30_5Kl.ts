import type { QuotationTemplateSection, QuotationSpecRow } from '../../../types/crm'

type TemplateSection = QuotationTemplateSection

function specRow(sectionNo: string, label: string, value: string, required = true): Omit<QuotationSpecRow, 'id'> {
  return { sectionNo, label, value, required }
}

/**
 * 30.5 KL Chemical Tanker Trailer — mapped from VF/QUO/26-27/164
 * Source: `164.30.5 KL Chemical Tanker Trailer.docx`
 */
export const CHEM_TANKER_30_5KL_SECTIONS: TemplateSection[] = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 30.5 KL Chemical Tanker Trailer',
      'Model VFCT-30.5T — Tri-axle chemical tanker semi trailer (without tyres)',
      'Self-supported stainless steel elliptical tanker',
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
      'Vehicle — 4 × 2 (without tyres)',
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
      specRow('1.1', 'Model No.', 'VFCT-30.5T'),
      specRow('1.2', 'Type', '30.5 KL Tri-axle Chemical Tanker Semi Trailer'),
      specRow('1.3', 'Commercial Scope', 'Without tyres (as quoted)'),
      specRow('1.4', 'Construction', 'Self-supported tanker made of Stainless Steel'),
      specRow('1.5', 'Shell', 'S.S. 304L — 6 mm thick'),
      specRow('1.6', 'Dish End', 'S.S. 304L — 6 mm thick'),
      specRow('1.7', 'Baffle Plate', 'S.S. 304L — 6 mm thick × 3 Nos.'),
      specRow('1.8', 'Shape', 'Elliptical'),
      specRow(
        '1.9',
        'Chassis',
        'High Tensile steel 5 mm thick chassis — welded with adequate cross members',
      ),
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
      specRow('2.1', 'Overall Length', '9,600 mm'),
      specRow('2.2', 'Overall Width', '2,550 mm'),
      specRow('2.3', 'Overall Height', '3,750 mm'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Connections, Discharge & Welding',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('3.1', 'Manholes', '3 Nos. DN 450'),
      specRow('3.2', 'Vent', '1 No. 2" vent with 1" ball valve'),
      specRow('3.3', 'Material Inlet', '2 Nos. 8" material inlet'),
      specRow('3.4', 'Discharge', '2" outlet with CF3M ball valve'),
      specRow('3.5', 'Welding', 'All butt joints — Plasma / TIG (Auto)'),
      specRow(
        '3.6',
        'Catwalk',
        '1-side SS 304 catwalk with M.S. hand rail on both sides of catwalk',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Electrical & Painting',
    content: '',
    sequenceNo: 8,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '4.1',
        'Electrical',
        '24 volt electrical system with 7-pin connector; parking, brake and indicator lights',
      ),
      specRow(
        '4.2',
        'Painting',
        'All M.S. parts shot blasted; two layers anti-corrosive metal primer (heavy duty — zinc phosphate); two coats PU paint, min. 110 DFT (without lettering)',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Running Gear',
    content: '',
    sequenceNo: 9,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '5.1',
        'Axles',
        '02 Nos. York axle with pole wheel and sensor (Model-6625) + 01 No. York axle without pole wheel sensor (Model-6625)',
      ),
      specRow('5.2', 'Axle Capacity', '13.0 tons per axle at 105 km/hr'),
      specRow('5.3', 'Axle Beam', '6 inch square axle beam'),
      specRow('5.4', 'Track Length', '1,950 mm'),
      specRow('5.5', 'King Pin', '50.4 mm YORK make — bolted on 12 mm steel plate'),
      specRow(
        '5.6',
        'Suspension',
        'York Tecair 1 HD air suspension, 14 MT capacity — 2 auto lift axle systems',
      ),
      specRow('5.7', 'Tyres', 'NA (quoted without tyres)'),
      specRow('5.8', 'Wheel Rims', '7.5 × 20, 10 holes, 12 Nos. — Wheels India'),
      specRow(
        '5.9',
        'Landing Legs',
        '2 Speed — static capacity 64 Tons and lift capacity 28 Tons per pair',
      ),
      specRow(
        '5.10',
        'Brakes',
        '2-line air brake system with three air tanks (120 L), mechanical slack adjusters, EBS',
      ),
      specRow(
        '5.11',
        'Relay Valve',
        'RE 6 Emergency relay valve M302930 (Wabco Ltd) — M22×1.5 reservoir, M14×1.5 service, M16×1.5 emergency, 4 delivery ports',
      ),
      specRow('5.12', 'Brake Chamber', 'Type 24, port size M16×1.5 — 6 Nos.'),
      specRow(
        '5.13',
        'Other Accessories',
        'Mud-guards and bumper, mild steel valve box, PTFE gaskets, SS 304 fasteners',
      ),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Optional / Chargeable Items',
    content: [
      'Tyres are excluded from the quoted commercial scope.',
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
      '1. We will manufacture the 30.5 KL Chemical Tanker Trailer as per the above specifications.',
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
        '30% advance with purchase order and balance against delivery. Advance is non-refundable on cancellation.',
      ),
      specRow(
        'T.4',
        'Delivery Time',
        'Delivery starts from 40 days from confirmed order date; total 80 days required to complete 10 Nos.',
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

export const CHEM_TANKER_30_5KL_TEMPLATE_ID = 'qtpl-chem-tanker-30-5kl'
export const CHEM_TANKER_30_5KL_TEMPLATE_VERSION = 1
