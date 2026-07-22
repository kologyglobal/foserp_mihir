import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  getPayableAllocation,
  getVendorAdjustment,
  getVendorAdjustmentReversalPreview,
  getVendorInvoice,
  getVendorInvoiceReversalPreview,
  getVendorPayment,
  getVendorPaymentReversalPreview,
  reversePayableAllocationApi,
  reverseVendorAdjustmentApi,
  reverseVendorInvoiceApi,
  reverseVendorPaymentApi,
} from '@/services/bridges/payablesApiBridge'
import type { ApDocumentReversalPreview, ApReversalDocumentType } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import {
  AP_REVERSAL_TYPE_LABELS,
  parseDecimal,
  todayIsoDate,
  vendorAdjustmentDisplayNumber,
  vendorInvoiceDisplayNumber,
  vendorPaymentDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

function parseReversalType(raw: string | undefined): ApReversalDocumentType | null {
  if (raw === 'payment' || raw === 'invoice' || raw === 'adjustment' || raw === 'allocation') return raw
  return null
}

export function ReversalPreviewPage() {
  const { type: rawType, id } = useParams()
  const type = parseReversalType(rawType)
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [preview, setPreview] = useState<ApDocumentReversalPreview | null>(null)
  const [documentUpdatedAt, setDocumentUpdatedAt] = useState<string>('')
  const [documentLabel, setDocumentLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [reversing, setReversing] = useState(false)
  const [reversalDate, setReversalDate] = useState(todayIsoDate())
  const [reason, setReason] = useState('')
  const [cascade, setCascade] = useState(false)
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null)

  const canReverse = useMemo(() => {
    if (type === 'payment') return perms.canReversePayment
    if (type === 'invoice') return perms.canReverseInvoice
    if (type === 'adjustment') return perms.canReverseAdjustment
    if (type === 'allocation') return perms.canReverseAllocation
    return false
  }, [perms, type])

  const load = useCallback(async () => {
    if (!id || !type) return
    setLoading(true)
    try {
      if (type === 'payment') {
        const pmt = await getVendorPayment(id)
        setDocumentUpdatedAt(pmt.updatedAt)
        setDocumentLabel(vendorPaymentDisplayNumber(pmt))
        setPreview(await getVendorPaymentReversalPreview(id))
      } else if (type === 'invoice') {
        const inv = await getVendorInvoice(id)
        setDocumentUpdatedAt(inv.updatedAt)
        setDocumentLabel(vendorInvoiceDisplayNumber(inv))
        setPreview(await getVendorInvoiceReversalPreview(id))
      } else if (type === 'adjustment') {
        const adj = await getVendorAdjustment(id)
        setDocumentUpdatedAt(adj.updatedAt)
        setDocumentLabel(vendorAdjustmentDisplayNumber(adj))
        setPreview(await getVendorAdjustmentReversalPreview(id))
      } else if (type === 'allocation') {
        const detail = await getPayableAllocation(id)
        setDocumentUpdatedAt(detail.batch.updatedAt)
        setDocumentLabel(detail.batch.allocationReference)
        const activeLines = detail.lines.filter((l) => l.status === 'ACTIVE' && parseDecimal(l.amount) > parseDecimal(l.reversedAmount))
        setPreview({
          eligible: activeLines.length > 0,
          blockingIssues: activeLines.length === 0 ? ['No active allocation amount remains to reverse'] : [],
          allowedActions: { reverse: activeLines.length > 0 },
          allocationBatchId: detail.batch.id,
          allocationReference: detail.batch.allocationReference,
          allocationTotal: detail.batch.totalAllocatedAmount,
          documentLabel: detail.batch.allocationReference,
        })
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reversal preview')
    } finally {
      setLoading(false)
    }
  }, [id, type])

  useEffect(() => {
    if (canReverse && isApiMode()) void load()
  }, [canReverse, load])

  const keySignature = JSON.stringify({ type, id, reversalDate, reason: reason.trim(), cascade })
  const resolveIdempotencyKey = () => {
    if (idempotencyRef.current && idempotencyRef.current.signature === keySignature) {
      return idempotencyRef.current.key
    }
    const key = crypto.randomUUID()
    idempotencyRef.current = { signature: keySignature, key }
    return key
  }

  const runReverse = async () => {
    if (!id || !type || !reason.trim()) {
      notify.error('Reversal reason is required')
      return
    }
    if (!documentUpdatedAt) {
      notify.error('Document version missing — refresh and retry')
      return
    }
    setReversing(true)
    try {
      const body = {
        reversalDate,
        reason: reason.trim(),
        idempotencyKey: resolveIdempotencyKey(),
        expectedUpdatedAt: documentUpdatedAt,
        cascadeAllocationReversals: cascade,
      }
      if (type === 'payment') {
        const result = await reverseVendorPaymentApi(id, body)
        notify.success(result.idempotentReplay ? 'Reversal replayed' : 'Vendor payment reversed')
        navigate(`/accounting/money-out/vendor-payments/${id}`)
      } else if (type === 'invoice') {
        const result = await reverseVendorInvoiceApi(id, body)
        notify.success(result.idempotentReplay ? 'Reversal replayed' : 'Vendor invoice reversed')
        navigate(`/accounting/money-out/vendor-invoices/${id}`)
      } else if (type === 'adjustment') {
        const result = await reverseVendorAdjustmentApi(id, body)
        notify.success(result.idempotentReplay ? 'Reversal replayed' : 'Vendor adjustment reversed')
        navigate(`/accounting/money-out/vendor-adjustments/${id}`)
      } else if (type === 'allocation') {
        const detail = await getPayableAllocation(id)
        const activeLineIds = detail.lines
          .filter((l) => l.status === 'ACTIVE' && parseDecimal(l.amount) > parseDecimal(l.reversedAmount))
          .map((l) => l.id)
        await reversePayableAllocationApi(id, {
          reversalDate,
          reason: reason.trim(),
          idempotencyKey: resolveIdempotencyKey(),
          expectedAllocationUpdatedAt: documentUpdatedAt,
          lineIds: activeLineIds,
          expectedLines: detail.lines.map((l) => ({ allocationLineId: l.id, expectedUpdatedAt: l.updatedAt })),
          expectedOpenItems: [
            ...(detail.source ? [{ openItemId: detail.source.openItemId, expectedUpdatedAt: detail.batch.updatedAt }] : []),
            ...detail.targets.map((t) => ({ openItemId: t.openItemId, expectedUpdatedAt: detail.batch.updatedAt })),
          ],
        })
        notify.success('Allocation reversed')
        navigate(`/accounting/money-out/allocations/${id}`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reversal failed')
      idempotencyRef.current = null
    } finally {
      setReversing(false)
    }
  }

  if (!type || !id) {
    return (
      <MoneyOutWorkspaceShell title="Reversal">
        <p className="text-[13px] text-erp-muted">Invalid reversal route.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!canReverse) {
    return (
      <MoneyOutWorkspaceShell title="Reversal">
        <p className="text-[13px] text-erp-muted">You do not have permission to reverse this document type.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode() || loading || !preview) {
    return (
      <MoneyOutWorkspaceShell title="Reversal Preview">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  const showCascade =
    type !== 'allocation' &&
    preview.requiresAllocationReversal &&
    mergeAllowedAction(canReverse, preview.allowedActions.reverseWithCascade)

  const canConfirm =
    type === 'allocation'
      ? preview.eligible
      : mergeAllowedAction(canReverse, preview.allowedActions.reverse) ||
        (showCascade && cascade && mergeAllowedAction(canReverse, preview.allowedActions.reverseWithCascade))

  return (
    <MoneyOutWorkspaceShell title={`Reverse ${AP_REVERSAL_TYPE_LABELS[type]}`}>
      <p className="mb-3 text-[12px] text-erp-muted">
        <Link to="/accounting/money-out/corrections" className="text-erp-accent hover:underline">
          ← Corrections
        </Link>
      </p>

      <div className="mb-4 rounded border border-erp-border bg-slate-50 p-4 text-[12px]">
        <div className="font-semibold">{documentLabel}</div>
        {preview.originalVoucherNumber && (
          <div className="mt-1 text-erp-muted">Original voucher: {preview.originalVoucherNumber}</div>
        )}
        {preview.proposedReversalSummary && (
          <div className="mt-2 grid gap-1 sm:grid-cols-3">
            <div>Lines: {preview.proposedReversalSummary.lineCount}</div>
            <div>Debit: {formatCurrency(parseDecimal(preview.proposedReversalSummary.totalDebit))}</div>
            <div>Credit: {formatCurrency(parseDecimal(preview.proposedReversalSummary.totalCredit))}</div>
          </div>
        )}
        {preview.activeAllocationCount != null && preview.activeAllocationCount > 0 && (
          <div className="mt-2 text-amber-800">
            {preview.activeAllocationCount} active allocation(s) totalling{' '}
            {formatCurrency(parseDecimal(preview.activeAllocationAmount ?? '0'))} must be reversed first
            {showCascade ? ' — or enable cascade below.' : '.'}
          </div>
        )}
        {preview.blockingIssues.length > 0 && (
          <ul className="mt-2 list-disc pl-4 text-red-700">
            {preview.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid max-w-lg gap-3">
        <div>
          <label className="mb-1 block text-[12px] text-erp-muted">Reversal date</label>
          <Input type="date" value={reversalDate} onChange={(e) => setReversalDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] text-erp-muted">Reason</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Required" />
        </div>
        {showCascade && (
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
            Cascade allocation reversals before document reversal
          </label>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <ErpButton variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </ErpButton>
        <ErpButton variant="primary" onClick={() => void runReverse()} disabled={!canConfirm || reversing}>
          {reversing ? 'Reversing…' : type === 'allocation' ? 'Reverse Allocation' : 'Confirm Reversal'}
        </ErpButton>
      </div>
    </MoneyOutWorkspaceShell>
  )
}
