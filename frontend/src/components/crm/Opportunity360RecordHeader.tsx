import { useEffect, useState } from 'react'
import {
  Activity,
  Calendar,
  CheckCircle2,
  Copy,
  FileDown,
  FileText,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  ShoppingCart,
  Star,
  Target,
  Trash2,
  Video,
  XCircle,
} from 'lucide-react'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { StageBadge } from '@/design-system/list-page'
import {
  CommandBarOverflowMenu,
  type CommandBarOverflowAction,
} from '@/components/ui/CommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { useUIStore } from '@/store/uiStore'
import type { Opportunity } from '@/types/crm'
import { cn } from '@/utils/cn'
import { opportunityPriorityLabel, opportunityStageLabel } from '@/utils/opportunityUtils'

export interface Opportunity360RecordHeaderProps {
  opportunity: Opportunity
  favoritePath: string
  isOpen: boolean
  canDelete: boolean
  /** Show Create SO control (hide when SO already linked). */
  showCreateSalesOrder: boolean
  /** Enable Create SO — quotation accepted + Won/Order Confirmed. */
  canCreateSalesOrder: boolean
  createSalesOrderDisabledReason?: string | null
  /** Create Quotation gate — stage + mandatory fields. */
  canCreateQuotation?: boolean
  createQuotationDisabledReason?: string | null
  contactPhone?: string
  contactEmail?: string
  onEdit: () => void
  onMoveStage: () => void
  onScheduleActivity: () => void
  onCreateQuotation: () => void
  onCreateSalesOrder: () => void
  onLogActivity: () => void
  onMarkWon: () => void
  onMarkLost: () => void
  onViewHistory: () => void
  onDuplicate: () => void
  onDelete: () => void
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

function priorityChipTone(priority: string): 'neutral' | 'info' | 'warning' | 'critical' | 'pending' {
  if (priority === 'critical') return 'critical'
  if (priority === 'high') return 'warning'
  if (priority === 'medium') return 'info'
  return 'neutral'
}

/** Sticky opportunity record header — identity left, prioritized actions right. */
export function Opportunity360RecordHeader({
  opportunity,
  favoritePath,
  isOpen,
  canDelete,
  showCreateSalesOrder,
  canCreateSalesOrder,
  createSalesOrderDisabledReason,
  canCreateQuotation = true,
  createQuotationDisabledReason,
  contactPhone,
  contactEmail,
  onEdit,
  onMoveStage,
  onScheduleActivity,
  onCreateQuotation,
  onCreateSalesOrder,
  onLogActivity,
  onMarkWon,
  onMarkLost,
  onViewHistory,
  onDuplicate,
  onDelete,
}: Opportunity360RecordHeaderProps) {
  const narrow = useNarrowViewport()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const fav = isFavorite(favoritePath)

  const stageLabel = opportunityStageLabel(opportunity.stage)
  const priorityLabel = opportunityPriorityLabel(opportunity.priority)
  const ownerName = opportunity.ownerName?.trim() || '—'
  const displayTitle = opportunity.opportunityName?.trim() || opportunity.opportunityNo

  const moreActions: CommandBarOverflowAction[] = [
    ...(narrow
      ? [
          {
            id: 'follow-up',
            label: 'Schedule Activity',
            icon: Calendar,
            onClick: onScheduleActivity,
          },
          {
            id: 'quotation',
            label: 'Create Quotation',
            icon: FileText,
            onClick: onCreateQuotation,
            disabled: !isOpen || !canCreateQuotation,
            disabledReason: createQuotationDisabledReason ?? undefined,
          },
          ...(showCreateSalesOrder
            ? [{
                id: 'so',
                label: 'Create Sales Order',
                icon: ShoppingCart,
                onClick: onCreateSalesOrder,
                disabled: !canCreateSalesOrder,
                disabledReason: createSalesOrderDisabledReason ?? undefined,
              }]
            : []),
        ]
      : []),
    { id: 'log', label: 'Log Activity', icon: Activity, onClick: onLogActivity },
    {
      id: 'call',
      label: 'Call',
      icon: Phone,
      onClick: () => (contactPhone ? window.open(`tel:${contactPhone}`) : onLogActivity()),
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      onClick: () => (contactEmail ? window.open(`mailto:${contactEmail}`) : onLogActivity()),
    },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, onClick: onLogActivity },
    { id: 'meeting', label: 'Meeting', icon: Video, onClick: onLogActivity },
    ...(isOpen
      ? [
          { id: 'won', label: 'Mark as Won', icon: CheckCircle2, onClick: onMarkWon },
          { id: 'lost', label: 'Mark as Lost', icon: XCircle, onClick: onMarkLost, danger: true },
        ]
      : []),
    { id: 'history', label: 'View History', icon: Calendar, onClick: onViewHistory },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: onDuplicate },
    { id: 'export', label: 'Export PDF', icon: FileDown, onClick: () => window.print() },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() },
    ...(canDelete
      ? [{ id: 'delete', label: 'Delete Opportunity', icon: Trash2, onClick: onDelete, danger: true }]
      : []),
  ]

  return (
    <header className="crm-sticky-record-header" aria-label="Opportunity record header">
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
          {opportunity.opportunityNo ? (
            <span className="crm-sticky-record-header__id">{opportunity.opportunityNo}</span>
          ) : null}
          <StageBadge stage={opportunity.stage} label={stageLabel} />
          <DynamicsStatusChip
            label={`${priorityLabel} Priority`}
            tone={priorityChipTone(opportunity.priority)}
          />
          <span className="crm-sticky-record-header__owner">
            <span className="crm-sticky-record-header__owner-label">Owner</span>
            {ownerName}
          </span>
        </div>
        <span className="sr-only">
          Current stage {stageLabel}. Priority {priorityLabel}.
        </span>
      </div>

      <div className="crm-sticky-record-header__actions" role="toolbar" aria-label="Opportunity actions">
        {isOpen ? (
          <ErpButton size="sm" variant="primary" icon={Pencil} onClick={onEdit}>
            Edit
          </ErpButton>
        ) : null}

        {isOpen ? (
          <ErpButton size="sm" variant="outline" icon={Target} onClick={onMoveStage}>
            Move Stage
          </ErpButton>
        ) : null}

        {!narrow ? (
          <>
            <ErpButton size="sm" variant="secondary" icon={Calendar} onClick={onScheduleActivity}>
              Schedule Activity
            </ErpButton>
            <ErpButton
              size="sm"
              variant="secondary"
              icon={FileText}
              onClick={onCreateQuotation}
              disabled={!isOpen || !canCreateQuotation}
              disabledReason={createQuotationDisabledReason ?? undefined}
            >
              Create Quotation
            </ErpButton>
            {showCreateSalesOrder ? (
              <ErpButton
                size="sm"
                variant="outline"
                icon={ShoppingCart}
                onClick={onCreateSalesOrder}
                disabled={!canCreateSalesOrder}
                disabledReason={createSalesOrderDisabledReason ?? undefined}
              >
                Create Sales Order
              </ErpButton>
            ) : null}
          </>
        ) : null}

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
