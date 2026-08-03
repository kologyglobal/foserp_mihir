import type { ImportPreviewHeader } from '../api/bank-statement.types'
import { formatCurrency } from '@/utils/formatters/currency'
import { DOCUMENT_TYPE_LABELS, formatBalanceDisplay, parseDecimal } from '../utils/bankStatementUi'

export function StatementBalanceSummary({
  header,
}: {
  header: ImportPreviewHeader | null | undefined
  currencyCode?: string
}) {
  if (!header) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        Statement header could not be derived from mapped rows. Adjust column mapping or enter overrides on confirm.
      </div>
    )
  }

  const hasOpening = header.hasOpeningBalance !== false
  const hasClosing = header.hasClosingBalance !== false
  const diff = parseDecimal(header.balanceDifference)
  const balanced = hasOpening && hasClosing && Math.abs(diff) < 0.01
  const documentLabel = header.documentType
    ? DOCUMENT_TYPE_LABELS[header.documentType]
    : null

  const items = [
    { label: 'Reference', value: header.statementReference },
    ...(documentLabel
      ? [{ label: 'Document', value: documentLabel + (header.isProvisional ? ' (provisional)' : '') }]
      : []),
    { label: 'Period', value: `${header.periodStartDate} → ${header.periodEndDate}` },
    {
      label: 'Opening',
      value: hasOpening ? formatCurrency(parseDecimal(header.openingBalance)) : formatBalanceDisplay(null, false),
    },
    { label: 'Credits', value: formatCurrency(parseDecimal(header.totalCreditAmount)) },
    { label: 'Debits', value: formatCurrency(parseDecimal(header.totalDebitAmount)) },
    {
      label: 'Closing',
      value: hasClosing ? formatCurrency(parseDecimal(header.closingBalance)) : formatBalanceDisplay(null, false),
    },
    {
      label: 'Balance check',
      value: !hasOpening || !hasClosing ? 'N/A (provisional)' : balanced ? 'Balanced' : formatCurrency(diff),
      tone:
        !hasOpening || !hasClosing
          ? 'text-erp-muted'
          : balanced
            ? 'text-emerald-700'
            : 'text-rose-700',
    },
  ]

  return (
    <div className="grid gap-2 rounded-lg border border-erp-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[11px] font-semibold uppercase text-erp-muted">{item.label}</dt>
          <dd className={`text-[13px] font-medium tabular-nums ${item.tone ?? 'text-erp-text'}`}>{item.value}</dd>
        </div>
      ))}
    </div>
  )
}
