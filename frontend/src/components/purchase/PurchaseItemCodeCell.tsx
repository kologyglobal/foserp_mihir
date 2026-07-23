import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '../../utils/cn'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { type PurchaseItem } from '@/types/purchaseDomain'
import { ENGINEERING_PRODUCT_TYPE_LABELS } from '@/types/taxMaster'
import { formatCurrency } from '@/utils/formatters/currency'

export type PurchaseItemCodeCatalogOption = PurchaseItem & {
  /** Resolved preferred vendor display name (optional). */
  preferredVendorName?: string | null
  /** Available stock for picker display (optional — falls back to reorder proxy). */
  availableStock?: number | null
  /** Last purchase rate for picker display (optional — falls back to standardRate). */
  lastPurchaseRate?: number | null
}

export type PurchaseItemCodeCellProps = {
  itemId: string
  itemCode: string
  /** Optional name for closed-state label when `labelMode` is `name`. */
  itemName?: string
  catalogItems: PurchaseItemCodeCatalogOption[]
  disabled?: boolean
  /** Match surrounding grid density (`text-[12px]` PR, `text-[11px]` PO). */
  textClassName?: string
  /** Closed trigger shows item name (PR) or item code (PO default). */
  labelMode?: 'code' | 'name'
  /** When false, hide manual code entry (catalog pick only). Default true. */
  allowManual?: boolean
  onSelectItem: (itemId: string) => void
  onClearCatalog: () => void
  onManualCodeChange: (code: string) => void
}

function lastRateFor(item: PurchaseItemCodeCatalogOption): number {
  return item.lastPurchaseRate ?? item.standardRate
}

/**
 * Dense Item Code cell: catalog picker (portaled so table overflow cannot clip it)
 * + optional manual code only after the user chooses manual entry.
 */
