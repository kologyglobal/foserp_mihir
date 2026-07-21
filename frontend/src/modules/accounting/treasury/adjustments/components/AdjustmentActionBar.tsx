import { useState } from 'react'
import { Ban, CheckCircle2, Send, ShieldCheck, ThumbsDown, ThumbsUp, Undo2, UploadCloud } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { mergeAllowedAction, useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useAdjustmentMutations } from '../hooks/useAdjustmentMutations'
import type { TreasuryAdjustmentDto } from '../api/treasury-adjustment.types'
import { AdjustmentLifecycleModal, type AdjustmentLifecycleModalConfig } from './AdjustmentLifecycleModal'

export function AdjustmentActionBar({
  adjustment,
  onUpdated,
}: {
  adjustment: TreasuryAdjustmentDto
  onUpdated: (updated: TreasuryAdjustmentDto) => void
}) {
  const perms = useTreasuryAdjustmentPermissions()
  const { busy, validate, submit, approve, reject, revise, markReady, cancel } = useAdjustmentMutations(adjustment, onUpdated)
  const [lifecycleModal, setLifecycleModal] = useState<AdjustmentLifecycleModalConfig | null>(null)

  const actions = adjustment.allowedActions

  const doReject = async () => {
    const reason = await appPromptNote({
      title: 'Reject transaction?',
      description: 'Reason for rejection',
      tone: 'danger',
      confirmLabel: 'Reject',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    void reject(reason)
  }

  const doCancel = async () => {
    const reason = await appPromptNote({
      title: 'Cancel transaction?',
      description: 'Reason for cancellation',
      tone: 'danger',
      confirmLabel: 'Cancel transaction',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    void cancel(reason)
  }

  const doApprove = async () => {
    const confirmed = await appConfirm({ title: 'Approve transaction?', confirmLabel: 'Approve', tone: 'success' })
    if (confirmed) void approve()
  }

  const doSubmit = async () => {
    const confirmed = await appConfirm({ title: 'Submit for approval?', confirmLabel: 'Submit' })
    if (confirmed) void submit()
  }

  const doMarkReady = async () => {
    const confirmed = await appConfirm({ title: 'Mark ready to post?', confirmLabel: 'Mark ready' })
    if (confirmed) void markReady()
  }

  const doRevise = async () => {
    const confirmed = await appConfirm({
      title: 'Return to draft for revision?',
      description: 'Moves this rejected/ready transaction back to Draft so it can be edited and resubmitted.',
      confirmLabel: 'Revise',
    })
    if (confirmed) void revise()
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {mergeAllowedAction(perms.canView, actions.validate) ? (
          <ErpButton variant="secondary" icon={ShieldCheck} disabled={busy} onClick={() => void validate()}>
            Validate
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canSubmit, actions.submit) ? (
          <ErpButton icon={Send} disabled={busy} onClick={() => void doSubmit()}>
            Submit for approval
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canApprove, actions.approve) ? (
          <ErpButton variant="success" icon={ThumbsUp} disabled={busy} onClick={() => void doApprove()}>
            Approve
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canApprove, actions.reject) ? (
          <ErpButton variant="danger" icon={ThumbsDown} disabled={busy} onClick={() => void doReject()}>
            Reject
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canEdit, actions.revise) ? (
          <ErpButton variant="secondary" icon={Undo2} disabled={busy} onClick={() => void doRevise()}>
            Revise
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canEdit, actions.markReady) ? (
          <ErpButton variant="secondary" icon={CheckCircle2} disabled={busy} onClick={() => void doMarkReady()}>
            Mark ready
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canPost, actions.post) ? (
          <ErpButton
            icon={UploadCloud}
            disabled={busy}
            onClick={() =>
              setLifecycleModal({
                action: 'post',
                title: 'Post transaction to GL',
                description: 'Posts the accounting entry for this bank transaction. This cannot be undone directly (use Reverse).',
                confirmLabel: 'Post',
                dateField: { label: 'Posting date', required: false },
                showAccountingPreview: true,
              })
            }
          >
            Post
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canReverse, actions.reverse) ? (
          <ErpButton
            variant="danger"
            icon={Undo2}
            disabled={busy}
            onClick={() =>
              setLifecycleModal({
                action: 'reverse',
                title: 'Reverse transaction',
                description: 'Posts an offsetting reversal of the GL entry for this bank transaction. This cannot be undone.',
                confirmLabel: 'Confirm reversal',
                tone: 'danger',
                dateField: { label: 'Reversal date', required: true },
                reasonField: { label: 'Reason', required: true, placeholder: 'Why is this transaction being reversed?' },
              })
            }
          >
            Reverse
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canCancel, actions.cancel) ? (
          <ErpButton variant="secondary" icon={Ban} disabled={busy} onClick={() => void doCancel()}>
            Cancel
          </ErpButton>
        ) : null}
      </div>

      <AdjustmentLifecycleModal
        open={Boolean(lifecycleModal)}
        adjustment={adjustment}
        config={lifecycleModal ?? { action: 'post', title: '', description: '', confirmLabel: '' }}
        onClose={() => setLifecycleModal(null)}
        onSuccess={onUpdated}
      />
    </>
  )
}
