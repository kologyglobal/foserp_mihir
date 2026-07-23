import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { getExperienceRole, getSessionUser, ERP_ROLE_LABELS } from '../../utils/permissions'
import { buildMobileTasks } from '../../utils/mobileTasks'
import { mobileCrmEnabled } from '../../utils/mobileCrmPipeline'
import { MobilePageTitle, MobileTaskCard, MobileSyncQueue } from '../../components/mobile'

export function MobileHomePage() {
  const navigate = useNavigate()
  const role = getExperienceRole()
  const tasks = buildMobileTasks(role)

  return (
    <>
      <MobilePageTitle title="Factory Tasks" subtitle="Scan-first mobile operations — same ERP data as desktop" />
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="mob-card text-center text-[#605e5c]">No pending tasks — scan a code or check modules.</div>
        ) : (
          tasks.map((t) => (
            <MobileTaskCard
              key={t.id}
              title={t.title}
              subtitle={t.subtitle}
              count={t.count}
              priority={t.priority}
              dueLabel={t.dueLabel}
              actionLabel={t.actionLabel}
              onAction={() => navigate(t.path)}
            />
          ))
        )}
      </div>
    </>
  )
}

export function MobileTasksPage() {
  const navigate = useNavigate()
  const role = getExperienceRole()
  const tasks = buildMobileTasks(role)

  return (
    <>
      <MobilePageTitle title="My Tasks" subtitle={`${tasks.length} task groups`} />
      {tasks.map((t) => (
        <MobileTaskCard
          key={t.id}
          title={t.title}
          subtitle={`${t.module} · ${t.subtitle}`}
          count={t.count}
          priority={t.priority}
          actionLabel={t.actionLabel}
          onAction={() => navigate(t.path)}
        />
      ))}
    </>
  )
}

export function MobileModulesPage() {
  const navigate = useNavigate()
  const modules = [
    { label: 'Shopfloor Kiosk', path: '/m/kiosk' },
    { label: 'Shop Floor', path: '/m/shop-floor' },
    { label: 'Quality / QC', path: '/m/qc' },
    { label: 'Gate Keeper', path: '/m/gate' },
    { label: 'GRN Receiving', path: '/m/grn' },
    { label: 'Stock Count', path: '/m/stock-count' },
    { label: 'Material Issue', path: '/m/material-issue' },
    { label: 'Material Return', path: '/m/material-return' },
    { label: 'Warehouse Transfer', path: '/m/warehouse-transfer' },
    { label: 'Job Work', path: '/m/job-work' },
    { label: 'Dispatch Loading', path: '/m/dispatch' },
    { label: 'Approvals', path: '/m/approvals' },
    ...(mobileCrmEnabled()
      ? [
          { label: 'CRM Pipeline', path: '/m/crm' },
          { label: 'CRM Leads', path: '/m/crm/leads' },
          { label: 'CRM Opportunities', path: '/m/crm/opportunities' },
          { label: 'CRM Quotations', path: '/m/crm/quotations' },
          { label: 'CRM Sales Orders', path: '/m/crm/sales-orders' },
          { label: 'CRM Follow-ups', path: '/m/crm/follow-ups' },
          { label: 'CRM Activities', path: '/m/crm/activities' },
          { label: 'CRM Companies', path: '/m/crm/customers' },
        ]
      : []),
    { label: 'Global Scan', path: '/m/scan' },
  ]

  return (
    <>
      <MobilePageTitle title="Modules" subtitle="One task per screen" />
      <div className="mob-grid-2">
        {modules.map((m) => (
          <button key={m.path} type="button" className="mob-card text-left min-h-[72px] font-semibold" onClick={() => navigate(m.path)}>
            {m.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function MobileProfilePage() {
  const session = getSessionUser()

  return (
    <>
      <MobilePageTitle title="Profile" />
      <div className="mob-card">
        <div className="font-semibold">{session.name}</div>
        <div className="text-sm text-[#605e5c]">{ERP_ROLE_LABELS[session.role]}</div>
        <div className="text-sm mt-2">Plant: Pune</div>
      </div>
      <MobileSyncQueue />
      <Link to="/home" className="mob-btn mob-btn-secondary mt-4 block text-center no-underline">
        Open Desktop ERP
      </Link>
    </>
  )
}
