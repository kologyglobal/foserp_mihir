import { cn } from '@/utils/cn'
import type {
  FGPostingStatus,
  ProductionOrderStatus,
  VarianceType,
  WIPStatus,
} from '@/types/manufacturingAccounting'

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1', className)} title={label}>
      {label}
    </span>
  )
}

const PO_CFG: Record<ProductionOrderStatus, string> = {
  Planned: 'bg-slate-50 text-slate-700 ring-slate-200',
  Released: 'bg-sky-50 text-sky-800 ring-sky-200',
  'In Progress': 'bg-amber-50 text-amber-800 ring-amber-200',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Closed: 'bg-slate-50 text-slate-600 ring-slate-200',
  Cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
}

const FG_CFG: Record<FGPostingStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  Posted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Revalued: 'bg-sky-50 text-sky-800 ring-sky-200',
  Adjusted: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
}

const WIP_CFG: Record<WIPStatus, string> = {
  Open: 'bg-sky-50 text-sky-800 ring-sky-200',
  'Partially Absorbed': 'bg-amber-50 text-amber-800 ring-amber-200',
  'Ready for FG': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Closed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  'Written Off': 'bg-rose-50 text-rose-800 ring-rose-200',
}

export function ProductionOrderStatusBadge({ status }: { status: ProductionOrderStatus }) {
  return <Badge label={status} className={PO_CFG[status]} />
}

export function FgPostingStatusBadge({ status }: { status: FGPostingStatus }) {
  return <Badge label={status} className={FG_CFG[status]} />
}

export function WipStatusBadge({ status }: { status: WIPStatus }) {
  return <Badge label={status} className={WIP_CFG[status]} />
}

export function VarianceTypeBadge({ type }: { type: VarianceType }) {
  return <Badge label={type} className="bg-indigo-50 text-indigo-800 ring-indigo-200" />
}

export function ManufacturingGenericStatusBadge({ status }: { status: string }) {
  const tone =
    /complet|post|closed|ready/i.test(status)
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : /progress|released|draft|planned/i.test(status)
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : /error|cancel|unfavour|adverse/i.test(status)
          ? 'bg-rose-50 text-rose-800 ring-rose-200'
          : 'bg-slate-50 text-slate-700 ring-slate-200'
  return <Badge label={status} className={tone} />
}
