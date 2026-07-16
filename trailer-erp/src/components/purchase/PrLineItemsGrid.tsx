import { Trash2 } from 'lucide-react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../../components/erp/ErpSmartSelect'
import { ItemLookupSelect } from '../../components/lookups/ItemLookupSelect'
import { VendorLookupSelect } from '../../components/lookups/VendorLookupSelect'
import { ErpButton } from '../../components/erp/ErpButton'
import { Input } from '../../components/forms/Inputs'
import { formatCurrency } from '../../utils/formatters/currency'
import { resolveLocationWarehouseId } from '../../utils/locationUtils'
import { useMasterStore } from '../../store/masterStore'
import { cn } from '../../utils/cn'

export type PrLineRow = {
  key: string
  itemId: string
  itemCode?: string
  itemName?: string
  uomId?: string
  uomName?: string
  locationId: string
  warehouseId: string
  vendorId: string
  vendorCode?: string
  vendorName?: string
  qty: string
  rate: string
  requiredDate: string
  remarks: string
}

type PrLineItemsGridProps = {
  lines: PrLineRow[]
  onChange: (lines: PrLineRow[]) => void
  locationOptions: ErpSmartSelectOption<string>[]
  warehouseOptions: ErpSmartSelectOption<string>[]
  stockByItem: Map<string, number>
  readOnly?: boolean
  compact?: boolean
  onAddLine?: () => void
}

