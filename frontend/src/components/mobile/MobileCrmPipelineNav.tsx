import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../utils/cn'

const STAGE_LINKS = [
  { id: 'hub', label: 'Hub', path: '/m/crm' },
  { id: 'leads', label: 'Leads', path: '/m/crm/leads' },
  { id: 'opportunities', label: 'Opps', path: '/m/crm/opportunities' },
  { id: 'quotations', label: 'Quotes', path: '/m/crm/quotations' },
  { id: 'sales-orders', label: 'SOs', path: '/m/crm/sales-orders' },
  { id: 'follow-ups', label: 'F/U', path: '/m/crm/follow-ups' },
  { id: 'customers', label: 'Cos', path: '/m/crm/customers' },
  { id: 'activities', label: 'Acts', path: '/m/crm/activities' },
] as const

export function MobileCrmPipelineNav() {
  const location = useLocation()

  return (
    <nav className="mb-4 -mx-1 overflow-x-auto pb-1" aria-label="CRM pipeline stages">
      <div className="flex min-w-max gap-1.5 px-1">
        {STAGE_LINKS.map((stage) => {
          const active =
            stage.path === '/m/crm'
              ? location.pathname === '/m/crm'
              : location.pathname.startsWith(stage.path)
          return (
            <Link
              key={stage.id}
              to={stage.path}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap border',
                active
                  ? 'border-[#0078d4] bg-[#0078d4] text-white'
                  : 'border-[#edebe9] bg-white text-[#323130]',
              )}
            >
              {stage.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
