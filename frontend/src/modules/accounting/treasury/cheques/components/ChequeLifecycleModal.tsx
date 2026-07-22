import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import { notify } from '@/store/toastStore'
import { useChequeMutations } from '../hooks/useChequeMutations'
import type { TreasuryChequeDto } from '../api/treasury-cheque.types'
import { formatChequeAmount, todayIsoDate } from '../utils/format'
import { ChequeAccountingPreviewPanel } from './ChequeAccountingPreviewPanel'

export type ChequeLifecycleAction = 'issue' | 'deposit' | 'clear' | 'bounce' | 'reverse'

export interface ChequeLifecycleModalConfig {
  action: ChequeLifecycleAction
  title: string
  description: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  /** When set, shows a date input for the action's date field. */
  dateField?: { label: string; required: boolean }
  /** When set, shows a text input for the action's reason field. */
  reasonField?: { label: string; required: boolean; placeholder?: string }
  /** Shows the cheque's accounting preview for context (issue/deposit/reverse). */
  showAccountingPreview?: boolean
}

export function ChequeLifecycleModal({
  open,
  cheque,
  config,
  onClose,
  onSuccess,
}: {
  open: boolean
  cheque: TreasuryChequeDto | null
  config: ChequeLifecycleModalConfig
  onClose: () => void
  onSuccess: (updated: TreasuryChequeDto) => void
}) {
  const [dateValue, setDateValue] = useState(todayIsoDate())
  const [reasonValue, setReasonValue] = useState('')
  const { busy, issue, deposit, clear, bounce, reverse } = useChequeMutations(cheque, (updated) => {
    onSuccess(updated)
    onClose()
  })

  useEffect(() => {
    if (!open) return
    setDateValue(todayIsoDate())
    setReasonValue('')
  }, [open, cheque?.id])

  if (!cheque) return null

  const dateMissing = Boolean(config.dateField?.required) && !dateValue
  const reasonMissing = Boolean(config.reasonField?.required) && !reasonValue.trim()

  const confirm = async () => {
    if (dateMissing) {
      notify.error(`${config.dateField?.label ?? 'Date'} is required`)
      return
    }
    if (reasonMissing) {
      notify.error(`${config.reasonField?.label ?? 'Reason'} is required`)
      return
    }
    try {
      switch (config.action) {
        case 'issue':
          await issue(config.dateField ? dateValue : undefined)
          break
        case 'deposit':
          await deposit(dateValue)
          break
        case 'clear':
          await clear(dateValue)
          break
        case 'bounce':
          await bounce(dateValue, reasonValue.trim())
          break
        case 'reverse':
          await reverse(dateValue, reasonValue.trim())
          break
      }
    } catch {
      // toast already surfaced by useChequeMutations
    }
  }

  const disableConfirm = busy || dateMissing || reasonMissing

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={config.title}
      description={config.description}
      size="md"
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </ErpButton>
          <ErpButton
            variant={config.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => void confirm()}
            loading={busy}
            disabled={disableConfirm}
          >
            {config.confirmLabel}
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-erp-muted">Cheque no:</span> <span className="font-mono">{cheque.chequeNumber}</span>
          </p>
          <p>
            <span className="text-erp-muted">Amount:</span> <span className="font-semibold tabular-nums">{formatChequeAmount(cheque.amount)}</span>
          </p>
          <p>
            <span className="text-erp-muted">Payee/Drawer:</span> {cheque.payeeOrDrawerName}
          </p>
        </div>

        {config.dateField || config.reasonField ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {config.dateField ? (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  {config.dateField.label}
                  {config.dateField.required ? ' (required)' : ' (optional)'}
                </label>
                <input
                  type="date"
                  className="erp-input text-[13px]"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  disabled={busy}
                />
              </div>
            ) : null}
            {config.reasonField ? (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  {config.reasonField.label}
                  {config.reasonField.required ? ' (required)' : ' (optional)'}
                </label>
                <input
                  className="erp-input text-[13px]"
                  value={reasonValue}
                  onChange={(e) => setReasonValue(e.target.value)}
                  disabled={busy}
                  placeholder={config.reasonField.placeholder}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {config.showAccountingPreview ? <ChequeAccountingPreviewPanel preview={cheque.accountingPreview} /> : null}
      </div>
    </Modal>
  )
}
