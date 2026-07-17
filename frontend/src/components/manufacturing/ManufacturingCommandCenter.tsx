import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

export type ManufacturingScreenId =
  | 'dashboard'
  | 'control_room'
  | 'work_orders'
  | 'shopfloor'
  | 'production_plan'
  | 'bom'
  | 'routes'
  | 'job_work'
  | 'reports'
  | 'settings'
  | 'other'

/** One-line role of each screen — keeps the module feeling light. */
export const MANUFACTURING_SCREEN_ROLE: Record<Exclude<ManufacturingScreenId, 'other'>, string> = {
  dashboard: 'Redirects to Production Control Room (owner / manager view).',
  control_room: 'Owner / manager attention board — not a stack of ERP documents.',
  work_orders: 'Center — Start / Hold / Complete / QC / Close and operation stages live here.',
  shopfloor: 'Live visibility of Work Orders — not a separate execution document.',
  production_plan: 'Plan tells what to make — then creates Work Orders.',
  bom: 'BOM tells what is needed — recipes, not a shopfloor document.',
  routes: 'Route Master — Cutting → Welding → … stages folded into Work Orders (not MES).',
  job_work: 'Optional outside processing on a Work Order (keep Advanced/subcontracting light).',
  reports: 'Performance visibility — not another posting document.',
  settings: 'Keep Advanced off so manufacturing stays simple.',
}

/**
 * Light pipeline only — never Job Card → Material Issue → Operation → FG Receipt → Scrap → QC → Rework docs.
 */
export const MANUFACTURING_PIPELINE = [
  {
    id: 'bom',
    label: 'BOM',
    detail: 'What is needed',
    to: '/manufacturing/bom',
    phase: 'setup' as const,
  },
  {
    id: 'plan',
    label: 'Plan',
    detail: 'What to make',
    to: '/manufacturing/production-plan',
    phase: 'setup' as const,
  },
  {
    id: 'work_order',
    label: 'Work Order',
    detail: 'One document for production',
    to: '/manufacturing/work-orders',
    phase: 'center' as const,
  },
  {
    id: 'execute',
    label: 'Start / Hold / Complete / QC / Close',
    detail: 'All actions stay on the Work Order',
    to: '/manufacturing/work-orders',
    phase: 'execute' as const,
  },
  {
    id: 'visibility',
    label: 'Shopfloor View + Reports',
    detail: 'See what is happening and how you performed',
    to: '/manufacturing/shopfloor',
    phase: 'visibility' as const,
  },
] as const

export type ManufacturingPipelineStepId = (typeof MANUFACTURING_PIPELINE)[number]['id']

export function resolveManufacturingScreen(pathname: string): ManufacturingScreenId {
  if (pathname.includes('/control-room')) return 'control_room'
  if (pathname.includes('/work-orders')) return 'work_orders'
  if (pathname.includes('/shopfloor')) return 'shopfloor'
  if (pathname.includes('/production-plan')) return 'production_plan'
  if (pathname.includes('/routes')) return 'routes'
  if (pathname.includes('/bom')) return 'bom'
  if (pathname.includes('/job-work')) return 'job_work'
  if (pathname.includes('/reports')) return 'reports'
  if (pathname.includes('/settings')) return 'settings'
  if (pathname.includes('/dashboard') || pathname === '/manufacturing' || pathname === '/manufacturing/') {
    return 'dashboard'
  }
  return 'other'
}

function activePipelineIds(screen: ManufacturingScreenId): ManufacturingPipelineStepId[] {
  switch (screen) {
    case 'bom':
    case 'routes':
      return ['bom']
    case 'production_plan':
      return ['plan']
    case 'work_orders':
      return ['work_order', 'execute']
    case 'shopfloor':
    case 'reports':
      return ['visibility']
    case 'dashboard':
    case 'control_room':
      return ['work_order']
    default:
      return []
  }
}

/** Light flow: BOM → Plan → Work Order → Start/Hold/Complete/QC/Close → Shopfloor + Reports */
export function ManufacturingCommandMap({
  className,
  dense,
}: {
  className?: string
  dense?: boolean
}) {
  const { pathname } = useLocation()
  const screen = resolveManufacturingScreen(pathname)
  const activeIds = new Set(activePipelineIds(screen))

  return (
    <nav
      aria-label="Simple manufacturing flow"
      className={cn(
        'rounded-xl border border-erp-border bg-gradient-to-b from-slate-50 via-white to-sky-50/30',
        dense ? 'px-2.5 py-2.5' : 'px-4 py-3.5',
        className,
      )}
    >
      <div className="mb-3 space-y-1">
        <p className={cn('font-semibold text-erp-text', dense ? 'text-[12px]' : 'text-[14px]')}>
          Simple production flow
        </p>
        <p className="text-[11px] leading-snug text-erp-muted">
          Not Job Card → Material Issue → Operation → FG Receipt → Scrap / QC / Rework entries.
          One <span className="font-semibold text-erp-primary">Work Order</span> carries Start / Hold / Complete / QC / Close.
        </p>
      </div>

      <ol className="mx-auto flex max-w-lg flex-col items-stretch gap-0">
        {MANUFACTURING_PIPELINE.map((step, index) => {
          const isActive = activeIds.has(step.id)
          const isCenter = step.phase === 'center'
          return (
            <li key={step.id} className="flex flex-col items-center">
              {index > 0 ? (
                <span className="py-0.5 text-[14px] font-medium leading-none text-erp-muted" aria-hidden>
                  ↓
                </span>
              ) : null}
              <Link
                to={step.to}
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-center transition touch-manipulation',
                  isCenter
                    ? 'bg-erp-primary text-white shadow-sm ring-2 ring-erp-primary/25'
                    : 'bg-white text-erp-text ring-1 ring-erp-border hover:bg-slate-50',
                  isActive && !isCenter && 'ring-2 ring-sky-400',
                  step.phase === 'execute' && 'bg-sky-50/80',
                )}
              >
                <span className={cn('block text-[13px] font-semibold', isCenter && 'text-white')}>
                  {step.label}
                  {isCenter ? ' ★' : ''}
                </span>
                <span className={cn('block text-[11px]', isCenter ? 'text-white/85' : 'text-erp-muted')}>
                  {step.detail}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-erp-muted">
        <Link to="/manufacturing/control-room" className="hover:text-erp-primary hover:underline">
          Control Room
        </Link>
        <Link to="/manufacturing/work-orders" className="font-semibold text-erp-primary hover:underline">
          Work Orders
        </Link>
        <Link to="/manufacturing/shopfloor" className="hover:text-erp-primary hover:underline">
          Shopfloor
        </Link>
        <Link to="/manufacturing/reports" className="hover:text-erp-primary hover:underline">
          Reports
        </Link>
      </div>
    </nav>
  )
}

/** Current-screen role line for banners. */
export function ManufacturingScreenRoleLine({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const screen = resolveManufacturingScreen(pathname)
  if (screen === 'other') return null
  return (
    <p className={cn('text-[12px] text-erp-muted', className)}>
      <span className="font-semibold text-erp-text">This screen: </span>
      {MANUFACTURING_SCREEN_ROLE[screen]}
    </p>
  )
}
