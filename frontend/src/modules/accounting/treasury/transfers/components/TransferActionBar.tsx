import { useState } from 'react'
import { Ban, CheckCircle2, Edit, PackageCheck, Send, ShieldCheck, ThumbsDown, ThumbsUp, Undo2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { mergeAllowedAction, useTreasuryTransferPermissions } from '@/utils/permissions/treasuryTransfer'
import { useTransferMutations } from '../hooks/useTransferMutations'
import type { TreasuryTransferDto } from '../api/treasury-transfer.types'
import { DispatchTransferModal } from './DispatchTransferModal'
import { ReceiveTransferModal } from './ReceiveTransferModal'
import { ReverseTransferModal } from './ReverseTransferModal'

export function TransferActionBar({
  transfer,
  onUpdated,
}: {
  transfer: TreasuryTransferDto
  onUpdated: (updated: TreasuryTransferDto) => void
}) {
  const navigate = useNavigate()
  const perms = useTreasuryTransferPermissions()
  const { busy, validate, submit, approve, reject, revise, markReady, cancel, post } = useTransferMutations(transfer, onUpdated)
  const [showDispatch, setShowDispatch] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [showReverse, setShowReverse] = useState(false)

  const actions = transfer.allowedActions

  const doReject = async () => {
    const reason = await appPromptNote({
      title: 'Reject transfer?',
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
      title: 'Cancel transfer?',
      description: 'Reason for cancellation',
      tone: 'danger',
      confirmLabel: 'Cancel transfer',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    void cancel(reason)
  }

  const doPost = async () => {
    const confirmed = await appConfirm({
      title: 'Post transfer?',
      description: 'Posts both legs directly to the general ledger. This cannot be undone.',
      confirmLabel: 'Post',
      tone: 'warning',
    })
    if (confirmed) void post()
  }

  const doApprove = async () => {
    const confirmed = await appConfirm({ title: 'Approve transfer?', confirmLabel: 'Approve', tone: 'success' })
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
      description: 'Moves this rejected transfer back to Draft so it can be edited and resubmitted.',
      confirmLabel: 'Revise',
    })
    if (confirmed) void revise()
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {mergeAllowedAction(perms.canEdit, actions.canEdit) ? (
          <ErpButton
            variant="secondary"
            icon={Edit}
            disabled={busy}
            onClick={() => navigate(`/accounting/bank-cash/transfers/${transfer.id}/edit`)}
          >
            Edit
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canEdit, actions.canValidate) ? (
          <ErpButton variant="secondary" icon={ShieldCheck} disabled={busy} onClick={() => void validate()}>
            Validate
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canSubmit, actions.canSubmit) ? (
          <ErpButton icon={Send} disabled={busy} onClick={() => void doSubmit()}>
            Submit for approval
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canApprove, actions.canApprove) ? (
          <ErpButton variant="success" icon={ThumbsUp} disabled={busy} onClick={() => void doApprove()}>
            Approve
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canApprove, actions.canReject) ? (
          <ErpButton variant="danger" icon={ThumbsDown} disabled={busy} onClick={() => void doReject()}>
            Reject
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canEdit, actions.canRevise) ? (
          <ErpButton variant="secondary" icon={Undo2} disabled={busy} onClick={() => void doRevise()}>
            Revise
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canPost, actions.canMarkReady) ? (
          <ErpButton variant="secondary" icon={CheckCircle2} disabled={busy} onClick={() => void doMarkReady()}>
            Mark ready to post
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canPost, actions.canPost) ? (
          <ErpButton icon={CheckCircle2} disabled={busy} onClick={() => void doPost()}>
            Post
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canDispatch, actions.canDispatch) ? (
          <ErpButton icon={Send} disabled={busy} onClick={() => setShowDispatch(true)}>
            Dispatch
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canReceive, actions.canReceive) ? (
          <ErpButton icon={PackageCheck} disabled={busy} onClick={() => setShowReceive(true)}>
            Receive
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canReverse, actions.canReverse) ? (
          <ErpButton variant="danger" icon={Undo2} disabled={busy} onClick={() => setShowReverse(true)}>
            Reverse
          </ErpButton>
        ) : null}
        {mergeAllowedAction(perms.canCancel, actions.canCancel) ? (
          <ErpButton variant="secondary" icon={Ban} disabled={busy} onClick={() => void doCancel()}>
            Cancel
          </ErpButton>
        ) : null}
      </div>

      <DispatchTransferModal
        open={showDispatch}
        transfer={transfer}
        onClose={() => setShowDispatch(false)}
        onSuccess={onUpdated}
      />
      <ReceiveTransferModal
        open={showReceive}
        transfer={transfer}
        onClose={() => setShowReceive(false)}
        onSuccess={onUpdated}
      />
      <ReverseTransferModal
        open={showReverse}
        transfer={transfer}
        onClose={() => setShowReverse(false)}
        onSuccess={onUpdated}
      />
    </>
  )
}
