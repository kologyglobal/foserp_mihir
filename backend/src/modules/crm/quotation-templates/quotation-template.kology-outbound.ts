/**
 * SERVICES (Kology) standard quotation template — outbound pilot proposal.
 * Seeded only for SERVICES tenants; print skin drives the visual layout.
 */
import type { Prisma } from '@prisma/client'

export const KOLOGY_OUTBOUND_PILOT_CODE = 'KOLOGY-OUTBOUND-PILOT'
export const KOLOGY_OUTBOUND_PILOT_VERSION = 1

export const KOLOGY_PROPOSAL_PRINT_LAYOUT_SEED = {
  pageSize: 'A4',
  marginMm: 10,
  fontScale: 1,
  headerStyle: 'cover',
  showLogo: false,
  showCompanyHeader: false,
  showCustomerBlock: false,
  showPageFooter: false,
  showSignatureBlock: false,
  pageBreakBefore: [] as string[],
  printSkin: 'kology_proposal',
}

export const KOLOGY_OUTBOUND_PILOT_SECTIONS = [
  {
    sectionType: 'cover',
    title: 'Cover',
    content: [
      'OUTBOUND PILOT PROPOSAL',
      'Outbound SDR & Pipeline Generation Proposal',
      'A 30-day structured pilot for {{customer_name}}. Kology owns the front of the funnel; {{customer_name}} takes over at qualified handover.',
    ].join('\n'),
    sequenceNo: 1,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'introduction',
    title: 'Executive summary',
    content: [
      '{{customer_name}} needs a structured outbound motion that converts existing leads and generates new pipeline without pulling technical teams into unqualified conversations.',
      'Kology runs a four-week sprint — research, outreach, qualification, meeting-setting and follow-up — and hands over only sales-ready opportunities with clear context.',
    ].join('\n\n'),
    sequenceNo: 2,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'price_table',
    title: 'Commercial price',
    content: '',
    sequenceNo: 3,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'commercial',
    title: 'Commercial terms',
    content: [
      'Pilot fees are monthly and billed in advance for the 30-day engagement window.',
      'GST is extra as applicable.',
      'Tooling / dialer / LinkedIn Sales Navigator costs (if required) are billed at actuals or as agreed.',
      'Invoicing: 100% advance for the pilot month; recurring cycles billed monthly in advance.',
      'Validity: {{validity_days}} days from quotation date.',
    ].join('\n'),
    sequenceNo: 4,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'terms',
    title: 'Engagement terms',
    content: [
      'Engagement type: 30-day outbound pilot, structured as a 4-week sprint.',
      'Kology owns: Research → Outreach → Qualification → Meeting-setting → Follow-up.',
      'Client owns: Technical discussion, demo, proposal, quotation, closure.',
      'Recommended team (Lean): 1 Dedicated SDR + shared Research + shared Campaign Manager.',
      'Recommended pilot fee: INR 60,000 / month (Option A — Lean Pilot).',
      'Time to launch: 5–7 working days from approval.',
    ].join('\n'),
    sequenceNo: 5,
    editable: true,
    contentFormat: 'richtext',
  },
  {
    sectionType: 'signature',
    title: 'Next step',
    content: [
      "Let's turn your database and event plan into a measurable pipeline.",
      'We would be glad to schedule a short introductory call to finalise the pilot structure, confirm Option A or B, lock the target event-city and set a start date.',
      '{{authorized_person}}',
      '{{designation}} — {{company_name}}',
    ].join('\n'),
    sequenceNo: 6,
    editable: true,
    contentFormat: 'richtext',
  },
] as const

export const KOLOGY_OUTBOUND_PILOT_SEED_ROW = {
  code: KOLOGY_OUTBOUND_PILOT_CODE,
  templateName: 'Kology — Outbound Pilot Proposal',
  productFamily: 'Outbound Services',
  version: KOLOGY_OUTBOUND_PILOT_VERSION,
  sections: KOLOGY_OUTBOUND_PILOT_SECTIONS as unknown as Prisma.InputJsonValue,
  defaultTerms:
    'Pilot fees billed monthly in advance. GST extra. Validity 30 days from quotation date.',
  defaultWarranty: '',
  defaultExclusions: 'Tooling / dialer / LinkedIn Sales Navigator billed at actuals unless included.',
  printLayout: KOLOGY_PROPOSAL_PRINT_LAYOUT_SEED as unknown as Prisma.InputJsonValue,
}
