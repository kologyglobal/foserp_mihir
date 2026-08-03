import { useEffect, useState } from 'react'
import {
  Activity,
  Banknote,
  BarChart3,
  Calendar,
  FileText,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  ShoppingCart,
  Star,
  Target,
  Truck,
  Video,
} from 'lucide-react'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  CommandBarOverflowMenu,
  type CommandBarOverflowAction,
} from '@/components/ui/CommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { CompanyCustomerBadge } from '@/components/masters/CompanyCustomerBadge'
import { useUIStore } from '@/store/uiStore'
import type { Customer } from '@/types/master'
import type { CrmCompanyStatus } from '@/utils/crmCompanyStatus'
import { cn } from '@/utils/cn'

export interface Customer360RecordHeaderProps {
  customer: Customer
  favoritePath: string
  status?: CrmCompanyStatus
  canCreateInvoice?: boolean
  onEdit: () => void
  onNewOpportunity: () => void
  onScheduleActivity: () => void
  onLogActivity: () => void
  onOpenQuotations: () => void
  onOpenSalesOrders: () => void
  onOpenDispatch: () => void
  onOpenOutstanding: () => void
  onCreateInvoice?: () => void
  onPaymentAllocation?: () => void
}

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return narrow
}

/** Sticky company/customer record header — identity left, prioritized actions right. */
export function Customer360RecordHeader({
  customer,
  favoritePath,
  status,
  canCreateInvoice = false,
  onEdit,
  onNewOpportunity,
  onScheduleActivity,
  onLogActivity,
  onOpenQuotations,
  onOpenSalesOrders,
  onOpenDispatch,
  onOpenOutstanding,
  onCreateInvoice,
  onPaymentAllocation,
}: Customer360RecordHeaderProps) {
  const narrow = useNarrowViewport()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const fav = isFavorite(favoritePath)

  const displayTitle = customer.customerName?.trim() || customer.customerCode
  const location = [customer.city, customer.state].filter(Boolean).join(', ')
  const territory = customer.salesTerritory?.trim() || null

  const moreActions: CommandBarOverflowAction[] = [
    ...(narrow
      ? [
          {
            id: 'follow-up',
            label: 'Schedule Follow-up',
            icon: Calendar,
            onClick: onScheduleActivity,
          },
          {
            id: 'new-opp',
            label: 'New Opportunity',
            icon: Plus,
            onClick: onNewOpportunity,
          },
        ]
      : []),
    {
      id: 'call',
      label: 'Call',
      icon: Phone,
      onClick: () =>
        (customer.contactPhone ? window.open(`tel:${customer.contactPhone}`) : onLogActivity()),
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      onClick: () =>
        (customer.contactEmail ? window.open(`mailto:${customer.contactEmail}`) : onLogActivity()),
    },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, onClick: onLogActivity },
    { id: 'meeting', label: 'Meeting', icon: Video, onClick: onLogActivity },
    { id: 'log', label: 'Log Activity', icon: Activity, onClick: onLogActivity },
    { id: 'quotations', label: 'Quotations', icon: FileText, onClick: onOpenQuotations },
    { id: 'sales', label: 'Sales Orders', icon: ShoppingCart, onClick: onOpenSalesOrders },
    { id: 'dispatch', label: 'Dispatch', icon: Truck, onClick: onOpenDispatch },
    { id: 'outstanding', label: 'Outstanding', icon: BarChart3, onClick: onOpenOutstanding },
    ...(canCreateInvoice && onCreateInvoice
      ? [{ id: 'invoice', label: 'Create Invoice', icon: Banknote, onClick: onCreateInvoice }]
      : []),
    ...(onPaymentAllocation
      ? [{ id: 'alloc', label: 'Payment Allocation', icon: Banknote, onClick: onPaymentAllocation }]
      : []),
    { id: 'edit-master', label: 'Edit Master', icon: Pencil, onClick: onEdit },
  ]

  return (
    <header className="crm-sticky-record-header" aria-label="Company record header">
      <div className="crm-sticky-record-header__identity">
        <div className="crm-sticky-record-header__title-row">
          <h1 className="crm-sticky-record-header__title">{displayTitle}</h1>
          <button
            type="button"
            className={cn(
              'crm-sticky-record-header__fav',
              fav && 'crm-sticky-record-header__fav--on',
            )}
            onClick={() => toggleFavorite({ path: favoritePath, label: displayTitle })}
            aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
            title={fav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
          </button>
        </div>
        <div className="crm-sticky-record-header__meta">
          {customer.customerCode ? (
            <span className="crm-sticky-record-header__id">{customer.customerCode}</span>
          ) : null}
          <CompanyCustomerBadge company={customer} />
          {status ? (
            <DynamicsStatusChip label={status.label} tone={status.tone} />
          ) : (
            <DynamicsStatusChip
              label={customer.isActive === false ? 'Inactive' : 'Active'}
              tone={customer.isActive === false ? 'neutral' : 'success'}
            />
          )}
          {customer.customerType ? (
            <DynamicsStatusChip label={customer.customerType} tone="info" />
          ) : null}
          {location || territory ? (
            <span className="crm-sticky-record-header__owner">
              <span className="crm-sticky-record-header__owner-label">
                {location ? 'Location' : 'Territory'}
              </span>
              {location || territory}
            </span>
          ) : null}
          {customer.contactPerson ? (
            <span className="crm-sticky-record-header__owner">
              <span className="crm-sticky-record-header__owner-label">Contact</span>
              {customer.contactPerson}
            </span>
          ) : null}
        </div>
        <span className="sr-only">
          Company {displayTitle}. {status?.label ?? (customer.isActive === false ? 'Inactive' : 'Active')}.
        </span>
      </div>

      <div className="crm-sticky-record-header__actions" role="toolbar" aria-label="Company actions">
        <ErpButton size="sm" variant="outline" icon={Pencil} onClick={onEdit}>
          Edit
        </ErpButton>

        {!narrow ? (
          <>
            <ErpButton size="sm" variant="secondary" icon={Calendar} onClick={onScheduleActivity}>
              Schedule
            </ErpButton>
            <ErpButton size="sm" variant="primary" icon={Target} onClick={onNewOpportunity}>
              Opportunity
            </ErpButton>
          </>
        ) : (
          <ErpButton size="sm" variant="primary" icon={Plus} onClick={onNewOpportunity}>
            Opportunity
          </ErpButton>
        )}

        <CommandBarOverflowMenu
          actions={moreActions}
          label="More Actions"
          icon={MoreHorizontal}
          iconOnly
        />
      </div>
    </header>
  )
}
