import { useMemo } from 'react'
import type { QuotationDocument, QuotationPrintLayout } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import type { Customer } from '../../types/master'
import type { Opportunity } from '../../types/crm'
import { buildQuotationMergeMap, resolvePlaceholders } from '../../utils/quotationEngine/placeholders'
import { QUOTATION_COMPANY } from '../../utils/quotationEngine/companyProfile'
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

interface QuotationPrintDocumentProps {
  doc: QuotationDocument
  quotation: Quotation
  customer?: Customer
  opportunity?: Opportunity
  contactName?: string
  className?: string
  printLayout?: QuotationPrintLayout
}

function PrintSpecTable({ rows, map }: { rows: NonNullable<QuotationDocument['sections'][0]['specRows']>; map: Record<string, string> }) {
  return (
    <table className="quo-print-spec">
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="quo-print-spec__no">{r.sectionNo}</td>
            <td className="quo-print-spec__label">{resolvePlaceholders(r.label, map)}</td>
            <td className="quo-print-spec__value">
              {resolvePlaceholders(r.value, map)}
              {r.unit ? ` ${r.unit}` : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
}: QuotationPrintDocumentProps) {
  const map = useMemo(
    () => buildQuotationMergeMap({ document: doc, quotation, customer, opportunity, contactName }),
    [doc, quotation, customer, opportunity, contactName],
  )
  const sorted = useMemo(() => [...doc.sections].sort((a, b) => a.sequenceNo - b.sequenceNo), [doc.sections])
  const lines = syncLineTotals(doc.priceLines)
  const summary = calcPriceSummary(lines, doc.freightAmount, doc.installationAmount, doc.customCharges)
  const layoutClass = printLayoutClassNames(printLayout)

  return (
    <article
      className={cn('quo-print-doc', layoutClass, className)}
      style={printLayoutStyleVars(printLayout)}
    >
      {printLayout.showCompanyHeader ? (
        <header className={cn('quo-print-header', printLayout.headerStyle === 'cover' && 'quo-print-header--cover')}>
          <div className="quo-print-header__brand">
            {printLayout.showLogo ? <div className="quo-print-header__logo" aria-hidden>V</div> : null}
            <div>
              <h1 className="quo-print-header__company">{QUOTATION_COMPANY.legalName}</h1>
              {printLayout.headerStyle !== 'minimal' ? (
                <>
                  <p className="quo-print-header__address">{QUOTATION_COMPANY.address}</p>
                  <p className="quo-print-header__contact">
                    {QUOTATION_COMPANY.phone} · {QUOTATION_COMPANY.email} · {QUOTATION_COMPANY.website}
                  </p>
                </>
              ) : null}
            </div>
          </div>
          <div className="quo-print-header__meta">
            <p className="quo-print-header__title">QUOTATION</p>
            <p><strong>Ref:</strong> {map.quotation_no}</p>
            <p><strong>Date:</strong> {map.quotation_date}</p>
            <p><strong>Revision:</strong> R{doc.revisionNo}</p>
            {quotation.validityDate ? <p><strong>Valid till:</strong> {quotation.validityDate}</p> : null}
          </div>
        </header>
      ) : null}

      {printLayout.showCustomerBlock ? (
        <section className="quo-print-customer">
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

        if (sec.sectionType === 'cover' && printLayout.headerStyle === 'cover') {
          const content = resolvePlaceholders(sec.content, map)
          return (
            <section key={sec.id} className={cn('quo-print-section quo-print-section--cover', pageBreak && 'quo-print-section--break')}>
              <h2 className="quo-print-section__title quo-print-cover__title">{sec.title}</h2>
              {content ? <div className="quo-print-section__body quo-print-cover__body">{content}</div> : null}
            </section>
          )
        }

        if (sec.sectionType === 'price_table') {
          return (
            <section key={sec.id} className={cn('quo-print-section quo-print-section--price', pageBreak && 'quo-print-section--break')}>
              <h2 className="quo-print-section__title">{sec.title}</h2>
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
                <div className="quo-print-summary__row"><span>Total Basic Price</span><span>{formatCrmCurrency(summary.basicAmount)}</span></div>
                <div className="quo-print-summary__row"><span>GST</span><span>{formatCrmCurrency(summary.gstAmount)}</span></div>
                <div className="quo-print-summary__row quo-print-summary__row--total"><span>Grand Total</span><span>{formatCrmCurrency(summary.grandTotal)}</span></div>
                <p className="quo-print-summary__words"><em>Amount in words:</em> {amountInWordsINR(summary.grandTotal)}</p>
              </div>
            </section>
          )
        }

        if (sec.contentFormat === 'spec_table' && sec.specRows?.length) {
          return (
            <section key={sec.id} className={cn('quo-print-section', pageBreak && 'quo-print-section--break')}>
              <h2 className="quo-print-section__title">{sec.title}</h2>
              <PrintSpecTable rows={sec.specRows} map={map} />
            </section>
          )
        }

        const content = resolvePlaceholders(sec.content, map)
        if (!content.trim()) return null

        if (sec.sectionType === 'customer_details' && printLayout.showCustomerBlock) {
          return null
        }

        return (
          <section key={sec.id} className={cn('quo-print-section', pageBreak && 'quo-print-section--break')}>
            <h2 className="quo-print-section__title">{sec.title}</h2>
            <div className="quo-print-section__body">{content}</div>
          </section>
        )
      })}

      {printLayout.showSignatureBlock || printLayout.showPageFooter ? (
        <footer className="quo-print-footer">
          {printLayout.showSignatureBlock ? (
            <>
              <p>For, {QUOTATION_COMPANY.legalName}</p>
              <div className="quo-print-signature">
                <div className="quo-print-signature__line" />
                <p>{map.authorized_person}</p>
                <p className="quo-print-signature__designation">{map.designation}</p>
              </div>
            </>
          ) : null}
          {printLayout.showPageFooter ? (
            <p className="quo-print-footer__gstin">GSTIN: {QUOTATION_COMPANY.gstin}</p>
          ) : null}
        </footer>
      ) : null}
    </article>
  )
}
