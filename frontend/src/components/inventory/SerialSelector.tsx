import { useEffect, useMemo, useState } from 'react'
import { getAvailableSerials } from '@/services/inventory/traceabilityService'
import { listInventorySerials } from '@/services/api/inventoryApi'
import { isApiMode } from '@/config/apiConfig'
import type { InventorySerialRecord } from '@/types/inventoryDomain'
import { SERIAL_STATUS_LABELS } from '@/utils/inventoryTraceabilityLabels'
import { cn } from '@/utils/cn'

export interface SerialSelectorProps {
  itemId: string
  warehouseId: string
  requiredQty: number
  value: string[]
  onChange: (serialNos: string[]) => void
  sourceDocumentNo?: string
  disabled?: boolean
}

export function SerialSelector({
  itemId,
  warehouseId,
  requiredQty,
  value,
  onChange,
  sourceDocumentNo,
  disabled = false,
}: SerialSelectorProps) {
  const [serials, setSerials] = useState<InventorySerialRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!itemId || !warehouseId) {
      setSerials([])
      return
    }
    let cancelled = false
    setLoading(true)
    const request = isApiMode()
      ? listInventorySerials({
          itemId,
          warehouseId,
          search: search || undefined,
          status: 'AVAILABLE',
          limit: 100,
        }).then((res) => res.data.map((serial) => ({
          id: serial.id,
          serialNo: serial.serialNumber,
          itemId: serial.itemId,
          itemCode: '',
          itemName: '',
          warehouseId: serial.warehouseId ?? warehouseId,
          warehouseName: '',
          status: 'available' as const,
          sourceDocumentType: null,
          sourceDocumentNo: serial.sourceReferenceNo ?? null,
          receiptDate: null,
        })))
      : getAvailableSerials(itemId, warehouseId, {
          search: search || undefined,
          sourceDocumentNo: sourceDocumentNo || undefined,
          status: 'available',
        })
    request
      .then((rows) => {
        if (!cancelled) setSerials(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [itemId, warehouseId, search, sourceDocumentNo])

  const countMatch = value.length === requiredQty
  const filtered = useMemo(() => {
    if (!search) return serials
    const q = search.toLowerCase()
    return serials.filter((s) => s.serialNo.toLowerCase().includes(q))
  }, [serials, search])

  function toggle(serialNo: string) {
    if (disabled) return
    if (value.includes(serialNo)) {
      onChange(value.filter((s) => s !== serialNo))
    } else if (value.length < requiredQty) {
      onChange([...value, serialNo])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          className="erp-input h-8 flex-1 text-[12px]"
          placeholder="Search serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />
        <span className={cn(
          'shrink-0 text-[11px] font-medium',
          countMatch ? 'text-emerald-700' : 'text-amber-700',
        )}
        >
          {value.length} / {requiredQty} selected
        </span>
      </div>
      {loading ? <p className="text-[12px] text-erp-muted">Loading serials…</p> : null}
      {!loading && filtered.length === 0 ? (
        <p className="text-[12px] text-erp-muted">No available serial numbers.</p>
      ) : null}
      <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-erp-border p-2">
        {filtered.map((s) => {
          const selected = value.includes(s.serialNo)
          return (
            <label
              key={s.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-erp-bg-subtle',
                selected && 'bg-erp-primary/5',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled || (!selected && value.length >= requiredQty)}
                onChange={() => toggle(s.serialNo)}
              />
              <span className="font-mono">{s.serialNo}</span>
              <span className="text-erp-muted">{SERIAL_STATUS_LABELS[s.status]}</span>
              {s.sourceDocumentNo ? (
                <span className="ml-auto text-[11px] text-erp-muted">{s.sourceDocumentNo}</span>
              ) : null}
            </label>
          )
        })}
      </div>
      {!countMatch && requiredQty > 0 ? (
        <p className="text-[11px] text-amber-700">
          Serial count must equal transaction quantity ({requiredQty}).
        </p>
      ) : null}
    </div>
  )
}
