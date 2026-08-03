import type { QuotationDocument } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import { cn } from '../../utils/cn'
import {
  buildQuotationCommercialFields,
  type BuildQuotationCommercialFieldsInput,
} from '../../utils/quotationEngine/commercialTermsDisplay'

export interface QuotationCommercialTermsBlockProps {
  quotation: BuildQuotationCommercialFieldsInput['quotation']
  document?: QuotationDocument | null
  quotationDate?: string | null
  /** print = letter layout used by Preview / Print / PDF */
  variant?: 'print' | 'card' | 'inline'
  className?: string
  title?: string
}

/**
 * Dedicated Commercial Terms section — same labels/values on Detail, Preview, Print, PDF.
 * Hidden entirely when every commercial field is blank.
 */
export function QuotationCommercialTermsBlock({
  quotation,
  document,
  quotationDate,
  variant = 'card',
  className,
  title = 'Commercial Terms',
}: QuotationCommercialTermsBlockProps) {
  const fields = buildQuotationCommercialFields({
    quotation: quotation as Quotation,
    document,
    quotationDate,
  })

  if (fields.length === 0) return null

  if (variant === 'print') {
    return (
      <section
        className={cn('quo-print-section quo-print-section--commercial', className)}
        aria-label={title}
      >
        <h2 className="quo-print-section__title">{title}</h2>
        <dl className="quo-print-commercial">
          {fields.map((f) => (
            <div
              key={f.key}
              className={cn(
                'quo-print-commercial__row',
                f.multiline && 'quo-print-commercial__row--multiline',
              )}
            >
              <dt>{f.label}</dt>
              <dd className={cn(f.multiline && 'quo-print-commercial__value--wrap')}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }

  if (variant === 'inline') {
    return (
      <dl className={cn('quo-commercial-inline', className)} aria-label={title}>
        {fields.map((f) => (
          <div key={f.key} className="quo-commercial-inline__row">
            <dt>{f.label}</dt>
            <dd className={cn(f.multiline && 'whitespace-pre-wrap')}>{f.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]',
        className,
      )}
      aria-label={title}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{title}</p>
      <dl className="mt-3 space-y-2.5">
        {fields.map((f) => (
          <div key={f.key} className="grid gap-0.5 sm:grid-cols-[minmax(0,160px)_1fr] sm:gap-3">
            <dt className="text-[12px] font-medium text-erp-muted">{f.label}</dt>
            <dd
              className={cn(
                'text-[13px] font-medium text-erp-text',
                f.multiline && 'whitespace-pre-wrap leading-relaxed',
              )}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
