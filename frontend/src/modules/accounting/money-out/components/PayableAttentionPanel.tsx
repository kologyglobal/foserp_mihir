import { Link } from 'react-router-dom'
import { AlertTriangle, FileCheck, Clock } from 'lucide-react'

export function PayableAttentionPanel({
  readyToPost,
  overdueCount,
  exceptionCount,
}: {
  readyToPost: number
  overdueCount: number
  exceptionCount: number
}) {
  const items = [
    readyToPost > 0 && {
      icon: FileCheck,
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
      label: `${readyToPost} vendor invoice${readyToPost === 1 ? '' : 's'} ready to post`,
      to: '/accounting/money-out/vendor-invoices?status=READY_TO_POST',
    },
    overdueCount > 0 && {
      icon: Clock,
      tone: 'text-rose-700 bg-rose-50 border-rose-200',
      label: `${overdueCount} overdue open item${overdueCount === 1 ? '' : 's'}`,
      to: '/accounting/money-out/outstanding',
    },
    exceptionCount > 0 && {
      icon: AlertTriangle,
      tone: 'text-orange-700 bg-orange-50 border-orange-200',
      label: `${exceptionCount} data quality exception${exceptionCount === 1 ? '' : 's'}`,
      to: '/accounting/money-out/outstanding',
    },
  ].filter(Boolean) as Array<{ icon: typeof Clock; tone: string; label: string; to: string }>

  if (items.length === 0) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
        No attention items — AP subledger is current.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.label}
            to={item.to}
            className={`flex items-center gap-2 rounded border px-3 py-2 text-[12px] transition hover:opacity-90 ${item.tone}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
