import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listVendorInvoices } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { VendorInvoiceDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import {
  MONEY_OUT_STATUS_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorInvoiceDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function VendorInvoiceApprovalListPage() {
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<VendorInvoiceDto[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await listVendorInvoices({
        legalEntityId: resolveLegalEntityId(),
        status: 'PENDING_APPROVAL',
        limit: 100,
      })
      setRows(result.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  if (!perms.canViewInvoice) {
    return (
      <MoneyOutWorkspaceShell title="Approvals">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor invoice approvals.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Approvals">
        <p className="text-[13px] text-erp-muted">Vendor invoice approvals require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Approvals"
      description="Vendor invoices awaiting approval. Approve/reject only when you are an eligible approver."
      commandBar={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">
          No vendor invoices are waiting for your approval.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Vendor Invoice</th>
                <th className="py-2 pr-3 font-medium">Supplier Invoice</th>
                <th className="py-2 pr-3 font-medium">Vendor</th>
                <th className="py-2 pr-3 font-medium">Submitted</th>
                <th className="py-2 pr-3 text-right font-medium">Total</th>
                <th className="py-2 pr-3 text-right font-medium">Payable</th>
                <th className="py-2 pr-3 font-medium">Level</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const actions = inv.allowedActions
                return (
                  <tr key={inv.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Link
                        to={`/accounting/money-out/approvals/${inv.id}`}
                        className="font-medium text-erp-accent hover:underline"
                      >
                        {vendorInvoiceDisplayNumber(inv)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{inv.supplierInvoiceNumber}</td>
                    <td className="py-2 pr-3">{inv.vendorNameSnapshot}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {inv.submittedAt ? new Date(inv.submittedAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatCurrency(parseDecimal(inv.invoiceGrandTotal))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatCurrency(parseDecimal(inv.vendorPayableAmount))}
                    </td>
                    <td className="py-2 pr-3">
                      {inv.approvalRequest
                        ? `${inv.approvalRequest.currentLevel}/${inv.approvalRequest.totalLevels}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <ErpStatusChip
                        label={MONEY_OUT_STATUS_LABELS[inv.status]}
                        tone={moneyOutStatusTone(inv.status)}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <ErpButton
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/accounting/money-out/approvals/${inv.id}`)}
                        >
                          Review
                        </ErpButton>
                        {mergeAllowedAction(perms.canApproveInvoice, actions?.approve) && (
                          <ErpButton
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/accounting/money-out/approvals/${inv.id}`)}
                          >
                            Approve
                          </ErpButton>
                        )}
                        {mergeAllowedAction(perms.canApproveInvoice, actions?.reject) && (
                          <ErpButton
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/accounting/money-out/approvals/${inv.id}`)}
                          >
                            Reject
                          </ErpButton>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
