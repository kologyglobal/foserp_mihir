import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MoreHorizontal, Package, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PurchaseTableToolbar } from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { PurchaseDocumentLineCards } from '@/components/purchase/PurchaseDocumentLineCards'
import { QuickManualLineDrawer } from '@/components/purchase/QuickManualLineDrawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { CommandBarOverflowMenu } from '@/components/ui/CommandBar'
import { MQ_BELOW_LG, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/utils/cn'
import { filterPurchaseCatalogByProductType, resolveCatalogItemProductType } from '@/utils/purchaseCatalogFilter'
import {
  mapEngineeringProductTypeToPurchaseCategory,
} from '@/utils/purchaseProductType'
import { getPurchaseLineUomOptions } from '@/utils/purchaseLineUom'
import { PurchaseLineQtyCell } from '@/components/purchase/PurchaseLineQtyCell'
import { PurchaseLineTrackingQtyCell } from '@/components/purchase/PurchaseLineTrackingQtyCell'
import {
  ENGINEERING_PRODUCT_TYPES,
  ENGINEERING_PRODUCT_TYPE_LABELS,
  type EngineeringProductType,
} from '@/types/taxMaster'
import type { PurchaseOrderLine } from '@/types/purchaseDomain'
import { useMasterStore } from '@/store/masterStore'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'

export type PoLinesEditorLine = PurchaseOrderLine & {
  key: string
  /** Client-only free-text / Quick New Item flag from PO editor. */
  manualEntry?: boolean
}

export type PurchaseOrderLinesToolbarAction = {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
}

export type LinePatch = Partial<PurchaseOrderLine> & { manualEntry?: boolean }

export type PurchaseOrderLinesTableProps = {
  lines: PoLinesEditorLine[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  warehouseOptions: Array<{ id: string; name: string }>
  binOptions?: Array<{ id: string; code: string; name: string }>
  qualityTestGroupOptions?: Array<{ code: string; label: string }>
  editable: boolean
  isInterstate: boolean
  dirty?: boolean
  formatCurrency: (n: number) => string
  onAddLine: () => void
  /**
   * Enables + Quick New Item. Prefer onCreateQuickLine so the drawer save
   * appends a complete free-text line; bare onAddQuickLine is legacy fallback.
   */
  onAddQuickLine?: () => void
  /** Append free-text line from Quick Manual Entry drawer (itemId null, HSN snapshots). */
  onCreateQuickLine?: (patch: LinePatch) => void
  onPatchLine: (key: string, patch: LinePatch) => void
  onRemoveLine: (key: string) => void
  onSelectCatalogItem: (key: string, itemId: string) => void
  /** When true, incomplete cells use error styling + messages instead of soft amber peek */
  showErrors?: boolean
  lineErrors?: Record<string, string>
  /** Secondary line tooling (Copy / Import / Clear) — collapses under More below lg */
  secondaryActions?: PurchaseOrderLinesToolbarAction[]
  toolbarExtra?: ReactNode
}

const QUICK_CREATE_INITIAL: Partial<PurchaseOrderLine> = {
  lineType: 'GOODS',
  itemType: 'raw_material',
  category: 'raw_material',
  productType: '',
  itemId: '',
  itemCode: '',
  itemName: '',
  description: '',
  hsnCode: '',
  sacCode: null,
  hsnId: null,
  uom: 'NOS',
  uomQuantity: 1,
  quantity: 1,
  rate: 0,
}

function isFreeTextLine(line: PoLinesEditorLine) {
  if (line.itemId) return false
  if (line.manualEntry) return true
  return Boolean(
    line.itemName?.trim() ||
      line.itemCode?.trim() ||
      line.hsnCode?.trim() ||
      line.hsnId ||
      line.sacCode?.trim(),
  )
}

function lineGoodsService(line: PoLinesEditorLine): 'GOODS' | 'SERVICE' {
  return line.lineType === 'SERVICE' || line.itemType === 'service' ? 'SERVICE' : 'GOODS'
}

function missingMandatory(line: PoLinesEditorLine) {
  const freeText = isFreeTextLine(line)
  const missingItem = freeText
    ? !line.itemName.trim()
    : !line.itemId && !line.itemCode.trim()
  const missingQty = !(Number(line.uomQuantity ?? line.quantity) > 0)
  const missingRate = !(Number(line.rate) > 0)
  const missingHsn =
    freeText && !(line.hsnId || line.hsnCode?.trim() || line.sacCode?.trim())
  const started = Boolean(
    line.productType ||
      line.itemId ||
      line.itemCode.trim() ||
      line.itemName.trim() ||
      line.hsnCode?.trim() ||
      line.hsnId ||
      Number(line.rate) > 0 ||
      Number(line.uomQuantity ?? line.quantity) > 0,
  )
  return {
    missingItem,
    missingQty,
    missingRate,
    missingHsn,
    any: started && (missingItem || missingQty || missingRate || missingHsn),
  }
}

function focusNextCell(e: KeyboardEvent<HTMLElement>, advanceRow = false) {
  const cell = e.currentTarget.closest('td')
  const row = cell?.closest('tr')
  const tbody = row?.closest('tbody')
  if (!cell || !row || !tbody) return

  const focusable = (el: Element | null | undefined) =>
    el?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), button:not([disabled])')

  if (advanceRow) {
    const nextRow = row.nextElementSibling as HTMLTableRowElement | null
    const sameIndex = Array.from(row.children).indexOf(cell)
    const nextCell = nextRow?.children[sameIndex]
    const target = focusable(nextCell)
    if (target) {
      e.preventDefault()
      target.focus()
      if (target instanceof HTMLInputElement) target.select?.()
    }
    return
  }

  let next: Element | null = cell.nextElementSibling
  while (next) {
    const target = focusable(next)
    if (target) {
      e.preventDefault()
      target.focus()
      if (target instanceof HTMLInputElement) target.select?.()
      return
    }
    next = next.nextElementSibling
  }
  const nextRow = row.nextElementSibling as HTMLTableRowElement | null
  const first = focusable(nextRow?.querySelector('td'))
  if (first) {
    e.preventDefault()
    first.focus()
    if (first instanceof HTMLInputElement) first.select?.()
  }
}

function onCellKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (e.key === 'Enter') {
    focusNextCell(e, true)
  } else if (e.key === 'Tab' && !e.shiftKey) {
    // Allow native Tab; enhance when at actionable end via default browser path.
  }
}

