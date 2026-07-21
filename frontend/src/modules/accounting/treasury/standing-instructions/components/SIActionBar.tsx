import { Ban, Pause, Play } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { mergeAllowedAction, useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useStandingInstructionMutations } from '../hooks/useStandingInstructionMutations'
import type { StandingInstructionDto } from '../api/standing-instruction.types'

export function SIActionBar({
  instruction,
  onUpdated,
}: {
  instruction: StandingInstructionDto
  onUpdated: (updated: StandingInstructionDto) => void
}) {
  const perms = useTreasuryAdjustmentPermissions()
  const { busy, pause, resume, cancel } = useStandingInstructionMutations(instruction, onUpdated)

  const doPause = async () => {
    const confirmed = await appConfirm({ title: 'Pause standing instruction?', confirmLabel: 'Pause' })
    if (confirmed) void pause()
  }

  const doResume = async () => {
    const confirmed = await appConfirm({ title: 'Resume standing instruction?', confirmLabel: 'Resume', tone: 'success' })
    if (confirmed) void resume()
  }

  const doCancel = async () => {
    const reason = await appPromptNote({
      title: 'Cancel standing instruction?',
      description: 'Reason for cancellation',
      tone: 'danger',
      confirmLabel: 'Cancel',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    void cancel(reason)
  }

  if (!perms.canManageStandingInstructions) return null

  return (
    <div className="flex flex-wrap gap-2">
      {mergeAllowedAction(perms.canManageStandingInstructions, instruction.status === 'ACTIVE') ? (
        <ErpButton variant="secondary" icon={Pause} disabled={busy} onClick={() => void doPause()}>
          Pause
        </ErpButton>
      ) : null}
      {mergeAllowedAction(perms.canManageStandingInstructions, instruction.status === 'PAUSED') ? (
        <ErpButton variant="success" icon={Play} disabled={busy} onClick={() => void doResume()}>
          Resume
        </ErpButton>
      ) : null}
      {mergeAllowedAction(
        perms.canManageStandingInstructions,
        instruction.status === 'ACTIVE' || instruction.status === 'PAUSED',
      ) ? (
        <ErpButton variant="danger" icon={Ban} disabled={busy} onClick={() => void doCancel()}>
          Cancel
        </ErpButton>
      ) : null}
    </div>
  )
}
