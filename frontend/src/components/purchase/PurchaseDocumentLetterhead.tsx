import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'
import { cn } from '@/utils/cn'

export type PurchaseLetterheadMeta = {
  label: string
  value: string
}

type PurchaseDocumentLetterheadProps = {
  /** Document title shown in the right badge, e.g. PURCHASE ORDER */
  docType: string
  docNumber: string
  meta?: PurchaseLetterheadMeta[]
  className?: string
}

/**
 * Shared Vasant Fabricators letterhead for all purchase print/PDF documents.
 * Branding matches quotation/SO via QUOTATION_COMPANY + logo asset.
 */
export function PurchaseDocumentLetterhead({
  docType,
  docNumber,
  meta = [],
  className,
}: PurchaseDocumentLetterheadProps) {
  const company = QUOTATION_COMPANY

  return (
    <header className={cn('po-print-header po-print-header--branded', className)}>
      <div className="po-print-header__brand">
        <div className="po-print-header__logo-wrap">
          <img className="po-print-header__logo" src={company.logoUrl} alt={company.brandName} />
        </div>
        <div className="po-print-header__identity">
          <h1 className="po-print-header__company">{company.legalName}</h1>
          <p className="po-print-header__tagline">{company.tagline}</p>
          <p className="po-print-header__address">{company.address}</p>
          <p className="po-print-header__address">{company.registeredOffice}</p>
          <p className="po-print-header__gst">
            {company.phone} · {company.email}
            {company.website ? ` · ${company.website}` : ''}
          </p>
          <p className="po-print-header__gst">GSTIN: {company.gstin}</p>
        </div>
      </div>

      <div className="po-print-header__badge">
        <p className="po-print-header__doc-type">{docType}</p>
        <p className="po-print-header__doc-no">{docNumber}</p>
        {meta.length > 0 ? (
          <dl className="po-print-header__meta-list">
            {meta.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  )
}
