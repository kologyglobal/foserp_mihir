import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { PayableDrawerShell } from './PayableDrawerShell'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { getPayableInvoices, getPayableLookups, getVendorPayments, PayablesServiceError } from '@/services/accounting/payablesService'
import { LoadingState } from '@/design-system/components/LoadingState'

export type VendorStatementType = 'Detailed' | 'Summary' | 'Open Items' | 'Ageing Statement'

const STATEMENT_TYPES: VendorStatementType[] = ['Detailed', 'Summary', 'Open Items', 'Ageing Statement']

export interface VendorStatementLine {
  date: string
  documentNumber: string
  documentType: string
  debit: number
  credit: number
  runningBalance: number
}

export interface VendorStatement {
  companyName: string
  vendorName: string
  vendorCode: string
  gstNumber: string | null
  statementPeriodFrom: string
  statementPeriodTo: string
  statementType: VendorStatementType
  closingBalance: number
  ageingSummary?: Record<string, number>
  lines: VendorStatementLine[]
}

export function VendorStatementPreview({
  open,
  onClose,
  vendorId: initialVendorId,
  vendorName: initialVendorName,
}: {
  open: boolean
  onClose: () => void
  vendorId?: string
  vendorName?: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  const yearStart = `${today.slice(0, 4)}-04-01`
  const [vendorId, setVendorId] = useState(initialVendorId ?? '')
  const [dateFrom, setDateFrom] = useState(yearStart > today ? `${Number(today.slice(0, 4)) - 1}-04-01` : yearStart)
  const [dateTo, setDateTo] = useState(today)
  const [statementType, setStatementType] = useState<VendorStatementType>('Detailed')
  const [includeAgeing, setIncludeAgeing] = useState(true)
  const [vendors, setVendors] = useState<{ id: string; code: string; name: string }[]>([])
  const [statement, setStatement] = useState<VendorStatement | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setVendorId(initialVendorId ?? '')
  }, [open, initialVendorId])

  useEffect(() => {
    if (!open) return
    void getPayableLookups()
      .then((l) => setVendors(l.vendors))
      .catch(() => setVendors([]))
  }, [open])

  const loadPreview = async () => {
    if (!vendorId) {
      notify.error('Select a vendor for the statement.')
      return
    }
    setLoading(true)
    try {
      const [invoices, payments, lookups] = await Promise.all([
        getPayableInvoices({ vendorId }),
        getVendorPayments({ vendorId }),
        getPayableLookups(),
      ])
      const vendor = lookups.vendors.find((v) => v.id === vendorId)
      const lines: VendorStatementLine[] = []
      let balance = 0

      for (const inv of invoices) {
        if (inv.invoiceDate < dateFrom || inv.invoiceDate > dateTo) continue
        if (statementType === 'Open Items' && inv.outstandingBalance <= 0) continue
        balance += inv.originalAmount
        lines.push({
          date: inv.invoiceDate,
          documentNumber: inv.invoiceNumber,
          documentType: 'Purchase Invoice',
          debit: inv.originalAmount,
          credit: 0,
          runningBalance: balance,
        })
        if (inv.paidAmount > 0) {
          balance -= inv.paidAmount
          lines.push({
            date: inv.postingDate,
            documentNumber: `PAY-ALLOC-${inv.invoiceNumber}`,
            documentType: 'Payment Allocation',
            debit: 0,
            credit: inv.paidAmount,
            runningBalance: balance,
          })
        }
      }

      for (const pay of payments.filter((p) => p.status === 'Posted')) {
        if (pay.paymentDate < dateFrom || pay.paymentDate > dateTo) continue
        if (statementType === 'Open Items') continue
        balance -= pay.amount
        lines.push({
          date: pay.paymentDate,
          documentNumber: pay.paymentNumber,
          documentType: 'Vendor Payment',
          debit: 0,
          credit: pay.amount,
          runningBalance: balance,
        })
      }

      lines.sort((a, b) => a.date.localeCompare(b.date))
      let running = 0
      for (const line of lines) {
        running += line.debit - line.credit
        line.runningBalance = running
      }

      const openInvoices = invoices.filter((i) => i.outstandingBalance > 0)
      const ageingSummary = includeAgeing
        ? {
            'Not Due': openInvoices.filter((i) => i.ageingBucket === 'Not Due').reduce((s, i) => s + i.outstandingBalance, 0),
            '1–30 Days': openInvoices.filter((i) => i.ageingBucket === '1–30 Days').reduce((s, i) => s + i.outstandingBalance, 0),
            '31–60 Days': openInvoices.filter((i) => i.ageingBucket === '31–60 Days').reduce((s, i) => s + i.outstandingBalance, 0),
            '61–90 Days': openInvoices.filter((i) => i.ageingBucket === '61–90 Days').reduce((s, i) => s + i.outstandingBalance, 0),
            '91+ Days': openInvoices
              .filter((i) => ['91–180 Days', 'Above 180 Days'].includes(i.ageingBucket))
              .reduce((s, i) => s + i.outstandingBalance, 0),
          }
        : undefined

      setStatement({
        companyName: 'FOS Trailers Pvt Ltd',
        vendorName: vendor?.name ?? initialVendorName ?? 'Vendor',
        vendorCode: vendor?.code ?? '',
        gstNumber: null,
        statementPeriodFrom: dateFrom,
        statementPeriodTo: dateTo,
        statementType,
        closingBalance: running,
        ageingSummary,
        lines,
      })
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Statement could not be loaded.')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !vendorId) {
      setStatement(null)
      return
    }
    void loadPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vendorId, dateFrom, dateTo, statementType, includeAgeing])

  const selectedName =
    initialVendorName ?? vendors.find((v) => v.id === vendorId)?.name ?? statement?.vendorName

  return (
    <PayableDrawerShell
      open={open}
      onClose={onClose}
      title="Vendor statement preview"
      subtitle={selectedName}
      eyebrow="Payables"
      widthClassName="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold"
            onClick={() => notify.info('Email preview only — no message was sent (demo).')}
          >
            <Mail className="mr-1 inline h-4 w-4" aria-hidden />
            Email preview
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
            Vendor
            <select
              className="erp-input mt-1 h-9 w-full text-[12px]"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              disabled={Boolean(initialVendorId)}
            >
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.name}
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
              onChange={(e) => setStatementType(e.target.value as VendorStatementType)}
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
            <h3 className="mt-1 text-[15px] font-semibold text-erp-text">{statement.vendorName}</h3>
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
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] sm:grid-cols-5">
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
    </PayableDrawerShell>
  )
}
