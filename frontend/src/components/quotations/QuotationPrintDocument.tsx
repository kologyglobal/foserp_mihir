import { useMemo } from 'react'
import type { QuotationDocument, QuotationPrintLayout, QuotationSpecRow } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import type { Customer } from '../../types/master'
import type { Opportunity } from '../../types/crm'
import { buildQuotationMergeMap, resolvePlaceholders } from '../../utils/quotationEngine/placeholders'
import { useCompanyProfile } from '../../utils/quotationEngine/companyProfile'
import { CompanyBankDetailsBlock } from '../print/CompanyBankDetailsBlock'
import { EditableText } from '../print/EditableText'
import { calcPriceSummary, syncLineTotals } from '../../utils/crmQuotationCalc'
import { amountInWordsINR } from '../../utils/quotationEngine/amountInWords'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import {
  DEFAULT_QUOTATION_PRINT_LAYOUT,
  printLayoutClassNames,
  printLayoutStyleVars,
  sectionHasPageBreak,
} from '../../utils/quotationEngine/printLayout'
import { cn } from '../../utils/cn'
import { useTenantProfileStore } from '../../store/tenantProfileStore'
import { KologyProposalPrintDocument } from './KologyProposalPrintDocument'

export type QuotationSectionFieldChange = (sectionId: string, field: 'title' | 'content', value: string) => void
export type QuotationSpecRowFieldChange = (
  sectionId: string,
  rowId: string,
  field: 'label' | 'value' | 'unit',
  value: string,
) => void

interface QuotationPrintDocumentProps {
  doc: QuotationDocument
  quotation: Quotation
  customer?: Customer
  opportunity?: Opportunity
  contactName?: string
  className?: string
  printLayout?: QuotationPrintLayout
  /** Enables inline WYSIWYG editing on the print canvas (template preview editor). */
  editable?: boolean
  /** kology_proposal skin — persists edits into `printLayout.contentOverrides[id]`. */
  onContentChange?: (id: string, value: string) => void
  /** section-driven skins — persists edits directly onto the section's title/content. */
  onSectionFieldChange?: QuotationSectionFieldChange
  /** section-driven skins — persists edits onto a spec_table row. */
  onSpecRowChange?: QuotationSpecRowFieldChange
}

function SectionTitle({
  sectionId,
  title,
  editable,
  onSectionFieldChange,
  className,
}: {
  sectionId: string
  title: string
  editable?: boolean
  onSectionFieldChange?: QuotationSectionFieldChange
  className?: string
}) {
  return (
    <EditableText
      id={`section-title-${sectionId}`}
      value={title}
      editable={editable}
      onChange={(_id, value) => onSectionFieldChange?.(sectionId, 'title', value)}
      as="h2"
      className={className ?? 'quo-print-section__title'}
    />
  )
}

