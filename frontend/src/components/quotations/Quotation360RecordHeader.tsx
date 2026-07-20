import { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Eye,
  FileDown,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Printer,
  Send,
  ShoppingCart,
  Star,
  Trash2,
} from 'lucide-react'
import { StatusBadge } from '@/design-system/list-page'
import {
  CommandBarOverflowMenu,
  type CommandBarOverflowAction,
} from '@/components/ui/CommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'
import { quotationStatusLabel } from './QuotationCrmCard'
import type { QuotationDocumentStatus } from '@/types/crm'

export interface Quotation360RecordHeaderProps {
  quotationNo: string
  customerName?: string | null
  opportunityLabel?: string | null
  favoritePath: string
  documentStatus: QuotationDocumentStatus
  revisionNo: number
  ownerName?: string | null
  canEdit: boolean
  canMarkSent: boolean
  canSubmitApproval: boolean
  canApprove: boolean
  canRevise: boolean
  canDelete?: boolean
  showCreateSalesOrder: boolean
  canCreateSalesOrder: boolean
  createSalesOrderDisabledReason?: string | null
  salesOrderId?: string | null
  onEdit: () => void
  onPreview: () => void
  onScheduleFollowUp: () => void
  onMarkSent: () => void
  onSubmitApproval: () => void
  onApprove: () => void
  onNewRevision: () => void
  onCreateSalesOrder: () => void
  onViewSalesOrder?: () => void
  onDelete?: () => void
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

/** Sticky quotation record header — identity left, prioritized lifecycle actions right. */
export function Quotation360RecordHeader({
  quotationNo,
  customerName,
  opportunityLabel,
  favoritePath,
  documentStatus,
  revisionNo,
  ownerName,
  canEdit,
  canMarkSent,
  canSubmitApproval,
  canApprove,
  canRevise,
  canDelete = false,
  showCreateSalesOrder,
  canCreateSalesOrder,
  createSalesOrderDisabledReason,
  salesOrderId,
  onEdit,
  onPreview,
  onScheduleFollowUp,
  onMarkSent,
  onSubmitApproval,
  onApprove,
  onNewRevision,
  onCreateSalesOrder,
  onViewSalesOrder,
  onDelete,
}: Quotation360RecordHeaderProps) {
  const narrow = useNarrowViewport()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const fav = isFavorite(favoritePath)

  const statusLabel = quotationStatusLabel(documentStatus)
  const owner = ownerName?.trim() || '—'
  const displayTitle = quotationNo

  const moreActions: CommandBarOverflowAction[] = [
    ...(narrow
      ? [
          {
            id: 'follow-up',
            label: 'Schedule Follow-up',
            icon: Calendar,
            onClick: onScheduleFollowUp,
          },
          {
            id: 'preview',
            label: 'Preview',
            icon: Eye,
            onClick: onPreview,
          },
          ...(canMarkSent
            ? [{ id: 'send', label: 'Mark Sent', icon: Send, onClick: onMarkSent }]
            : []),
          ...(canSubmitApproval
            ? [{ id: 'submit', label: 'Submit Approval', icon: CheckCircle2, onClick: onSubmitApproval }]
            : []),
          ...(canApprove
            ? [{ id: 'approve', label: 'Approve', icon: CheckCircle2, onClick: onApprove }]
            : []),
          ...(showCreateSalesOrder
            ? [{
                id: 'so',
                label: salesOrderId ? 'View Sales Order' : 'Convert to Sales Order',
                icon: ShoppingCart,
                onClick: salesOrderId && onViewSalesOrder ? onViewSalesOrder : onCreateSalesOrder,
                disabled: !salesOrderId && !canCreateSalesOrder,
                disabledReason: createSalesOrderDisabledReason ?? undefined,
              }]
            : []),
        ]
      : []),
    ...(!narrow
      ? [
          { id: 'follow-up', label: 'Schedule Follow-up', icon: Calendar, onClick: onScheduleFollowUp },
          { id: 'preview', label: 'Preview', icon: Eye, onClick: onPreview },
        ]
      : []),
    ...(canRevise
      ? [{ id: 'revise', label: 'New Revision', icon: GitBranch, onClick: onNewRevision }]
      : []),
    ...(canDelete && onDelete
      ? [{ id: 'delete', label: 'Delete', icon: Trash2, onClick: onDelete, danger: true as const }]
      : []),
    { id: 'export', label: 'Export PDF', icon: FileDown, onClick: () => window.print() },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() },
  ]

  const lifecyclePrimary =
    canMarkSent ? { label: 'Send', icon: Send, onClick: onMarkSent }
      : canApprove ? { label: 'Approve', icon: CheckCircle2, onClick: onApprove }
        : canSubmitApproval ? { label: 'Submit Approval', icon: CheckCircle2, onClick: onSubmitApproval }
          : null

  return (
    <header className="crm-sticky-record-header" aria-label="Quotation record header">
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
          <span className="crm-sticky-record-header__id">R{revisionNo}</span>
          <StatusBadge label={statusLabel} status={documentStatus} />
          {customerName ? (
            <span className="crm-sticky-record-header__owner">
              <span className="crm-sticky-record-header__owner-label">Customer</span>
              {customerName}
            </span>
          ) : null}
          {opportunityLabel ? (
            <span className="crm-sticky-record-header__owner">
              <span className="crm-sticky-record-header__owner-label">Deal</span>
              {opportunityLabel}
            </span>
          ) : null}
          <span className="crm-sticky-record-header__owner">
            <span className="crm-sticky-record-header__owner-label">Owner</span>
            {owner}
          </span>
        </div>
        <span className="sr-only">
          Status {statusLabel}. Revision {revisionNo}.
        </span>
      </div>

      <div className="crm-sticky-record-header__actions" role="toolbar" aria-label="Quotation actions">
        {canEdit ? (
          <ErpButton size="sm" variant="primary" icon={Pencil} onClick={onEdit}>
            Edit
          </ErpButton>
        ) : null}

        {!narrow && lifecyclePrimary ? (
          <ErpButton
            size="sm"
            variant={canEdit ? 'outline' : 'primary'}
            icon={lifecyclePrimary.icon}
            onClick={lifecyclePrimary.onClick}
          >
            {lifecyclePrimary.label}
          </ErpButton>
        ) : null}

        {!narrow && canSubmitApproval && lifecyclePrimary?.label !== 'Submit Approval' ? (
          <ErpButton size="sm" variant="secondary" icon={CheckCircle2} onClick={onSubmitApproval}>
            Submit Approval
          </ErpButton>
        ) : null}

        {!narrow && showCreateSalesOrder ? (
          salesOrderId && onViewSalesOrder ? (
            <ErpButton size="sm" variant="outline" icon={ShoppingCart} onClick={onViewSalesOrder}>
              View Sales Order
            </ErpButton>
          ) : (
            <ErpButton
              size="sm"
              variant="outline"
              icon={ShoppingCart}
              onClick={onCreateSalesOrder}
              disabled={!canCreateSalesOrder}
              disabledReason={createSalesOrderDisabledReason ?? undefined}
            >
              Convert to Sales Order
            </ErpButton>
          )
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
