import { useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  HardHat,
  Package,
  ShieldOff,
  Truck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGatePermissions } from '@/utils/permissions/gate'
import { GATE_BREADCRUMB } from '../gateUi'

interface EntryCard {
  id: string
  icon: LucideIcon
  title: string
  description: string
  to: string
  enabled: boolean
}

/** Full-page "what is at the gate?" chooser — same six cards as the quick-entry drawer. */
export function GateNewEntryPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()

  const cards: EntryCard[] = [
    { id: 'visitor', icon: Users, title: 'Visitor', description: 'Walk-in or expected visitor entry with host approval and pass printing.', to: '/gate/visitors/new', enabled: perms.canCreateVisitor },
    { id: 'vehicle', icon: Truck, title: 'Vehicle', description: 'Register a vehicle arriving for delivery, pickup or FG dispatch.', to: '/gate/vehicles/new', enabled: perms.canCreateVehicle },
    { id: 'material-inward', icon: ArrowDownToLine, title: 'Material Inward', description: 'Record physical material arrival only. Inventory posts after Store completes the GRN.', to: '/gate/material-inward/new', enabled: perms.canCreateInward },
    { id: 'material-outward', icon: ArrowUpFromLine, title: 'Material Outward', description: 'Verify an approved outward document and release the vehicle.', to: '/gate/material-outward/verify', enabled: perms.canVerifyOutward },
    { id: 'contractor', icon: HardHat, title: 'Contractor', description: 'Contract worker entry with validity and safety induction checks.', to: '/gate/contractors/new', enabled: perms.canCreateContractor },
    { id: 'courier', icon: Package, title: 'Courier', description: 'Incoming or outgoing courier parcel register with handover tracking.', to: '/gate/couriers/new', enabled: perms.canCreateCourier },
  ]

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Gate Entry" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to create gate entries." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="New Gate Entry"
      description="Choose what is at the gate right now."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'New Entry' }]}
      backLink={{ to: '/gate', label: 'Back to Gate Dashboard' }}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.id}
              type="button"
              disabled={!card.enabled}
              onClick={() => navigate(card.to)}
              className="group flex min-h-[140px] flex-col items-start gap-2.5 rounded-lg border border-erp-border bg-white p-5 text-left transition-colors hover:border-erp-primary hover:bg-erp-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-erp-primary-soft">
                <Icon className="h-5 w-5 text-erp-primary" aria-hidden />
              </span>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-erp-text">{card.title}</span>
                <ArrowRight className="h-4.5 w-4.5 text-erp-muted transition-transform group-hover:translate-x-0.5 group-hover:text-erp-primary" aria-hidden />
              </span>
              <span className="text-[12.5px] leading-snug text-erp-muted">{card.description}</span>
              {!card.enabled ? <span className="text-[11px] font-medium text-rose-600">No permission</span> : null}
            </button>
          )
        })}
      </div>
    </OperationalPageShell>
  )
}