/**
 * PO Item Lines grid — primary visible columns, sticky Line/Item columns,
 * sticky header, totals footer. Blank seed rows are ignored until filled.
 */
export function PurchaseOrderLinesTable({
  lines,
  catalogItems,
  warehouseOptions: _warehouseOptions,
  binOptions = [],
  qualityTestGroupOptions = [],
  editable,
  isInterstate,
  dirty,
  formatCurrency,
  onAddLine,
  onAddQuickLine,
  onCreateQuickLine,
  onPatchLine,
  onRemoveLine,
  onSelectCatalogItem,
  showErrors = false,
  lineErrors = {},
  secondaryActions = [],
  toolbarExtra,
}: PurchaseOrderLinesTableProps) {
  const collapseSecondary = useMediaQuery(MQ_BELOW_LG)
  const gstGroups = useMasterStore((s) => s.gstGroups)
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const getHsn = useMasterStore((s) => s.getHsn)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [drawerKey, setDrawerKey] = useState<string | null>(null)

  const quickLineEnabled = Boolean(onCreateQuickLine || onAddQuickLine)

  const openQuickCreate = () => {
    setDrawerMode('create')
    setDrawerKey(null)
    setDrawerOpen(true)
  }

  const openQuickEdit = (key: string) => {
    setDrawerMode('edit')
    setDrawerKey(key)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerKey(null)
  }

  const drawerLine = drawerKey ? lines.find((l) => l.key === drawerKey) : null
  const initialForDrawer =
    drawerMode === 'edit' && drawerLine ? drawerLine : QUICK_CREATE_INITIAL

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => ({
        qty: acc.qty + (Number(l.quantity) || 0),
        taxable: acc.taxable + (Number(l.taxableAmount) || 0),
        tax: acc.tax + (Number(l.taxAmount) || 0),
        cgst: acc.cgst + (Number(l.cgst) || 0),
        sgst: acc.sgst + (Number(l.sgst) || 0),
        igst: acc.igst + (Number(l.igst) || 0),
        lineTotal: acc.lineTotal + (Number(l.lineTotal) || 0),
      }),
      { qty: 0, taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0, lineTotal: 0 },
    )
  }, [lines])

  const catalogForLine = (
    productType: EngineeringProductType | '' | null | undefined,
    selectedItemId?: string,
  ) => {
    const filtered = filterPurchaseCatalogByProductType(catalogItems, productType)
    if (!selectedItemId) return filtered
    if (filtered.some((i) => i.id === selectedItemId)) return filtered
    const selected = catalogItems.find((i) => i.id === selectedItemId)
    return selected ? [selected, ...filtered] : filtered
  }

  const setRowProductType = (line: PoLinesEditorLine, productType: EngineeringProductType | '') => {
    const category = mapEngineeringProductTypeToPurchaseCategory(productType)
    if (!productType) {
      onPatchLine(line.key, {
        productType: '',
        category: 'raw_material',
        itemId: '',
        itemCode: '',
        itemName: '',
        description: '',
        uomId: null,
        uom: 'NOS',
        hsnCode: '',
        sacCode: null,
        rate: 0,
        quantity: 0,
        uomQuantity: 0,
      })
      return
    }
    const matched = line.itemId
      ? catalogItems.find(
          (i) =>
            i.id === line.itemId && resolveCatalogItemProductType(i) === productType,
        )
      : undefined
    if (matched) {
      onPatchLine(line.key, {
        productType,
        category: category || line.category,
      })
      return
    }
    onPatchLine(line.key, {
      productType,
      category: category || 'raw_material',
      itemId: '',
      itemCode: '',
      itemName: '',
      description: '',
      uomId: null,
      uom: 'NOS',
      hsnCode: '',
      sacCode: null,
      rate: 0,
      quantity: 0,
      uomQuantity: 0,
    })
  }

  const secondaryOverflow = secondaryActions.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon ?? MoreHorizontal,
    onClick: a.onClick,
    disabled: a.disabled,
    disabledReason: a.disabledReason,
  }))

  return (
    <>
      <PurchaseTableToolbar>
        <ErpButton
          type="button"
          size="sm"
          variant="secondary"
          icon={Plus}
          disabled={!editable}
          onClick={onAddLine}
        >
          Add Line
        </ErpButton>
        {quickLineEnabled ? (
          <ErpButton
            type="button"
            size="sm"
            variant="secondary"
            icon={Plus}
            disabled={!editable}
            onClick={openQuickCreate}
            title="Free-text goods or service without Item Master"
          >
            Quick New Item
          </ErpButton>
        ) : null}
        {collapseSecondary ? (
          secondaryOverflow.length > 0 ? (
            <CommandBarOverflowMenu actions={secondaryOverflow} label="More actions" />
          ) : null
        ) : (
          secondaryActions.map((action) => {
            const Icon = action.icon
            return (
              <ErpButton
                key={action.id}
                type="button"
                size="sm"
                variant="outline"
                icon={Icon}
                disabled={action.disabled}
                title={action.disabled ? action.disabledReason : undefined}
                onClick={action.onClick}
              >
                {action.label}
              </ErpButton>
            )
          })
        )}
        {toolbarExtra}
        <span className="ml-auto text-[12px] tabular-nums text-erp-muted">
          {lines.length} line(s) · Total {formatCurrency(totals.lineTotal)}
          {dirty ? ' · Unsaved' : ''}
        </span>
      </PurchaseTableToolbar>

      {lines.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No item lines yet"
          description="Add Item Master lines or Quick New Item free-text goods/services."
          className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 py-12"
          action={
            editable ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={onAddLine}>
                  Add Line
                </ErpButton>
                {quickLineEnabled ? (
                  <ErpButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={openQuickCreate}
                  >
                    Quick New Item
                  </ErpButton>
                ) : null}
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: expandable item cards — avoid 15-col horizontal scroll as primary UX */}
          <div className="md:hidden">
            <PurchaseDocumentLineCards
              lines={lines}
              catalogItems={catalogItems}
              editable={editable}
              formatCurrency={formatCurrency}
              onPatchLine={onPatchLine}
              onRemoveLine={onRemoveLine}
              onSelectCatalogItem={onSelectCatalogItem}
              onSetProductType={setRowProductType}
              requireOneLine={false}
            />
          </div>

          {/* Tablet / desktop: grid table — scroll lives on this wrapper only */}
          <div className="purchase-doc-lines-grid-scroll relative hidden rounded-md border border-erp-border md:block">
          <table className="erp-table purchase-doc-lines-grid w-max min-w-full text-[11px]">
            <thead>
              <tr>
                <th className="purchase-doc-lines-grid__sticky-line">#</th>
                <th className="purchase-doc-lines-grid__sticky-type">Product Type</th>
                <th className="purchase-doc-lines-grid__sticky-item">Item</th>
                <th className="min-w-[11rem]">Description</th>
                <th className="min-w-[9rem]">Specification</th>
                <th className="purchase-doc-lines-grid__uom-col">UOM</th>
                <th className="num min-w-[11rem] purchase-doc-lines-grid__qty-col">Qty</th>
                <th className="num min-w-[5.75rem]">Rate</th>
                <th className="num min-w-[5rem]">Discount</th>
                <th className="num min-w-[4rem]">Tax %</th>
                <th className="num min-w-[5.75rem]">Taxable Amount</th>
                {isInterstate ? (
                  <th className="num min-w-[4.5rem]">IGST</th>
                ) : (
                  <>
                    <th className="num min-w-[4.5rem]">CGST</th>
                    <th className="num min-w-[4.5rem]">SGST</th>
                  </>
                )}
                <th className="num min-w-[5.75rem]">Line Total</th>
                <th className="min-w-[9rem]">Expected Delivery Date</th>
                <th className="min-w-[8rem]">Requisition no.</th>
                <th className="min-w-[7rem]">GST Group</th>
                <th className="min-w-[7rem]">HSN Code</th>
                <th className="num min-w-[7.5rem]">Outstanding</th>
                <th className="num min-w-[7.5rem]">Received</th>
                <th className="num min-w-[7.5rem]">Invoiced</th>
                <th className="min-w-[4rem]">QC Required</th>
                <th className="purchase-doc-lines-grid__qtg-col">Quality Test Group</th>
                <th className="purchase-doc-lines-grid__bin-col">Bin Code</th>
                <th className="purchase-doc-lines-grid__sticky-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const freeText = isFreeTextLine(line)
                const lineType = lineGoodsService(line)
                const isService = lineType === 'SERVICE'
                const miss = missingMandatory(line)
                const itemErr = showErrors ? lineErrors[`${line.key}:item`] : undefined
                const qtyErr = showErrors ? lineErrors[`${line.key}:quantity`] : undefined
                const rateErr = showErrors ? lineErrors[`${line.key}:rate`] : undefined
                const hsnErr = showErrors ? lineErrors[`${line.key}:hsn`] : undefined
                const hasSubmitError = Boolean(itemErr || qtyErr || rateErr || hsnErr)
                const rowCatalog = catalogForLine(line.productType, line.itemId)
                return (
                  <tr
                    key={line.key}
                    className={cn(
                      hasSubmitError
                        ? 'bg-red-50/40'
                        : miss.any && 'bg-amber-50/50',
                    )}
                  >
                    <td className="purchase-doc-lines-grid__sticky-line tabular-nums">{line.lineNo}</td>
                    <td className="purchase-doc-lines-grid__sticky-type" onKeyDown={onCellKeyDown}>
                      {freeText ? (
                        <select
                          className="erp-input h-8 w-full min-w-0 text-[11px]"
                          disabled={!editable}
                          value={lineType}
                          title="Goods or Service"
                          onChange={(e) => {
                            const next = e.target.value === 'SERVICE' ? 'SERVICE' : 'GOODS'
                            const service = next === 'SERVICE'
                            onPatchLine(line.key, {
                              manualEntry: true,
                              lineType: next,
                              itemType: service ? 'service' : 'raw_material',
                              category: service ? 'job_work' : 'raw_material',
                              productType: service ? 'service' : '',
                              sacCode: service ? line.hsnCode || line.sacCode || null : null,
                            })
                          }}
                        >
                          <option value="GOODS">Goods</option>
                          <option value="SERVICE">Service</option>
                        </select>
                      ) : (
                        <select
                          className="erp-input h-8 w-full min-w-0 text-[11px]"
                          disabled={!editable}
                          value={line.productType ?? ''}
                          onChange={(e) =>
                            setRowProductType(line, e.target.value as EngineeringProductType | '')
                          }
                        >
                          <option value="">{SELECT_PLACEHOLDER}</option>
                          {ENGINEERING_PRODUCT_TYPES.map((pt) => (
                            <option key={pt} value={pt}>
                              {ENGINEERING_PRODUCT_TYPE_LABELS[pt]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td
                      id={`purchase-line-${line.key}-item`}
                      className={cn(
                        'purchase-doc-lines-grid__sticky-item',
                        itemErr
                          ? 'ring-1 ring-inset ring-red-400/80'
                          : miss.missingItem && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      {freeText ? (
                        <input
                          className="erp-input h-8 w-full min-w-0 text-[11px]"
                          disabled={!editable}
                          value={line.itemName}
                          placeholder="Item / service name"
                          onChange={(e) =>
                            onPatchLine(line.key, {
                              manualEntry: true,
                              itemId: '',
                              itemName: e.target.value,
                              description: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <PurchaseItemCodeCell
                          itemId={line.itemId}
                          itemCode={line.itemCode}
                          catalogItems={rowCatalog}
                          disabled={!editable}
                          textClassName="text-[11px]"
                          className="w-full min-w-0 max-w-none"
                          emptyCatalogHint={
                            line.productType
                              ? 'No Item Master rows for this product type'
                              : 'No purchasable items from Item Master'
                          }
                          onSelectItem={(id) => onSelectCatalogItem(line.key, id)}
                          onClearCatalog={() => onPatchLine(line.key, { itemId: '', itemCode: '' })}
                          onManualCodeChange={(code) => onPatchLine(line.key, { itemCode: code })}
                        />
                      )}
                      {itemErr ? (
                        <p className="mt-0.5 text-[10px] text-erp-danger-fg">{itemErr}</p>
                      ) : null}
                      {freeText ? (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-erp-muted">Quick</p>
                      ) : null}
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[11rem] text-[11px]"
                        disabled={!editable}
                        value={line.description || (freeText ? '' : line.itemName)}
                        onChange={(e) =>
                          onPatchLine(line.key, {
                            description: e.target.value,
                            ...(freeText
                              ? {
                                  manualEntry: true,
                                  itemName: line.itemName.trim() ? line.itemName : e.target.value,
                                }
                              : { itemName: e.target.value }),
                          })
                        }
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[9rem] text-[11px]"
                        disabled={!editable}
                        value={line.specification}
                        onChange={(e) => onPatchLine(line.key, { specification: e.target.value })}
                      />
                    </td>
                    <td className="purchase-doc-lines-grid__uom-col" onKeyDown={onCellKeyDown}>
                      {(() => {
                        if (freeText) {
                          return (
                            <input
                              className="erp-input h-8 w-full px-0.5 text-center text-[10px] uppercase"
                              disabled={!editable}
                              value={line.uom || '—'}
                              placeholder="UOM"
                              onChange={(e) =>
                                onPatchLine(line.key, {
                                  manualEntry: true,
                                  uom: e.target.value.toUpperCase(),
                                  uomId: null,
                                  uomConversionFactor: 1,
                                })
                              }
                            />
                          )
                        }
                        const uomOptions = getPurchaseLineUomOptions(line.itemId)
                        const multi = uomOptions.length > 1
                        const uomCode = uomOptions[0]?.code || line.uom || '—'
                        if (!editable || !line.itemId) {
                          return (
                            <span className="block text-center text-[11px] font-medium uppercase text-erp-text">
                              {line.uom || '—'}
                            </span>
                          )
                        }
                        if (multi) {
                          return (
                            <select
                              className="erp-input h-8 w-full px-0.5 text-center text-[10px]"
                              value={line.uomId || uomOptions[0]?.id || ''}
                              title="Select purchase unit from Item Master"
                              onChange={(e) => {
                                const opt = uomOptions.find((o) => o.id === e.target.value)
                                if (!opt) return
                                // Keep entered purchase qty; recompute base via patchLine → computeLine.
                                onPatchLine(line.key, {
                                  uomId: opt.id,
                                  uom: opt.code,
                                  uomConversionFactor: opt.factor,
                                })
                              }}
                            >
                              {uomOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.code}
                                </option>
                              ))}
                            </select>
                          )
                        }
                        return (
                          <span className="block text-center text-[11px] font-medium uppercase text-erp-text">
                            {uomCode}
                          </span>
                        )
                      })()}
                    </td>
                    <td
                      id={`purchase-line-${line.key}-quantity`}
                      className={cn(
                        'num purchase-doc-lines-grid__qty-col min-w-[11rem]',
                        qtyErr
                          ? 'ring-1 ring-inset ring-red-400/80'
                          : miss.missingQty && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <PurchaseLineQtyCell
                        line={line}
                        editable={editable}
                        disabled={!editable}
                        inputId={`purchase-line-${line.key}-quantity`}
                        onChange={(v) => onPatchLine(line.key, { uomQuantity: v })}
                      />
                      {qtyErr ? (
                        <p className="mt-0.5 text-[10px] text-erp-danger-fg">{qtyErr}</p>
                      ) : null}
                    </td>
                    <td
                      id={`purchase-line-${line.key}-rate`}
                      className={cn(
                        'num',
                        rateErr
                          ? 'ring-1 ring-inset ring-red-400/80'
                          : miss.missingRate && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={cn(
                          'erp-input h-8 w-24 text-right text-[11px]',
                          rateErr && 'border-erp-danger-fg',
                        )}
                        disabled={!editable}
                        value={line.rate}
                        onChange={(e) => onPatchLine(line.key, { rate: Number(e.target.value) })}
                      />
                      {rateErr ? (
                        <p className="mt-0.5 text-[10px] text-erp-danger-fg">{rateErr}</p>
                      ) : null}
                    </td>
                    <td className="num" onKeyDown={onCellKeyDown}>
                      <input
                        type="number"
                        min={0}
                        className="erp-input h-8 w-14 text-right text-[11px]"
                        disabled={!editable}
                        value={line.discountPct}
                        onChange={(e) => onPatchLine(line.key, { discountPct: Number(e.target.value) })}
                        title="Discount %"
                      />
                    </td>
                    <td className="num" onKeyDown={onCellKeyDown}>
                      <input
                        type="number"
                        min={0}
                        className="erp-input h-8 w-14 text-right text-[11px]"
                        disabled={!editable}
                        value={line.gstRatePct}
                        onChange={(e) => onPatchLine(line.key, { gstRatePct: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num tabular-nums">{formatCurrency(line.taxableAmount)}</td>
                    {isInterstate ? (
                      <td className="num tabular-nums text-erp-muted">
                        {formatCurrency(line.igst)}
                      </td>
                    ) : (
                      <>
                        <td className="num tabular-nums text-erp-muted">
                          {formatCurrency(line.cgst)}
                        </td>
                        <td className="num tabular-nums text-erp-muted">
                          {formatCurrency(line.sgst)}
                        </td>
                      </>
                    )}
                    <td className="num tabular-nums font-medium">{formatCurrency(line.lineTotal)}</td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        type="date"
                        className="erp-input h-8 min-w-[9rem] text-[11px]"
                        disabled={!editable}
                        value={line.expectedDeliveryDate || line.requiredDate || ''}
                        onChange={(e) =>
                          onPatchLine(line.key, {
                            expectedDeliveryDate: e.target.value,
                            requiredDate: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[8rem] text-[11px] font-mono"
                        disabled={!editable}
                        value={line.requisitionNo ?? ''}
                        placeholder="PR no."
                        onChange={(e) =>
                          onPatchLine(line.key, {
                            requisitionNo: e.target.value.trim() ? e.target.value : null,
                          })
                        }
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <select
                        className="erp-input h-8 min-w-[7rem] text-[11px]"
                        disabled={!editable}
                        value={line.gstGroupId ?? ''}
                        onChange={(e) => {
                          const nextGroupId = e.target.value || null
                          const patch: Partial<PurchaseOrderLine> = {
                            gstGroupId: nextGroupId,
                            gstGroupCode: nextGroupId ? getGstGroup(nextGroupId)?.code ?? '' : '',
                          }
                          const currentHsn = line.hsnId ? getHsn(line.hsnId) : null
                          if (currentHsn && nextGroupId && currentHsn.gstGroupId !== nextGroupId) {
                            patch.hsnId = null
                            patch.hsnCode = ''
                          }
                          onPatchLine(line.key, patch)
                        }}
                      >
                        <option value="">{SELECT_PLACEHOLDER}</option>
                        {gstGroups
                          .filter((g) => g.isActive)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.code}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td
                      id={`purchase-line-${line.key}-hsn`}
                      className={cn(
                        hsnErr || miss.missingHsn ? 'ring-1 ring-inset ring-red-400/80' : undefined,
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      {freeText ? (
                        <>
                          <input
                            className={cn(
                              'erp-input h-8 min-w-[7rem] font-mono text-[11px]',
                              (hsnErr || miss.missingHsn) && 'border-erp-danger-fg',
                            )}
                            disabled={!editable}
                            value={line.hsnCode || line.sacCode || ''}
                            placeholder={isService ? 'SAC code' : 'HSN code'}
                            title={
                              isService
                                ? 'Type SAC code or match a master later'
                                : 'Type HSN code or match a master later'
                            }
                            onChange={(e) => {
                              const raw = e.target.value
                              const matched = raw.trim()
                                ? hsnMasters.find(
                                    (h) =>
                                      h.isActive &&
                                      h.code.localeCompare(raw.trim(), undefined, {
                                        sensitivity: 'accent',
                                      }) === 0,
                                  )
                                : null
                              onPatchLine(line.key, {
                                manualEntry: true,
                                hsnId: matched?.id ?? null,
                                hsnCode: raw,
                                sacCode: isService ? raw : null,
                                ...(matched?.gstGroupId
                                  ? {
                                      gstGroupId: matched.gstGroupId,
                                      gstGroupCode: getGstGroup(matched.gstGroupId)?.code ?? '',
                                    }
                                  : {}),
                              })
                            }}
                          />
                          {hsnErr ? (
                            <p className="mt-0.5 text-[10px] text-erp-danger-fg">{hsnErr}</p>
                          ) : null}
                        </>
                      ) : (
                        <select
                          className="erp-input h-8 min-w-[7rem] text-[11px]"
                          disabled={!editable || !line.gstGroupId}
                          value={line.hsnId ?? ''}
                          onChange={(e) => {
                            const nextHsnId = e.target.value || null
                            const hsn = nextHsnId ? getHsn(nextHsnId) : null
                            onPatchLine(line.key, {
                              hsnId: nextHsnId,
                              hsnCode: hsn?.code ?? '',
                            })
                          }}
                        >
                          <option value="">{SELECT_PLACEHOLDER}</option>
                          {hsnMasters
                            .filter((h) => h.isActive && h.gstGroupId === line.gstGroupId)
                            .map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.code}
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                    <td className="num">
                      <PurchaseLineTrackingQtyCell
                        line={line}
                        purchaseQty={Number(line.outstandingQty ?? line.pendingQty ?? 0)}
                        baseQty={Number(line.outstandingQtyBase ?? line.pendingQty ?? 0)}
                      />
                    </td>
                    <td className="num">
                      <PurchaseLineTrackingQtyCell
                        line={line}
                        purchaseQty={Number(line.receivedQty ?? 0)}
                        baseQty={Number(line.receivedQtyBase ?? 0)}
                      />
                    </td>
                    <td className="num">
                      <PurchaseLineTrackingQtyCell
                        line={line}
                        purchaseQty={Number(line.invoicedQty ?? 0)}
                        baseQty={Number(line.invoicedQtyBase ?? 0)}
                      />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={Boolean(line.qcRequired)} disabled readOnly />
                    </td>
                    <td className="purchase-doc-lines-grid__qtg-col">
                      <select
                        className="erp-input h-8 w-full text-[11px]"
                        disabled={!editable}
                        value={line.qualityTestGroupCode ?? ''}
                        onChange={(e) =>
                          onPatchLine(line.key, {
                            qualityTestGroupCode: e.target.value.trim() || null,
                          })
                        }
                      >
                        <option value="">{SELECT_PLACEHOLDER}</option>
                        {qualityTestGroupOptions.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.label}
                          </option>
                        ))}
                        {line.qualityTestGroupCode &&
                        !qualityTestGroupOptions.some((o) => o.code === line.qualityTestGroupCode) ? (
                          <option value={line.qualityTestGroupCode}>{line.qualityTestGroupCode}</option>
                        ) : null}
                      </select>
                    </td>
                    <td className="purchase-doc-lines-grid__bin-col" onKeyDown={onCellKeyDown}>
                      {(() => {
                        const resolvedBinId =
                          line.binId ||
                          (line.binCode
                            ? binOptions.find(
                                (b) =>
                                  b.code.localeCompare(line.binCode ?? '', undefined, {
                                    sensitivity: 'accent',
                                  }) === 0,
                              )?.id
                            : undefined) ||
                          ''
                        const hasOption = Boolean(
                          resolvedBinId && binOptions.some((b) => b.id === resolvedBinId),
                        )
                        const displayLabel =
                          binOptions.find((b) => b.id === resolvedBinId)?.code ||
                          line.binCode ||
                          resolvedBinId
                        return (
                          <>
                            <select
                              className="erp-input h-8 w-full text-[11px]"
                              disabled={!editable}
                              value={resolvedBinId}
                              onChange={(e) => {
                                const nextBinId = e.target.value || null
                                const bin = binOptions.find((b) => b.id === nextBinId)
                                onPatchLine(line.key, {
                                  binId: nextBinId,
                                  binCode: bin?.code ?? '',
                                })
                              }}
                              title={
                                !binOptions.length
                                  ? 'No bins loaded — configure Master → Bins, then refresh'
                                  : displayLabel || undefined
                              }
                            >
                              <option value="">{SELECT_PLACEHOLDER}</option>
                              {binOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code}
                                  {b.name && b.name !== b.code ? ` — ${b.name}` : ''}
                                </option>
                              ))}
                              {resolvedBinId && !hasOption ? (
                                <option value={resolvedBinId}>
                                  {line.binCode || resolvedBinId}
                                </option>
                              ) : null}
                            </select>
                            {!binOptions.length ? (
                              <p className="mt-0.5 text-[10px] text-erp-muted">No bins</p>
                            ) : null}
                          </>
                        )
                      })()}
                    </td>
                    <td className="purchase-doc-lines-grid__sticky-actions">
                      <div className="flex items-center justify-center gap-0.5">
                        {freeText && editable ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text disabled:opacity-40"
                            onClick={() => openQuickEdit(line.key)}
                            title="Edit manual line"
                            aria-label="Edit manual line"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded p-1 text-erp-danger-fg hover:bg-red-50 disabled:opacity-40"
                          disabled={!editable}
                          onClick={() => onRemoveLine(line.key)}
                          title="Delete line"
                          aria-label="Delete line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="purchase-doc-lines-grid__totals bg-erp-surface-alt font-semibold">
                <td className="purchase-doc-lines-grid__sticky-line">Total</td>
                <td className="purchase-doc-lines-grid__sticky-type" />
                <td className="purchase-doc-lines-grid__sticky-item" />
                <td colSpan={3} />
                <td className="num tabular-nums">{totals.qty}</td>
                <td className="num" colSpan={2} />
                <td className="num text-erp-muted" title="Tax amount">
                  {formatCurrency(totals.tax)}
                </td>
                <td className="num tabular-nums">{formatCurrency(totals.taxable)}</td>
                {isInterstate ? (
                  <td className="num tabular-nums">{formatCurrency(totals.igst)}</td>
                ) : (
                  <>
                    <td className="num tabular-nums">{formatCurrency(totals.cgst)}</td>
                    <td className="num tabular-nums">{formatCurrency(totals.sgst)}</td>
                  </>
                )}
                <td className="num tabular-nums">{formatCurrency(totals.lineTotal)}</td>
                <td colSpan={2} />
                <td colSpan={8} />
                <td className="purchase-doc-lines-grid__sticky-actions" />
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      {quickLineEnabled ? (
        <QuickManualLineDrawer
          open={drawerOpen}
          mode={drawerMode}
          initial={initialForDrawer}
          isInterstate={isInterstate}
          qualityTestGroupOptions={qualityTestGroupOptions}
          formatCurrency={formatCurrency}
          onClose={closeDrawer}
          onSave={(patch) => {
            if (drawerMode === 'edit' && drawerKey) {
              onPatchLine(drawerKey, { ...patch, manualEntry: true, itemId: '' })
              closeDrawer()
              return
            }
            if (onCreateQuickLine) {
              onCreateQuickLine({
                ...patch,
                manualEntry: true,
                itemId: '',
                itemCode: patch.itemCode ?? '',
              })
              closeDrawer()
              return
            }
            onAddQuickLine?.()
            closeDrawer()
          }}
          onDelete={
            drawerMode === 'edit' && drawerKey && editable
              ? () => {
                  onRemoveLine(drawerKey)
                  closeDrawer()
                }
              : undefined
          }
        />
      ) : null}

      <style>{`
        .purchase-doc-lines-grid-scroll {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          max-height: min(32rem, 60vh);
          overflow-x: auto;
          overflow-y: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }
        .purchase-doc-lines-grid-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .purchase-doc-lines-grid-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: var(--erp-border-strong, #cbd5e1);
        }
        .purchase-doc-lines-grid-scroll::-webkit-scrollbar-track {
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid__qty-col {
          min-width: 11rem;
          width: 11rem;
        }
        .purchase-doc-lines-grid__sticky-item {
          position: sticky;
          left: 12rem;
          z-index: 11;
          width: 20rem;
          min-width: 20rem;
          max-width: 20rem;
          padding-left: 8px !important;
          padding-right: 8px !important;
          background: #fff;
          border-right: 1px solid var(--erp-border, #e2e8f0);
          box-shadow: 4px 0 8px -4px rgb(15 23 42 / 0.12);
          overflow: visible;
        }
        .purchase-doc-lines-grid thead th {
          position: sticky;
          top: 0;
          z-index: 20;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid__sticky-line {
          position: sticky;
          left: 0;
          z-index: 13;
          min-width: 2.5rem;
          width: 2.5rem;
          background: #fff;
          box-shadow: 2px 0 4px rgb(15 23 42 / 0.04);
        }
        .purchase-doc-lines-grid thead .purchase-doc-lines-grid__sticky-line,
        .purchase-doc-lines-grid tfoot .purchase-doc-lines-grid__sticky-line {
          z-index: 22;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid__sticky-type {
          position: sticky;
          left: 2.5rem;
          z-index: 12;
          width: 9.5rem;
          min-width: 9.5rem;
          max-width: 9.5rem;
          box-sizing: border-box;
          background: #fff;
          border-right: 1px solid var(--erp-border, #e2e8f0);
        }
        .purchase-doc-lines-grid thead .purchase-doc-lines-grid__sticky-type,
        .purchase-doc-lines-grid tfoot .purchase-doc-lines-grid__sticky-type {
          z-index: 21;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid thead .purchase-doc-lines-grid__sticky-item,
        .purchase-doc-lines-grid tfoot .purchase-doc-lines-grid__sticky-item {
          z-index: 21;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid__sticky-actions {
          position: sticky;
          right: 0;
          z-index: 12;
          min-width: 4.5rem;
          width: 4.5rem;
          text-align: center;
          background: #fff;
          border-left: 1px solid var(--erp-border, #e2e8f0);
          box-shadow: -4px 0 8px rgb(15 23 42 / 0.06);
        }
        .purchase-doc-lines-grid thead .purchase-doc-lines-grid__sticky-actions,
        .purchase-doc-lines-grid tfoot .purchase-doc-lines-grid__sticky-actions {
          z-index: 22;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-line,
        .purchase-doc-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-type,
        .purchase-doc-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-item,
        .purchase-doc-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-actions {
          background: #f0f7ff;
        }
        .purchase-doc-lines-grid tfoot td {
          border-top: 1px solid var(--erp-border-strong, #cbd5e1);
        }
      `}</style>
    </>
  )
}
