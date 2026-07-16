import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { StatusBadge } from '@/design-system/list-page'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'

export type PurchaseDocumentRecordHeaderFact = {
  label: string
  value: string
}

export type PurchaseDocumentRecordHeaderProps = {
  title: string
  favoritePath: string
  status: string
  /** Raw status key for StatusBadge tone mapping (optional). */
  statusKey?: string
  /** Optional mono chip before status (e.g. R0, Auto). */
  idChip?: string
  facts?: PurchaseDocumentRecordHeaderFact[]
  /** Right-side actions (command bar, overflow). */
  actions?: ReactNode
  className?: string
}

/**
 * CRM Quotation-style sticky document header for Purchase create/edit.
 * Large title + favorite, then compact: [id] · status badge · Label: value …
 */
export function PurchaseDocumentRecordHeader({
  title,
  favoritePath,
  status,
  statusKey,
  idChip,
  facts = [],
  actions,
  className,
}: PurchaseDocumentRecordHeaderProps) {
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const fav = isFavorite(favoritePath)

  return (
    <header
      className={cn('crm-sticky-record-header', className)}
      aria-label="Document header"
    >
      <div className="crm-sticky-record-header__identity">
        <div className="crm-sticky-record-header__title-row">
          <h1 className="crm-sticky-record-header__title">{title}</h1>
          <button
            type="button"
            className={cn(
              'crm-sticky-record-header__fav',
              fav && 'crm-sticky-record-header__fav--on',
            )}
            onClick={() => toggleFavorite({ path: favoritePath, label: title })}
            aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
            title={fav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
          </button>
        </div>
        <div className="crm-sticky-record-header__meta">
          {idChip ? (
            <span className="crm-sticky-record-header__id">{idChip}</span>
          ) : null}
          <StatusBadge label={status} status={statusKey ?? status} />
          {facts.map((fact) => (
            <span key={fact.label} className="crm-sticky-record-header__owner">
              <span className="crm-sticky-record-header__owner-label">{fact.label}</span>
              {fact.value || '—'}
            </span>
          ))}
        </div>
      </div>

      {actions ? (
        <div className="crm-sticky-record-header__actions" role="toolbar" aria-label="Document actions">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
