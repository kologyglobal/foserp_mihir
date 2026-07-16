import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronRight, LayoutDashboard } from 'lucide-react'
import { EXPERIENCE_ROLE_CHANGE } from '../../components/role-experience/RoleSwitcher'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { WorkspaceSection } from '../../components/design-system/WorkspaceLayout'
import { Badge } from '../../components/ui/Badge'
import { SaaSCommandDashboard, SaaSPageShell, SaaSActivityFeed } from '../../components/saas'
import { NextActionPanel } from '../../components/premium/NextActionPanel'
import { useErpExecutiveAnalytics } from '../../services/erpAnalyticsService'
import { ROLE_HOME_ROUTES } from '../../config/roleExperience'
import { EXPERIENCE_ROLE_LABELS } from '../../types/roleExperience'
import { getExperienceRole, getSessionUser } from '../../utils/permissions'
import { useRoleExperienceData } from '../../utils/roleExperienceMetrics'
import type { InboxItem } from '../../utils/controlTowerMetrics'
import { cn } from '../../utils/cn'

function InboxList({ items, empty }: { items: InboxItem[]; empty: string }) {
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-[var(--saas-muted)]">{empty}</p>
  }
  return (
    <ul className="divide-y divide-[var(--saas-border)]">
      {items.slice(0, 5).map((item) => (
        <li key={item.id}>
          <Link to={item.href} className="group flex items-start gap-3 px-4 py-3 hover:bg-[var(--saas-bg-subtle)]">
            <span
              className={cn(
                'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                item.severity === 'red' && 'bg-[var(--saas-danger)]',
                item.severity === 'amber' && 'bg-[var(--saas-warning)]',
                item.severity === 'green' && 'bg-[var(--saas-success)]',
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--saas-text)]">{item.title}</span>
              <span className="block text-xs text-[var(--saas-muted)]">{item.description}</span>
            </span>
            <Badge color="gray">{item.module}</Badge>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--saas-muted)] opacity-0 group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function RoleHomePage() {
  const navigate = useNavigate()
  const [, refresh] = useState(0)
  useEffect(() => {
    const h = () => refresh((n) => n + 1)
    window.addEventListener(EXPERIENCE_ROLE_CHANGE, h)
    return () => window.removeEventListener(EXPERIENCE_ROLE_CHANGE, h)
  }, [])
  const role = getExperienceRole()
  const user = getSessionUser()
  const data = useRoleExperienceData(role)
  const { definition: def, kpis, inbox, approvals, counts } = data
  const analytics = useErpExecutiveAnalytics()

  return (
    <SaaSCommandDashboard
      title={def.title}
      subtitle={`${def.tagline} · ${user.name} · ${analytics.plantName} · Health ${analytics.plantHealthScore}%`}
      badge={EXPERIENCE_ROLE_LABELS[role]}
      favoritePath="/home"
      deepDashboardPath={def.deepDashboardPath}
      deepDashboardLabel={def.deepDashboardLabel}
      showNextActions={false}
      roleKpis={kpis.map((k) => ({
        label: k.label,
        value: k.value,
        href: k.href,
      }))}
      extra={
        <div className="space-y-5">
          <NextActionPanel limit={4} title="Today needs attention" />
          <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            <div className="grid gap-5 md:grid-cols-2">
              <section className="saas-panel">
                <div className="saas-panel-header">
                  <div>
                    <h3 className="saas-panel-title">Inbox</h3>
                    <p className="text-[0.6875rem] text-[var(--saas-muted)]">{counts.inbox} items</p>
                  </div>
                  <Link to={ROLE_HOME_ROUTES.inbox} className="text-xs font-semibold text-[var(--saas-primary)] hover:underline">
                    View all <ArrowRight className="inline h-3 w-3" />
                  </Link>
                </div>
                <InboxList items={inbox} empty="Inbox clear — no open tasks for your role." />
              </section>
              <section className="saas-panel">
                <div className="saas-panel-header">
                  <div>
                    <h3 className="saas-panel-title">Approvals</h3>
                    <p className="text-[0.6875rem] text-[var(--saas-muted)]">{counts.approvals} pending</p>
                  </div>
                  <Link to={ROLE_HOME_ROUTES.approvals} className="text-xs font-semibold text-[var(--saas-primary)] hover:underline">
                    View all <ArrowRight className="inline h-3 w-3" />
                  </Link>
                </div>
                <InboxList items={approvals} empty="No approvals waiting — you're up to date." />
              </section>
            </div>
          </div>
          <aside className="lg:col-span-4">
            <section className="saas-panel">
              <div className="saas-panel-header">
                <h3 className="saas-panel-title">Quick access</h3>
              </div>
              <div className="grid gap-1 p-2">
                {def.shortcuts.map((s) => {
                  const Icon = s.icon ?? LayoutDashboard
                  return (
                    <button
                      key={s.path + s.label}
                      type="button"
                      onClick={() => navigate(s.path)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--saas-bg-subtle)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--saas-primary-soft)] text-[var(--saas-primary)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--saas-text)]">{s.label}</span>
                      <ChevronRight className="h-4 w-4 text-[var(--saas-muted)]" />
                    </button>
                  )
                })}
              </div>
            </section>
          </aside>
          </div>
          <SaaSActivityFeed minEvents={8} />
        </div>
      }
    />
  )
}

export function RoleInboxPage() {
  const [, refresh] = useState(0)
  useEffect(() => {
    const h = () => refresh((n) => n + 1)
    window.addEventListener(EXPERIENCE_ROLE_CHANGE, h)
    return () => window.removeEventListener(EXPERIENCE_ROLE_CHANGE, h)
  }, [])
  const role = getExperienceRole()
  const data = useRoleExperienceData(role)

  return (
    <SaaSPageShell>
      <OperationalPageShell
        title={`${EXPERIENCE_ROLE_LABELS[role]} Inbox`}
        description="Work items, tasks, and alerts filtered for your role."
        badge={`${data.inbox.length} items`}
        favoritePath={ROLE_HOME_ROUTES.inbox}
      >
        <WorkspaceSection title="My Work">
          <InboxList items={data.inbox} empty="Inbox clear for your role." />
        </WorkspaceSection>
      </OperationalPageShell>
    </SaaSPageShell>
  )
}

export function RoleApprovalsPage() {
  const [, refresh] = useState(0)
  useEffect(() => {
    const h = () => refresh((n) => n + 1)
    window.addEventListener(EXPERIENCE_ROLE_CHANGE, h)
    return () => window.removeEventListener(EXPERIENCE_ROLE_CHANGE, h)
  }, [])
  const role = getExperienceRole()
  const data = useRoleExperienceData(role)

  return (
    <SaaSPageShell>
      <OperationalPageShell
        title={`${EXPERIENCE_ROLE_LABELS[role]} Approvals`}
        description="Approval queue filtered by role — includes matrix routing."
        badge={`${data.approvals.length} pending`}
        favoritePath={ROLE_HOME_ROUTES.approvals}
      >
        <WorkspaceSection title="Pending Approvals">
          <InboxList items={data.approvals} empty="No approvals waiting for your role." />
        </WorkspaceSection>
      </OperationalPageShell>
    </SaaSPageShell>
  )
}
