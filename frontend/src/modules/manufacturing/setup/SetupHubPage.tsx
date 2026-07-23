import { useNavigate } from 'react-router-dom'
import { Factory, GitBranch, Layers, SlidersHorizontal, Warehouse, Wrench } from 'lucide-react'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

interface SetupCardDef {
  title: string
  description: string
  path: string
  icon: typeof Layers
}

const CARDS: SetupCardDef[] = [
  {
    title: 'Work Centres',
    description: 'Physical/logical production locations — capacity, cost rate, department.',
    path: '/manufacturing/work-centres',
    icon: Warehouse,
  },
  {
    title: 'Machines',
    description: 'Equipment belonging to a work centre, with an operational status lifecycle.',
    path: '/manufacturing/machines',
    icon: Wrench,
  },
  {
    title: 'BOMs',
    description: 'Versioned, multilevel component structures per finished item.',
    path: '/manufacturing/setup/boms',
    icon: Layers,
  },
  {
    title: 'Routings',
    description: 'Versioned sequences of stage groups → operations → dependencies.',
    path: '/manufacturing/setup/routings',
    icon: GitBranch,
  },
  {
    title: 'Manufacturing Profiles',
    description: 'Per-item production configuration with a readiness gate.',
    path: '/manufacturing/profiles',
    icon: SlidersHorizontal,
  },
]

export function SetupHubPage() {
  const navigate = useNavigate()

  return (
    <ManufacturingSetupShell title="Setup Hub">
      <div className="mb-4 flex items-start gap-2 rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-muted">
        <Factory className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          This hub is for manufacturing masters (work centres, machines, BOMs, routings, profiles). For production
          execution, use{' '}
          <button
            type="button"
            className="font-semibold text-erp-primary underline-offset-2 hover:underline"
            onClick={() => navigate('/manufacturing/work-orders')}
          >
            Work Orders
          </button>
          ,{' '}
          <button
            type="button"
            className="font-semibold text-erp-primary underline-offset-2 hover:underline"
            onClick={() => navigate('/manufacturing/today')}
          >
            Today
          </button>
          , or{' '}
          <button
            type="button"
            className="font-semibold text-erp-primary underline-offset-2 hover:underline"
            onClick={() => navigate('/manufacturing/shopfloor')}
          >
            Shopfloor
          </button>
          .
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.path}
              type="button"
              onClick={() => navigate(card.path)}
              className="flex flex-col items-start gap-2 rounded-md border border-erp-border bg-white p-4 text-left transition-colors hover:border-erp-primary/40 hover:bg-erp-primary-soft/30"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-erp-primary-soft text-erp-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[14px] font-semibold text-erp-text">{card.title}</span>
              <span className="text-[12px] text-erp-muted">{card.description}</span>
            </button>
          )
        })}
      </div>
    </ManufacturingSetupShell>
  )
}
