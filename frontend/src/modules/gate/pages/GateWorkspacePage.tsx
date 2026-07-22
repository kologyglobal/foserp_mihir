import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  HardHat,
  Package,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DynamicsCommandButton,
  DynamicsDashboardGrid,
  DynamicsDashboardPanel,
  DynamicsModuleDashboard,
} from '@/components/dynamics'
import { SmartEmptyState } from '@/components/premium/SmartEmptyState'
import { moduleCategories } from '@/config/navigation'

const SECTION_ICONS: Record<string, LucideIcon> = {
  '/gate': ShieldCheck,
  '/gate/register': ClipboardList,
  '/gate/visitors': Users,
  '/gate/vehicles': Truck,
  '/gate/material-inward': ArrowDownToLine,
  '/gate/material-outward': ArrowUpFromLine,
  '/gate/passes': FileText,
  '/gate/contractors': HardHat,
  '/gate/couriers': Package,
  '/gate/approvals': ShieldCheck,
  '/gate/reports': BarChart3,
  '/gate/settings': Settings2,
}

function gateNavItems() {
  return moduleCategories.find((c) => c.id === 'gate')?.items.filter((i) => !i.end) ?? []
}

/** Gate & Security workspace — module hub while full operational pages are restored. */
export function GateWorkspacePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = useMemo(() => gateNavItems(), [])
  const active = items.find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`))
  const isHub = pathname === '/gate' || pathname === '/gate/'

  return (
    <DynamicsModuleDashboard
      title={isHub ? 'Gate & Security' : (active?.label ?? 'Gate & Security')}
      subtitle={
        isHub
          ? 'Visitor, vehicle, material, pass, contractor and courier gate operations'
          : 'This Gate register is wired in navigation. Full operational screens are being restored onto the live Gate API.'
      }
      badge="Gate"
      favoritePath="/gate"
      healthScore={88}
      heroMetrics={[
        { id: 'visitors', label: 'Visitors', value: '—', accent: 'blue', href: '/gate/visitors' },
        { id: 'vehicles', label: 'Vehicles', value: '—', accent: 'cyan', href: '/gate/vehicles' },
        { id: 'inward', label: 'Material In', value: '—', accent: 'green', href: '/gate/material-inward' },
        { id: 'approvals', label: 'Approvals', value: '—', accent: 'amber', href: '/gate/approvals' },
      ]}
      emptyState={
        <SmartEmptyState
          icon={CheckCircle2}
          title={isHub ? 'Gate module is available in the sidebar' : `${active?.label ?? 'Section'} is listed`}
          insight="Use the module rail to open Visitors, Vehicles, Material, Passes, Contractors, Couriers, Approvals, Reports, and Settings."
          healthNote="Backend Gate API is mounted at /api/v1/t/:slug/gate"
        />
      }
      quickActions={
        <>
          <DynamicsCommandButton primary onClick={() => navigate('/gate/visitors')}>
            Visitors
          </DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/gate/vehicles')}>Vehicles</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/gate/material-inward')}>
            Material Inward
          </DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/gate/approvals')}>Approvals</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: "Today's Register", value: 'Open', tone: 'primary', href: '/gate/register' },
        { label: 'Contractors', value: 'Open', tone: 'neutral', href: '/gate/contractors' },
        { label: 'Couriers', value: 'Open', tone: 'neutral', href: '/gate/couriers' },
        { label: 'Settings', value: 'Open', tone: 'neutral', href: '/gate/settings' },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel title="Gate registers">
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const Icon = SECTION_ICONS[item.path] ?? ShieldCheck
              const selected = pathname === item.path || pathname.startsWith(`${item.path}/`)
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={
                      selected
                        ? 'flex items-center gap-3 rounded-md border border-erp-accent/40 bg-erp-accent/5 px-3 py-2.5 text-[13px] font-medium text-erp-text'
                        : 'flex items-center gap-3 rounded-md border border-erp-border px-3 py-2.5 text-[13px] text-erp-text hover:bg-erp-surface-muted'
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0 text-erp-muted" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>
    </DynamicsModuleDashboard>
  )
}
