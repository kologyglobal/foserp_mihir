import { useMemo, useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { ErpButton } from '../ErpButton'
import type { ErpSubpageColumn } from './types'
import { cn } from '../../../utils/cn'

interface ErpSubpageGridProps<T extends { id: string }> {
  title?: string
  rows: T[]
  columns: ErpSubpageColumn<T>[]
  onAddLine?: () => void
  onDeleteLine?: (row: T, index: number) => void
  onDuplicateLine?: (row: T, index: number) => void
  selectedId?: string | null
  onSelectRow?: (row: T) => void
  footer?: React.ReactNode
  emptyLabel?: string
  readOnly?: boolean
  className?: string
}

/** BC-style subpage line grid for transaction forms */
export function ErpSubpageGrid<T extends { id: string }>({
  title = 'Lines',
  rows,
  columns,
  onAddLine,
  onDeleteLine,
  onDuplicateLine,
  selectedId,
  onSelectRow,
  footer,
  emptyLabel = 'No lines yet. Press Alt+N or click Add Line.',
  readOnly,
  className,
}: ErpSubpageGridProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0)

  const gridTemplate = useMemo(
    () => columns.map((c) => c.width ?? '1fr').join(' '),
    [columns],
  )

  function selectRow(row: T, index: number) {
    setActiveIndex(index)
    onSelectRow?.(row)
  }

  return (
    <section className={cn('erp-subpage-grid', className)}>
      <header className="erp-subpage-grid__header">
        <h3 className="erp-subpage-grid__title">{title}</h3>
        {!readOnly ? (
          <div className="erp-subpage-grid__actions">
            {onAddLine ? (
              <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={onAddLine}>
                Add Line
              </ErpButton>
            ) : null}
            {onDuplicateLine && rows[activeIndex] ? (
              <ErpButton
                type="button"
                size="sm"
                variant="ghost"
                icon={Copy}
                onClick={() => onDuplicateLine(rows[activeIndex], activeIndex)}
              >
                Duplicate
              </ErpButton>
            ) : null}
            {onDeleteLine && rows[activeIndex] ? (
              <ErpButton
                type="button"
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={() => onDeleteLine(rows[activeIndex], activeIndex)}
              >
                Delete
              </ErpButton>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="erp-subpage-grid__table-wrap">
        <div
          className="erp-subpage-grid__head"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((col) => (
            <div
              key={col.id}
              className={cn('erp-subpage-grid__th', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}
            >
              {col.header}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="erp-subpage-grid__empty">{emptyLabel}</p>
        ) : (
          <ul className="erp-subpage-grid__body">
            {rows.map((row, index) => {
              const selected = selectedId ? row.id === selectedId : index === activeIndex
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn('erp-subpage-grid__row', selected && 'erp-subpage-grid__row--selected')}
                    style={{ gridTemplateColumns: gridTemplate }}
                    onClick={() => selectRow(row, index)}
                  >
                    {columns.map((col) => (
                      <div
                        key={col.id}
                        className={cn('erp-subpage-grid__td', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}
                      >
                        {col.cell(row, index)}
                      </div>
                    ))}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {footer ? <footer className="erp-subpage-grid__footer">{footer}</footer> : null}
    </section>
  )
}
