import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ClipboardCheck,
  LogIn,
  LogOut,
  Package,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GateActivity, GateActivityEvent } from '../types/gate.types'
import { GateStatusBadge } from './GateStatusBadge'
import { formatRecentTime } from '@/utils/dates/format'

const EVENT_META: Record<GateActivityEvent, { label: string; icon: LucideIcon }> = {
  visitor_arrived: { label: 'Visitor arrived', icon: Users },
  visitor_approved: { label: 'Visitor approved', icon: UserCheck },
  visitor_entered: { label: 'Visitor entered', icon: LogIn },
  visitor_exited: { label: 'Visitor exited', icon: LogOut },
  vehicle_arrived: { label: 'Vehicle arrived', icon: Truck },
  vehicle_exited: { label: 'Vehicle exited', icon: Truck },
  material_inward_registered: { label: 'Material inward registered', icon: ArrowDownToLine },
  outward_released: { label: 'Outward released', icon: ArrowUpFromLine },
  gate_pass_returned: { label: 'Gate pass returned', icon: Package },
  contractor_entered: { label: 'Contractor entered', icon: LogIn },
  contractor_exited: { label: 'Contractor exited', icon: LogOut },
  courier_received: { label: 'Courier received', icon: Package },
  courier_handed_over: { label: 'Courier handed over', icon: CheckCircle2 },
  approval_actioned: { label: 'Approval actioned', icon: ClipboardCheck },
}

export function GateActivityTimeline({ activities }: { activities: GateActivity[] }) {
  if (activities.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-erp-muted">No gate activity recorded yet today.</p>
  }
  return (
    <ol className="divide-y divide-erp-border">
      {activities.map((activity) => {
        const meta = EVENT_META[activity.event]
        const Icon = meta.icon
        return (
          <li key={activity.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-erp-primary-soft">
              <Icon className="h-3.5 w-3.5 text-erp-primary" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-medium text-erp-text">{meta.label}</span>
                <GateStatusBadge status={activity.status} />
              </div>
              <p className="truncate text-[12.5px] text-erp-muted">
                {activity.recordLabel}
                {activity.company ? ` · ${activity.company}` : ''}
              </p>
              <p className="text-[11.5px] text-erp-muted">
                {formatRecentTime(activity.time)} · {activity.gate} · {activity.operator}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
