import type { SalesInvoiceDto } from '@/types/moneyIn'
import { useCompanyProfile } from '@/utils/quotationEngine/companyProfile'
import { amountInWords } from '@/utils/amountInWords'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { CompanyBankDetailsBlock } from '@/components/print/CompanyBankDetailsBlock'
import { cn } from '@/utils/cn'
import { invoiceDisplayNumber, MONEY_IN_STATUS_LABELS, parseDecimal } from '../moneyInUi'

function gstRate(line: NonNullable<SalesInvoiceDto['lines']>[number]): number {
  return Math.max(parseDecimal(line.cgstRate), parseDecimal(line.sgstRate), parseDecimal(line.igstRate))
}

function formatQty(raw: string, uom?: string | null): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  const trimmed = Number.isInteger(n)
    ? String(n)
    : n
        .toFixed(4)
        .replace(/\.?0+$/, '')
  return uom?.trim() ? `${trimmed} ${uom.trim()}` : trimmed
}

function addressLines(snapshot: Record<string, unknown> | null | undefined): string[] {
  if (!snapshot) return []
  const pick = (...keys: string[]) =>
    keys
      .map((k) => snapshot[k])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  const line1 = pick('addressLine1', 'address1', 'line1', 'address')
  const line2 = pick('addressLine2', 'address2', 'line2')
  const cityState = pick('city', 'state')
  const pinCountry = pick('pincode', 'postalCode', 'country')
  return [line1.join(', '), line2.join(', '), [...cityState, ...pinCountry].join(', ')].filter(Boolean)
}

/**
 * Single letterhead template for screen preview, browser print, and PDF capture.
 * Same DOM + styles everywhere — do not maintain a separate print HTML tree.
 */
