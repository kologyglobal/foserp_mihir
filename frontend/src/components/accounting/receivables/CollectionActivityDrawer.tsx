import { useEffect, useState } from 'react'
import { ReceivableDrawerShell } from './ReceivableDrawerShell'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { getSessionUser } from '@/utils/permissions'
import {
  COLLECTION_ACTIVITY_TYPES,
  COLLECTION_OUTCOMES,
  RECEIPT_PAYMENT_MODES,
  type CollectionActivityType,
  type CollectionOutcome,
  type CollectionStatus,
  type ReceiptPaymentMode,
} from '@/types/receivables'
import {
  createCollectionActivity,
  createPaymentPromise,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import { cn } from '@/utils/cn'

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

const CONTACT_MODES = ['Mobile', 'Landline', 'Email', 'WhatsApp', 'In Person', 'Other'] as const

export type CollectionActivityCustomerSummary = {
  customerId: string
  customerName: string
  outstanding: number
  overdue: number
  creditLimit: number
  oldestDueDate: string | null
  collectionOwner: string
}

function outcomeToStatus(outcome: CollectionOutcome): CollectionStatus {
  if (outcome === 'Promise to Pay') return 'Promise Received'
  if (outcome === 'Partial Payment') return 'Partial Payment Expected'
  if (outcome === 'Dispute Raised') return 'Disputed'
  if (outcome === 'Escalation Required') return 'Escalated'
  if (outcome === 'Closed') return 'Closed'
  if (outcome === 'Follow-up Required') return 'Follow-up Required'
  return 'Contacted'
}

export function CollectionActivityDrawer({
  open,
  onClose,
  customerSummary,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customerSummary?: CollectionActivityCustomerSummary
  onSaved?: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [activityType, setActivityType] = useState<CollectionActivityType>('Call')
  const [activityDate, setActivityDate] = useState(today)
  const [contactPerson, setContactPerson] = useState('')
  const [contactMode, setContactMode] = useState<string>('Mobile')
  const [outcome, setOutcome] = useState<CollectionOutcome>('Follow-up Required')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [notes, setNotes] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [promisePaymentMode, setPromisePaymentMode] = useState<ReceiptPaymentMode>('NEFT')
  const [escalationRequired, setEscalationRequired] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setActivityType('Call')
    setActivityDate(today)
    setContactPerson('')
    setContactMode('Mobile')
    setOutcome('Follow-up Required')
    setNextFollowUpDate('')
    setNotes('')
    setPromiseDate('')
    setPromiseAmount('')
    setPromisePaymentMode('NEFT')
    setEscalationRequired(false)
  }, [open, today])

  const showPromiseFields =
    outcome === 'Promise to Pay' || activityType === 'Payment Promise'

  const handleSave = async () => {
    if (!customerSummary) {
      notify.error('Customer context is required.')
      return
    }
    if (!contactPerson.trim()) {
      notify.error('Contact person is required.')
      return
    }
    if (showPromiseFields && (!promiseDate || !(Number(promiseAmount) > 0))) {
      notify.error('Promise date and amount are required for payment promises.')
      return
    }

    setBusy(true)
    try {
      const user = getSessionUser()
      const owner = customerSummary.collectionOwner || user.name
      const status = outcomeToStatus(outcome)

      await createCollectionActivity({
        customerId: customerSummary.customerId,
        customerName: customerSummary.customerName,
        invoiceId: null,
        invoiceNumber: null,
        activityType,
        activityDate,
        contactPerson: contactPerson.trim(),
        contactMode,
        outcome,
        nextFollowUpDate: nextFollowUpDate || null,
        notes: notes.trim(),
        promiseDate: showPromiseFields ? promiseDate : null,
        promiseAmount: showPromiseFields ? Number(promiseAmount) : null,
        escalationRequired,
        collectionOwner: owner,
        status,
        completed: outcome === 'Closed' || outcome === 'Payment Already Made',
      })

      if (activityType === 'Email' || activityType === 'WhatsApp') {
        notify.info('Communication preview created. Messaging integration is not connected.')
      }

      if (showPromiseFields) {
        await createPaymentPromise({
          customerId: customerSummary.customerId,
          customerName: customerSummary.customerName,
          invoiceId: null,
          invoiceNumber: null,
          promiseDate,
          promiseAmount: Number(promiseAmount),
          paymentMode: promisePaymentMode,
          customerContact: contactPerson.trim(),
          notes: notes.trim(),
          followUpDate: nextFollowUpDate || null,
          status: 'Active',
          collectionOwner: owner,
        })
      }

      notify.success('Collection activity saved (demo).')
      onSaved?.()
      onClose()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Failed to save activity.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ReceivableDrawerShell
      open={open}
      onClose={onClose}
      title="Log collection activity"
      subtitle={customerSummary?.customerName}
      eyebrow="Receivables · Collections"
      widthClassName="max-w-lg"
      footer={
        customerSummary ? (
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
              {busy ? 'Saving…' : 'Save activity'}
            </button>
          </div>
        ) : null
      }
    >
      {!customerSummary ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">Select a customer to log collection activity.</p>
      ) : (
        <div className="space-y-4">
          <div
            className="rounded-lg border border-erp-border bg-erp-surface-alt/50 p-3"
            aria-label="Customer summary"
          >
            <p className="text-[13px] font-semibold text-erp-text">{customerSummary.customerName}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <div>
                <dt className="text-erp-muted">Outstanding</dt>
                <dd className="font-semibold tabular-nums text-erp-text">
                  {formatCurrency(customerSummary.outstanding)}
                </dd>
              </div>
              <div>
                <dt className="text-erp-muted">Overdue</dt>
                <dd className="font-semibold tabular-nums text-rose-700">
                  {formatCurrency(customerSummary.overdue)}
                </dd>
              </div>
              <div>
                <dt className="text-erp-muted">Credit limit</dt>
                <dd className="tabular-nums text-erp-text">{formatCurrency(customerSummary.creditLimit)}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Oldest due</dt>
                <dd className="text-erp-text">
                  {customerSummary.oldestDueDate ? formatDate(customerSummary.oldestDueDate) : '—'}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-erp-muted">Owner: {customerSummary.collectionOwner}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Activity type
              <select
                className={inputCls}
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as CollectionActivityType)}
                aria-required
              >
                {COLLECTION_ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Activity date
              <input
                type="date"
                className={inputCls}
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                aria-required
              />
            </label>
            <label className={labelCls}>
              Contact person
              <input
                type="text"
                className={inputCls}
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Name at customer"
                aria-required
              />
            </label>
            <label className={labelCls}>
              Contact mode
              <select
                className={inputCls}
                value={contactMode}
                onChange={(e) => setContactMode(e.target.value)}
              >
                {CONTACT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={cn(labelCls, 'sm:col-span-2')}>
              Outcome
              <select
                className={inputCls}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CollectionOutcome)}
              >
                {COLLECTION_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Next follow-up
              <input
                type="date"
                className={inputCls}
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
              />
            </label>
            <label htmlFor="escalation-required" className="flex items-end gap-2 pb-1 text-[12px] font-medium text-erp-text">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-erp-border"
                checked={escalationRequired}
                onChange={(e) => setEscalationRequired(e.target.checked)}
                id="escalation-required"
              />
              Escalation required
            </label>
          </div>

          {showPromiseFields ? (
            <fieldset className="rounded-lg border border-erp-border p-3">
              <legend className="px-1 text-[12px] font-semibold text-erp-text">Payment promise</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Promise date
                  <input
                    type="date"
                    className={inputCls}
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    aria-required
                  />
                </label>
                <label className={labelCls}>
                  Promise amount (₹)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputCls}
                    value={promiseAmount}
                    onChange={(e) => setPromiseAmount(e.target.value)}
                    aria-required
                  />
                </label>
                <label className={cn(labelCls, 'sm:col-span-2')}>
                  Expected payment mode
                  <select
                    className={inputCls}
                    value={promisePaymentMode}
                    onChange={(e) => setPromisePaymentMode(e.target.value as ReceiptPaymentMode)}
                  >
                    {RECEIPT_PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
          ) : null}

          <label className={labelCls}>
            Notes
            <textarea
              className="mt-1 w-full rounded-md border border-erp-border px-2.5 py-2 text-[13px] text-erp-text"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conversation summary, commitments, objections…"
            />
          </label>

          <p className="text-[11px] text-erp-muted">
            Demo mode — activities are stored locally. No emails, WhatsApp messages, or ledger updates are sent.
          </p>
        </div>
      )}
    </ReceivableDrawerShell>
  )
}
