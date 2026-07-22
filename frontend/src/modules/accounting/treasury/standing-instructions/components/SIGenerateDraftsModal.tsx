import { useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import { useGenerateDueDrafts } from '../hooks/useStandingInstructionMutations'
import type { GenerationOutcomeDto } from '../api/standing-instruction.types'
import { todayIsoDate } from '../utils/format'

export function SIGenerateDraftsModal({
  open,
  legalEntityId,
  standingInstructionId,
  onClose,
  onGenerated,
}: {
  open: boolean
  legalEntityId: string
  /** When set, generates due drafts for a single standing instruction only. */
  standingInstructionId?: string
  onClose: () => void
  onGenerated: (outcomes: GenerationOutcomeDto[]) => void
}) {
  const [asOfDate, setAsOfDate] = useState(todayIsoDate())
  const [outcomes, setOutcomes] = useState<GenerationOutcomeDto[] | null>(null)
  const { busy, generate } = useGenerateDueDrafts()

  const run = async () => {
    try {
      const result = await generate({ legalEntityId, asOfDate, standingInstructionId })
      setOutcomes(result)
      onGenerated(result)
    } catch {
      // toast already surfaced
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setOutcomes(null)
        onClose()
      }}
      title="Generate due drafts"
      description="Creates a draft bank transaction (treasury adjustment) for every standing instruction due on or before the selected date."
      size="md"
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton
            variant="secondary"
            onClick={() => {
              setOutcomes(null)
              onClose()
            }}
            disabled={busy}
          >
            Close
          </ErpButton>
          <ErpButton onClick={() => void run()} loading={busy}>
            Generate
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">As-of date</label>
          <input
            type="date"
            className="erp-input text-[13px]"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            disabled={busy}
          />
        </div>
        {outcomes ? (
          <div className="max-h-64 overflow-y-auto rounded-md border border-erp-border">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                  <th className="px-2 py-1">Due date</th>
                  <th className="px-2 py-1">Result</th>
                  <th className="px-2 py-1">Detail</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((o, i) => (
                  <tr key={`${o.standingInstructionId}-${i}`} className="border-t border-erp-border">
                    <td className="px-2 py-1.5">{o.dueDate}</td>
                    <td className="px-2 py-1.5">{o.status.replace(/_/g, ' ')}</td>
                    <td className="px-2 py-1.5 text-erp-muted">{o.failureReason ?? (o.treasuryAdjustmentId ? 'Draft created' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
