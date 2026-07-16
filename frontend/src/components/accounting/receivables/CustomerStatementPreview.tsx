import { useEffect, useState } from 'react'
import { ReceivableDrawerShell } from './ReceivableDrawerShell'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import {
  getCustomerStatementPreview,
  getReceivableLookups,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import type { CustomerStatement, StatementType } from '@/types/receivables'
import { LoadingState } from '@/design-system/components/LoadingState'

const STATEMENT_TYPES: StatementType[] = ['Detailed', 'Summary', 'Open Items', 'Ageing Statement']

export function CustomerStatementPreview({
  open,
  onClose,
  customerId: initialCustomerId,
  customerName: initialCustomerName,
}: {
  open: boolean
  onClose: () => void
  customerId?: string
  customerName?: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  const yearStart = `${today.slice(0, 4)}-04-01`
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '')
  const [dateFrom, setDateFrom] = useState(yearStart > today ? `${Number(today.slice(0, 4)) - 1}-04-01` : yearStart)
  const [dateTo, setDateTo] = useState(today)
  const [statementType, setStatementType] = useState<StatementType>('Detailed')
  const [includeAgeing, setIncludeAgeing] = useState(true)
  const [customers, setCustomers] = useState<{ id: string; code: string; name: string }[]>([])
  const [statement, setStatement] = useState<CustomerStatement | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setCustomerId(initialCustomerId ?? '')
  }, [open, initialCustomerId])

  useEffect(() => {
    if (!open) return
    void getReceivableLookups()
      .then((l) => setCustomers(l.customers))
      .catch(() => setCustomers([]))
  }, [open])

  const loadPreview = async () => {
    if (!customerId) {
      notify.error('Select a customer for the statement.')
      return
    }
    setLoading(true)
    try {
      const result = await getCustomerStatementPreview({
        customerId,
        dateFrom,
        dateTo,
        statementType,
        includeOpenEntriesOnly: statementType === 'Open Items',
        includeAgeingSummary: includeAgeing,
        includeContactDetails: true,
      })
      setStatement(result)
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Statement could not be loaded.')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !customerId) {
      setStatement(null)
      return
    }
    void loadPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId, dateFrom, dateTo, statementType, includeAgeing])

  const selectedName =
    initialCustomerName ?? customers.find((c) => c.id === customerId)?.name ?? statement?.customerName

  return (
    <ReceivableDrawerShell
      open={open}
      onClose={onClose}
      title="Customer statement preview"
      subtitle={selectedName}
      eyebrow="Receivables"
      widthClassName="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-primary h-9 px-3 text-[13px] font-semibold"
            onClick={() => notify.info('Print/export integration is not connected (demo).')}
          >
            Print / Export
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-medium text-erp-text sm:col-span-2">
            Customer
            <select
              className="erp-input mt-1 h-9 w-full text-[12px]"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={Boolean(initialCustomerId)}
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-erp-text">
            From
            <input
              type="date"
              className="erp-input mt-1 h-9 w-full text-[12px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="block text-[12px] font-medium text-erp-text">
            To
            <input
              type="date"
              className="erp-input mt-1 h-9 w-full text-[12px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <label className="block text-[12px] font-medium text-erp-text">
            Statement type
            <select
              className="erp-input mt-1 h-9 w-full text-[12px]"
              value={statementType}
              onChange={(e) => setStatementType(e.target.value as StatementType)}
            >
              {STATEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1 text-[12px]">
            <input
              type="checkbox"
              checked={includeAgeing}
              onChange={(e) => setIncludeAgeing(e.target.checked)}
              className="h-4 w-4 rounded border-erp-border"
            />
            Include ageing summary
          </label>
        </div>

        {loading ? <LoadingState variant="table" rows={6} /> : null}

        {!loading && statement ? (
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{statement.companyName}</p>
            <h3 className="mt-1 text-[15px] font-semibold text-erp-text">{statement.customerName}</h3>
            <p className="text-[12px] text-erp-muted">
              {formatDate(statement.statementPeriodFrom)} — {formatDate(statement.statementPeriodTo)} ·{' '}
              {statement.statementType}
            </p>
            {statement.gstNumber ? (
              <p className="text-[11px] text-erp-muted">GSTIN: {statement.gstNumber}</p>
            ) : null}
            <p className="mt-2 text-[13px] font-semibold tabular-nums">
              Closing balance: {formatCurrency(statement.closingBalance)}
            </p>

            {statement.ageingSummary ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] sm:grid-cols-6">
                {Object.entries(statement.ageingSummary).map(([bucket, amt]) => (
                  <div key={bucket} className="rounded border border-erp-border px-2 py-1">
                    <p className="text-erp-muted">{bucket}</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(amt)}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {statement.lines.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-[12px]">
                  <thead className="sticky top-0 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase text-erp-muted">
                    <tr>
                      <th className="px-2 py-1.5">Date</th>
                      <th className="px-2 py-1.5">Document</th>
                      <th className="px-2 py-1.5">Type</th>
                      <th className="px-2 py-1.5 text-right">Debit</th>
                      <th className="px-2 py-1.5 text-right">Credit</th>
                      <th className="px-2 py-1.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.lines.map((line, i) => (
                      <tr key={`${line.documentNumber}-${i}`} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">{formatDate(line.date)}</td>
                        <td className="px-2 py-1.5 font-mono">{line.documentNumber}</td>
                        <td className="px-2 py-1.5">{line.documentType}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                          {formatCurrency(line.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-erp-muted">No statement lines for the selected period.</p>
            )}
          </div>
        ) : null}

        <p className="text-[11px] text-erp-muted">Demo preview — no PDF or email delivery is connected.</p>
      </div>
    </ReceivableDrawerShell>
  )
}
