import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '../../utils/cn'
import { PURCHASE_ITEM_CATEGORY_LABELS, type PurchaseItem } from '@/types/purchaseDomain'
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
  catalogItems: PurchaseItemCodeCatalogOption[]
  disabled?: boolean
  /** Match surrounding grid density (`text-[12px]` PR, `text-[11px]` PO). */
  textClassName?: string
  onSelectItem: (itemId: string) => void
  onClearCatalog: () => void
  onManualCodeChange: (code: string) => void
}

function stockFor(item: PurchaseItemCodeCatalogOption): number | null {
  if (item.availableStock != null) return item.availableStock
  if (!item.isStockable) return null
  return Math.max(0, Math.round(item.reorderLevel * 1.4))
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
  catalogItems,
  disabled,
  textClassName = 'text-[12px]',
  onSelectItem,
  onClearCatalog,
  onManualCodeChange,
}: PurchaseItemCodeCellProps) {
  const selected = catalogItems.find((i) => i.id === itemId)
  const [forceManual, setForceManual] = useState(() => !itemId && Boolean(itemCode.trim()))
  const isManual = Boolean(forceManual || (!itemId && itemCode.trim()))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (itemId) setForceManual(false)
    else if (itemCode.trim()) setForceManual(true)
  }, [itemId, itemCode])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalogItems
    return catalogItems.filter((item) => {
      const vendor = item.preferredVendorName ?? ''
      const cat = PURCHASE_ITEM_CATEGORY_LABELS[item.category] ?? item.category
      return (
        item.itemCode.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        vendor.toLowerCase().includes(q)
      )
    })
  }, [catalogItems, query])

  const positionDropdown = useCallback(() => {
    if (!rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    // Wide enough for Item Code → Pref. Vendor without horizontal scroll
    const preferredWidth = 900
    const width = Math.min(preferredWidth, window.innerWidth - 16)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    left = Math.max(8, left)
    const estimatedHeight = Math.min(360, window.innerHeight - 24)
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const placeAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow
    const top = placeAbove
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 4
    setDropdownStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight: estimatedHeight,
      zIndex: 10050,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    positionDropdown()
    window.addEventListener('scroll', positionDropdown, true)
    window.addEventListener('resize', positionDropdown)
    return () => {
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

  const triggerLabel = selected?.itemCode || (isManual && itemCode ? itemCode : 'Select item…')

  return (
    <div ref={rootRef} className="relative flex min-w-[9.5rem] max-w-[14rem] flex-col gap-1">
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'erp-input flex h-8 w-full min-w-0 items-center justify-between gap-1 px-2 font-mono',
          textClassName,
          !selected && !itemCode && 'text-erp-muted',
          open && 'ring-2 ring-erp-primary/30',
        )}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected ? `${selected.itemCode} — ${selected.itemName}` : 'Pick catalog item or enter code'}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-erp-muted" aria-hidden />
      </button>
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

      {open
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
                  placeholder="Search code, name, category, vendor…"
                  aria-label="Filter catalog items"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed border-collapse text-left text-[11px]">
                  <colgroup>
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '16%' }} />
                  </colgroup>
                  <thead className="sticky top-0 z-[1] bg-erp-surface-alt">
                    <tr className="text-[10px] uppercase tracking-wide text-erp-muted">
                      <th className="px-2.5 py-1.5 font-semibold">Item Code</th>
                      <th className="px-2.5 py-1.5 font-semibold">Item Name</th>
                      <th className="px-2.5 py-1.5 font-semibold">Category</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Stock</th>
                      <th className="px-2.5 py-1.5 font-semibold">UOM</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Last Rate</th>
                      <th className="px-2.5 py-1.5 font-semibold">Pref. Vendor</th>
                    </tr>
                  </thead>
                  <tbody>
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
                      <td colSpan={7} className="px-2.5 py-2 italic text-erp-muted">
                        Manual entry (clear catalog)
                      </td>
                    </tr>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2.5 py-3 text-center text-erp-muted">
                          No matching items
                        </td>
                      </tr>
                    ) : (
                      filtered.map((item) => {
                        const stock = stockFor(item)
                        const lastRate = lastRateFor(item)
                        const categoryLabel = PURCHASE_ITEM_CATEGORY_LABELS[item.category] ?? item.category
                        const vendorLabel = item.preferredVendorName || '—'
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
                            <td className="truncate px-2.5 py-1.5 font-mono font-medium" title={item.itemCode}>
                              {item.itemCode}
                            </td>
                            <td className="truncate px-2.5 py-1.5" title={item.itemName}>
                              {item.itemName}
                            </td>
                            <td className="truncate px-2.5 py-1.5 text-erp-muted" title={categoryLabel}>
                              {categoryLabel}
                            </td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums">
                              {stock == null ? '—' : stock}
                            </td>
                            <td className="truncate px-2.5 py-1.5">{item.uom}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {formatCurrency(lastRate)}
                            </td>
                            <td className="truncate px-2.5 py-1.5 text-erp-muted" title={vendorLabel}>
                              {vendorLabel}
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
