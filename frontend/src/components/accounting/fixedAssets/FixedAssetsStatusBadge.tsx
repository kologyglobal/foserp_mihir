import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import type {
  AssetStatus,
  CapitalizationStatus,
  DepreciationRunStatus,
  DisposalStatus,
  VerificationStatus,
} from '@/types/fixedAssets'

function Badge({
  label,
  className,
  icon: Icon,
}: {
  label: string
  className: string
  icon?: typeof CheckCircle2
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1',
        className,
      )}
      title={label}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      <span>{label}</span>
    </span>
  )
}

const ASSET_CFG: Record<AssetStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  'Under Construction': 'bg-amber-50 text-amber-800 ring-amber-200',
  'Pending Capitalization': 'bg-orange-50 text-orange-800 ring-orange-200',
  Active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Idle: 'bg-sky-50 text-sky-800 ring-sky-200',
  'Under Maintenance': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Fully Depreciated': 'bg-slate-50 text-slate-600 ring-slate-200',
  'Held for Disposal': 'bg-rose-50 text-rose-800 ring-rose-200',
  Disposed: 'bg-slate-50 text-slate-600 ring-slate-200',
  'Written Off': 'bg-rose-50 text-rose-800 ring-rose-200',
  Sold: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

const DEP_CFG: Record<DepreciationRunStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  Preview: 'bg-sky-50 text-sky-800 ring-sky-200',
  Posted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Reversed: 'bg-orange-50 text-orange-800 ring-orange-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const DISP_CFG: Record<DisposalStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  'Pending Approval': 'bg-amber-50 text-amber-800 ring-amber-200',
  Approved: 'bg-sky-50 text-sky-800 ring-sky-200',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const CAP_CFG: Record<CapitalizationStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  'Pending Approval': 'bg-amber-50 text-amber-800 ring-amber-200',
  Capitalized: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
}

const VER_CFG: Record<VerificationStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  'In Progress': 'bg-amber-50 text-amber-800 ring-amber-200',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <Badge
      label={status}
      className={ASSET_CFG[status]}
      icon={status === 'Held for Disposal' ? AlertTriangle : status === 'Active' ? CheckCircle2 : undefined}
    />
  )
}

export function DepreciationRunStatusBadge({ status }: { status: DepreciationRunStatus }) {
  return <Badge label={status} className={DEP_CFG[status]} icon={status === 'Preview' ? Clock : undefined} />
}

export function DisposalStatusBadge({ status }: { status: DisposalStatus }) {
  return <Badge label={status} className={DISP_CFG[status]} />
}

export function CapitalizationStatusBadge({ status }: { status: CapitalizationStatus }) {
  return <Badge label={status} className={CAP_CFG[status]} />
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  return <Badge label={status} className={VER_CFG[status]} />
}

/** Generic compact status for transfer/maintenance/reval/impairment strings */
export function FixedAssetsGenericStatusBadge({ status }: { status: string }) {
  const tone =
    /complet|post|approv|active|capitaliz|sold/i.test(status)
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : /pending|progress|preview|draft|schedul/i.test(status)
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : /reject|cancel|dispos|impair|write/i.test(status)
          ? 'bg-rose-50 text-rose-800 ring-rose-200'
          : 'bg-slate-50 text-slate-700 ring-slate-200'
  return <Badge label={status} className={tone} />
}
