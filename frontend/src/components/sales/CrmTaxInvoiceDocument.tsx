import { useCompanyProfile } from '../../utils/quotationEngine/companyProfile'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { gstSchemeLabel } from '../../utils/gstEngine'
import { amountInWords } from '../../utils/amountInWords'
import {
  CRM_INVOICE_PAYMENT_STATUS_LABELS,
  CRM_TAX_INVOICE_STATUS_LABELS,
  type CrmTaxInvoice,
} from '../../types/crmCommercial'
import { cn } from '../../utils/cn'
import { CompanyBankDetailsBlock } from '../print/CompanyBankDetailsBlock'

interface CrmTaxInvoiceDocumentProps {
  invoice: CrmTaxInvoice
  className?: string
}

/**
 * Tax invoice letterhead preview — Zoho Books–style document sheet.
 * Reuses `so-print-*` / `pi-print-*` classes for visual parity with SO / Proforma.
 */
export function CrmTaxInvoiceDocument({ invoice, className }: CrmTaxInvoiceDocumentProps) {
  const { gst } = invoice
  const company = useCompanyProfile()
  const bank = company.bankDetails
  const billTo = invoice.billingAddress?.trim() || invoice.customerAddress || '-'
  const shipTo = invoice.shippingAddress?.trim() || invoice.customerAddress || billTo

  return (
    <article className={cn('pi-print-doc ti-print-doc', className)} id="crm-tax-invoice-print">
      <div className="so-print-doc__accent" aria-hidden />

      <header className="so-print-header">
        <div className="so-print-header__brand">
          <div className="so-print-header__logo-wrap">
            {company.logoUrl ? (
              <img className="so-print-header__logo" src={company.logoUrl} alt={company.brandName} />
            ) : null}
          </div>
          <div className="so-print-header__identity">
            <h1 className="so-print-header__company">{company.legalName}</h1>
            {company.tagline ? <p className="so-print-header__tagline">{company.tagline}</p> : null}
            <p className="so-print-header__address">{company.address}</p>
            <p className="so-print-header__contact">
              {[company.phone, company.email, company.website].filter(Boolean).join(' · ')}
            </p>
            {company.gstin ? <p className="so-print-header__gstin">GSTIN: {company.gstin}</p> : null}
          </div>
        </div>

        <div className="so-print-header__badge">
          <p className="so-print-header__doc-type">Tax Invoice</p>
          <p className="so-print-header__doc-no">{invoice.invoiceNo}</p>
          <dl className="so-print-header__meta">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(invoice.invoiceDate)}</dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{formatDate(invoice.dueDate)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{CRM_TAX_INVOICE_STATUS_LABELS[invoice.status]}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{CRM_INVOICE_PAYMENT_STATUS_LABELS[invoice.paymentStatus]}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="ti-print-balance-strip" aria-label="Balance summary">
        <div>
          <span className="ti-print-balance-strip__label">Total</span>
          <span className="ti-print-balance-strip__value">{formatCurrency(gst.grandTotal)}</span>
        </div>
        <div>
          <span className="ti-print-balance-strip__label">Paid</span>
          <span className="ti-print-balance-strip__value">{formatCurrency(invoice.amountPaid)}</span>
        </div>
        <div className={cn(invoice.balanceDue > 0.009 && 'is-due')}>
          <span className="ti-print-balance-strip__label">Balance due</span>
          <span className="ti-print-balance-strip__value">{formatCurrency(invoice.balanceDue)}</span>
        </div>
      </div>

      <div className="so-print-parties">
        <section className="so-print-party">
          <p className="so-print-party__label">Bill to</p>
          <p className="so-print-party__name">{invoice.customerName}</p>
          <p className="so-print-party__line">{billTo}</p>
          <p className="so-print-party__line">GSTIN: {invoice.customerGstin || '-'}</p>
          <p className="so-print-party__line">State: {invoice.customerState || '-'}</p>
          <p className="so-print-party__line">Place of supply: {invoice.placeOfSupply || '-'}</p>
        </section>

        <section className="so-print-party">
          <p className="so-print-party__label">Ship to</p>
          <p className="so-print-party__name">{invoice.customerName}</p>
          <p className="so-print-party__line">{shipTo}</p>
          <p className="so-print-party__line">{gstSchemeLabel(gst.scheme)}</p>
          {invoice.customerPoNumber ? (
            <p className="so-print-party__line">Customer PO: {invoice.customerPoNumber}</p>
          ) : null}
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
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td className="num">{line.lineNo}</td>
              <td>
                <span className="pi-print-table__desc">{line.description || line.itemCode}</span>
                {line.itemCode ? <span className="pi-print-table__code">{line.itemCode}</span> : null}
              </td>
              <td>{line.hsnCode || '-'}</td>
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

      <div className="so-print-footer-grid">
        <div className="so-print-words">
          <p className="so-print-words__label">Amount in words</p>
          <p className="so-print-words__value">{amountInWords(gst.grandTotal)}</p>

          {invoice.remarks ? (
            <div className="pi-print-notes">
              <p className="pi-print-notes__title">Remarks</p>
              <p>{invoice.remarks}</p>
            </div>
          ) : null}

          <div className="pi-print-notes">
            <p className="pi-print-notes__title">Terms</p>
            <ul>
              <li>Payment: {invoice.paymentTerms || 'As agreed'}</li>
              <li>Delivery: {invoice.deliveryTerms || 'As agreed'}</li>
              <li>This is a computer-generated tax invoice.</li>
            </ul>
          </div>

          {bank ? <CompanyBankDetailsBlock bank={bank} className="mt-3" /> : null}
        </div>

        <div className="so-print-totals">
          <div className="so-print-totals__row">
            <span>Taxable amount</span>
            <span>{formatCurrency(gst.taxableAmount)}</span>
          </div>
          {gst.scheme === 'cgst_sgst' ? (
            <>
              <div className="so-print-totals__row">
                <span>CGST @ {gst.cgstRate}%</span>
                <span>{formatCurrency(gst.cgstAmount)}</span>
              </div>
              <div className="so-print-totals__row">
                <span>SGST @ {gst.sgstRate}%</span>
                <span>{formatCurrency(gst.sgstAmount)}</span>
              </div>
            </>
          ) : (
            <div className="so-print-totals__row">
              <span>IGST @ {gst.igstRate}%</span>
              <span>{formatCurrency(gst.igstAmount)}</span>
            </div>
          )}
          <div className="so-print-totals__row so-print-totals__row--grand">
            <span>Grand total</span>
            <span>{formatCurrency(gst.grandTotal)}</span>
          </div>
          <div className="so-print-totals__row">
            <span>Amount paid</span>
            <span>{formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div className="so-print-totals__row">
            <span>Balance due</span>
            <span>{formatCurrency(invoice.balanceDue)}</span>
          </div>
        </div>
      </div>

      <div className="so-print-signatures">
        <div className="so-print-signatures__block">
          <div className="so-print-signatures__line" />
          <p>Prepared by</p>
        </div>
        <div className="so-print-signatures__block">
          <div className="so-print-signatures__line" />
          <p>Customer acknowledgement</p>
        </div>
        <div className="so-print-signatures__block">
          <div className="so-print-signatures__line" />
          <p>For {company.legalName}</p>
          <p className="so-print-signatures__role">{company.authorizedPerson || 'Authorised Signatory'}</p>
        </div>
      </div>

      <footer className="pi-print-doc__footer">
        <span>{company.legalName}</span>
        <span>Tax Invoice · {invoice.invoiceNo}</span>
      </footer>
    </article>
  )
}
