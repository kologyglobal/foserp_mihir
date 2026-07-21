import { useState } from 'react'
import {
  Ban,
  Banknote,
  CheckCircle2,
  Octagon,
  PiggyBank,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  XCircle,
} from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { mergeAllowedAction, useTreasuryChequePermissions } from '@/utils/permissions/treasuryCheque'
import { useChequeMutations } from '../hooks/useChequeMutations'
import type { TreasuryChequeDto } from '../api/treasury-cheque.types'
import { ChequeLifecycleModal, type ChequeLifecycleModalConfig } from './ChequeLifecycleModal'

export function ChequeActionBar({
  cheque,
  onUpdated,
}: {
  cheque: TreasuryChequeDto
  onUpdated: (updated: TreasuryChequeDto) => void
}) {
  const perms = useTreasuryChequePermissions()
  const { busy, validate, submit, approve, reject, revise, markReady, cancel, stop } = useChequeMutations(cheque, onUpdated)
  const [lifecycleModal, setLifecycleModal] = useState<ChequeLifecycleModalConfig | null>(null)

  const actions = cheque.allowedActions

  const doReject = async () => {
    const reason = await appPromptNote({
      title: 'Reject cheque?',
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
      title: 'Cancel cheque?',
      description: 'Reason for cancellation',
      tone: 'danger',
      confirmLabel: 'Cancel cheque',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    void cancel(reason)
  }

  const doStop = async () => {
    const reason = await appPromptNote({
      title: 'Record stop payment?',
      description: 'Instructs the bank to stop payment on this cheque. Reverses the GL entry if already issued.',
      tone: 'danger',
      confirmLabel: 'Stop payment',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    void stop(reason)
  }

  const doApprove = async () => {
    const confirmed = await appConfirm({ title: 'Approve cheque?', confirmLabel: 'Approve', tone: 'success' })
    if (confirmed) void approve()
  }

  const doSubmit = async () => {
    const confirmed = await appConfirm({ title: 'Submit for approval?', confirmLabel: 'Submit' })
    if (confirmed) void submit()
  }

  const doMarkReady = async () => {
    const confirmed = await appConfirm({ title: 'Mark cheque ready?', confirmLabel: 'Mark ready' })
    if (confirmed) void markReady()
  }

  const doRevise = async () => {
    const confirmed = await appConfirm({
      title: 'Return to draft for revision?',
      description: 'Moves this rejected/ready cheque back to Draft so it can be edited and resubmitted.',
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
        {mergeAllowedAction(perms.canIssue, actions.issue) ? (
          <ErpButton
            icon={Banknote}
            disabled={busy}
            onClick={() =>
              setLifecycleModal({
                action: 'issue',
                title: 'Issue cheque',
                description: 'Marks this cheque as issued to the payee and posts the accounting entry (unless track-only).',
                confirmLabel: 'Issue cheque',
                dateField: { label: 'Issue date', required: false },
                showAccountingPreview: true,
              })
            }
          >
            Issue
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canDeposit, actions.deposit) ? (
          <ErpButton
            icon={PiggyBank}
            disabled={busy}
            onClick={() =>
              setLifecycleModal({
                action: 'deposit',
                title: 'Deposit cheque',
                description: 'Marks this cheque as deposited and posts the accounting entry (unless track-only).',
                confirmLabel: 'Deposit cheque',
                dateField: { label: 'Deposit date', required: true },
                showAccountingPreview: true,
              })
            }
          >
            Deposit
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canClear, actions.clear) ? (
          <ErpButton
            variant="success"
            icon={CheckCircle2}
            disabled={busy}
            onClick={() =>
              setLifecycleModal({
                action: 'clear',
                title: 'Mark cheque cleared',
                description: 'Confirms clearance at the bank. No new GL entry is posted — the entry was booked at issue/deposit time.',
                confirmLabel: 'Mark cleared',
                dateField: { label: 'Clearance date', required: true },
              })
            }
          >
            Mark cleared
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canBounce, actions.bounce) ? (
          <ErpButton
            variant="danger"
            icon={XCircle}
            disabled={busy}
            onClick={() =>
              setLifecycleModal({
                action: 'bounce',
                title: 'Mark cheque bounced',
                description: 'Reverses the posted GL entry (if any) and records the bounce reason.',
                confirmLabel: 'Mark bounced',
                tone: 'danger',
                dateField: { label: 'Bounce date', required: true },
                reasonField: { label: 'Bounce reason', required: true, placeholder: 'e.g. Insufficient funds' },
              })
            }
          >
            Mark bounced
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canStop, actions.stop) ? (
          <ErpButton variant="danger" icon={Octagon} disabled={busy} onClick={() => void doStop()}>
            Stop payment
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
                title: 'Reverse cheque',
                description: 'Posts an offsetting reversal of the GL entry for this cheque. This cannot be undone.',
                confirmLabel: 'Confirm reversal',
                tone: 'danger',
                dateField: { label: 'Reversal date', required: true },
                reasonField: { label: 'Reason', required: true, placeholder: 'Why is this cheque being reversed?' },
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

      <ChequeLifecycleModal
        open={Boolean(lifecycleModal)}
        cheque={cheque}
        config={lifecycleModal ?? { action: 'issue', title: '', description: '', confirmLabel: '' }}
        onClose={() => setLifecycleModal(null)}
        onSuccess={onUpdated}
      />
    </>
  )
}
