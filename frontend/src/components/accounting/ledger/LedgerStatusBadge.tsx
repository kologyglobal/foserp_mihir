import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  Eye,
  RotateCcw,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { LedgerEntryStatus } from '@/types/ledgerEntries'

type BadgeVariant = LedgerEntryStatus | 'Preview Only'

const BADGE_CONFIG: Record<
  BadgeVariant,
  { icon: typeof CheckCircle2; className: string }
> = {
  Posted: {
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  Reversed: {
    icon: Undo2,
    className: 'bg-rose-50 text-rose-800 ring-rose-200',
  },
  'Reversal Entry': {
    icon: RotateCcw,
    className: 'bg-orange-50 text-orange-800 ring-orange-200',
  },
  'Opening Balance': {
    icon: BookOpen,
    className: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  },
  Adjustment: {
    icon: SlidersHorizontal,
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  'System Generated': {
    icon: Cpu,
    className: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  'Preview Only': {
    icon: Eye,
    className: 'bg-violet-50 text-violet-800 ring-violet-200',
  },
}

export function LedgerStatusBadge({
  status,
  isPreviewOnly,
}: {
  status: LedgerEntryStatus
  isPreviewOnly?: boolean
}) {
  const variant: BadgeVariant = isPreviewOnly ? 'Preview Only' : status
  const config = BADGE_CONFIG[variant]
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1',
        config.className,
      )}
      title={variant}
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span>{variant}</span>
    </span>
  )
}

export function LedgerVoucherTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
      <ArrowLeftRight className="h-3 w-3" aria-hidden />
      <span>{type}</span>
    </span>
  )
}