function PrintSpecTable({
  sectionId,
  rows,
  map,
  editable,
  onSpecRowChange,
}: {
  sectionId: string
  rows: NonNullable<QuotationDocument['sections'][0]['specRows']>
  map: Record<string, string>
  editable?: boolean
  onSpecRowChange?: QuotationSpecRowFieldChange
}) {
  return (
    <table className="quo-print-spec">
      <tbody>
        {rows.map((r: QuotationSpecRow) => (
          <tr key={r.id}>
            <td className="quo-print-spec__no">{r.sectionNo}</td>
            <td className="quo-print-spec__label">
              <EditableText
                id={`spec-${r.id}-label`}
                value={editable ? r.label : resolvePlaceholders(r.label, map)}
                editable={editable}
                onChange={(_id, value) => onSpecRowChange?.(sectionId, r.id, 'label', value)}
                as="span"
              />
            </td>
            <td className="quo-print-spec__value">
              <EditableText
                id={`spec-${r.id}-value`}
                value={editable ? r.value : resolvePlaceholders(r.value, map)}
                editable={editable}
                onChange={(_id, value) => onSpecRowChange?.(sectionId, r.id, 'value', value)}
                as="span"
              />
              {r.unit ? ` ${r.unit}` : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Split cover letter body into meta rows + remaining subject/body lines. */
function parseCoverBody(content: string): { meta: Array<{ label: string; value: string }>; bodyLines: string[] } {
  const lines = content.split('\n')
  const meta: Array<{ label: string; value: string }> = []
  const bodyLines: string[] = []
  let inMeta = true

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      if (meta.length > 0) inMeta = false
      if (!inMeta) bodyLines.push('')
      continue
    }
    if (/^QUOTATION$/i.test(line)) continue
    const m = line.match(/^(Quotation No\.?|Ref\.?\s*No\.?|Date)\s*:\s*(.*)$/i)
    if (inMeta && m) {
      meta.push({ label: m[1].replace(/\s+/g, ' ').replace(/\.$/, ''), value: m[2].trim() || '—' })
      continue
    }
    inMeta = false
    bodyLines.push(raw)
  }

  while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift()
  while (bodyLines.length && !bodyLines[bodyLines.length - 1].trim()) bodyLines.pop()
  return { meta, bodyLines }
}

function QuotationLetterhead({
  map,
  printLayout,
  revisionNo,
  validityDate,
}: {
  map: Record<string, string>
  printLayout: QuotationPrintLayout
  revisionNo: number
  validityDate?: string | null
}) {
  const company = useCompanyProfile()
  return (
    <header className={cn('quo-print-header', printLayout.headerStyle === 'cover' && 'quo-print-header--cover')}>
      <div className="quo-print-header__brand">
        {printLayout.showLogo ? (
          <div className="quo-print-header__logo-wrap">
            <img
              className="quo-print-header__logo-img"
              src={company.logoUrl}
              alt={company.brandName}
            />
          </div>
        ) : null}
        <div className="quo-print-header__identity">
          <h1 className="quo-print-header__company">{company.legalName}</h1>
          {company.tagline ? <p className="quo-print-header__tagline">{company.tagline}</p> : null}
          {printLayout.headerStyle !== 'minimal' ? (
            <>
              <p className="quo-print-header__address">{company.address}</p>
              {company.registeredOffice ? (
                <p className="quo-print-header__address">{company.registeredOffice}</p>
              ) : null}
              <p className="quo-print-header__contact">
                {[company.phone, company.email, company.website].filter(Boolean).join(' · ')}
              </p>
              {company.gstin ? <p className="quo-print-header__gstin">GSTIN: {company.gstin}</p> : null}
            </>
          ) : null}
        </div>
      </div>
      <div className="quo-print-header__meta">
        <p className="quo-print-header__title">QUOTATION</p>
        <dl className="quo-print-header__meta-list">
          <div>
            <dt>Quotation No.</dt>
            <dd>{map.quotation_no}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{map.quotation_date}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>R{revisionNo}</dd>
          </div>
          {validityDate ? (
            <div>
              <dt>Valid till</dt>
              <dd>{validityDate}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </header>
  )
}

export function QuotationPrintDocument({
  doc,
  quotation,
  customer,
  opportunity,
  contactName,
  className,
  printLayout = DEFAULT_QUOTATION_PRINT_LAYOUT,
  editable,
  onContentChange,
  onSectionFieldChange,
  onSpecRowChange,
}: QuotationPrintDocumentProps) {
  const showFreight = !useTenantProfileStore((s) => s.isServices())
  const company = useCompanyProfile()
  const map = useMemo(
    () => buildQuotationMergeMap({ document: doc, quotation, customer, opportunity, contactName }),
    [doc, quotation, customer, opportunity, contactName],
  )
  const sorted = useMemo(() => [...doc.sections].sort((a, b) => a.sequenceNo - b.sequenceNo), [doc.sections])
  const lines = syncLineTotals(doc.priceLines)
  const freightAmount = showFreight ? doc.freightAmount : 0
  const summary = calcPriceSummary(lines, freightAmount, doc.installationAmount, doc.customCharges)
  const layoutClass = printLayoutClassNames(printLayout)
  const isVfWord = printLayout.printSkin === 'vf_word'

  if (printLayout.printSkin === 'kology_proposal') {
    return (
      <KologyProposalPrintDocument
        doc={doc}
        quotation={quotation}
        customer={customer}
        opportunity={opportunity}
        contactName={contactName}
        className={className}
        printLayout={printLayout}
        editable={editable}
        onContentChange={onContentChange}
      />
    )
  }

  return (
    <article
      className={cn('quo-print-doc', layoutClass, editable && 'quo-print-doc--editing', className)}
      style={printLayoutStyleVars(printLayout)}
    >
      {printLayout.showCompanyHeader ? (
        <QuotationLetterhead
          map={map}
          printLayout={printLayout}
          revisionNo={doc.revisionNo}
          validityDate={quotation.validityDate}
        />
      ) : null}

      {printLayout.showCustomerBlock ? (
        <section className="quo-print-customer">
          <p className="quo-print-customer__label">Customer</p>
          <p className="quo-print-customer__to">To,</p>
          <p className="quo-print-customer__name">{map.customer_name}</p>
          <p>{map.customer_address}</p>
          <p>Kind Attn: {map.contact_person}</p>
          <p>Mobile: {map.contact_mobile}</p>
          {map.contact_email !== '—' ? <p>Email: {map.contact_email}</p> : null}
        </section>
      ) : null}

      {sorted.map((sec) => {
        const pageBreak = sectionHasPageBreak(sec.sectionType, printLayout)

        // Avoid duplicate signature when footer signature block is enabled.
        if (sec.sectionType === 'signature' && printLayout.showSignatureBlock) {
          return null
        }

        if (sec.sectionType === 'cover') {
          const content = resolvePlaceholders(sec.content, map)
          const { meta, bodyLines } = parseCoverBody(content)
          const showBuiltInMeta = printLayout.showCompanyHeader && isVfWord
          const metaRows = showBuiltInMeta
            ? meta.filter((m) => !/quotation\s*no|date/i.test(m.label))
            : meta

          return (
            <section
              key={sec.id}
              className={cn(
                'quo-print-section quo-print-section--cover',
                pageBreak && 'quo-print-section--break',
              )}
            >
              {!printLayout.showCompanyHeader ? (
                <SectionTitle
                  sectionId={sec.id}
                  title={sec.title}
                  editable={editable}
                  onSectionFieldChange={onSectionFieldChange}
                  className="quo-print-section__title quo-print-cover__title"
                />
              ) : null}

              {metaRows.length > 0 ? (
                <dl className="quo-print-cover__meta">
                  {metaRows.map((row) => (
                    <div key={row.label} className="quo-print-cover__meta-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {bodyLines.length > 0 ? (
                <div className="quo-print-cover__subject">
                  {bodyLines.map((line, idx) => {
                    const trimmed = line.trim()
                    if (!trimmed) return <br key={`b-${idx}`} />
                    if (/^sub\s*:/i.test(trimmed)) {
                      return (
                        <p key={`s-${idx}`} className="quo-print-cover__subject-line">
                          {trimmed}
                        </p>
                      )
                    }
                    return (
                      <p key={`p-${idx}`} className="quo-print-cover__subject-detail">
                        {trimmed}
                      </p>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        }

        if (sec.sectionType === 'price_table') {
          return (
            <section
              key={sec.id}
              className={cn('quo-print-section quo-print-section--price', pageBreak && 'quo-print-section--break')}
            >
              <SectionTitle sectionId={sec.id} title={sec.title} editable={editable} onSectionFieldChange={onSectionFieldChange} />
              <table className="quo-print-price">
                <thead>
                  <tr>
                    <th>Sr.</th>
                    <th>Description</th>
                    <th className="text-right">Qty</th>
                    <th>UOM</th>
                    <th className="text-right">Basic Price</th>
                    <th className="text-right">Disc %</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">GST %</th>
                    <th className="text-right">GST Amt</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const base = line.qty * line.unitPrice
                    const disc = base * (line.discountPct / 100)
                    const taxable = base - disc
                    const gstAmt = taxable * (line.taxPct / 100)
                    return (
                      <tr key={line.id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{line.productOrItem}</strong>
                          {line.description ? <div className="quo-print-price__desc">{line.description}</div> : null}
                        </td>
                        <td className="text-right">{line.qty}</td>
                        <td>{line.uom}</td>
                        <td className="text-right">{formatCrmCurrency(line.unitPrice)}</td>
                        <td className="text-right">{line.discountPct}%</td>
                        <td className="text-right">{formatCrmCurrency(taxable)}</td>
                        <td className="text-right">{line.taxPct}%</td>
                        <td className="text-right">{formatCrmCurrency(gstAmt)}</td>
                        <td className="text-right">{formatCrmCurrency(line.lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="quo-print-summary">
                <div className="quo-print-summary__row">
                  <span>Total Basic Price</span>
                  <span>{formatCrmCurrency(summary.basicAmount)}</span>
                </div>
                <div className="quo-print-summary__row">
                  <span>GST</span>
                  <span>{formatCrmCurrency(summary.gstAmount)}</span>
                </div>
                <div className="quo-print-summary__row quo-print-summary__row--total">
                  <span>Grand Total</span>
                  <span>{formatCrmCurrency(summary.grandTotal)}</span>
                </div>
                <p className="quo-print-summary__words">
                  <em>Amount in words:</em> {amountInWordsINR(summary.grandTotal)}
                </p>
              </div>
            </section>
          )
        }

        if (sec.contentFormat === 'spec_table' && sec.specRows?.length) {
          return (
            <section key={sec.id} className={cn('quo-print-section', pageBreak && 'quo-print-section--break')}>
              <SectionTitle sectionId={sec.id} title={sec.title} editable={editable} onSectionFieldChange={onSectionFieldChange} />
              <PrintSpecTable
                sectionId={sec.id}
                rows={sec.specRows}
                map={map}
                editable={editable}
                onSpecRowChange={onSpecRowChange}
              />
            </section>
          )
        }

        const rawContent = sec.content
        const content = editable ? rawContent : resolvePlaceholders(rawContent, map)
        if (!content.trim() && !editable) return null

        if (sec.sectionType === 'customer_details' && printLayout.showCustomerBlock) {
          return null
        }

        if (sec.sectionType === 'customer_details') {
          return (
            <section
              key={sec.id}
              className={cn('quo-print-section quo-print-section--customer', pageBreak && 'quo-print-section--break')}
            >
              <SectionTitle sectionId={sec.id} title={sec.title} editable={editable} onSectionFieldChange={onSectionFieldChange} />
              <div className="quo-print-customer-card">
                <EditableText
                  id={`section-body-${sec.id}`}
                  value={content}
                  editable={editable}
                  onChange={(_id, value) => onSectionFieldChange?.(sec.id, 'content', value)}
                  as="div"
                  multiline
                  className="quo-print-customer-card__body"
                />
              </div>
            </section>
          )
        }

        return (
          <section key={sec.id} className={cn('quo-print-section', pageBreak && 'quo-print-section--break')}>
            <SectionTitle sectionId={sec.id} title={sec.title} editable={editable} onSectionFieldChange={onSectionFieldChange} />
            <EditableText
              id={`section-body-${sec.id}`}
              value={content}
              editable={editable}
              onChange={(_id, value) => onSectionFieldChange?.(sec.id, 'content', value)}
              as="div"
              multiline
              className="quo-print-section__body"
              placeholder="Click to add content…"
            />
          </section>
        )
      })}

      {printLayout.showSignatureBlock || printLayout.showPageFooter ? (
        <footer className="quo-print-footer">
          {printLayout.showSignatureBlock ? (
            <div className="quo-print-footer__sign-row">
              <div className="quo-print-footer__closing">
                <p className="quo-print-footer__for">For, {company.legalName}</p>
              </div>
              <div className="quo-print-signature">
                <div className="quo-print-signature__line" />
                <p className="quo-print-signature__name">{map.authorized_person}</p>
                <p className="quo-print-signature__designation">{map.designation}</p>
              </div>
            </div>
          ) : null}
          {company.bankDetails ? <CompanyBankDetailsBlock bank={company.bankDetails} /> : null}
          {printLayout.showPageFooter ? (
            <div className="quo-print-footer__bar">
              {company.gstin ? <span>GSTIN: {company.gstin}</span> : null}
              <span>{company.website}</span>
              <span className="quo-print-footer__page">Confidential — for addressee only</span>
            </div>
          ) : null}
        </footer>
      ) : null}
    </article>
  )
}
