/** Seed quotation templates for CRM API mode (CRM-P0-3). */

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

function baseSections(family: string): Array<Record<string, unknown>> {
  return [
    { sectionType: 'cover', title: 'Cover Page', content: `${family} — Quotation`, sequenceNo: 1, editable: true },
    { sectionType: 'customer_details', title: 'Customer Details', content: 'Customer name, address, contact person, GSTIN', sequenceNo: 2, editable: true },
    { sectionType: 'introduction', title: 'Introduction', content: 'Thank you for your inquiry. We are pleased to submit our offer for your requirement.', sequenceNo: 3, editable: true },
    { sectionType: 'scope', title: 'Scope of Supply', content: 'Supply of trailer as per agreed specifications including chassis, body, axles, and standard accessories.', sequenceNo: 4, editable: true },
    { sectionType: 'specification', title: 'Product Specification', content: 'Payload, dimensions, material grade, axle configuration, tyre size, and braking system.', sequenceNo: 5, editable: true },
    { sectionType: 'technical', title: 'Technical Details', content: 'Engineering drawings reference, welding standards, and quality compliance.', sequenceNo: 6, editable: true },
    { sectionType: 'commercial', title: 'Commercial Offer', content: 'Pricing as per attached price table. Validity 30 days from date of issue.', sequenceNo: 7, editable: true },
    { sectionType: 'price_table', title: 'Price Table', content: '', sequenceNo: 8, editable: true },
    { sectionType: 'taxes', title: 'Taxes', content: 'GST @ 18% applicable on taxable value as per prevailing law.', sequenceNo: 9, editable: true },
    { sectionType: 'delivery', title: 'Delivery Terms', content: 'Ex-works / FOR destination as agreed. Delivery within 8–12 weeks from PO and advance.', sequenceNo: 10, editable: true },
    { sectionType: 'payment', title: 'Payment Terms', content: '30% advance, 60% against proforma invoice before dispatch, 10% within 15 days of delivery.', sequenceNo: 11, editable: true },
    { sectionType: 'warranty', title: 'Warranty Terms', content: '12 months from date of delivery against manufacturing defects.', sequenceNo: 12, editable: true },
    { sectionType: 'exclusions', title: 'Exclusions', content: 'Registration, insurance, freight beyond agreed terms, and statutory levies unless specified.', sequenceNo: 13, editable: true },
    { sectionType: 'terms', title: 'Terms & Conditions', content: 'Standard terms of sale apply. Force majeure and dispute resolution as per company policy.', sequenceNo: 14, editable: true },
    { sectionType: 'bank', title: 'Bank Details', content: 'Account name, bank, branch, IFSC, account number for remittance.', sequenceNo: 15, editable: true },
    { sectionType: 'signature', title: 'Signature Block', content: 'Authorized signatory — Sales & Marketing', sequenceNo: 16, editable: true },
  ]
}

export const QUOTATION_TEMPLATE_SEED_ROWS: QuotationTemplateSeedRow[] = [
  {
    code: 'STANDARD-TRAILER',
    templateName: 'Standard Trailer Quotation',
    productFamily: 'Trailer',
    version: 1,
    defaultTerms: 'Prices valid for 30 days. Subject to force majeure.',
    defaultWarranty: '12 months manufacturing warranty.',
    defaultExclusions: 'Registration and insurance excluded.',
    sections: baseSections('Standard Trailer'),
  },
  {
    code: '45M3-BULKER',
    templateName: '45 M3 Bulker Trailer Quotation',
    productFamily: 'Bulker',
    version: 1,
    defaultTerms: 'Bulker-specific terms apply.',
    defaultWarranty: '12 months on structure, 6 months on pneumatics.',
    defaultExclusions: 'Compressor and site piping excluded.',
    sections: baseSections('45 M3 Bulker Trailer'),
  },
  {
    code: 'ISO-TANK-26KL',
    templateName: '26 KL ISO Tank Container Quotation',
    productFamily: 'ISO Tank',
    version: 3,
    defaultTerms:
      'Ex-Works Vadodara. GST @ 18% extra. Prices valid 30 days from quotation date. ADR / ISO / CSC compliance documentation included.',
    defaultWarranty: '18 months from dispatch against manufacturing defects on tank shell and frame.',
    defaultExclusions:
      'Freight, insurance, third-party inspection charges beyond agreed scope, and statutory registrations excluded unless specified.',
    sections: baseSections('26 KL ISO Tank'),
  },
  {
    code: 'SIDEWALL',
    templateName: 'Side Wall Trailer Quotation',
    productFamily: 'Side Wall',
    version: 1,
    defaultTerms: 'Standard side wall configuration.',
    defaultWarranty: '12 months warranty.',
    defaultExclusions: 'Tarpaulin and lashing excluded unless specified.',
    sections: baseSections('Side Wall Trailer'),
  },
  {
    code: 'JOB-WORK',
    templateName: 'Job Work / Service Quotation',
    productFamily: 'Job Work',
    version: 1,
    defaultTerms: 'Job work on customer material at agreed rates.',
    defaultWarranty: '30 days on workmanship.',
    defaultExclusions: 'Material cost unless supplied by us.',
    sections: baseSections('Job Work / Service'),
  },
  {
    code: 'SPARE-PARTS',
    templateName: 'Spare Parts Quotation',
    productFamily: 'Spares',
    version: 1,
    defaultTerms: 'Spares against advance or approved credit.',
    defaultWarranty: '90 days on spares.',
    defaultExclusions: 'Fitment and transport unless specified.',
    sections: baseSections('Spare Parts'),
  },
  {
    code: 'FLATBED',
    templateName: 'Flatbed Trailer Quotation',
    productFamily: 'Flatbed',
    version: 1,
    defaultTerms: 'Flatbed standard offer.',
    defaultWarranty: '12 months.',
    defaultExclusions: 'Twist locks and lashing excluded.',
    sections: baseSections('Flatbed Trailer'),
  },
  {
    code: 'LOWBED',
    templateName: 'Low Bed Trailer Quotation',
    productFamily: 'Low Bed',
    version: 1,
    defaultTerms: 'Heavy haul configuration.',
    defaultWarranty: '12 months structural.',
    defaultExclusions: 'Hydraulic ramps optional.',
    sections: baseSections('Low Bed Trailer'),
  },
  {
    code: 'TIPPER',
    templateName: 'Tipper Trailer Quotation',
    productFamily: 'Tipper',
    version: 1,
    defaultTerms: 'Tipper hydraulics as per spec.',
    defaultWarranty: '12 months body, 6 months hydraulics.',
    defaultExclusions: 'Cylinder repair off-site extra.',
    sections: baseSections('Tipper Trailer'),
  },
  {
    code: 'CUSTOM-BUILD',
    templateName: 'Custom Build Quotation',
    productFamily: 'Custom',
    version: 1,
    defaultTerms: 'Engineering sign-off required before production.',
    defaultWarranty: 'As per custom agreement.',
    defaultExclusions: 'Prototype tooling if applicable.',
    sections: baseSections('Custom Build'),
  },
]
