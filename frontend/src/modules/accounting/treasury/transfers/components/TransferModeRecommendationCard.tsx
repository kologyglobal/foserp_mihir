import { Info, Lightbulb } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { TransferModeRecommendation, TreasuryTransferPostingMode } from '../api/treasury-transfer.types'
import { TRANSFER_POSTING_MODE_LABELS } from '../utils/treasuryTransferUi'

/** Server-computed posting-mode recommendation surfaced after validate/preview. */
export function TransferModeRecommendationCard({
  recommendation,
  selectedMode,
  onApply,
}: {
  recommendation: TransferModeRecommendation | null | undefined
  selectedMode?: TreasuryTransferPostingMode
  onApply?: (mode: TreasuryTransferPostingMode) => void
}) {
  if (!recommendation) return null
  const matches = selectedMode ? selectedMode === recommendation.recommendedPostingMode : true

  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-2 rounded-md border px-3 py-2 text-[12px]',
        matches ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      {matches ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          Recommended posting mode: {TRANSFER_POSTING_MODE_LABELS[recommendation.recommendedPostingMode]}
        </p>
        {recommendation.message ? <p className="mt-0.5 text-[11px] opacity-90">{recommendation.message}</p> : null}
        {recommendation.reasonCodes.length > 0 ? (
          <ul className="mt-1 list-inside list-disc text-[11px] opacity-90">
            {recommendation.reasonCodes.map((code) => (
              <li key={code}>{code.replace(/_/g, ' ').toLowerCase()}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {!matches && onApply ? (
        <button
          type="button"
          className="erp-btn erp-btn-secondary h-7 shrink-0 px-2 text-[11px]"
          onClick={() => onApply(recommendation.recommendedPostingMode)}
        >
          Use recommended
        </button>
      ) : null}
    </div>
  )
}
