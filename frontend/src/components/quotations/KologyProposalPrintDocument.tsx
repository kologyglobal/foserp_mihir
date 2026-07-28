import { useCallback, useMemo } from 'react'
import type { QuotationDocument, QuotationPrintLayout } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import type { Customer } from '../../types/master'
import type { Opportunity } from '../../types/crm'
import { buildQuotationMergeMap } from '../../utils/quotationEngine/placeholders'
import { useCompanyProfile } from '../../utils/quotationEngine/companyProfile'
import { calcPriceSummary, syncLineTotals } from '../../utils/crmQuotationCalc'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import {
  KOLOGY_PROPOSAL_PRINT_LAYOUT,
  printLayoutClassNames,
  printLayoutStyleVars,
} from '../../utils/quotationEngine/printLayout'
import { cn } from '../../utils/cn'
import { CompanyBankDetailsBlock } from '../print/CompanyBankDetailsBlock'
import { EditableText } from '../print/EditableText'

interface Props {
  doc: QuotationDocument
  quotation: Quotation
  customer?: Customer
  opportunity?: Opportunity
  contactName?: string
  className?: string
  printLayout?: QuotationPrintLayout
  /** Enables inline WYSIWYG editing of the static proposal copy (template preview editor). */
  editable?: boolean
  /** Called with (fieldId, newText) whenever an editable field is committed (blur). */
  onContentChange?: (id: string, value: string) => void
}

