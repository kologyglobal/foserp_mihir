import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Calendar,
  FileText,
  Handshake,
  PackageSearch,
  Plus,
  Route,
  UserPlus,
} from 'lucide-react'
import { useCrmQuickCreateStore, type CrmQuickCreateTarget } from '../../../store/crmQuickCreateStore'
import { canCrmPermission } from '../../../utils/permissions'
import { usePurchasePermissions } from '../../../utils/permissions/purchase'
import { cn } from '../../../utils/cn'

type MenuItem = {
  id: CrmQuickCreateTarget | 'guided'
  label: string
  description: string
  icon: typeof Plus
  enabled: boolean
}

interface CrmQuickCreateMenuProps {
  className?: string
  /** Suite bar uses light-on-dark styles. */
  variant?: 'topbar' | 'suite'
}

export function CrmQuickCreateMenu({ className, variant = 'suite' }: CrmQuickCreateMenuProps) {
  const navigate = useNavigate()
  const openQuickCreate = useCrmQuickCreateStore((s) => s.openQuickCreate)
  const purchasePerms = usePurchasePermissions()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const items: MenuItem[] = [
    {
      id: 'lead',
      label: 'Lead',
      description: 'Capture a prospect quickly',
      icon: UserPlus,
      enabled: canCrmPermission('crm.lead.create'),
    },
    {
      id: 'customer',
      label: 'Customer',
      description: 'New company — minimum fields',
      icon: Building2,
      enabled: canCrmPermission('crm.company.create'),
    },
    {
      id: 'opportunity',
      label: 'Opportunity',
      description: 'Open a pipeline deal',
      icon: Handshake,
      enabled: canCrmPermission('crm.opportunity.create'),
    },
    {
      id: 'rfq',
      label: 'RFQ',
      description: 'Purchase request for quotation',
      icon: PackageSearch,
      enabled: purchasePerms.canCreateRfq,
    },
    {
      id: 'quotation',
      label: 'Quotation',
      description: 'Quick client quote',
      icon: FileText,
      enabled: canCrmPermission('crm.quotation.create'),
    },
    {
      id: 'follow_up',
      label: 'Follow-up',
      description: 'Schedule next touchpoint',
      icon: Calendar,
      enabled: canCrmPermission('crm.follow_up.create'),
    },
    {
      id: 'guided',
      label: 'Guided deal',
      description: 'Lead → Qualify → Opp → Quote → Order',
      icon: Route,
      enabled: canCrmPermission('crm.lead.create') || canCrmPermission('crm.opportunity.create'),
    },
  ]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleSelect(item: MenuItem) {
    if (!item.enabled) return
    setOpen(false)
    if (item.id === 'guided') {
      navigate('/crm/guided-deal')
      return
    }
    openQuickCreate(item.id)
  }

  const triggerClass =
    variant === 'suite'
      ? 'd365-suite-quick-action hidden sm:inline-flex'
      : 'erp-type-caption-strong hidden h-8 items-center gap-1.5 rounded-md border border-erp-border bg-white px-2.5 text-erp-text shadow-none transition-colors hover:border-erp-primary/30 hover:bg-erp-primary-soft hover:text-erp-primary sm:inline-flex'

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Quick create
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Quick create"
          className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[320px] overflow-hidden rounded-lg border border-erp-border bg-white py-1 shadow-lg"
        >
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
            Capture minimum data first
          </p>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={!item.enabled}
                onClick={() => handleSelect(item)}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                  item.enabled ? 'hover:bg-erp-surface-alt' : 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-erp-primary/10 text-erp-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-erp-text">{item.label}</span>
                  <span className="block text-[11px] text-erp-muted">{item.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
