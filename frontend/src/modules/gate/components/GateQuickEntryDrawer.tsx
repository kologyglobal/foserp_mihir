import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  HardHat,
  Package,
  Truck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GateDrawer } from './GateDrawer'
import { useGatePermissions } from '@/utils/permissions/gate'

interface EntryCard {
  id: string
  icon: LucideIcon
  title: string
  description: string
  to: string
  enabled: boolean
}

/** "New Gate Entry" drawer — six large cards routing to each capture flow. */
export function GateQuickEntryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const perms = useGatePermissions()

  const cards: EntryCard[] = [
    { id: 'visitor', icon: Users, title: 'Visitor', description: 'Walk-in or expected visitor entry with host approval.', to: '/gate/visitors/new', enabled: perms.canCreateVisitor },
    { id: 'vehicle', icon: Truck, title: 'Vehicle', description: 'Register a vehicle arriving for delivery, pickup or dispatch.', to: '/gate/vehicles/new', enabled: perms.canCreateVehicle },
    { id: 'material-inward', icon: ArrowDownToLine, title: 'Material Inward', description: 'Record physical material arrival. GRN stays with Store.', to: '/gate/material-inward/new', enabled: perms.canCreateInward },
    { id: 'material-outward', icon: ArrowUpFromLine, title: 'Material Outward', description: 'Verify an approved document and release material.', to: '/gate/material-outward/verify', enabled: perms.canVerifyOutward },
    { id: 'contractor', icon: HardHat, title: 'Contractor', description: 'Contract worker entry with safety induction check.', to: '/gate/contractors/new', enabled: perms.canCreateContractor },
    { id: 'courier', icon: Package, title: 'Courier', description: 'Incoming or outgoing courier parcel register.', to: '/gate/couriers/new', enabled: perms.canCreateCourier },
  ]

  return (
    <GateDrawer
      open={open}
      onClose={onClose}
      title="New Gate Entry"
      subtitle="Choose what is at the gate right now"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.id}
              type="button"
              disabled={!card.enabled}
              onClick={() => {
                onClose()
                navigate(card.to)
              }}
              className="group flex min-h-[104px] flex-col items-start gap-2 rounded-lg border border-erp-border bg-white p-4 text-left transition-colors hover:border-erp-primary hover:bg-erp-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-erp-primary-soft">
                <Icon className="h-4.5 w-4.5 text-erp-primary" aria-hidden />
              </span>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-erp-text">{card.title}</span>
                <ArrowRight className="h-4 w-4 text-erp-muted transition-transform group-hover:translate-x-0.5 group-hover:text-erp-primary" aria-hidden />
              </span>
              <span className="text-[12px] leading-snug text-erp-muted">{card.description}</span>
            </button>
          )
        })}
      </div>
    </GateDrawer>
  )
}
