import { useEffect, useMemo, useRef, useState } from 'react'
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
 * Dense Item Code cell: single-row seamless catalog picker (rich options) +
 * optional manual code when no catalog item is selected. Never stacks controls.
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
  const isManual = !itemId
  const selected = catalogItems.find((i) => i.id === itemId)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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
    <div ref={rootRef} className="relative flex min-w-[10rem] items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'erp-input flex h-8 min-w-[8.5rem] flex-1 items-center justify-between gap-1 px-2 font-mono',
          textClassName,
          !selected && !itemCode && 'text-erp-muted',
        )}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected ? `${selected.itemCode} — ${selected.itemName}` : 'Pick catalog item or enter code'}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-erp-muted" />
      </button>
      {isManual ? (
        <input
          className={cn('erp-input h-8 w-24 shrink-0 font-mono', textClassName)}
          disabled={disabled}
          value={itemCode}
          onChange={(e) => onManualCodeChange(e.target.value)}
          placeholder="Code"
          aria-label="Manual item code"
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}

      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-erp-border bg-white shadow-lg"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b border-erp-border px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-erp-muted" />
            <input
              ref={searchRef}
              className={cn('h-7 w-full border-0 bg-transparent outline-none', textClassName)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, name, category, vendor…"
              aria-label="Filter catalog items"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="sticky top-0 bg-erp-surface-alt">
                <tr className="text-[10px] uppercase tracking-wide text-erp-muted">
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Item Code</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Item Name</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Category</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Stock</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">UOM</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Last Rate</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Pref. Vendor</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className="cursor-pointer border-t border-erp-border hover:bg-erp-surface-alt"
                  onClick={() => {
                    onClearCatalog()
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <td colSpan={7} className="px-2 py-1.5 italic text-erp-muted">
                    Manual entry (clear catalog)
                  </td>
                </tr>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-center text-erp-muted">
                      No matching items
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const stock = stockFor(item)
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
                        onClick={() => {
                          onSelectItem(item.id)
                          setOpen(false)
                          setQuery('')
                        }}
                      >
                        <td className="whitespace-nowrap px-2 py-1.5 font-mono font-medium">{item.itemCode}</td>
                        <td className="max-w-[10rem] truncate px-2 py-1.5" title={item.itemName}>
                          {item.itemName}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-erp-muted">
                          {PURCHASE_ITEM_CATEGORY_LABELS[item.category] ?? item.category}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                          {stock == null ? '—' : stock}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5">{item.uom}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                          {formatCurrency(lastRate)}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-1.5 text-erp-muted">
                          {item.preferredVendorName || '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