export function SalesInvoiceDocument({
  invoice,
  id = 'sales-invoice-print',
  className,
}: {
  invoice: SalesInvoiceDto
  id?: string
  className?: string
}) {
  const company = useCompanyProfile()
  const docNo = invoiceDisplayNumber(invoice)
  const lines = invoice.lines ?? []
  const billTo = addressLines(invoice.customerBillingAddressSnapshot)
  const shipTo = addressLines(invoice.customerShippingAddressSnapshot)
  const grand = parseDecimal(invoice.totalAmount)
  const cgst = parseDecimal(invoice.cgstAmount)
  const sgst = parseDecimal(invoice.sgstAmount)
  const igst = parseDecimal(invoice.igstAmount)
  const discount = parseDecimal(invoice.discountAmount)
  const freight = parseDecimal(invoice.freightAmount)
  const other = parseDecimal(invoice.otherChargesAmount)
  const roundOff = parseDecimal(invoice.roundOffAmount)

  return (
    <article id={id} className={cn('pi-print-doc mi-si-print-doc', className)}>
      <div className="pi-print-doc__accent" aria-hidden />

      <header className="pi-print-header">
        <div className="pi-print-header__brand">
          {company.logoUrl ? (
            <div className="pi-print-header__logo-wrap">
              <img className="pi-print-header__logo" src={company.logoUrl} alt={company.brandName} />
            </div>
          ) : (
            <div className="pi-print-header__logo-wrap mi-si-print-doc__logo-fallback" aria-hidden>
              {(company.brandName || company.legalName || 'CO').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="pi-print-header__identity">
            <h1 className="pi-print-header__company">{company.legalName}</h1>
            {company.tagline ? <p className="pi-print-header__tagline">{company.tagline}</p> : null}
            <p className="pi-print-header__address">{company.address}</p>
            <p className="pi-print-header__contact">
              {[company.phone, company.email, company.website].filter(Boolean).join(' · ')}
            </p>
            {company.gstin ? <p className="pi-print-header__gstin">GSTIN: {company.gstin}</p> : null}
          </div>
        </div>

        <div className="pi-print-header__badge">
          <p className="pi-print-header__doc-type">Tax Invoice</p>
          <p className="pi-print-header__doc-no">{docNo}</p>
          <dl className="pi-print-header__meta">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(invoice.invoiceDate)}</dd>
            </div>
            {invoice.dueDate ? (
              <div>
                <dt>Due</dt>
                <dd>{formatDate(invoice.dueDate)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Status</dt>
              <dd>{MONEY_IN_STATUS_LABELS[invoice.status] ?? invoice.status}</dd>
            </div>
            {invoice.customerPoNumber ? (
              <div>
                <dt>Customer PO</dt>
                <dd>{invoice.customerPoNumber}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      <div className="pi-print-parties mi-si-print-doc__parties">
        <section className="pi-print-party">
          <p className="pi-print-party__label">Bill to</p>
          <p className="pi-print-party__name">{invoice.customerNameSnapshot}</p>
          {invoice.customerCodeSnapshot ? (
            <p className="pi-print-party__line">Code: {invoice.customerCodeSnapshot}</p>
          ) : null}
          {billTo.map((line) => (
            <p key={line} className="pi-print-party__line">
              {line}
            </p>
          ))}
          <p className="pi-print-party__line">GSTIN: {invoice.customerGstinSnapshot ?? '-'}</p>
          <p className="pi-print-party__line">State: {invoice.customerStateCodeSnapshot ?? '-'}</p>
        </section>

        <section className="pi-print-party">
          <p className="pi-print-party__label">Ship to &amp; supply</p>
          {shipTo.length > 0 ? (
            <>
              <p className="pi-print-party__name">Ship to</p>
              {shipTo.map((line) => (
                <p key={line} className="pi-print-party__line">
                  {line}
                </p>
              ))}
            </>
          ) : (
            <p className="pi-print-party__name">{invoice.customerNameSnapshot}</p>
          )}
          <dl className="mi-si-print-doc__kv">
            <div>
              <dt>Place of supply</dt>
              <dd>{invoice.placeOfSupply ?? '-'}</dd>
            </div>
            <div>
              <dt>Supply type</dt>
              <dd>{invoice.supplyType.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt>Tax treatment</dt>
              <dd>{invoice.taxTreatment.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>
                {invoice.currencyCode}
                {invoice.exchangeRate && invoice.exchangeRate !== '1' && invoice.exchangeRate !== '1.00000000'
                  ? ` @ ${invoice.exchangeRate}`
                  : ''}
              </dd>
            </div>
            {invoice.referenceNumber ? (
              <div>
                <dt>Reference</dt>
                <dd>{invoice.referenceNumber}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      <table className="pi-print-table mi-si-print-doc__table">
        <thead>
          <tr>
            <th className="mi-si-print-doc__col-num">#</th>
            <th>Item / description</th>
            <th>HSN</th>
            <th className="mi-si-print-doc__col-qty">Qty</th>
            <th className="mi-si-print-doc__col-amt">Rate</th>
            <th className="mi-si-print-doc__col-amt">Taxable</th>
            <th className="mi-si-print-doc__col-gst">GST%</th>
            <th className="mi-si-print-doc__col-amt">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="mi-si-print-doc__empty">
                No line items
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.id}>
                <td className="mi-si-print-doc__col-num">{l.lineNumber}</td>
                <td>
                  <span className="mi-si-print-doc__item-code">{l.itemCodeSnapshot ?? '-'}</span>
                  <span className="mi-si-print-doc__item-desc">
                    {l.description || l.itemNameSnapshot || '-'}
                  </span>
                </td>
                <td className="mi-si-print-doc__mono">{l.hsnCodeSnapshot ?? '-'}</td>
                <td className="mi-si-print-doc__col-qty">{formatQty(l.quantity, l.uomSnapshot)}</td>
                <td className="mi-si-print-doc__col-amt">{formatCurrency(parseDecimal(l.unitRate))}</td>
                <td className="mi-si-print-doc__col-amt">{formatCurrency(parseDecimal(l.taxableAmount))}</td>
                <td className="mi-si-print-doc__col-gst">{gstRate(l)}%</td>
                <td className="mi-si-print-doc__col-amt mi-si-print-doc__col-total">
                  {formatCurrency(parseDecimal(l.lineTotal))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mi-si-print-doc__footer-grid">
        <div className="mi-si-print-doc__notes">
          <p className="mi-si-print-doc__words-label">Amount in words</p>
          <p className="mi-si-print-doc__words">{amountInWords(grand)}</p>
          {invoice.narration ? (
            <>
              <p className="mi-si-print-doc__words-label">Narration</p>
              <p className="mi-si-print-doc__narration">{invoice.narration}</p>
            </>
          ) : null}
          {company.bankDetails ? (
            <div className="mi-si-print-doc__bank">
              <CompanyBankDetailsBlock bank={company.bankDetails} />
            </div>
          ) : null}
        </div>

        <div className="pi-print-totals mi-si-print-doc__totals">
          <div className="pi-print-totals__row">
            <span>Subtotal</span>
            <span>{formatCurrency(parseDecimal(invoice.subtotalAmount))}</span>
          </div>
          {discount > 0 ? (
            <div className="pi-print-totals__row">
              <span>Discount</span>
              <span>− {formatCurrency(discount)}</span>
            </div>
          ) : null}
          <div className="pi-print-totals__row">
            <span>Taxable</span>
            <span>{formatCurrency(parseDecimal(invoice.taxableAmount))}</span>
          </div>
          {cgst > 0 || sgst > 0 ? (
            <>
              <div className="pi-print-totals__row">
                <span>CGST</span>
                <span>{formatCurrency(cgst)}</span>
              </div>
              <div className="pi-print-totals__row">
                <span>SGST</span>
                <span>{formatCurrency(sgst)}</span>
              </div>
            </>
          ) : null}
          {igst > 0 ? (
            <div className="pi-print-totals__row">
              <span>IGST</span>
              <span>{formatCurrency(igst)}</span>
            </div>
          ) : null}
          {freight > 0 ? (
            <div className="pi-print-totals__row">
              <span>Freight</span>
              <span>{formatCurrency(freight)}</span>
            </div>
          ) : null}
          {other > 0 ? (
            <div className="pi-print-totals__row">
              <span>Other charges</span>
              <span>{formatCurrency(other)}</span>
            </div>
          ) : null}
          {roundOff !== 0 ? (
            <div className="pi-print-totals__row">
              <span>Round off</span>
              <span>{formatCurrency(roundOff)}</span>
            </div>
          ) : null}
          <div className="pi-print-totals__row pi-print-totals__row--grand">
            <span>Grand total</span>
            <span>{formatCurrency(grand)}</span>
          </div>
        </div>
      </div>

      <footer className="pi-print-doc__footer">
        <span>Computer-generated tax invoice · {company.legalName}</span>
        <span>{docNo}</span>
      </footer>
    </article>
  )
}
