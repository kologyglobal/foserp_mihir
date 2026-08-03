/**
 * CRM Tax Invoices pending Accounting review → convert into Money In Sales Invoice.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FilePlus2, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  listCrmPendingTaxInvoices,
  prefillInvoiceFromCrmTaxInvoice,
} from '@/services/bridges/receivablesApiBridge'
import type { CrmPendingTaxInvoiceDto } from '@/types/moneyIn'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { moneyInPath } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import type { CrmTaxInvoicePrefillState } from '../invoices/invoicePrefillState'

function accountingTone(status: string): 'warning' | 'success' | 'neutral' {
  if (status === 'pending_review') return 'warning'
  if (status === 'converted') return 'success'
  return 'neutral'
}

function accountingLabel(status: string): string {
  if (status === 'pending_review') return 'Pending review'
  if (status === 'converted') return 'Converted'
  if (status === 'rejected') return 'Rejected'
  return status
}

export function CrmPendingInvoicesPage() {
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<CrmPendingTaxInvoiceDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await listCrmPendingTaxInvoices({
        search: search.trim() || undefined,
        limit: 100,
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load CRM pending invoices')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  async function convertToMoneyIn(row: CrmPendingTaxInvoiceDto) {
    if (row.accountingStatus === 'converted' && row.salesInvoiceId) {
      navigate(moneyInPath(`invoices/${row.salesInvoiceId}`))
      return
    }
    if (!mergeAllowedAction(perms.canCreateInvoice, true)) {
      notify.error('finance.ar.invoice.create required')
      return
    }
    setConvertingId(row.id)
    try {
      const prefill = await prefillInvoiceFromCrmTaxInvoice(row.id)
      const state: CrmTaxInvoicePrefillState = { crmTaxInvoicePrefill: prefill }
      navigate(moneyInPath('invoices/new'), { state })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to prefill from CRM tax invoice')
    } finally {
      setConvertingId(null)
    }
  }

  if (!mergeAllowedAction(perms.canViewInvoice, true)) {
    return (
      <MoneyInWorkspaceShell title="CRM Tax Invoices">
        <p className="text-[13px] text-erp-muted">You do not have permission to view CRM pending invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="CRM Tax Invoices"
      description="Tax invoices posted by CRM users — convert to Money In for AR posting, receipts, and allocation."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search invoice / customer / creator…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()} disabled={loading}>
          Refresh
        </ErpButton>
      </div>

      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-erp-border bg-erp-surface px-4 py-8 text-center text-[13px] text-erp-muted">
          {isApiMode()
            ? 'No CRM tax invoices pending Accounting review.'
            : 'Switch to API mode to load CRM pending invoices.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-erp-border">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Created by</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Accounting</th>
                <th className="px-3 py-2 font-medium">Money In</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border">
                  <td className="px-3 py-2">
                    <Link to={`/sales/invoices/${row.id}`} className="font-medium text-erp-accent hover:underline">
                      {row.invoiceNo}
                    </Link>
                    {row.salesOrderNo ? (
                      <div className="text-[11px] text-erp-muted">SO {row.salesOrderNo}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.customerName}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-800">
                      CRM · {row.createdByName || 'User'}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.invoiceDate}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(Number(row.grandTotal))}</td>
                  <td className="px-3 py-2">
                    <ErpStatusChip tone={accountingTone(row.accountingStatus)} label={accountingLabel(row.accountingStatus)} />
                  </td>
                  <td className="px-3 py-2">
                    {row.salesInvoiceId ? (
                      <Link
                        to={moneyInPath(`invoices/${row.salesInvoiceId}`)}
                        className="text-erp-accent hover:underline"
                      >
                        {row.salesInvoiceNumber || 'Open SI'}
                      </Link>
                    ) : (
                      <span className="text-erp-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.accountingStatus === 'converted' ? (
                      <ErpButton
                        size="sm"
                        variant="secondary"
                        onClick={() => convertToMoneyIn(row)}
                      >
                        Open SI
                      </ErpButton>
                    ) : (
                      <ErpButton
                        size="sm"
                        variant="primary"
                        icon={FilePlus2}
                        disabled={convertingId === row.id || !mergeAllowedAction(perms.canCreateInvoice, true)}
                        onClick={() => void convertToMoneyIn(row)}
                      >
                        {convertingId === row.id ? 'Opening…' : 'Convert to Money In'}
                      </ErpButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
