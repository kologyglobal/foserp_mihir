import { useMemo } from 'react'
import { Database, AlertTriangle } from 'lucide-react'
import type { QuotationDocument } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import type { Customer } from '../../types/master'
import type { Opportunity } from '../../types/crm'
import { buildQuotationMergeMap, findMissingPlaceholderValues } from '../../utils/quotationEngine/placeholders'
import { sectionCompletionStatus } from '../../utils/quotationEngine/validation'
import { extractCommercialTermsFromSections } from '../../utils/quotationTermUtils'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate, isValidTimestamp } from '../../utils/dates/format'
import { cn } from '../../utils/cn'

interface QuotationDataSourcePanelProps {
  doc: QuotationDocument
  quotation: Quotation
  customer?: Customer
  opportunity?: Opportunity
  contactName?: string
}

const ISO_DATE_TOKEN = /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z?)?/g

/** Format bare / embedded ISO timestamps for sidebar display (en-IN short date). */
function formatTermDisplayValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—') return trimmed || '—'
  if (isValidTimestamp(trimmed) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return formatDate(trimmed)
  }
  return trimmed.replace(ISO_DATE_TOKEN, (token) => (isValidTimestamp(token) ? formatDate(token) : token))
}

export function QuotationDataSourcePanel({
  doc,
  quotation,
  customer,
  opportunity,
  contactName,
}: QuotationDataSourcePanelProps) {
  const mergeMap = useMemo(
    () => buildQuotationMergeMap({ document: doc, quotation, customer, opportunity, contactName }),
    [doc, quotation, customer, opportunity, contactName],
  )
  const missing = useMemo(() => findMissingPlaceholderValues(mergeMap), [mergeMap])
  const completion = useMemo(() => sectionCompletionStatus(doc), [doc])

  const commercialTerms = useMemo(() => extractCommercialTermsFromSections(doc.sections), [doc.sections])
  const completionPct = completion.total ? (completion.complete / completion.total) * 100 : 0
  const completionTone = completion.missing.length ? 'warning' : 'success'

  const sources = [
    { label: 'Customer', value: customer?.customerName ?? '—', source: 'CRM Customer Master' },
    { label: 'Contact', value: contactName ?? customer?.contactPerson ?? '—', source: 'CRM Contact' },
    { label: 'Opportunity', value: opportunity?.opportunityNo ?? '—', source: 'CRM Opportunity' },
    { label: 'Product', value: mergeMap.product_name, source: 'Product Master / Opp' },
    { label: 'Grand Total', value: formatCrmCurrency(doc.totalAmount), source: 'Price Table' },
    { label: 'Payment Terms', value: commercialTerms.paymentTerms || mergeMap.payment_terms, source: 'Payment Terms Master' },
    { label: 'Delivery Terms', value: commercialTerms.deliveryTerms || mergeMap.delivery_time, source: 'Delivery Terms Master' },
    { label: 'Warranty Terms', value: commercialTerms.warrantyTerms || '—', source: 'Warranty Terms Master' },
  ]

  return (
    <div className="quo-datasource">
      <div className="quo-datasource__completion">
        <div className="quo-datasource__completion-head">
          <span>Section completion</span>
          <strong>{completion.complete}/{completion.total}</strong>
        </div>
        <div className="quo-datasource__progress">
          <div
            className={cn('quo-datasource__progress-bar', `quo-datasource__progress-bar--${completionTone}`)}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        {completion.missing.length > 0 ? (
          <ul className="quo-datasource__missing">
            {completion.missing.slice(0, 4).map((m) => (
              <li key={m}><AlertTriangle className="h-3 w-3" /> {m}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="quo-datasource__block">
        <h4 className="quo-datasource__title"><Database className="h-3.5 w-3.5" /> Data sources</h4>
        <ul className="quo-datasource__list">
          {sources.map((s) => {
            const display = formatTermDisplayValue(s.value)
            return (
              <li key={s.label}>
                <div className="quo-datasource__item-head">
                  <span>{s.label}</span>
                  <span className="quo-datasource__source">{s.source}</span>
                </div>
                <p className="quo-datasource__value" title={display}>{display}</p>
              </li>
            )
          })}
        </ul>
      </div>

      {missing.length > 0 ? (
        <div className="quo-datasource__warn">
          <p className="quo-datasource__warn-title">Unresolved placeholders</p>
          <p className="quo-datasource__warn-text">{missing.join(', ')}</p>
        </div>
      ) : null}
    </div>
  )
}
