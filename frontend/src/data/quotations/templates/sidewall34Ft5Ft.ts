import type { QuotationTemplateSection, QuotationSpecRow } from '../../../types/crm'

type TemplateSection = QuotationTemplateSection

function specRow(sectionNo: string, label: string, value: string, required = true): Omit<QuotationSpecRow, 'id'> {
  return { sectionNo, label, value, required }
}

/**
 * 34′ × 5′ Side Wall Semi Trailer — mapped from VF/QUO/26-27/156
 * Source: `156.34FT x5ft Side Wall Trailer.docx`
 */
export const SIDEWALL_34FT_5FT_SECTIONS: TemplateSection[] = [
  {
    sectionType: 'cover',
    title: 'Quotation',
    content: [
      'Ref. No.: {{reference_no}}',
      '',
      'Sub: Quotation for supply of 34′ × 5′ Side Wall Semi Trailer',
      'Model VFFT-34T — Tridem axle side wall semi-trailer (without tyres and rims)',
      'Made from High Tensile Steel',
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
      'Approx. weight — 7,300 kg',
      'Vehicle model reference — Tata Signa 5532',
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
      specRow('1.1', 'Model No.', 'VFFT-34T'),
      specRow('1.2', 'Type', '34′ × 5 ft Side wall semi-trailer — tridem axles'),
      specRow('1.3', 'Commercial Scope', 'Without tyres and rims (as quoted)'),
      specRow('1.4', 'Material', 'High Tensile Steel'),
      specRow('1.5', 'Tare Weight', 'Approx. 7,300 kg'),
      specRow('1.6', 'Vehicle Model (reference)', 'Tata Signa 5532'),
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
      specRow('2.1', 'Overall Length', '10,455 mm'),
      specRow('2.2', 'Overall Width', '2,590 mm'),
      specRow('2.3', 'Internal Width', '2,395 mm'),
      specRow('2.4', 'Internal Height', '1,520 mm (5′)'),
      specRow('2.5', 'Height (Top to Ground)', '3,000 mm'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Body Construction',
    content: '',
    sequenceNo: 7,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow('3.1', 'Chassis', '02 Nos. fabricated beams'),
      specRow('3.2', 'Beam — Flange Thickness', '8 mm and 10 mm'),
      specRow('3.3', 'Beam — Web Thickness', '6 mm'),
      specRow('3.4', 'Cross Members', 'Adequately reinforced pressed channels'),
      specRow('3.5', 'Floor', '2.75 mm High Tensile steel with adequate cross members'),
      specRow('3.6', 'Side Wall', '2 mm thick — 5′ height'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Running Gear',
    content: '',
    sequenceNo: 8,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '4.1',
        'Axles',
        '02 Nos. York round beam axle (Model-6625) + 01 No. York round beam axle with lift (Model-6625)',
      ),
      specRow('4.2', 'Axle Capacity', '13.0 tons per axle at 105 km/hr'),
      specRow('4.3', 'Axle Beam', '6 inch'),
      specRow('4.4', 'Track Length', '1,950 mm'),
      specRow(
        '4.5',
        'Suspension',
        'York mono air suspension with manual lift axle + tandem mechanical suspension — 16 MT capacity',
      ),
      specRow('4.6', 'King Pin', '50.4 mm YORK / Jost make — bolted on 12 mm steel plate'),
      specRow(
        '4.7',
        'Landing Legs',
        '2 Speed — static capacity 64 Tons per pair (lift capacity per maker rating)',
      ),
      specRow('4.8', 'Tyres', 'NA (quoted without tyres)'),
      specRow('4.9', 'Rims', 'NA (quoted without rims)'),
      specRow(
        '4.10',
        'Brakes',
        '2-line air brake system with two air tanks (80 L) and mechanical slack adjusters',
      ),
      specRow(
        '4.11',
        'Relay Valve',
        'RE 6 Emergency relay valve M332930 (Webco Ltd) — M22×1.5 reservoir, M14×1.5 service, M16×1.5 emergency, 4 delivery ports',
      ),
      specRow('4.12', 'Brake Chamber', 'Type 24, port size M16×1.5 — 6 Nos.'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Electrical, Paint & Accessories',
    content: '',
    sequenceNo: 9,
    editable: true,
    contentFormat: 'spec_table',
    specRows: [
      specRow(
        '5.1',
        'Electrical',
        '24-volt system with 7-pin connector; parking, brake and indicator lights; rear marker and side reflectors',
      ),
      specRow(
        '5.2',
        'Painting',
        'Chassis completely shot blasted; two layers anti-corrosive metal primer (heavy duty — zinc phosphate); three layers automotive spray paint',
      ),
      specRow('5.3', 'Spare Wheel', 'Spare wheel carrier only — 1 No.'),
      specRow('5.4', 'SUPD', 'Side under-run protection device (included)'),
      specRow('5.5', 'Accessories', 'Tarpaulin holder at front side, mudguards'),
    ],
  },
  {
    sectionType: 'custom',
    title: 'Optional / Chargeable Items',
    content: [
      'Tyres and rims are excluded from the quoted commercial scope.',
      'Any extra fittings, connections, or flanges required will be on chargeable basis.',
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
      '1. We will manufacture the 34′ × 5′ Side Wall Semi Trailer as per the above specifications.',
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
        '30% advance with purchase order and balance against proforma invoice. Advance is non-refundable on cancellation.',
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

export const SIDEWALL_34FT_5FT_TEMPLATE_ID = 'qtpl-sidewall-34ft-5ft'
export const SIDEWALL_34FT_5FT_TEMPLATE_VERSION = 1
