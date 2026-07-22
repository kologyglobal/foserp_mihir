import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import { notify } from '@/store/toastStore'
import { useAdjustmentMutations } from '../hooks/useAdjustmentMutations'
import type { TreasuryAdjustmentDto } from '../api/treasury-adjustment.types'
import { formatAdjustmentAmount, todayIsoDate } from '../utils/format'
import { AdjustmentAccountingPreviewPanel } from './AdjustmentAccountingPreviewPanel'

export type AdjustmentLifecycleAction = 'post' | 'reverse'

export interface AdjustmentLifecycleModalConfig {
  action: AdjustmentLifecycleAction
  title: string
  description: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  dateField?: { label: string; required: boolean }
  reasonField?: { label: string; required: boolean; placeholder?: string }
  showAccountingPreview?: boolean
}

export function AdjustmentLifecycleModal({
  open,
  adjustment,
  config,
  onClose,
  onSuccess,
}: {
  open: boolean
  adjustment: TreasuryAdjustmentDto | null
  config: AdjustmentLifecycleModalConfig
  onClose: () => void
  onSuccess: (updated: TreasuryAdjustmentDto) => void
}) {
  const [dateValue, setDateValue] = useState(todayIsoDate())
  const [reasonValue, setReasonValue] = useState('')
  const { busy, post, reverse } = useAdjustmentMutations(adjustment, (updated) => {
    onSuccess(updated)
    onClose()
  })

  useEffect(() => {
    if (!open) return
    setDateValue(todayIsoDate())
    setReasonValue('')
  }, [open, adjustment?.id])

  if (!adjustment) return null

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
        case 'post':
          await post(config.dateField ? dateValue : undefined)
          break
        case 'reverse':
          await reverse(dateValue, reasonValue.trim())
          break
      }
    } catch {
      // toast already surfaced by useAdjustmentMutations
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
            <span className="text-erp-muted">Reference:</span>{' '}
            <span className="font-mono">{adjustment.adjustmentNumber ?? adjustment.draftReference}</span>
          </p>
          <p>
            <span className="text-erp-muted">Amount:</span>{' '}
            <span className="font-semibold tabular-nums">{formatAdjustmentAmount(adjustment.bankAmount)}</span>
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

        {config.showAccountingPreview ? (
          <AdjustmentAccountingPreviewPanel preview={adjustment.accountingPreview} lines={adjustment.lines} />
        ) : null}
      </div>
    </Modal>
  )
}
