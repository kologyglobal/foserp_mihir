import { Ban, CheckCircle2, FolderTree, Hash } from 'lucide-react'
import { cn } from '../../../utils/cn'
import type { AccountStatus, AccountType } from '../../../types/chartOfAccounts'

export function AccountStatusBadge({ active }: { active: boolean }) {
  const status: AccountStatus = active ? 'Active' : 'Inactive'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1',
        active
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 ring-slate-200',
      )}
      title={status}
    >
      {active ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <Ban className="h-3 w-3" aria-hidden />}
      <span>{status}</span>
    </span>
  )
}

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const isGroup = type === 'Group'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1',
        isGroup
          ? 'bg-indigo-50 text-indigo-800 ring-indigo-200'
          : 'bg-sky-50 text-sky-800 ring-sky-200',
      )}
    >
      {isGroup ? <FolderTree className="h-3 w-3" aria-hidden /> : <Hash className="h-3 w-3" aria-hidden />}
      <span>{type}</span>
    </span>
  )
}