export function PurchaseItemCodeCell({
  itemId,
  itemCode,
  itemName,
  catalogItems,
  disabled,
  textClassName = 'text-[12px]',
  labelMode = 'code',
  allowManual = true,
  onSelectItem,
  onClearCatalog,
  onManualCodeChange,
}: PurchaseItemCodeCellProps) {
  const selected = catalogItems.find((i) => i.id === itemId)
  const [forceManual, setForceManual] = useState(() => !itemId && Boolean(itemCode.trim()))
  const isManual = Boolean(allowManual && (forceManual || (!itemId && itemCode.trim())))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (itemId) setForceManual(false)
    else if (allowManual && itemCode.trim()) setForceManual(true)
  }, [itemId, itemCode, allowManual])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalogItems
    return catalogItems.filter((item) => {
      const productTypeLabel = item.productType
        ? ENGINEERING_PRODUCT_TYPE_LABELS[item.productType]
        : ''
      return (
        item.itemCode.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        productTypeLabel.toLowerCase().includes(q) ||
        (item.productType ?? '').toLowerCase().includes(q)
      )
    })
  }, [catalogItems, query])

  const positionDropdown = useCallback(() => {
    const el = triggerRef.current ?? rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return

    const preferredWidth = 720
    const width = Math.min(preferredWidth, window.innerWidth - 16)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    left = Math.max(8, left)

    const gap = 4
    const maxH = Math.min(360, Math.max(160, window.innerHeight - 24))
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const placeAbove = spaceBelow < Math.min(240, maxH) && spaceAbove > spaceBelow
    const maxHeight = Math.min(maxH, placeAbove ? spaceAbove - gap : spaceBelow - gap)
    const top = placeAbove
      ? Math.max(8, rect.top - maxHeight - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - Math.max(120, maxHeight) - 8)

    setDropdownStyle({
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      maxHeight: `${Math.round(Math.max(120, maxHeight))}px`,
      zIndex: 10050,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setDropdownStyle(null)
      return
    }
    positionDropdown()
    const raf = window.requestAnimationFrame(() => positionDropdown())
    window.addEventListener('scroll', positionDropdown, true)
    window.addEventListener('resize', positionDropdown)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', positionDropdown, true)
      window.removeEventListener('resize', positionDropdown)
    }
  }, [open, positionDropdown, filtered.length])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open])

  const triggerLabel =
    labelMode === 'name'
      ? selected?.itemName || itemName?.trim() || (isManual && itemCode ? itemCode : SELECT_PLACEHOLDER)
      : selected?.itemCode || (isManual && itemCode ? itemCode : SELECT_PLACEHOLDER)
  const isEmpty = !selected && !(isManual && itemCode.trim()) && !itemName?.trim()

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex flex-col gap-1',
        labelMode === 'name' ? 'min-w-[14rem] max-w-[22rem]' : 'min-w-[9.5rem] max-w-[14rem]',
      )}
    >
      <div className="erp-select-wrap w-full">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            'erp-input erp-select flex h-8 w-full min-w-0 items-center text-left',
            labelMode === 'code' && 'font-mono',
            textClassName,
            isEmpty && 'text-erp-muted',
            open && 'ring-2 ring-erp-primary/30',
          )}
          onClick={() => !disabled && setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={selected ? `${selected.itemCode} — ${selected.itemName}` : 'Pick catalog item'}
        >
          <span className="truncate">{triggerLabel}</span>
        </button>
        <ChevronDown className="erp-select-chevron pointer-events-none h-4 w-4" aria-hidden />
      </div>
      {isManual ? (
        <input
          className={cn('erp-input h-8 w-full font-mono', textClassName)}
          disabled={disabled}
          value={itemCode}
          onChange={(e) => onManualCodeChange(e.target.value)}
          placeholder="Manual code"
          aria-label="Manual item code"
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}

      {open && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              className="flex flex-col overflow-hidden rounded-md border border-erp-border bg-white shadow-xl"
              style={dropdownStyle}
              role="listbox"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-erp-border bg-erp-surface-alt px-2.5 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-erp-muted" aria-hidden />
                <input
                  ref={searchRef}
                  className={cn('h-7 min-w-0 flex-1 border-0 bg-transparent outline-none', textClassName)}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, code, product type…"
                  aria-label="Filter catalog items"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed border-collapse text-left text-[11px]">
                  <colgroup>
                    {labelMode === 'name' ? (
                      <>
                        <col style={{ width: '55%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '30%' }} />
                      </>
                    ) : (
                      <>
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '20%' }} />
                      </>
                    )}
                  </colgroup>
                  <thead className="sticky top-0 z-[1] bg-erp-surface-alt">
                    <tr className="text-[10px] uppercase tracking-wide text-erp-muted">
                      {labelMode === 'name' ? (
                        <th className="px-2.5 py-1.5 font-semibold">Item</th>
                      ) : (
                        <>
                          <th className="px-2.5 py-1.5 font-semibold">Item Code</th>
                          <th className="px-2.5 py-1.5 font-semibold">Item Name</th>
                        </>
                      )}
                      <th className="px-2.5 py-1.5 font-semibold">UOM</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Last Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowManual ? (
                      <tr
                        className="cursor-pointer border-t border-erp-border hover:bg-erp-surface-alt"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setForceManual(true)
                          onClearCatalog()
                          setOpen(false)
                          setQuery('')
                        }}
                      >
                        <td colSpan={labelMode === 'name' ? 3 : 4} className="px-2.5 py-2 italic text-erp-muted">
                          Manual entry (clear catalog)
                        </td>
                      </tr>
                    ) : null}
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={labelMode === 'name' ? 3 : 4}
                          className="px-2.5 py-3 text-center text-erp-muted"
                        >
                          No matching items
                        </td>
                      </tr>
                    ) : (
                      filtered.map((item) => {
                        const lastRate = lastRateFor(item)
                        return (
                          <tr
                            key={item.id}
                            role="option"
                            aria-selected={item.id === itemId}
                            className={cn(
                              'cursor-pointer border-t border-erp-border hover:bg-sky-50',
                              item.id === itemId && 'bg-sky-50/80',
                            )}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setForceManual(false)
                              onSelectItem(item.id)
                              setOpen(false)
                              setQuery('')
                            }}
                          >
                            {labelMode === 'name' ? (
                              <td className="truncate px-2.5 py-1.5 font-medium" title={item.itemName}>
                                {item.itemName}
                              </td>
                            ) : (
                              <>
                                <td className="truncate px-2.5 py-1.5 font-mono font-medium" title={item.itemCode}>
                                  {item.itemCode}
                                </td>
                                <td className="truncate px-2.5 py-1.5" title={item.itemName}>
                                  {item.itemName}
                                </td>
                              </>
                            )}
                            <td className="truncate px-2.5 py-1.5">{item.uom}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {formatCurrency(lastRate)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
