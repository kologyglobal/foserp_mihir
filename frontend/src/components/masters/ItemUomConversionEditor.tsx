import { Plus, Trash2 } from 'lucide-react'
import { Input } from '../forms/Inputs'
import { ErpButton } from '../erp/ErpButton'
import { UomMasterSelect } from './TaxMasterSelects'
import type { ItemUomConversion } from '@/types/master'

export type ItemUomConversionRow = Omit<ItemUomConversion, 'id' | 'uomCode' | 'uomName'> & {
  id?: string
  uomCode?: string
}

type Props = {
  baseUomId: string
  baseUomCode: string
  rows: ItemUomConversionRow[]
  onChange: (rows: ItemUomConversionRow[]) => void
  uomCodeOf: (uomId: string) => string
}

function ensureBaseRow(baseUomId: string, rows: ItemUomConversionRow[]): ItemUomConversionRow[] {
  if (rows.some((r) => r.uomId === baseUomId)) {
    return rows.map((r) =>
      r.uomId === baseUomId ? { ...r, conversionFactor: 1, isPurchaseAllowed: r.isPurchaseAllowed !== false } : r,
    )
  }
  return [
    {
      uomId: baseUomId,
      conversionFactor: 1,
      isPurchaseAllowed: true,
      isDefaultPurchase: rows.every((r) => !r.isDefaultPurchase),
    },
    ...rows,
  ]
}

/** Item Master — multiple purchase UOM mappings per item (base UOM + alternates). */
export function ItemUomConversionEditor({
  baseUomId,
  baseUomCode,
  rows,
  onChange,
  uomCodeOf,
}: Props) {
  const list = ensureBaseRow(baseUomId, rows)

  const patch = (index: number, patchRow: Partial<ItemUomConversionRow>) => {
    const next = list.map((row, i) => (i === index ? { ...row, ...patchRow } : row))
    onChange(next)
  }

  const setDefault = (index: number) => {
    onChange(
      list.map((row, i) => ({
        ...row,
        isDefaultPurchase: i === index && row.isPurchaseAllowed !== false,
      })),
    )
  }

  const addRow = () => {
    onChange([
      ...list,
      {
        uomId: '',
        conversionFactor: 1,
        isPurchaseAllowed: true,
        isDefaultPurchase: false,
      },
    ])
  }

  const removeRow = (index: number) => {
    const row = list[index]
    if (!row || row.uomId === baseUomId) return
    const next = list.filter((_, i) => i !== index)
    if (!next.some((r) => r.isDefaultPurchase && r.isPurchaseAllowed !== false)) {
      const firstPurchase = next.find((r) => r.isPurchaseAllowed !== false)
      if (firstPurchase) firstPurchase.isDefaultPurchase = true
    }
    onChange(next)
  }

  return (
    <div className="md:col-span-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-erp-text">UOM conversions (purchase)</p>
          <p className="text-[11px] text-erp-muted">
            Stock is always tracked in base UOM ({baseUomCode}). Add alternate vendor units for PO / GRN.
          </p>
        </div>
        <ErpButton type="button" variant="secondary" size="sm" icon={Plus} onClick={addRow}>
          Add UOM
        </ErpButton>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-erp-border text-[11px] uppercase tracking-wide text-erp-muted">
              <th className="px-2 py-2 font-medium">UOM</th>
              <th className="px-2 py-2 font-medium">Factor (per 1 {baseUomCode})</th>
              <th className="px-2 py-2 font-medium">Purchase</th>
              <th className="px-2 py-2 font-medium">Default</th>
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {list.map((row, index) => {
              const isBase = row.uomId === baseUomId
              const code = row.uomCode || uomCodeOf(row.uomId) || '—'
              return (
                <tr key={`${row.uomId || 'new'}-${index}`} className="border-b border-erp-border/60">
                  <td className="px-2 py-2 align-top">
                    {isBase ? (
                      <Input readOnly value={baseUomCode} className="font-mono uppercase" />
                    ) : (
                      <UomMasterSelect
                        value={row.uomId}
                        onChange={(uomId) =>
                          patch(index, {
                            uomId,
                            conversionFactor: uomId === baseUomId ? 1 : row.conversionFactor,
                          })
                        }
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <Input
                      type="number"
                      step="0.001"
                      min={0.001}
                      disabled={isBase}
                      value={isBase ? 1 : row.conversionFactor}
                      onChange={(e) =>
                        patch(index, { conversionFactor: Number(e.target.value) || 1 })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.isPurchaseAllowed !== false}
                        disabled={isBase}
                        onChange={(e) =>
                          patch(index, {
                            isPurchaseAllowed: e.target.checked,
                            isDefaultPurchase: e.target.checked ? row.isDefaultPurchase : false,
                          })
                        }
                      />
                      <span>Allowed</span>
                    </label>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      type="radio"
                      name="defaultPurchaseUom"
                      checked={Boolean(row.isDefaultPurchase)}
                      disabled={row.isPurchaseAllowed === false}
                      onChange={() => setDefault(index)}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    {!isBase ? (
                      <button
                        type="button"
                        className="text-erp-muted hover:text-red-600"
                        aria-label={`Remove ${code}`}
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-erp-muted">
        Example: factor 3 on MTR with base NOS means 30 MTR received → 10 NOS in inventory. FIFO/costing uses base qty.
      </p>
    </div>
  )
}

/** Build API payload rows from legacy single purchase UOM fields. */
export function legacyPurchaseFieldsToConversions(input: {
  baseUomId: string
  purchaseUomId?: string | null
  uomConversionFactor?: number
}): ItemUomConversionRow[] {
  const purchase =
    input.purchaseUomId && input.purchaseUomId !== input.baseUomId ? input.purchaseUomId : null
  const factor = Number(input.uomConversionFactor ?? 1) || 1
  const rows: ItemUomConversionRow[] = [
    {
      uomId: input.baseUomId,
      conversionFactor: 1,
      isPurchaseAllowed: true,
      isDefaultPurchase: !purchase,
    },
  ]
  if (purchase) {
    rows.push({
      uomId: purchase,
      conversionFactor: factor,
      isPurchaseAllowed: true,
      isDefaultPurchase: true,
    })
  }
  return rows
}

/** Map API item to editor rows. */
export function itemToUomConversionRows(item: {
  baseUomId: string
  purchaseUomId?: string | null
  uomConversionFactor?: number
  uomConversions?: ItemUomConversion[]
}): ItemUomConversionRow[] {
  if (item.uomConversions?.length) {
    return item.uomConversions.map((r) => ({
      id: r.id,
      uomId: r.uomId,
      uomCode: r.uomCode,
      conversionFactor: r.conversionFactor,
      isPurchaseAllowed: r.isPurchaseAllowed,
      isDefaultPurchase: r.isDefaultPurchase,
    }))
  }
  return legacyPurchaseFieldsToConversions(item)
}
