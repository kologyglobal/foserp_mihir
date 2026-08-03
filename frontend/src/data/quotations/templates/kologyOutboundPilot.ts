import type { QuotationTemplateSection } from '../../../types/crm'

/**
 * Kology standard outbound pilot proposal — visual layout is driven by
 * `printSkin: 'kology_proposal'` (see KologyProposalPrintDocument).
 * Sections below remain editable in the designer and feed optional overrides.
 */
export const KOLOGY_OUTBOUND_PILOT_TEMPLATE_VERSION = 1

export const KOLOGY_OUTBOUND_PILOT_SECTIONS: QuotationTemplateSection[] = [
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
]
