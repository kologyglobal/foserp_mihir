import { useEffect, useState } from 'react'
import { PayableDrawerShell } from './PayableDrawerShell'
import { VendorDisputeStatusBadge } from './PayableStatusBadge'
import { notify } from '@/store/toastStore'
import { getSessionUser } from '@/utils/permissions'
import {
  VENDOR_DISPUTE_TYPES,
  type VendorDispute,
  type VendorDisputeStatus,
  type VendorDisputeType,
} from '@/types/payables'
import { getPayableInvoices, PayablesServiceError } from '@/services/accounting/payablesService'
import { cn } from '@/utils/cn'

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

const DISPUTE_STATUSES: VendorDisputeStatus[] = [
  'Open',
  'Under Review',
  'Awaiting Vendor',
  'Awaiting Internal Team',
  'Resolved',
  'Rejected',
  'Closed',
]

const PRIORITIES: VendorDispute['priority'][] = ['Low', 'Medium', 'High', 'Critical']

export function PayableDisputeDrawer({
  open,
  onClose,
  dispute,
  vendorId: presetVendorId,
  vendorName: presetVendorName,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  dispute?: VendorDispute | null
  vendorId?: string
  vendorName?: string
  onSaved?: (payload: Partial<VendorDispute>) => void
}) {
  const isEdit = Boolean(dispute?.id)
  const today = new Date().toISOString().slice(0, 10)
  const user = getSessionUser()

  const [invoiceId, setInvoiceId] = useState('')
  const [disputeDate, setDisputeDate] = useState(today)
  const [disputeType, setDisputeType] = useState<VendorDisputeType>('Price Difference')
  const [disputedAmount, setDisputedAmount] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState(user.name)
  const [responsibleDepartment, setResponsibleDepartment] = useState('Accounts Payable')
  const [priority, setPriority] = useState<VendorDispute['priority']>('Medium')
  const [targetResolutionDate, setTargetResolutionDate] = useState('')
  const [status, setStatus] = useState<VendorDisputeStatus>('Open')
  const [resolution, setResolution] = useState('')
  const [debitNoteRequired, setDebitNoteRequired] = useState(false)
  const [paymentHold, setPaymentHold] = useState(false)
  const [invoices, setInvoices] = useState<{ id: string; invoiceNumber: string; outstandingBalance: number }[]>([])
  const [busy, setBusy] = useState(false)

  const effectiveVendorId = dispute?.vendorId ?? presetVendorId ?? ''

  useEffect(() => {
    if (!open) return
    if (dispute) {
      setInvoiceId(dispute.invoiceId)
      setDisputeDate(dispute.disputeDate)
      setDisputeType(dispute.disputeType)
      setDisputedAmount(String(dispute.disputedAmount))
      setDescription(dispute.description)
      setOwner(dispute.owner)
      setResponsibleDepartment(dispute.responsibleDepartment)
      setPriority(dispute.priority)
      setTargetResolutionDate(dispute.targetResolutionDate)
      setStatus(dispute.status)
      setResolution(dispute.resolution ?? '')
      setDebitNoteRequired(dispute.debitNoteRequired)
      setPaymentHold(dispute.paymentHold)
    } else {
      setInvoiceId('')
      setDisputeDate(today)
      setDisputeType('Price Difference')
      setDisputedAmount('')
      setDescription('')
      setOwner(user.name)
      setResponsibleDepartment('Accounts Payable')
      setPriority('Medium')
      setTargetResolutionDate('')
      setStatus('Open')
      setResolution('')
      setDebitNoteRequired(false)
      setPaymentHold(false)
    }
  }, [open, dispute, today, user.name])

  useEffect(() => {
    if (!open || !effectiveVendorId) {
      setInvoices([])
      return
    }
    void getPayableInvoices({ vendorId: effectiveVendorId })
      .then((rows) =>
        setInvoices(
          rows.map((i) => ({
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            outstandingBalance: i.outstandingBalance,
          })),
        ),
      )
      .catch((e) => {
        if (e instanceof PayablesServiceError) notify.error(e.message)
        setInvoices([])
      })
  }, [open, effectiveVendorId])

  const handleSave = async () => {
    if (!effectiveVendorId) {
      notify.error('Vendor is required.')
      return
    }
    if (!invoiceId) {
      notify.error('Invoice is required.')
      return
    }
    if (!description.trim()) {
      notify.error('Description is required.')
      return
    }
    if (!(Number(disputedAmount) > 0)) {
      notify.error('Disputed amount must be greater than zero.')
      return
    }

    const inv = invoices.find((i) => i.id === invoiceId)
    setBusy(true)
    try {
      const payload: Partial<VendorDispute> = {
        vendorId: effectiveVendorId,
        vendorName: dispute?.vendorName ?? presetVendorName ?? '',
        invoiceId,
        invoiceNumber: inv?.invoiceNumber ?? dispute?.invoiceNumber ?? '',
        disputeDate,
        disputeType,
        disputedAmount: Number(disputedAmount),
        description: description.trim(),
        owner: owner.trim(),
        responsibleDepartment: responsibleDepartment.trim(),
        priority,
        targetResolutionDate: targetResolutionDate || dispute?.targetResolutionDate || today,
        status,
        resolution: resolution.trim() || null,
        debitNoteRequired,
        paymentHold,
      }
      onSaved?.(payload)
      notify.success(isEdit ? 'Dispute updated (demo).' : 'Dispute created (demo).')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <PayableDrawerShell
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit dispute' : 'Raise vendor dispute'}
      subtitle={dispute?.disputeNumber ?? presetVendorName}
      eyebrow="Payables · Disputes"
      widthClassName="max-w-lg"
      footer={
        effectiveVendorId ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px] font-semibold"
              onClick={() => void handleSave()}
              disabled={busy}
            >
              {busy ? 'Saving…' : isEdit ? 'Update dispute' : 'Create dispute'}
            </button>
          </div>
        ) : null
      }
    >
      {!effectiveVendorId ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">Select a vendor to manage disputes.</p>
      ) : (
        <div className="space-y-4">
          {isEdit && dispute ? (
            <div className="flex items-center gap-2">
              <VendorDisputeStatusBadge status={dispute.status} />
              <span className="font-mono text-[12px] text-erp-muted">{dispute.disputeNumber}</span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={cn(labelCls, 'sm:col-span-2')}>
              Invoice
              <select
                className={inputCls}
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                aria-required
                disabled={isEdit}
              >
                <option value="">Select invoice…</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} · Bal ₹{i.outstandingBalance.toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Dispute date
              <input
                type="date"
                className={inputCls}
                value={disputeDate}
                onChange={(e) => setDisputeDate(e.target.value)}
              />
            </label>
            <label className={labelCls}>
              Dispute type
              <select
                className={inputCls}
                value={disputeType}
                onChange={(e) => setDisputeType(e.target.value as VendorDisputeType)}
              >
                {VENDOR_DISPUTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Disputed amount (₹)
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={disputedAmount}
                onChange={(e) => setDisputedAmount(e.target.value)}
                aria-required
              />
            </label>
            <label className={labelCls}>
              Priority
              <select
                className={inputCls}
                value={priority}
                onChange={(e) => setPriority(e.target.value as VendorDispute['priority'])}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Owner
              <input type="text" className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)} />
            </label>
            <label className={labelCls}>
              Department
              <input
                type="text"
                className={inputCls}
                value={responsibleDepartment}
                onChange={(e) => setResponsibleDepartment(e.target.value)}
              />
            </label>
            <label className={labelCls}>
              Target resolution
              <input
                type="date"
                className={inputCls}
                value={targetResolutionDate}
                onChange={(e) => setTargetResolutionDate(e.target.value)}
              />
            </label>
            {isEdit ? (
              <label className={labelCls}>
                Status
                <select
                  className={inputCls}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as VendorDisputeStatus)}
                >
                  {DISPUTE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <label className={labelCls}>
            Description
            <textarea
              className="mt-1 w-full rounded-md border border-erp-border px-2.5 py-2 text-[13px] text-erp-text"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-required
            />
          </label>

          {isEdit ? (
            <label className={labelCls}>
              Resolution notes
              <textarea
                className="mt-1 w-full rounded-md border border-erp-border px-2.5 py-2 text-[13px] text-erp-text"
                rows={2}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Outcome, debit note reference, vendor confirmation…"
              />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-4 text-[12px]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-erp-border"
                checked={debitNoteRequired}
                onChange={(e) => setDebitNoteRequired(e.target.checked)}
              />
              Debit note required
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-erp-border"
                checked={paymentHold}
                onChange={(e) => setPaymentHold(e.target.checked)}
              />
              Payment hold
            </label>
          </div>

          <p className="text-[11px] text-erp-muted">
            Demo mode — disputes update local payables data only. No vendor notifications or GL postings occur.
          </p>
        </div>
      )}
    </PayableDrawerShell>
  )
}
