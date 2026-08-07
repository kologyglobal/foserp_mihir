import { useCompanyProfile } from '@/utils/quotationEngine/companyProfile'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { amountInWords } from '@/utils/amountInWords'
import { cn } from '@/utils/cn'
import { useTenantProfileStore } from '@/store/tenantProfileStore'
import type { CustomerReceiptDto, CustomerReceiptPaymentMethod, ReceiptAllocationHistoryRow } from '@/types/moneyIn'
import { parseDecimal, receiptDisplayNumber } from '../moneyInUi'

export const CUSTOMER_RECEIPT_PAYMENT_METHOD_LABELS: Record<CustomerReceiptPaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  CARD: 'Card',
  OTHER: 'Other',
}

function snapshotAddressLines(snapshot: Record<string, unknown> | null): string[] {
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

interface CustomerReceiptDocumentProps {
  receipt: CustomerReceiptDto
  allocations?: ReceiptAllocationHistoryRow[]
  className?: string
}

/**
 * Letterhead-style customer receipt for on-screen preview, print, and PDF capture.
 * Reuses the shared `.pi-print-*` document chrome used by CRM payment receipts.
 */
export function CustomerReceiptDocument({
  receipt,
  allocations = [],
  className,
}: CustomerReceiptDocumentProps) {
  const company = useCompanyProfile()
  const isServices = useTenantProfileStore((s) => s.isServices())
  const receiptNo = receiptDisplayNumber(receipt)
  const bankCash = parseDecimal(receipt.bankCashAmount)
  const tds = parseDecimal(receipt.customerTdsAmount)
  const bankCharges = parseDecimal(receipt.bankChargeAmount)
  const otherDeductions = parseDecimal(receipt.otherDeductionAmount)
  const gross = parseDecimal(receipt.grossReceiptAmount)
  const allocated = parseDecimal(receipt.allocatedAmount)
  const unallocated = parseDecimal(receipt.unallocatedAmount)
  const addressLines = snapshotAddressLines(receipt.customerBillingAddressSnapshot)
  const activeAllocations = allocations.filter((row) => row.status === 'POSTED')
  const modeLabel = CUSTOMER_RECEIPT_PAYMENT_METHOD_LABELS[receipt.paymentMethod]

  return (
    <article
      className={cn('pi-print-doc mi-rcpt-print-doc', className)}
      id="customer-receipt-print"
    >
      <div className="pi-print-doc__accent" aria-hidden />

      <header className="pi-print-header">
        <div className="pi-print-header__brand">
          <div className="pi-print-header__logo-wrap">
            <img className="pi-print-header__logo" src={company.logoUrl} alt={company.brandName} />
          </div>
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
          <p className="pi-print-header__doc-type">Customer Receipt</p>
          <p className="pi-print-header__doc-no">{receiptNo}</p>
          <dl className="pi-print-header__meta">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(receipt.receiptDate)}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{modeLabel}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{receipt.status.replace(/_/g, ' ')}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="pi-print-banner" role="note">
        <strong>Acknowledgement of receipt.</strong> This document confirms payment received and is not a tax
        invoice. GST tax invoices remain the basis for supply and input tax credit.
      </div>

      <div className="pi-print-parties" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <section className="pi-print-party">
          <p className="pi-print-party__label">Received from</p>
          <p className="pi-print-party__name">{receipt.customerNameSnapshot}</p>
          {receipt.customerCodeSnapshot ? (
            <p className="pi-print-party__line">Code: {receipt.customerCodeSnapshot}</p>
          ) : null}
          {addressLines.map((line) => (
            <p key={line} className="pi-print-party__line">
              {line}
            </p>
          ))}
          <p className="pi-print-party__line">GSTIN: {receipt.customerGstinSnapshot || '-'}</p>
          {receipt.customerStateCodeSnapshot ? (
            <p className="pi-print-party__line">State code: {receipt.customerStateCodeSnapshot}</p>
          ) : null}
        </section>

        <section className="pi-print-party pi-print-party--meta">
          <p className="pi-print-party__label">Payment details</p>
          <p className="pi-print-party__line">
            <span>Mode</span> {modeLabel}
          </p>
          <p className="pi-print-party__line">
            <span>UTR / Ref</span> {receipt.transactionReference || receipt.referenceNumber || '-'}
          </p>
          {receipt.paymentMethod === 'CHEQUE' ? (
            <>
              <p className="pi-print-party__line">
                <span>Cheque no.</span> {receipt.chequeNumber || '-'}
              </p>
              <p className="pi-print-party__line">
                <span>Cheque date</span> {receipt.chequeDate ? formatDate(receipt.chequeDate) : '-'}
              </p>
            </>
          ) : null}
          {receipt.bankName ? (
            <p className="pi-print-party__line">
              <span>Bank</span> {receipt.bankName}
            </p>
          ) : null}
          {receipt.customerBankReference ? (
            <p className="pi-print-party__line">
              <span>Bank ref</span> {receipt.customerBankReference}
            </p>
          ) : null}
          <p className="pi-print-party__line">
            <span>Currency</span> {receipt.currencyCode}
          </p>
          <p className="pi-print-party__line">
            <span>Received by</span> {receipt.createdBy || '-'}
          </p>
        </section>
      </div>

      {activeAllocations.length > 0 ? (
        <table className="pi-print-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Allocated to</th>
              <th>Date</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {activeAllocations.map((row, index) => (
              <tr key={row.allocationId}>
                <td className="num">{index + 1}</td>
                <td>
                  <span className="pi-print-table__desc">{row.invoiceNumber ?? 'Invoice'}</span>
                </td>
                <td>{formatDate(row.allocationDate)}</td>
                <td className="num">{formatCurrency(parseDecimal(row.allocatedAmount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="pi-print-footer-grid">
        <div className="pi-print-words">
          <p className="pi-print-words__label">Amount in words (gross receipt)</p>
          <p className="pi-print-words__value">{amountInWords(gross)}</p>

          {receipt.narration ? (
            <div className="pi-print-notes">
              <p className="pi-print-notes__title">Narration</p>
              <p>{receipt.narration}</p>
            </div>
          ) : null}

          <div className="pi-print-notes">
            <p className="pi-print-notes__title">Note</p>
            <ul>
              <li>Unallocated balance may be applied to future invoices for the same customer.</li>
              <li>Please quote the receipt number in all payment-related correspondence.</li>
            </ul>
          </div>
        </div>

        <div className="pi-print-totals">
          <div className="pi-print-totals__row">
            <span>Bank / cash received</span>
            <span>{formatCurrency(bankCash)}</span>
          </div>
          {tds > 0 ? (
            <div className="pi-print-totals__row">
              <span>Customer TDS</span>
              <span>{formatCurrency(tds)}</span>
            </div>
          ) : null}
          {bankCharges > 0 ? (
            <div className="pi-print-totals__row">
              <span>Bank charges</span>
              <span>{formatCurrency(bankCharges)}</span>
            </div>
          ) : null}
          {otherDeductions > 0 ? (
            <div className="pi-print-totals__row">
              <span>Other deductions</span>
              <span>{formatCurrency(otherDeductions)}</span>
            </div>
          ) : null}
          <div className="pi-print-totals__row pi-print-totals__row--grand">
            <span>Gross receipt</span>
            <span>{formatCurrency(gross)}</span>
          </div>
          {receipt.status === 'POSTED' || allocated > 0 || unallocated > 0 ? (
            <>
              <div className="pi-print-totals__row">
                <span>Allocated</span>
                <span>{formatCurrency(allocated)}</span>
              </div>
              <div className="pi-print-totals__row">
                <span>Unallocated</span>
                <span>{formatCurrency(unallocated)}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="pi-print-signatures">
        <div className="pi-print-signatures__block">
          <div className="pi-print-signatures__line" />
          <p>Received by</p>
        </div>
        <div className="pi-print-signatures__block">
          <div className="pi-print-signatures__line" />
          <p>Customer acknowledgement</p>
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
        <span>
          Computer-generated customer receipt{!isServices ? ' · Subject to Chhapi jurisdiction' : ''}
        </span>
      </footer>
    </article>
  )
}
