import { useEffect, useState } from 'react'
import {
  Calendar,
  Copy,
  FileDown,
  FileText,
  Handshake,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  Archive,
  Star,
  Trash2,
  Video,
} from 'lucide-react'
import { LeadStageChip } from '@/components/crm/LeadStageChip'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  CommandBarOverflowMenu,
  type CommandBarOverflowAction,
} from '@/components/ui/CommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { useUIStore } from '@/store/uiStore'
import type { Lead } from '@/types/sales'
import { cn } from '@/utils/cn'
import { leadPriorityLabel, leadStageLabel } from '@/utils/leadUtils'

export interface Lead360RecordHeaderProps {
  lead: Lead
  displayName: string
  favoritePath: string
  canEdit: boolean
  canConvert: boolean
  canClose: boolean
  isConverted: boolean
  /** When set, primary commercial CTA is Create Quotation via this opportunity. */
  quoteOpportunityId: string | null
  onEdit: () => void
  onScheduleActivity: () => void
  onCreateQuotation: () => void
  onConvert: () => void
  onLogActivity: () => void
  onViewHistory: () => void
  onDuplicate: () => void
  onArchive: () => void
  onCloseLead: () => void
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

/** Sticky lead record header — identity left, prioritized actions right. */
export function Lead360RecordHeader({
  lead,
  displayName,
  favoritePath,
  canEdit,
  canConvert,
  canClose,
  isConverted,
  quoteOpportunityId,
  onEdit,
  onScheduleActivity,
  onCreateQuotation,
  onConvert,
  onLogActivity,
  onViewHistory,
  onDuplicate,
  onArchive,
  onCloseLead,
}: Lead360RecordHeaderProps) {
  const narrow = useNarrowViewport()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const fav = isFavorite(favoritePath)

  const stageLabel = leadStageLabel(lead.stage)
  const priorityLabel = leadPriorityLabel(lead.priority)
  const ownerName = lead.leadOwnerName?.trim() || '—'
  const canQuoteViaOpp = Boolean(quoteOpportunityId)
  const convertPrimary = canConvert
  const quotePrimary = canQuoteViaOpp && !convertPrimary
  const editPrimary = canEdit && !convertPrimary && !quotePrimary

  const moreActions: CommandBarOverflowAction[] = [
    ...(narrow
      ? [
          {
            id: 'follow-up',
            label: 'Schedule Activity',
            icon: Calendar,
            onClick: onScheduleActivity,
          },
          ...(canQuoteViaOpp
            ? [
                {
                  id: 'quotation',
                  label: 'Create Quotation',
                  icon: FileText,
                  onClick: onCreateQuotation,
                },
              ]
            : []),
        ]
      : []),
    {
      id: 'call',
      label: 'Call',
      icon: Phone,
      onClick: () => (lead.mobile ? window.open(`tel:${lead.mobile}`) : onLogActivity()),
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      onClick: () => (lead.email ? window.open(`mailto:${lead.email}`) : onLogActivity()),
    },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, onClick: onLogActivity },
    { id: 'meeting', label: 'Meeting', icon: Video, onClick: onLogActivity },
    { id: 'history', label: 'View History', icon: Calendar, onClick: onViewHistory },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: onDuplicate },
    { id: 'export', label: 'Export PDF', icon: FileDown, onClick: () => window.print() },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() },
    { id: 'archive', label: 'Archive', icon: Archive, onClick: onArchive },
    ...(canClose
      ? [{ id: 'close', label: 'Close Lead', icon: Trash2, onClick: onCloseLead, danger: true }]
      : []),
  ]

  return (
    <header className="crm-sticky-record-header" aria-label="Lead record header">
      <div className="crm-sticky-record-header__identity">
        <div className="crm-sticky-record-header__title-row">
          <h1 className="crm-sticky-record-header__title">{displayName}</h1>
          <button
            type="button"
            className={cn(
              'crm-sticky-record-header__fav',
              fav && 'crm-sticky-record-header__fav--on',
            )}
            onClick={() => toggleFavorite({ path: favoritePath, label: displayName })}
            aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
            title={fav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
          </button>
        </div>
        <div className="crm-sticky-record-header__meta">
          {lead.leadNo ? (
            <span className="crm-sticky-record-header__id">{lead.leadNo}</span>
          ) : null}
          <LeadStageChip stage={lead.stage} />
          <DynamicsStatusChip
            label={`${priorityLabel} Priority`}
            tone={priorityChipTone(lead.priority)}
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

      <div className="crm-sticky-record-header__actions" role="toolbar" aria-label="Lead actions">
        {canEdit ? (
          <ErpButton
            size="sm"
            variant={editPrimary ? 'primary' : 'outline'}
            icon={Pencil}
            onClick={onEdit}
          >
            Edit
          </ErpButton>
        ) : null}

        {!narrow ? (
          <>
            <ErpButton size="sm" variant="secondary" icon={Calendar} onClick={onScheduleActivity}>
              Schedule Activity
            </ErpButton>
            {canQuoteViaOpp ? (
              <ErpButton
                size="sm"
                variant={quotePrimary ? 'primary' : 'secondary'}
                icon={FileText}
                onClick={onCreateQuotation}
              >
                Create Quotation
              </ErpButton>
            ) : null}
          </>
        ) : null}

        <ErpButton
          size="sm"
          variant={convertPrimary ? 'primary' : 'outline'}
          icon={Handshake}
          onClick={onConvert}
          disabled={!canConvert}
          disabledReason={
            isConverted ? 'Already converted' : 'Qualify and link company first'
          }
        >
          Convert to Opportunity
        </ErpButton>

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
