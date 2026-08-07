import type { CompanyBankDetails } from '../../utils/quotationEngine/companyProfile'

interface CompanyBankDetailsBlockProps {
  bank: CompanyBankDetails | null | undefined
  className?: string
}

/**
 * Bank / remittance details block shared across Proforma, Sales Order, Tax Invoice
 * and Quotation print documents. Renders nothing when no bank profile is configured.
 */
export function CompanyBankDetailsBlock({ bank, className }: CompanyBankDetailsBlockProps) {
  if (!bank) return null

  return (
    <div className={className ? `doc-print-bank ${className}` : 'doc-print-bank'}>
      <p className="doc-print-bank__title">Bank details</p>
      <dl className="doc-print-bank__grid">
        <div className="doc-print-bank__row">
          <dt>Company Name</dt>
          <dd>{bank.accountName || '-'}</dd>
        </div>
        <div className="doc-print-bank__row">
          <dt>Bank Name</dt>
          <dd>{bank.bankName}</dd>
        </div>
        <div className="doc-print-bank__row">
          <dt>Account No</dt>
          <dd>{bank.accountNumber || '-'}</dd>
        </div>
        <div className="doc-print-bank__row">
          <dt>IFSC Code</dt>
          <dd>{bank.ifscCode || '-'}</dd>
        </div>
        <div className="doc-print-bank__row">
          <dt>Branch</dt>
          <dd>{bank.branch || '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
