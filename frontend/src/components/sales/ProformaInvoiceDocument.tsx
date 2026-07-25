import { QUOTATION_COMPANY } from '../../utils/quotationEngine/companyProfile'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { gstSchemeLabel } from '../../utils/gstEngine'
import { amountInWords } from '../../utils/amountInWords'
import type { ProformaInvoice } from '../../types/proformaInvoice'
import { PROFORMA_STATUS_LABELS } from '../../types/proformaInvoice'
import { cn } from '../../utils/cn'

interface ProformaInvoiceDocumentProps {
  proforma: ProformaInvoice
  className?: string
}

export function ProformaInvoiceDocument({ proforma, className }: ProformaInvoiceDocumentProps) {
  const { gst } = proforma
  const company = QUOTATION_COMPANY
  const billTo = proforma.billingAddress?.trim() || proforma.customerAddress || '—'
  const shipTo = proforma.shippingAddress?.trim() || proforma.customerAddress || billTo

  return (
    <article className={cn('pi-print-doc', className)} id="proforma-invoice-print">
      <div className="pi-print-doc__accent" aria-hidden />

      <header className="pi-print-header">
        <div className="pi-print-header__brand">
          <div className="pi-print-header__logo-wrap">
            <img className="pi-print-header__logo" src={company.logoUrl} alt={company.brandName} />
          </div>
          <div className="pi-print-header__identity">
            <h1 className="pi-print-header__company">{company.legalName}</h1>
            <p className="pi-print-header__tagline">{company.tagline}</p>
            <p className="pi-print-header__address">{company.address}</p>
            <p className="pi-print-header__contact">
              {company.phone} · {company.email}
              {company.website ? ` · ${company.website}` : ''}
            </p>
            <p className="pi-print-header__gstin">GSTIN: {company.gstin}</p>
          </div>
        </div>

        <div className="pi-print-header__badge">
          <p className="pi-print-header__doc-type">Proforma Invoice</p>
          <p className="pi-print-header__doc-no">{proforma.proformaNo}</p>
          <dl className="pi-print-header__meta">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(proforma.proformaDate)}</dd>
            </div>
            <div>
              <dt>Valid until</dt>
              <dd>{formatDate(proforma.validUntil)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{PROFORMA_STATUS_LABELS[proforma.status]}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="pi-print-banner" role="note">
        <strong>Not a tax invoice.</strong> This proforma is issued for advance payment, booking confirmation,
        or customs documentation only. A GST tax invoice will be raised at the time of supply.
      </div>

      <div className="pi-print-parties">
        <section className="pi-print-party">
          <p className="pi-print-party__label">Bill to</p>
          <p className="pi-print-party__name">{proforma.customerName}</p>
          <p className="pi-print-party__line">{billTo}</p>
          <p className="pi-print-party__line">GSTIN: {proforma.customerGstin || '—'}</p>
          <p className="pi-print-party__line">State: {proforma.customerState || '—'}</p>
          <p className="pi-print-party__line">Place of supply: {proforma.placeOfSupply || '—'}</p>
        </section>

        <section className="pi-print-party">
          <p className="pi-print-party__label">Ship to</p>
          <p className="pi-print-party__name">{proforma.customerName}</p>
          <p className="pi-print-party__line">{shipTo}</p>
        </section>

        <section className="pi-print-party pi-print-party--meta">
          <p className="pi-print-party__label">Commercial</p>
          <p className="pi-print-party__line">
            <span>Payment</span> {proforma.paymentTerms || '—'}
          </p>
          <p className="pi-print-party__line">
            <span>Delivery</span> {proforma.deliveryTerms || '—'}
          </p>
          <p className="pi-print-party__line">
            <span>Customer PO</span> {proforma.customerPoNumber || '—'}
          </p>
          <p className="pi-print-party__line">
            <span>Sales order</span> {proforma.salesOrderNo || '—'}
          </p>
          <p className="pi-print-party__line">
            <span>Quotation</span> {proforma.quotationNo || '—'}
          </p>
          <p className="pi-print-party__line">
            <span>GST</span> {gstSchemeLabel(gst.scheme)}
          </p>
        </section>
      </div>

      <table className="pi-print-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Description</th>
            <th>HSN</th>
            <th className="num">Qty</th>
            <th>UOM</th>
            <th className="num">Rate</th>
            <th className="num">Disc %</th>
            <th className="num">Tax %</th>
            <th className="num">Taxable</th>
            <th className="num">GST</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {proforma.lines.map((line) => (
            <tr key={line.id}>
              <td className="num">{line.lineNo}</td>
              <td>
                <span className="pi-print-table__desc">{line.description}</span>
                {line.itemCode ? <span className="pi-print-table__code">{line.itemCode}</span> : null}
              </td>
              <td>{line.hsnCode || '—'}</td>
              <td className="num">{formatNumber(line.qty)}</td>
              <td>{line.uom || 'Nos'}</td>
              <td className="num">{formatCurrency(line.unitPrice)}</td>
              <td className="num">{formatNumber(line.discountPct)}</td>
              <td className="num">{formatNumber(line.taxPct)}</td>
              <td className="num">{formatCurrency(line.taxableValue)}</td>
              <td className="num">{formatCurrency(line.gstAmount)}</td>
              <td className="num">{formatCurrency(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pi-print-footer-grid">
        <div className="pi-print-words">
          <p className="pi-print-words__label">Amount in words</p>
          <p className="pi-print-words__value">{amountInWords(gst.grandTotal)}</p>

          <div className="pi-print-bank">
            <p className="pi-print-words__label">Bank / remittance</p>
            <p className="pi-print-bank__value">{company.bankDetails}</p>
          </div>

          {proforma.remarks ? (
            <div className="pi-print-notes">
              <p className="pi-print-notes__title">Remarks</p>
              <p>{proforma.remarks}</p>
            </div>
          ) : null}

          <div className="pi-print-notes">
            <p className="pi-print-notes__title">Terms</p>
            <ul>
              <li>Prices are subject to the commercial terms stated above and remain valid until {formatDate(proforma.validUntil)}.</li>
              <li>Advance / booking amounts are non-refundable unless otherwise agreed in writing.</li>
              <li>Supply is subject to order confirmation and production schedule at works, Chhapi.</li>
            </ul>
          </div>
        </div>

        <div className="pi-print-totals">
          <div className="pi-print-totals__row">
            <span>Taxable amount</span>
            <span>{formatCurrency(gst.taxableAmount)}</span>
          </div>
          {gst.scheme === 'cgst_sgst' ? (
            <>
              <div className="pi-print-totals__row">
                <span>CGST @ {gst.cgstRate}%</span>
                <span>{formatCurrency(gst.cgstAmount)}</span>
              </div>
              <div className="pi-print-totals__row">
                <span>SGST @ {gst.sgstRate}%</span>
                <span>{formatCurrency(gst.sgstAmount)}</span>
              </div>
            </>
          ) : (
            <div className="pi-print-totals__row">
              <span>IGST @ {gst.igstRate}%</span>
              <span>{formatCurrency(gst.igstAmount)}</span>
            </div>
          )}
          <div className="pi-print-totals__row pi-print-totals__row--grand">
            <span>Grand total</span>
            <span>{formatCurrency(gst.grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="pi-print-signatures">
        <div className="pi-print-signatures__block">
          <div className="pi-print-signatures__line" />
          <p>Prepared by</p>
        </div>
        <div className="pi-print-signatures__block">
          <div className="pi-print-signatures__line" />
          <p>Customer acceptance</p>
        </div>
        <div className="pi-print-signatures__block">
          <div className="pi-print-signatures__line" />
          <p>For {company.legalName}</p>
          <p className="pi-print-signatures__role">{company.authorizedPerson}</p>
          <p className="pi-print-signatures__role">{company.designation}</p>
        </div>
      </div>

      <footer className="pi-print-doc__footer">
        <span>{company.legalName}</span>
        <span>Computer-generated proforma · Subject to Chhapi jurisdiction</span>
      </footer>
    </article>
  )
}