function DotGrid({ className }: { className?: string }) {
  return (
    <div className={cn('kology-prop__dot-grid', className)} aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

function SectionNo({ n }: { n: string }) {
  return <span className="kology-prop__sec-no">{n}</span>
}

/** Static, ordered list where every item is independently editable. */
function ChevronList({
  items,
  idPrefix,
  editable,
  contentOverrides,
  onContentChange,
}: {
  items: string[]
  idPrefix: string
  editable?: boolean
  contentOverrides?: Record<string, string>
  onContentChange?: (id: string, value: string) => void
}) {
  return (
    <ul className="kology-prop__chevron-list">
      {items.map((item, i) => {
        const id = `${idPrefix}.${i}`
        return (
          <li key={i}>
            <EditableText
              id={id}
              value={contentOverrides?.[id] ?? item}
              editable={editable}
              onChange={onContentChange}
              as="span"
            />
          </li>
        )
      })}
    </ul>
  )
}

/** Professional letterhead: real logo + company block (matches Kology print standard). */
function KologyLetterhead({
  legalName,
  logoUrl,
  addressLines,
  phone,
  email,
  website,
  gstin,
}: {
  legalName: string
  logoUrl: string
  addressLines: string[]
  phone: string
  email: string
  website?: string
  gstin: string
}) {
  const contactLine = [phone, email, website].filter(Boolean).join(' · ')
  return (
    <header className="kology-prop__letterhead">
      <div className="kology-prop__letterhead-bar" aria-hidden />
      <div className="kology-prop__letterhead-row">
        <div className="kology-prop__letterhead-logo-wrap">
          <img
            className="kology-prop__letterhead-logo"
            src={logoUrl}
            alt={legalName}
          />
        </div>
        <div className="kology-prop__letterhead-info">
          <p className="kology-prop__letterhead-name">{legalName}</p>
          {addressLines.map((line) => (
            <p key={line} className="kology-prop__letterhead-line">
              {line}
            </p>
          ))}
          {contactLine ? (
            <p className="kology-prop__letterhead-contact">{contactLine}</p>
          ) : null}
          {gstin ? (
            <p className="kology-prop__letterhead-gstin">GSTIN: {gstin}</p>
          ) : null}
        </div>
      </div>
    </header>
  )
}

/**
 * Printable / PDF-export layout for Kology's standard outbound pilot proposal.
 * Visual structure mirrors the approved VBTI Outbound Pilot Proposal PDF.
 *
 * Most of this document is static boilerplate copy rather than data pulled
 * from the quotation/customer. That static copy is wrapped in `EditableText`
 * so the template preview page can offer an inline WYSIWYG editor — edits are
 * persisted as `printLayout.contentOverrides[id]`. Sentences that interpolate
 * live merge fields (customer name, dates, computed pricing) are intentionally
 * left read-only here since they come from the document being printed, not
 * from the reusable template copy.
 */
export function KologyProposalPrintDocument({
  doc,
  quotation,
  customer,
  opportunity,
  contactName,
  className,
  printLayout = KOLOGY_PROPOSAL_PRINT_LAYOUT,
  editable,
  onContentChange,
}: Props) {
  const company = useCompanyProfile()
  const map = useMemo(
    () => buildQuotationMergeMap({ document: doc, quotation, customer, opportunity, contactName }),
    [doc, quotation, customer, opportunity, contactName],
  )
  const lines = syncLineTotals(doc.priceLines)
  const summary = calcPriceSummary(lines, 0, doc.installationAmount, doc.customCharges)
  const hasLivePrice = lines.some((l) => l.qty > 0 && l.unitPrice > 0)
  const feeDisplay = hasLivePrice ? formatCrmCurrency(summary.grandTotal) : 'INR 60K'
  const client = map.customer_name !== '—' ? map.customer_name : 'Client'
  const contact = map.contact_person !== '—' ? map.contact_person : client
  const preparedBy = map.authorized_person !== '—' ? map.authorized_person : 'Mihir Bhatt'
  const designation = map.designation !== '—' ? map.designation : 'CEO'
  const validity = map.validity_days !== '—' ? `${map.validity_days} days` : '30 days'
  const layoutClass = printLayoutClassNames(printLayout)
  const addressLines = (company.address || '')
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean)
  const contentOverrides = printLayout.contentOverrides

  /**
   * Shorthand for the common case: editable span/paragraph bound to
   * contentOverrides. Memoized via useCallback so its identity stays stable
   * across unrelated re-renders (only changes when edit state truly
   * changes) — this avoids remounting every field's contentEditable node,
   * which would otherwise interrupt an in-progress edit.
   */
  const Text = useCallback(
    ({
      id,
      fallback,
      as,
      multiline,
      className: fieldClassName,
    }: {
      id: string
      fallback: string
      as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div' | 'strong' | 'li' | 'td' | 'th'
      multiline?: boolean
      className?: string
    }) => (
      <EditableText
        id={id}
        value={contentOverrides?.[id] ?? fallback}
        editable={editable}
        onChange={onContentChange}
        as={as}
        multiline={multiline}
        className={fieldClassName}
      />
    ),
    [contentOverrides, editable, onContentChange],
  )

  return (
    <article
      className={cn(
        'quo-print-doc',
        'quo-print-doc--skin-kology-proposal',
        layoutClass,
        editable && 'quo-print-doc--editing',
        className,
      )}
      style={printLayoutStyleVars(printLayout)}
    >
      {/* ── Page 1: Letterhead + Hero + Executive summary ──────────────── */}
      <section className="kology-prop__page">
        <KologyLetterhead
          legalName={company.legalName}
          logoUrl={company.logoUrl || '/brand/kology-logo.webp'}
          addressLines={addressLines}
          phone={company.phone}
          email={company.email}
          website={company.website}
          gstin={company.gstin}
        />
        <header className="kology-prop__hero">
          <div className="kology-prop__hero-top">
            <div className="kology-prop__brand">{company.brandName || 'Kology'}</div>
            <DotGrid />
          </div>
          <p className="kology-prop__eyebrow">
            <span className="kology-prop__eyebrow-rule" />
            <Text id="hero.eyebrow" fallback="Outbound Pilot Proposal" as="span" />
          </p>
          <h1 className="kology-prop__hero-title">
            <Text id="hero.title" fallback="Outbound SDR & Pipeline Generation Proposal" as="span" />
          </h1>
          <p className="kology-prop__hero-lead">
            A 30-day structured pilot for {client}. Kology owns the front of the funnel; {client} takes
            over at qualified handover.
          </p>
          <div className="kology-prop__meta-bar">
            <div>
              <span><Text id="hero.meta.preparedForLabel" fallback="Prepared for" as="span" /></span>
              <strong>
                {contact}
                {client !== contact ? `, ${client}` : ''}
              </strong>
            </div>
            <div>
              <span><Text id="hero.meta.preparedByLabel" fallback="Prepared by" as="span" /></span>
              <strong>
                {preparedBy}, {designation} · Kology
              </strong>
            </div>
            <div>
              <span><Text id="hero.meta.dateLabel" fallback="Date" as="span" /></span>
              <strong>{map.quotation_date}</strong>
            </div>
            <div>
              <span><Text id="hero.meta.validityLabel" fallback="Validity" as="span" /></span>
              <strong>{validity}</strong>
            </div>
          </div>
          <p className="kology-prop__confidential">
            Confidential — prepared exclusively for {client}. Quotation {map.quotation_no}
          </p>
        </header>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <span className="kology-prop__badge">SUM</span>
            <Text id="summary.heading" fallback="Executive summary" as="span" />
          </h2>
          <p className="kology-prop__body">
            {client} needs a structured outbound motion that converts existing leads and generates new
            pipeline without pulling technical teams into unqualified conversations.
          </p>
          <Text
            id="summary.p2"
            fallback="Kology runs a four-week sprint — research, outreach, qualification, meeting-setting and follow-up — and hands over only sales-ready opportunities with clear context."
            as="p"
            className="kology-prop__body"
          />
          <div className="kology-prop__metric-row">
            <div className="kology-prop__metric-card">
              <strong>{feeDisplay}</strong>
              <Text id="summary.metric.fee.label" fallback="Recommended pilot fee / month" as="span" />
            </div>
            <div className="kology-prop__metric-card">
              <strong><Text id="summary.metric.duration.value" fallback="30 days" as="span" /></strong>
              <Text id="summary.metric.duration.label" fallback="Pilot as a 4-week sprint" as="span" />
            </div>
            <div className="kology-prop__metric-card">
              <strong><Text id="summary.metric.meetings.value" fallback="12–20" as="span" /></strong>
              <Text id="summary.metric.meetings.label" fallback="Qualified meetings (indicative)" as="span" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Page 2: At a glance + understanding ────────────────────────── */}
      <section className="kology-prop__page kology-prop__page--break">
        <div className="kology-prop__glance">
          <div className="kology-prop__glance-head">
            <Text id="glance.heading" fallback="At a glance" as="span" />
          </div>
          <table className="kology-prop__glance-table">
            <tbody>
              <tr>
                <th><Text id="glance.row1.th" fallback="Engagement type" as="span" /></th>
                <td><Text id="glance.row1.td" fallback="30-day outbound pilot, structured as a 4-week sprint." as="span" /></td>
              </tr>
              <tr>
                <th><Text id="glance.row2.th" fallback="Kology owns" as="span" /></th>
                <td><Text id="glance.row2.td" fallback="Research → Outreach → Qualification → Meeting-setting → Follow-up." as="span" /></td>
              </tr>
              <tr>
                <th>{client} owns</th>
                <td><Text id="glance.row3.td" fallback="Technical discussion, demo, proposal, quotation, closure." as="span" /></td>
              </tr>
              <tr>
                <th><Text id="glance.row4.th" fallback="Recommended team" as="span" /></th>
                <td><Text id="glance.row4.td" fallback="1 Dedicated SDR + shared Research + shared Campaign Manager." as="span" /></td>
              </tr>
              <tr>
                <th><Text id="glance.row5.th" fallback="Recommended pilot fee" as="span" /></th>
                <td>
                  <strong><Text id="glance.row5.tdBold" fallback="INR 60,000 / month" as="span" /></strong>{' '}
                  <Text id="glance.row5.tdSuffix" fallback="(Lean Pilot, Option A)." as="span" />
                </td>
              </tr>
              <tr>
                <th><Text id="glance.row6.th" fallback="Time to launch" as="span" /></th>
                <td><Text id="glance.row6.td" fallback="5–7 working days from approval." as="span" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="01" />
            <Text id="understanding.heading" fallback="Our understanding of your requirement" as="span" />
          </h2>
          <Text
            id="understanding.body"
            fallback="The brief is clear: activate dormant and warm leads, enrich decision-maker coverage for priority sectors and event cities, and book qualified meetings that your team can close."
            as="p"
            className="kology-prop__body"
          />
          <div className="kology-prop__tint-box">
            <p className="kology-prop__tint-label">What {client} does</p>
            <p className="kology-prop__body kology-prop__body--tight">
              {client} delivers specialised solutions to infrastructure, industrial and commercial
              buyers. Outbound must speak the language of project owners, consultants and plant /
              facility decision-makers.
            </p>
          </div>
          <h3 className="kology-prop__h3">
            <Text id="understanding.sectorsHeading" fallback="Priority target sectors" as="span" />
          </h3>
          <div className="kology-prop__sector-grid">
            {[
              ['Airports & transport', 'Airports, metros, ports, large transport infrastructure'],
              ['Industrial plants', 'Process plants, manufacturing campuses, utilities'],
              ['Commercial complexes', 'Campuses, malls, offices, mixed-use developments'],
              ['Infra & capital projects', 'EPC, capital equipment and large infra programmes'],
            ].map(([title, sub], i) => (
              <div key={i} className="kology-prop__sector-card">
                <strong><Text id={`understanding.sector.${i}.title`} fallback={title} as="span" /></strong>
                <Text id={`understanding.sector.${i}.sub`} fallback={sub} as="span" />
              </div>
            ))}
          </div>
          <h3 className="kology-prop__h3">
            <Text id="understanding.motionsHeading" fallback="The two motions you need" as="span" />
          </h3>
          <div className="kology-prop__motion-row">
            <div className="kology-prop__motion kology-prop__motion--a">
              <span><Text id="understanding.motion.0.label" fallback="Motion 01" as="span" /></span>
              <strong><Text id="understanding.motion.0.title" fallback="Existing-lead follow-up" as="span" /></strong>
              <Text id="understanding.motion.0.body" fallback="Re-engage warm and dormant leads with a disciplined multi-touch cadence." as="p" />
            </div>
            <div className="kology-prop__motion kology-prop__motion--b">
              <span><Text id="understanding.motion.1.label" fallback="Motion 02" as="span" /></span>
              <strong><Text id="understanding.motion.1.title" fallback="New lead generation & enrichment" as="span" /></strong>
              <Text id="understanding.motion.1.body" fallback="Build and enrich decision-maker lists for target sectors and event cities." as="p" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Page 3: Scope + process ────────────────────────────────────── */}
      <section className="kology-prop__page kology-prop__page--break">
        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="02" />
            <Text id="scope.heading" fallback="Scope of work & division of responsibility" as="span" />
          </h2>
          <Text
            id="scope.body"
            fallback="A clean split keeps technical experts focused on closing while Kology owns top-of-funnel velocity."
            as="p"
            className="kology-prop__body"
          />
          <div className="kology-prop__own-row">
            <div className="kology-prop__own kology-prop__own--kology">
              <h3><Text id="scope.kologyOwnsHeading" fallback="Kology owns" as="span" /></h3>
              <ChevronList
                idPrefix="scope.kologyOwns"
                editable={editable}
                contentOverrides={contentOverrides}
                onContentChange={onContentChange}
                items={[
                  'ICP validation & messaging kit',
                  'List research & enrichment',
                  'Multi-channel outreach cadence',
                  'Qualification & meeting-setting',
                  'Follow-up discipline & reporting',
                ]}
              />
            </div>
            <div className="kology-prop__own kology-prop__own--client">
              <h3>{client} owns</h3>
              <ChevronList
                idPrefix="scope.clientOwns"
                editable={editable}
                contentOverrides={contentOverrides}
                onContentChange={onContentChange}
                items={[
                  'Product / technical briefing',
                  'Demo & discovery calls',
                  'Commercial proposal & quotation',
                  'Negotiation & closure',
                  'CRM ownership of closed deals',
                ]}
              />
            </div>
          </div>
          <div className="kology-prop__callout">
            <strong><Text id="scope.calloutLabel" fallback="Handover definition —" as="span" /></strong> a qualified meeting or demo with a confirmed
            decision-maker, clear need context, and agreed next step for {client}&apos;s team.
          </div>
        </div>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="03" />
            <Text id="approach.heading" fallback="Recommended approach & channels" as="span" />
          </h2>
          <div className="kology-prop__flow">
            <p className="kology-prop__flow-label">
              <Text id="approach.flowLabel" fallback="Process flow" as="span" />
            </p>
            <div className="kology-prop__flow-steps">
              {['Data', 'Outreach', 'Qualification', 'Meeting set', 'Follow-up'].map((step, i) => (
                <div key={step} className="kology-prop__flow-item">
                  {i > 0 ? <span className="kology-prop__flow-arrow">→</span> : null}
                  <span className="kology-prop__flow-chip">
                    <Text id={`approach.flow.${i}`} fallback={step} as="span" />
                  </span>
                </div>
              ))}
              <div className="kology-prop__flow-item">
                <span className="kology-prop__flow-arrow">→</span>
                <span className="kology-prop__flow-chip kology-prop__flow-chip--end">
                  Handover to {client}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Page 4: Channels + cadence ─────────────────────────────────── */}
      <section className="kology-prop__page kology-prop__page--break">
        <div className="kology-prop__block">
          <h3 className="kology-prop__h3">
            <Text id="channels.heading" fallback="Channels & how we use them" as="span" />
          </h3>
          <table className="kology-prop__data-table">
            <thead>
              <tr>
                <th><Text id="channels.col0" fallback="Channel" as="span" /></th>
                <th><Text id="channels.col1" fallback="How we use it" as="span" /></th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Cold calling', 'Primary engine for DM conversations, qualification and meeting locks.'],
                ['Email', 'Personalised sequences for value messaging, reminders and nurture.'],
                ['LinkedIn', 'Connect + message plays for hard-to-reach stakeholders and multi-threading.'],
                ['CRM / tracker', 'Single source of truth for activity, stage and daily hot-opportunity escalation.'],
              ].map(([label, desc], i) => (
                <tr key={i}>
                  <td><Text id={`channels.row${i}.label`} fallback={label} as="span" /></td>
                  <td><Text id={`channels.row${i}.desc`} fallback={desc} as="span" /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="kology-prop__h3">
            <Text id="cadence.heading" fallback="Calling & follow-up cadence" as="span" />
          </h3>
          <div className="kology-prop__cadence">
            {[
              ['Day 1', 'navy', 'First touch — call + email introduction'],
              ['Day 2–3', 'blue', 'Second attempt + LinkedIn connect'],
              ['Day 4–5', 'navy', 'Value follow-up with case proof / event hook'],
              ['Day 7–8', 'blue', 'Re-qualification push on engaged prospects'],
              ['Pre-mtg', 'teal', 'Confirmation + agenda + reminder call'],
              ['Ongoing', 'mint', 'Nurture sequence for warm / deferred leads'],
            ].map(([pill, tone, text], i) => (
              <div key={i} className="kology-prop__cadence-row">
                <span className={`kology-prop__pill kology-prop__pill--${tone}`}>
                  <Text id={`cadence.${i}.pill`} fallback={pill} as="span" />
                </span>
                <span><Text id={`cadence.${i}.text`} fallback={text} as="span" /></span>
              </div>
            ))}
          </div>

          <h2 className="kology-prop__h2">
            <SectionNo n="04" />
            <Text id="sprint.heading" fallback="The 30-day pilot — weekly sprint plan" as="span" />
          </h2>
          <Text
            id="sprint.body"
            fallback="Each week has a clear objective, activity set, deliverable and review gate so progress is measurable from day one."
            as="p"
            className="kology-prop__body"
          />
        </div>
      </section>

      {/* ── Page 5–6: Weekly cards + targets ───────────────────────────── */}
      <section className="kology-prop__page kology-prop__page--break">
        {[
          {
            week: 'Week 1',
            title: 'Onboarding, setup & launch',
            objective: `Get fully ramped on ${client}'s solution and market, set up systems, and begin live outreach on the existing database.`,
            objectiveEditable: false,
            tags: ['Product & industry training', 'ICP & messaging sign-off', 'Playbook & scripts', 'CRM & tracker setup', 'First-touch calling on warm leads'],
            deliverable: 'Approved messaging kit, scripts, live tracker, first calls underway',
            gate: 'Kick-off review: confirm messaging, ICP & enrichment city',
          },
          {
            week: 'Week 2',
            title: 'Full outreach & data enrichment',
            objective: 'Run the existing-lead motion at full pace while building the enriched decision-maker list for the target event-city.',
            objectiveEditable: true,
            tags: ['Daily multi-channel outreach', 'City-wise DM enrichment', 'First qualified conversations', 'Cadence enforcement', 'Mid-pilot messaging tuning'],
            deliverable: 'Enriched decision-maker list + first qualified meetings scheduled',
            gate: 'Response-rate read, objection themes, pitch refinement',
          },
          {
            week: 'Week 3',
            title: 'Qualification & meeting generation',
            objective: 'Convert engaged prospects into booked meetings and demo/event confirmations; drive event attendance.',
            objectiveEditable: true,
            tags: ['Intensive qualification calls', 'Book meetings, demos, high-teas', 'Reminder-call discipline', 'Warm handover with context', 'Daily hot-opportunity escalation'],
            deliverable: 'Pipeline of scheduled meetings/demos + confirmed event attendees',
            gate: 'Meetings vs. target, handover quality, event readiness',
          },
        ].map((w, wi) => (
          <div key={w.week} className="kology-prop__week-card">
            <div className="kology-prop__week-head">
              <span className="kology-prop__week-badge">{w.week}</span>
              <strong><Text id={`week.${wi}.title`} fallback={w.title} as="span" /></strong>
            </div>
            <p>
              <strong>Objective —</strong>{' '}
              {w.objectiveEditable ? (
                <Text id={`week.${wi}.objective`} fallback={w.objective} as="span" />
              ) : (
                w.objective
              )}
            </p>
            <div className="kology-prop__tags">
              {w.tags.map((t, ti) => (
                <span key={ti}><Text id={`week.${wi}.tag.${ti}`} fallback={t} as="span" /></span>
              ))}
            </div>
            <p>
              <strong className="kology-prop__label-blue">Deliverable ·</strong>{' '}
              <Text id={`week.${wi}.deliverable`} fallback={w.deliverable} as="span" />
            </p>
            <p>
              <strong className="kology-prop__label-teal">Review gate ·</strong>{' '}
              <Text id={`week.${wi}.gate`} fallback={w.gate} as="span" />
            </p>
          </div>
        ))}
      </section>

      <section className="kology-prop__page kology-prop__page--break">
        <div className="kology-prop__week-card kology-prop__week-card--bar">
          <div className="kology-prop__week-bar">
            <span className="kology-prop__week-badge">Week 4</span>
            <strong><Text id="week4.title" fallback="Conversion push, reporting & scale plan" as="span" /></strong>
          </div>
          <p>
            <strong>Objective —</strong>{' '}
            <Text
              id="week4.objective"
              fallback="Final conversion push on warm opportunities, close the pilot report and recommend the scale model."
              as="span"
            />
          </p>
          <div className="kology-prop__tags">
            {['Final push on warm leads', 'Meeting conversion', 'Pilot scorecard', 'Learnings pack', 'Data-backed scale plan'].map((t, i) => (
              <span key={i}><Text id={`week4.tag.${i}`} fallback={t} as="span" /></span>
            ))}
          </div>
          <p>
            <strong className="kology-prop__label-blue">Deliverable ·</strong>{' '}
            <Text id="week4.deliverable" fallback="Pilot report + recommended Option A/B scale plan" as="span" />
          </p>
          <p>
            <strong className="kology-prop__label-teal">Review gate ·</strong>{' '}
            <Text id="week4.gate" fallback="Go / no-go on continuing engagement" as="span" />
          </p>
        </div>

        <table className="kology-prop__data-table">
          <thead>
            <tr>
              <th>Week</th>
              <th><Text id="weekTable.colFocus" fallback="Focus" as="span" /></th>
              <th><Text id="weekTable.colOutcome" fallback="Primary outcome" as="span" /></th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Week 1', 'Onboarding & launch', 'Live outreach underway'],
              ['Week 2', 'Outreach & enrichment', 'First meetings + DM list'],
              ['Week 3', 'Qualification', 'Meeting / demo pipeline'],
              ['Week 4', 'Conversion & scale', 'Pilot report + scale plan'],
            ].map(([week, focus, outcome], i) => (
              <tr key={i}>
                <td><strong>{week}</strong></td>
                <td><Text id={`weekTable.${i}.focus`} fallback={focus} as="span" /></td>
                <td><Text id={`weekTable.${i}.outcome`} fallback={outcome} as="span" /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="05" />
            <Text id="targets.heading" fallback="Expected output & activity targets" as="span" />
          </h2>
          <Text
            id="targets.body"
            fallback="Figures below are indicative operating benchmarks for a Lean Pilot — not contractual guarantees. Actuals depend on list quality, ICP fit and offer complexity."
            as="p"
            className="kology-prop__body"
          />
          <table className="kology-prop__data-table kology-prop__data-table--nums">
            <thead>
              <tr>
                <th><Text id="targets.col0" fallback="Metric" as="span" /></th>
                <th><Text id="targets.col1" fallback="Weekly (indicative)" as="span" /></th>
                <th><Text id="targets.col2" fallback="30-day (indicative)" as="span" /></th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Outbound calls', '250–350', '1,000–1,400', false],
                ['LinkedIn connects', '80–120', '320–480', false],
                ['Personalised emails', '150–250', '600–1,000', false],
                ['Qualified meetings / demos', '3–5', '12–20', true],
              ].map(([metric, weekly, monthly, highlight], i) => (
                <tr key={i} className={highlight ? 'kology-prop__highlight-row' : undefined}>
                  <td><Text id={`targets.row${i}.metric`} fallback={metric as string} as="span" /></td>
                  <td><Text id={`targets.row${i}.weekly`} fallback={weekly as string} as="span" /></td>
                  <td><Text id={`targets.row${i}.monthly`} fallback={monthly as string} as="span" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Page 7: Team + commercial ──────────────────────────────────── */}
      <section className="kology-prop__page kology-prop__page--break">
        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="06" />
            <Text id="team.heading" fallback="Team structure — two engagement options" as="span" />
          </h2>
          <table className="kology-prop__data-table">
            <thead>
              <tr>
                <th><Text id="team.col0" fallback="Role" as="span" /></th>
                <th><Text id="team.col1" fallback="Option A — Lean" as="span" /></th>
                <th><Text id="team.col2" fallback="Option B — Standard" as="span" /></th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Dedicated SDR', '1 · full-time', '1 · full-time', false, false],
                ['BDR', 'Shared / partial', '1 · full-time', false, true],
                ['Data Research Specialist', 'Shared resource', '1 · full-time', false, true],
                ['Campaign Manager', 'Included (shared)', 'Included (shared)', true, true],
              ].map(([role, a, b, tealBoth, boldB], i) => (
                <tr key={i}>
                  <td><Text id={`team.row${i}.role`} fallback={role as string} as="span" /></td>
                  <td className={tealBoth ? 'kology-prop__teal-text' : undefined}>
                    <Text id={`team.row${i}.a`} fallback={a as string} as="span" />
                  </td>
                  <td className={tealBoth ? 'kology-prop__teal-text' : undefined}>
                    {boldB ? (
                      <strong><Text id={`team.row${i}.b`} fallback={b as string} as="span" /></strong>
                    ) : (
                      <Text id={`team.row${i}.b`} fallback={b as string} as="span" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="kology-prop__callout">
            <strong><Text id="team.calloutLabel" fallback="Recommendation —" as="span" /></strong>{' '}
            <Text
              id="team.calloutBody"
              fallback="start with Option A (Lean Pilot) to prove channel-market fit, then scale to Option B once meeting quality and conversion are validated."
              as="span"
            />
          </div>
        </div>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="07" />
            <Text id="commercial.heading" fallback="Commercial proposal" as="span" />
          </h2>
          <div className="kology-prop__price-row">
            <div className="kology-prop__price-card kology-prop__price-card--rec">
              <span className="kology-prop__rec-badge">
                <Text id="commercial.priceA.badge" fallback="Recommended" as="span" />
              </span>
              <h3><Text id="commercial.priceA.title" fallback="Option A — Lean Pilot" as="span" /></h3>
              <p><Text id="commercial.priceA.desc" fallback="1 Dedicated SDR + shared research & campaign support" as="span" /></p>
              <div className="kology-prop__price">
                <Text id="commercial.priceA.amount" fallback="INR 60,000" as="span" />
                <span><Text id="commercial.priceA.unit" fallback="per month" as="span" /></span>
              </div>
            </div>
            <div className="kology-prop__price-card">
              <h3><Text id="commercial.priceB.title" fallback="Option B — Standard" as="span" /></h3>
              <p><Text id="commercial.priceB.desc" fallback="Dedicated SDR + BDR + Data Research + shared campaign" as="span" /></p>
              <div className="kology-prop__price">
                <Text id="commercial.priceB.amount" fallback="INR 1,15,000" as="span" />
                <span><Text id="commercial.priceB.unit" fallback="per month" as="span" /></span>
              </div>
            </div>
          </div>
          <h3 className="kology-prop__h3">
            <Text id="rates.heading" fallback="Per-resource monthly rates (dedicated model)" as="span" />
          </h3>
          <table className="kology-prop__data-table kology-prop__data-table--nums">
            <thead>
              <tr>
                <th><Text id="rates.col0" fallback="Resource" as="span" /></th>
                <th><Text id="rates.col1" fallback="Rate (INR / month)" as="span" /></th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Dedicated SDR / BDR Executive', '45,000'],
                ['Data Research Executive', '25,000'],
              ].map(([role, rate], i) => (
                <tr key={i}>
                  <td><Text id={`rates.row${i}.role`} fallback={role} as="span" /></td>
                  <td><Text id={`rates.row${i}.rate`} fallback={rate} as="span" /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasLivePrice ? (
            <div className="kology-prop__live-price">
              <h3 className="kology-prop__h3">
                <Text id="livePrice.heading" fallback="Quotation line items" as="span" />
              </h3>
              <table className="kology-prop__data-table kology-prop__data-table--nums">
                <thead>
                  <tr>
                    <th><Text id="livePrice.col0" fallback="Description" as="span" /></th>
                    <th><Text id="livePrice.col1" fallback="Qty" as="span" /></th>
                    <th><Text id="livePrice.col2" fallback="Rate" as="span" /></th>
                    <th><Text id="livePrice.col3" fallback="Amount" as="span" /></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.description || l.itemNameSnapshot || l.productOrItem || 'Service line'}</td>
                      <td>{l.qty}</td>
                      <td>{formatCrmCurrency(l.unitPrice)}</td>
                      <td>{formatCrmCurrency(l.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr className="kology-prop__highlight-row">
                    <td colSpan={3}><Text id="livePrice.grandTotalLabel" fallback="Grand total (incl. tax)" as="span" /></td>
                    <td>{formatCrmCurrency(summary.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Page 8–9: Terms, experience, reporting, Q&A ────────────────── */}
      <section className="kology-prop__page kology-prop__page--break">
        <div className="kology-prop__block">
          <h3 className="kology-prop__h3">
            <Text id="terms.heading" fallback="Commercial terms" as="span" />
          </h3>
          <ul className="kology-prop__chevron-list">
            {[
              'Pilot fees billed monthly in advance for the 30-day engagement window.',
              'GST extra as applicable.',
              'Tooling / dialer / LinkedIn Sales Navigator (if required) billed at actuals or as agreed.',
              'Engagement period: 30 days from go-live; extension by mutual written agreement.',
            ].map((item, i) => (
              <li key={i}><Text id={`terms.${i}`} fallback={item} as="span" /></li>
            ))}
            <li>Validity: {validity} from quotation date ({map.quotation_no}).</li>
          </ul>
        </div>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="08" />
            <Text id="experience.heading" fallback="Relevant experience" as="span" />
          </h2>
          <Text
            id="experience.body"
            fallback="Kology has run consultative outbound programmes for enterprise-software, industrial technology and manufacturing sellers — motions that depend on reaching the right stakeholders, not spray-and-pray volume."
            as="p"
            className="kology-prop__body"
          />
          <div className="kology-prop__exp-grid">
            {[
              ['ERP & enterprise-software vendors', 'Selling into manufacturing & industrial buyers'],
              ['Industrial technology & engineering', 'Capital-equipment providers'],
              ['Manufacturing, SaaS & enterprise', 'Consultative, demo-led sales motions'],
            ].map(([t, s], i) => (
              <div key={i} className="kology-prop__exp-card">
                <strong><Text id={`experience.card.${i}.title`} fallback={t} as="span" /></strong>
                <Text id={`experience.card.${i}.sub`} fallback={s} as="span" />
              </div>
            ))}
          </div>
        </div>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="09" />
            <Text id="reporting.heading" fallback="Reporting & transparency" as="span" />
          </h2>
          <div className="kology-prop__report-grid">
            {[
              'Weekly dashboard of activity & pipeline',
              'Daily escalation of hot opportunities',
              'Call recordings / notes where consented',
              'Weekly review meetings with action log',
            ].map((t, i) => (
              <div key={i} className="kology-prop__report-card">
                › <Text id={`reporting.item.${i}`} fallback={t} as="span" />
              </div>
            ))}
          </div>
          <div className="kology-prop__metric-detail-row">
            <div className="kology-prop__metric-detail">
              <p className="kology-prop__tint-label"><Text id="reporting.detail.0.label" fallback="Cold calling" as="span" /></p>
              <Text
                id="reporting.detail.0.body"
                fallback="Total & connected calls · DM conversations · interested leads · meetings booked · objections logged"
                as="p"
              />
            </div>
            <div className="kology-prop__metric-detail">
              <p className="kology-prop__tint-label"><Text id="reporting.detail.1.label" fallback="Email outreach" as="span" /></p>
              <Text
                id="reporting.detail.1.body"
                fallback="Sent · delivery rate · open rate · reply rate · positive replies · meetings from email"
                as="p"
              />
            </div>
          </div>
          <div className="kology-prop__metric-detail-row">
            <div className="kology-prop__metric-detail">
              <p className="kology-prop__tint-label"><Text id="reporting.detail.2.label" fallback="LinkedIn outreach" as="span" /></p>
              <Text
                id="reporting.detail.2.body"
                fallback="Connection requests · acceptance rate · messages · replies · interested prospects · meetings generated"
                as="p"
              />
            </div>
            <div className="kology-prop__metric-detail">
              <p className="kology-prop__tint-label"><Text id="reporting.detail.3.label" fallback="Campaign summary" as="span" /></p>
              <Text
                id="reporting.detail.3.body"
                fallback="Qualified leads · meetings scheduled · demo status · hot/warm/cold split · pending follow-ups · next-week plan"
                as="p"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="kology-prop__page kology-prop__page--break">
        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="10" />
            <Text id="qa.heading" fallback="Responses to your specific queries" as="span" />
          </h2>
          <div className="kology-prop__qa">
            <div>
              <p className="kology-prop__qa-q">
                <span>a</span> <Text id="qa.0.q" fallback="Can Kology work from our existing lead sheets and CRM?" as="span" />
              </p>
              <p className="kology-prop__qa-a">
                <strong><Text id="qa.0.aBold" fallback="Yes." as="span" /></strong>{' '}
                <Text
                  id="qa.0.aBody"
                  fallback="We ingest your current lists, map them into the pilot tracker, and start Motion 01 within the first week while enrichment for Motion 02 runs in parallel."
                  as="span"
                />
              </p>
            </div>
            <div>
              <p className="kology-prop__qa-q">
                <span>b</span> <Text id="qa.1.q" fallback="Who owns commercial closure?" as="span" />
              </p>
              <p className="kology-prop__qa-a">
                <strong><Text id="qa.1.aBold" fallback="Confirmed —" as="span" /></strong> {client} owns demo, proposal, quotation and closure.
                Kology stops at qualified handover.
              </p>
            </div>
            <div>
              <p className="kology-prop__qa-q">
                <span>c</span> <Text id="qa.2.q" fallback="Can we start with Option A and scale later?" as="span" />
              </p>
              <p className="kology-prop__qa-a">
                <strong><Text id="qa.2.aBold" fallback="Yes," as="span" /></strong>{' '}
                <Text
                  id="qa.2.aBody"
                  fallback="that is the recommended path. Week-4 review includes an explicit go / no-go on moving to Option B."
                  as="span"
                />
              </p>
            </div>
          </div>
        </div>

        <div className="kology-prop__block">
          <h2 className="kology-prop__h2">
            <SectionNo n="11" />
            <Text id="timeline.heading" fallback="Timeline & onboarding" as="span" />
          </h2>
          <div className="kology-prop__onboard-row">
            <div className="kology-prop__onboard-hero">
              <strong><Text id="timeline.days" fallback="5–7" as="span" /></strong>
              <span><Text id="timeline.daysLabel" fallback="Working days to launch" as="span" /></span>
              <Text
                id="timeline.body"
                fallback="Product training, ICP validation, CRM / tracker setup, messaging sign-off and first live calls."
                as="p"
              />
            </div>
            <div className="kology-prop__onboard-need">
              <p className="kology-prop__tint-label">What we&apos;ll need from {client} to start</p>
              <ChevronList
                idPrefix="timeline.need"
                editable={editable}
                contentOverrides={contentOverrides}
                onContentChange={onContentChange}
                items={[
                  'Existing lead sheets / CRM export',
                  'Company / product presentation',
                  'Confirmed target sectors & event city',
                  'Single point of contact for daily escalation',
                  'Access notes for dialer / LinkedIn (if applicable)',
                ]}
              />
            </div>
          </div>
        </div>

        <CompanyBankDetailsBlock bank={company.bankDetails} className="kology-prop__bank" />
      </section>

      {/* ── Page 10: Next step CTA ─────────────────────────────────────── */}
      <section className="kology-prop__page kology-prop__page--break">
        <footer className="kology-prop__cta">
          <p className="kology-prop__eyebrow kology-prop__eyebrow--light">
            <span className="kology-prop__eyebrow-rule" />
            <Text id="cta.eyebrow" fallback="Next step" as="span" />
          </p>
          <h2><Text id="cta.heading" fallback="Let's turn your database and event plan into a measurable pipeline." as="span" /></h2>
          <Text
            id="cta.body"
            fallback="We'd be glad to schedule a short introductory call to finalise the pilot structure, confirm Option A or B, lock the target event-city and set a start date."
            as="p"
          />
          <div className="kology-prop__cta-foot">
            <div>
              <strong>{preparedBy}</strong>
              <span>
                {designation} — {company.brandName || 'Kology'} · Your Sales Outsourcing Partner
              </span>
            </div>
            <div className="kology-prop__cta-brand">
              <img
                className="kology-prop__cta-logo"
                src={company.logoUrl || '/brand/kology-logo.webp'}
                alt={company.brandName || 'Kology'}
              />
              <span>{(company.website || 'www.kology.co').replace(/^https?:\/\//, '').toUpperCase()}</span>
            </div>
          </div>
        </footer>
      </section>
    </article>
  )
}
