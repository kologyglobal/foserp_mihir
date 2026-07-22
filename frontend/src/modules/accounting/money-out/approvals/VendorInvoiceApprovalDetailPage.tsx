import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  approveVendorInvoice,
  getVendorInvoice,
  getVendorInvoiceApproval,
  rejectVendorInvoice,
} from '@/services/bridges/payablesApiBridge'
import type { VendorInvoiceApprovalDetail, VendorInvoiceDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { VendorInvoiceAccountingPreviewTable } from '../components/VendorInvoiceAccountingPreview'
import { VendorInvoiceTotalsPanel } from '../components/VendorInvoiceTotalsPanel'
import {
  MONEY_OUT_STATUS_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorInvoiceDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function VendorInvoiceApprovalDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [invoice, setInvoice] = useState<VendorInvoiceDto | null>(null)
  const [approval, setApproval] = useState<VendorInvoiceApprovalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [comments, setComments] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [inv, appr] = await Promise.all([getVendorInvoice(id), getVendorInvoiceApproval(id).catch(() => null)])
      setInvoice(inv)
      setApproval(appr)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load approval')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewInvoice && isApiMode()) void load()
  }, [load, perms.canViewInvoice])

  const runApprove = async () => {
    if (!id || !invoice) return
    setActing(true)
    try {
      await approveVendorInvoice(id, invoice.updatedAt, comments.trim() || undefined)
      notify.success('Approved')
      setComments('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setActing(false)
    }
  }

  const runReject = async () => {
    if (!id || !invoice || !reason.trim()) {
      notify.error('Rejection reason is required')
      return
    }
    setActing(true)
    try {
      await rejectVendorInvoice(id, reason.trim(), invoice.updatedAt)
      notify.success('Rejected')
      setShowReject(false)
      setReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setActing(false)
    }
  }

  if (!perms.canViewInvoice) {
    return (
      <MoneyOutWorkspaceShell title="Approval">
        <p className="text-[13px] text-erp-muted">Access denied.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading || !invoice) {
    return (
      <MoneyOutWorkspaceShell title="Approval">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  const actions = invoice.allowedActions

  return (
    <MoneyOutWorkspaceShell
      title={`Approve — ${vendorInvoiceDisplayNumber(invoice)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <ErpButton variant="secondary" onClick={() => navigate(`/accounting/money-out/vendor-invoices/${id}`)}>
            Open Vendor Invoice
          </ErpButton>
          {mergeAllowedAction(perms.canApproveInvoice, actions?.approve) && (
            <ErpButton variant="primary" onClick={() => void runApprove()} disabled={acting}>
              Approve
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApproveInvoice, actions?.reject) && (
            <ErpButton variant="ghost" onClick={() => setShowReject(true)} disabled={acting}>
              Reject
            </ErpButton>
          )}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ErpStatusChip label={MONEY_OUT_STATUS_LABELS[invoice.status]} tone={moneyOutStatusTone(invoice.status)} />
        <span className="text-[13px] text-erp-muted">{invoice.vendorNameSnapshot}</span>
        <span className="text-[13px] text-erp-muted">Supplier: {invoice.supplierInvoiceNumber}</span>
        <span className="text-[13px] font-medium tabular-nums">
          Payable {formatCurrency(parseDecimal(invoice.vendorPayableAmount))}
        </span>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <dl className="space-y-2 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-erp-muted">Invoice total</dt>
            <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.invoiceGrandTotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-erp-muted">TDS</dt>
            <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.tdsAmount))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-erp-muted">Approval level</dt>
            <dd>
              {approval?.approvalRequest?.currentLevel ?? invoice.approvalRequest?.currentLevel ?? '—'} /{' '}
              {approval?.approvalRequest?.totalLevels ?? invoice.approvalRequest?.totalLevels ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-erp-muted">Duplicate risk</dt>
            <dd>{invoice.validation?.duplicateAssessment?.riskLevel ?? '—'}</dd>
          </div>
        </dl>
        <VendorInvoiceTotalsPanel
          taxable={invoice.taxableAmount}
          cgst={invoice.inputCgstAmount}
          sgst={invoice.inputSgstAmount}
          igst={invoice.inputIgstAmount}
          grandTotal={invoice.invoiceGrandTotal}
          tds={invoice.tdsAmount}
          vendorPayable={invoice.vendorPayableAmount}
        />
      </div>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-erp-border text-erp-muted">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Taxable</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-erp-border/60">
                <td className="py-2 pr-2">{l.lineNumber}</td>
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.taxableAmount))}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Accounting preview</h3>
        <VendorInvoiceAccountingPreviewTable preview={invoice.accountingPreviewSnapshot} />
      </div>

      <div className="mb-4 text-[12px]">
        <h3 className="mb-2 font-semibold uppercase tracking-wide text-erp-muted">Approval timeline</h3>
        {(approval?.steps ?? []).length === 0 ? (
          <p className="text-erp-muted">No approval steps loaded.</p>
        ) : (
          <ul className="space-y-2">
            {approval!.steps.map((s) => (
              <li key={s.id} className="rounded border border-erp-border px-3 py-2">
                Level {s.level}: {s.status}
                {s.comments ? ` — ${s.comments}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      {mergeAllowedAction(perms.canApproveInvoice, actions?.approve) && (
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-erp-muted" htmlFor="approve-comment">
            Approval comment (optional)
          </label>
          <Textarea id="approve-comment" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
      )}

      <p className="text-[12px]">
        <Link to={`/accounting/money-out/vendor-invoices/${id}`} className="text-erp-accent hover:underline">
          Open full vendor invoice →
        </Link>
      </p>

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Reject vendor invoice</h3>
            <p className="mt-2 text-[12px] text-erp-muted">
              The vendor invoice will move to Rejected and must be revised before resubmission.
            </p>
            <Textarea
              className="mt-2"
              rows={3}
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Rejection reason"
            />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowReject(false)} disabled={acting}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runReject()} disabled={acting}>
                Reject
              </ErpButton>
            </div>
          </div>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
