import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw, Zap } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { mergeAllowedAction, useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useStandingInstructionDetail } from '../hooks/useStandingInstructionDetail'
import { SIStatusChip } from '../components/SIStatusChip'
import { SIActionBar } from '../components/SIActionBar'
import { SIWorkspaceShell } from '../components/SIWorkspaceShell'
import { SIGenerateDraftsModal } from '../components/SIGenerateDraftsModal'
import { formatSiAmount, formatSiDate, formatSiDateTime } from '../utils/format'
import { ADJUSTMENT_TYPE_LABELS, SI_AMOUNT_MODE_LABELS, SI_FREQUENCY_LABELS } from '../utils/standingInstructionUi'

export function ApiSIDetailPage() {
  const { id } = useParams()
  const perms = useTreasuryAdjustmentPermissions()
  const { instruction, setInstruction, loading, reload } = useStandingInstructionDetail(id, perms.canViewStandingInstructions)
  const [generateOpen, setGenerateOpen] = useState(false)

  if (!perms.canViewStandingInstructions) {
    return (
      <SIWorkspaceShell title="Standing Instruction">
        <p className="text-[13px] text-erp-muted">You do not have permission to view standing instructions.</p>
      </SIWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />

  if (!instruction) {
    return (
      <SIWorkspaceShell title="Standing Instruction">
        <p className="text-[13px] text-erp-muted">Standing instruction not found.</p>
      </SIWorkspaceShell>
    )
  }

  return (
    <SIWorkspaceShell
      title={instruction.name}
      actions={
        <>
          {mergeAllowedAction(perms.canGenerateStandingInstructions, true) ? (
            <ErpButton variant="secondary" icon={Zap} onClick={() => setGenerateOpen(true)}>
              Generate due draft
            </ErpButton>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()}>
            Refresh
          </ErpButton>
        </>
      }
    >
      <PageBackLink to="/accounting/bank-cash/standing-instructions" label="Back to standing instructions" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SIStatusChip status={instruction.status} />
        <span className="text-[12px] text-erp-muted">Updated {formatSiDateTime(instruction.updatedAt)}</span>
      </div>

      <div className="mb-4">
        <SIActionBar instruction={instruction} onUpdated={setInstruction} />
      </div>

      <div className="rounded-lg border border-erp-border bg-white p-4">
        <div className="grid gap-3 text-[12px] sm:grid-cols-2">
          <div>
            <span className="text-erp-muted">Transaction type</span>
            <p className="font-medium text-erp-text">{ADJUSTMENT_TYPE_LABELS[instruction.adjustmentType] ?? instruction.adjustmentType}</p>
          </div>
          <div>
            <span className="text-erp-muted">Frequency</span>
            <p className="font-medium text-erp-text">{SI_FREQUENCY_LABELS[instruction.frequency] ?? instruction.frequency}</p>
          </div>
          <div>
            <span className="text-erp-muted">Amount mode</span>
            <p className="font-medium text-erp-text">{SI_AMOUNT_MODE_LABELS[instruction.amountMode]}</p>
          </div>
          {instruction.amountMode === 'FIXED' ? (
            <div>
              <span className="text-erp-muted">Fixed amount</span>
              <p className="font-semibold tabular-nums text-erp-text">{formatSiAmount(instruction.fixedAmount)}</p>
            </div>
          ) : null}
          <div>
            <span className="text-erp-muted">Start date</span>
            <p className="font-medium text-erp-text">{formatSiDate(instruction.startDate)}</p>
          </div>
          <div>
            <span className="text-erp-muted">End date</span>
            <p className="font-medium text-erp-text">{instruction.endDate ? formatSiDate(instruction.endDate) : 'No end date'}</p>
          </div>
          <div>
            <span className="text-erp-muted">Next due date</span>
            <p className="font-medium text-erp-text">{formatSiDate(instruction.nextDueDate)}</p>
          </div>
          <div>
            <span className="text-erp-muted">Last generated</span>
            <p className="font-medium text-erp-text">
              {instruction.lastGeneratedAt ? formatSiDateTime(instruction.lastGeneratedAt) : 'Never'}
            </p>
          </div>
          {instruction.description ? (
            <div className="sm:col-span-2">
              <span className="text-erp-muted">Description</span>
              <p className="font-medium text-erp-text">{instruction.description}</p>
            </div>
          ) : null}
          {instruction.narrationTemplate ? (
            <div className="sm:col-span-2">
              <span className="text-erp-muted">Narration template</span>
              <p className="font-medium text-erp-text">{instruction.narrationTemplate}</p>
            </div>
          ) : null}
        </div>
      </div>

      <SIGenerateDraftsModal
        open={generateOpen}
        legalEntityId={instruction.legalEntityId}
        standingInstructionId={instruction.id}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => void reload()}
      />
    </SIWorkspaceShell>
  )
}
