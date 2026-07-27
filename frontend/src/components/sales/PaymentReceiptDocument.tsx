import { QUOTATION_COMPANY } from '../../utils/quotationEngine/companyProfile'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { amountInWords } from '../../utils/amountInWords'
import { cn } from '../../utils/cn'
import type { CrmPaymentAllocation, CrmPaymentReceipt } from '../../types/crmCommercial'
import { CRM_PAYMENT_MODE_LABELS } from '../../types/crmCommercial'

export interface PaymentReceiptPartyInfo {
  address?: string
  gstin?: string
  state?: string
}

interface PaymentReceiptDocumentProps {
  receipt: CrmPaymentReceipt
  allocations?: CrmPaymentAllocation[]
  customer?: PaymentReceiptPartyInfo | null
  className?: string
}

export function PaymentReceiptDocument({
  receipt,
  allocations = [],
  customer,
  className,
}: PaymentReceiptDocumentProps) {
  const company = QUOTATION_COMPANY
  const allocatedAmount = Math.max(0, receipt.amount - receipt.unallocatedAmount)
  const activeAllocations = allocations.filter((a) => !a.reversedAt)

  return (
    <article className={cn('pi-print-doc rcpt-print-doc', className)} id="payment-receipt-print">
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
          <p className="pi-print-header__doc-type">Payment Receipt</p>
          <p className="pi-print-header__doc-no">{receipt.receiptNo}</p>
          <dl className="pi-print-header__meta">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(receipt.receiptDate)}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{CRM_PAYMENT_MODE_LABELS[receipt.paymentMode]}</dd>
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
          <p className="pi-print-party__name">{receipt.customerName}</p>
          {customer?.address ? <p className="pi-print-party__line">{customer.address}</p> : null}
          <p className="pi-print-party__line">GSTIN: {customer?.gstin || '—'}</p>
          {customer?.state ? <p className="pi-print-party__line">State: {customer.state}</p> : null}
        </section>

        <section className="pi-print-party pi-print-party--meta">
          <p className="pi-print-party__label">Payment details</p>
          <p className="pi-print-party__line">
            <span>Mode</span> {CRM_PAYMENT_MODE_LABELS[receipt.paymentMode]}
          </p>
          <p className="pi-print-party__line">
            <span>UTR / Ref</span> {receipt.transactionRef || '—'}
          </p>
          <p className="pi-print-party__line">
            <span>Proforma</span> {receipt.proformaNo || '—'}
          </p>
          <p className="pi-print-party__line">
            <span>Received by</span> {receipt.createdBy || '—'}
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
              <tr key={row.id}>
                <td className="num">{index + 1}</td>
                <td>
                  <span className="pi-print-table__desc">{row.invoiceNo}</span>
                  {row.remarks ? <span className="pi-print-table__code">{row.remarks}</span> : null}
                </td>
                <td>{formatDate(row.allocationDate)}</td>
                <td className="num">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="pi-print-footer-grid">
        <div className="pi-print-words">
          <p className="pi-print-words__label">Amount in words</p>
          <p className="pi-print-words__value">{amountInWords(receipt.amount)}</p>

          {receipt.remarks ? (
            <div className="pi-print-notes">
              <p className="pi-print-notes__title">Remarks</p>
              <p>{receipt.remarks}</p>
            </div>
          ) : null}

          <div className="pi-print-notes">
            <p className="pi-print-notes__title">Note</p>
            <ul>
              <li>Unallocated balance may be applied to future tax invoices for the same customer.</li>
              <li>Please quote the receipt number in all payment-related correspondence.</li>
            </ul>
          </div>
        </div>

        <div className="pi-print-totals">
          <div className="pi-print-totals__row">
            <span>Amount received</span>
            <span>{formatCurrency(receipt.amount)}</span>
          </div>
          <div className="pi-print-totals__row">
            <span>Allocated</span>
            <span>{formatCurrency(allocatedAmount)}</span>
          </div>
          <div className="pi-print-totals__row pi-print-totals__row--grand">
            <span>Unallocated</span>
            <span>{formatCurrency(receipt.unallocatedAmount)}</span>
          </div>
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
        <span>Computer-generated payment receipt · Subject to Chhapi jurisdiction</span>
      </footer>
    </article>
  )
}