export function PrLineItemsGrid({
  lines,
  onChange,
  locationOptions,
  warehouseOptions,
  stockByItem,
  readOnly,
  compact,
}: PrLineItemsGridProps) {
  const locations = useMasterStore((s) => s.locations)
  const getItem = useMasterStore((s) => s.getItem)
  const lineTotal = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)

  function patchLine(key: string, patch: Partial<PrLineRow>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    const last = lines[lines.length - 1]
    onChange([
      ...lines,
      {
        key: crypto.randomUUID(),
        itemId: last?.itemId ?? '',
        itemCode: last?.itemCode,
        itemName: last?.itemName,
        uomId: last?.uomId,
        uomName: last?.uomName,
        locationId: last?.locationId ?? '',
        warehouseId: last?.warehouseId ?? '',
        vendorId: '',
        qty: '1',
        rate: last?.itemId ? String(getItem(last.itemId)?.standardRate ?? 0) : '0',
        requiredDate: last?.requiredDate ?? new Date().toISOString().slice(0, 10),
        remarks: '',
      },
    ])
  }

  function removeLine(key: string) {
    if (lines.length <= 1) return
    onChange(lines.filter((l) => l.key !== key))
  }

  const totalColSpan = compact ? 8 : 12

  const tableClass = cn(
    'quo-editor-price__table erp-line-items-grid__table erp-line-items-grid__table--purchase',
    compact ? 'erp-line-items-grid__table--compact' : 'erp-line-items-grid__table--full',
  )

  return (
    <div className="erp-line-items-grid">
      <div className="erp-line-items-grid__toolbar flex items-center justify-between gap-3">
        <span className="text-sm text-erp-muted">
          <strong className="text-erp-text">{lines.length}</strong> line{lines.length === 1 ? '' : 's'} · Estimated{' '}
          <strong className="text-erp-text">{formatCurrency(lineTotal)}</strong>
        </span>
        {!readOnly ? (
          <ErpButton type="button" variant="primary" size="sm" onClick={addLine}>
            + Add Line Item
          </ErpButton>
        ) : null}
      </div>
      <div className="quo-editor-price__table-wrap erp-line-items-grid__wrap erp-line-items-grid__wrap--purchase overflow-x-auto">
        <table className={tableClass}>
          <colgroup>
            <col className="col-idx" />
            <col className="col-item" />
            {!compact ? <col className="col-desc" /> : null}
            {!compact ? <col className="col-drawing" /> : null}
            {!compact ? <col className="col-rev" /> : null}
            <col className="col-qty" />
            <col className="col-uom" />
            <col className="col-warehouse" />
            <col className="col-stock" />
            <col className="col-required" />
            {!compact ? <col className="col-vendor" /> : null}
            <col className="col-rate" />
            <col className="col-amount" />
            {!readOnly ? <col className="col-action" /> : null}
          </colgroup>
          <thead>
            <tr>
              <th className="erp-line-items-grid__sticky-sr">#</th>
              <th className="erp-line-items-grid__sticky-product">Item</th>
              {!compact ? <th>Description</th> : null}
              {!compact ? <th>Drawing</th> : null}
              {!compact ? <th>Rev</th> : null}
              <th className="num">Qty</th>
              <th>UOM</th>
              <th>Location Code</th>
              <th className="num">Stock</th>
              <th>Required</th>
              {!compact ? <th>Vendor</th> : null}
              <th className="num">Rate</th>
              <th className="num">Amount</th>
              {!readOnly ? <th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const item = line.itemId ? getItem(line.itemId) : undefined
              const qty = Number(line.qty) || 0
              const rate = Number(line.rate) || 0
              const stock = stockByItem.get(line.itemId) ?? 0
              const stockLow = stock <= 0 && Boolean(line.itemId)
              const itemCode = line.itemCode ?? item?.itemCode
              const itemName = line.itemName ?? item?.itemName
              const itemTitle = itemCode ? `${itemCode} — ${itemName ?? ''}` : undefined
              return (
                <tr key={line.key}>
                  <td className="num erp-line-items-grid__cell-idx erp-line-items-grid__sticky-sr">{idx + 1}</td>
                  <td className="erp-line-items-grid__cell-item erp-line-items-grid__sticky-product" title={itemTitle}>
                    {readOnly ? (
                      <span className="erp-line-items-grid__cell-text">{itemCode ?? '—'}</span>
                    ) : (
                      <ItemLookupSelect
                        compact
                        value={line.itemId}
                        placeholder="Search item…"
                        onChange={(sel) => {
                          const master = sel ? getItem(sel.itemId) : undefined
                          patchLine(line.key, {
                            itemId: sel?.itemId ?? '',
                            itemCode: sel?.itemCode,
                            itemName: sel?.itemName,
                            uomId: sel?.uomId,
                            uomName: sel?.uomName,
                            rate: String(master?.standardRate ?? 0),
                          })
                        }}
                      />
                    )}
                  </td>
                  {!compact ? (
                    <td className="erp-line-items-grid__cell-desc" title={itemName}>
                      <span className="erp-line-items-grid__cell-text">{itemName ?? '—'}</span>
                    </td>
                  ) : null}
                  {!compact ? <td className="erp-line-items-grid__cell-text">{item?.materialGrade || '—'}</td> : null}
                  {!compact ? <td>—</td> : null}
                  <td className="erp-line-items-grid__cell-qty">
                    {readOnly ? (
                      <span className="num">{line.qty}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="erp-line-items-grid__input-num"
                        value={line.qty}
                        onChange={(e) => patchLine(line.key, { qty: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="erp-line-items-grid__cell-uom">{line.uomName ?? '—'}</td>
                  <td className="erp-line-items-grid__cell-warehouse">
                    {readOnly ? (
                      <span className="erp-line-items-grid__cell-text">
                        {locationOptions.find((w) => w.value === line.locationId)?.label ??
                          warehouseOptions.find((w) => w.value === line.warehouseId)?.label}
                      </span>
                    ) : (
                      <ErpSmartSelect
                        compact
                        options={locationOptions}
                        value={line.locationId}
                        placeholder="Location…"
                        onChange={(v) => {
                          const warehouseId = resolveLocationWarehouseId(v || '', locations) ?? ''
                          patchLine(line.key, { locationId: v || '', warehouseId })
                        }}
                      />
                    )}
                  </td>
                  <td className={stockLow ? 'num stock-low erp-line-items-grid__cell-stock' : 'num erp-line-items-grid__cell-stock'}>
                    {stock}
                  </td>
                  <td className="erp-line-items-grid__cell-required">
                    {readOnly ? (
                      line.requiredDate
                    ) : (
                      <Input
                        type="date"
                        className="erp-line-items-grid__input-date"
                        value={line.requiredDate}
                        onChange={(e) => patchLine(line.key, { requiredDate: e.target.value })}
                      />
                    )}
                  </td>
                  {!compact ? (
                    <td className="erp-line-items-grid__cell-vendor">
                      {readOnly ? (
                        <span className="erp-line-items-grid__cell-text">
                          {line.vendorName ?? line.vendorCode ?? '—'}
                        </span>
                      ) : (
                        <VendorLookupSelect
                          compact
                          allowEmpty
                          value={line.vendorId}
                          onChange={(sel) =>
                            patchLine(line.key, {
                              vendorId: sel?.vendorId ?? '',
                              vendorCode: sel?.vendorCode,
                              vendorName: sel?.vendorName,
                            })
                          }
                        />
                      )}
                    </td>
                  ) : null}
                  <td className="erp-line-items-grid__cell-rate">
                    {readOnly ? (
                      <span className="num">{formatCurrency(rate)}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="erp-line-items-grid__input-num"
                        value={line.rate}
                        onChange={(e) => patchLine(line.key, { rate: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="num font-semibold erp-line-items-grid__cell-amount">{formatCurrency(qty * rate)}</td>
                  {!readOnly ? (
                    <td className="erp-line-items-grid__cell-action">
                      <ErpButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={lines.length <= 1}
                        onClick={() => removeLine(line.key)}
                        title="Delete line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ErpButton>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-erp-surface-alt">
              <td colSpan={totalColSpan}>Total</td>
              <td className="text-right tabular-nums">{formatCurrency(lineTotal)}</td>
              {!readOnly ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
