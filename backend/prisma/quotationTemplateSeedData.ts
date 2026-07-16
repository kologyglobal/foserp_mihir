/** Seed quotation templates for CRM API mode (CRM-P0-3).
 * Intentionally only ONE default template — avoid flooding tenants on re-seed.
 */

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

/** Single default template seeded for every tenant. */
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
]
