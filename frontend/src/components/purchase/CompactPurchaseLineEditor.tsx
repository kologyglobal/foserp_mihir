import { Fragment, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PurchaseTableToolbar } from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { PurchaseLineDetailsDrawer } from '@/components/purchase/PurchaseLineDetailsDrawer'
import { QuickManualLineDrawer } from '@/components/purchase/QuickManualLineDrawer'
import { PoLineLifecycleStrip } from '@/components/purchase/PoLineLifecycleStrip'
import { EmptyState } from '@/components/ui/EmptyState'
import { CommandBarOverflowMenu } from '@/components/ui/CommandBar'
import { MQ_BELOW_LG, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/utils/cn'
import type { PurchaseOrderLine } from '@/types/purchaseDomain'
import {
  formatPoDiscountDisplay,
  formatPoLineGstLabel,
  isPoFreeTextLine,
  isPoServiceLine,
  lineItemDescription,
  resolvePoMoreDetailsVisibility,
} from '@/utils/poCompactLineHelpers'

export type CompactPoLinesEditorLine = PurchaseOrderLine & {
  key: string
  /** Client-only free-text flag when present */
  manualEntry?: boolean
}

export type CompactPurchaseLineToolbarAction = {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
}

export type CompactPurchaseLineEditorProps = {
  lines: CompactPoLinesEditorLine[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  warehouseOptions?: Array<{ id: string; name: string }>
  binOptions?: Array<{ id: string; code: string; name: string }>
  qualityTestGroupOptions?: Array<{ code: string; label: string }>
  editable: boolean
  isInterstate: boolean
  dirty?: boolean
  formatCurrency: (n: number) => string
  /** Add blank catalog-ready line (legacy) — prefer onAddFromMaster via picker */
  onAddLine: () => void
  onAddQuickLine?: () => void
  onPatchLine: (key: string, patch: Partial<PurchaseOrderLine> & { manualEntry?: boolean }) => void
  onRemoveLine: (key: string) => void
  onSelectCatalogItem: (key: string, itemId: string) => void
  onDuplicateLine?: (key: string) => void
  /** Called with a new key + selected catalog item id */
  onAddCatalogLine?: (itemId: string) => void
  /** Seed + return line key for quick create */
  onCreateQuickLine?: (patch: Partial<PurchaseOrderLine>) => string
  showErrors?: boolean
  lineErrors?: Record<string, string>
  secondaryActions?: CompactPurchaseLineToolbarAction[]
  toolbarExtra?: ReactNode
  /** When true, show optional read-only receiving strip if data exists */
  showLifecycleStrip?: boolean
}

/**
 * Compact PO item lines: dual entry (Item Master / Quick Manual), ~9-column grid,
 * expandable more-details, edit via drawer (no 25-col horizontal scroll).
 */
export function CompactPurchaseLineEditor({
  lines,
  catalogItems,
  qualityTestGroupOptions = [],
  editable,
  isInterstate,
  dirty,
  formatCurrency,
  onAddLine,
  onAddQuickLine,
  onPatchLine,
  onRemoveLine,
  onDuplicateLine,
  onAddCatalogLine,
  onCreateQuickLine,
  showErrors = false,
  lineErrors = {},
  secondaryActions = [],
  toolbarExtra,
  showLifecycleStrip = true,
}: CompactPurchaseLineEditorProps) {
  const collapseSecondary = useMediaQuery(MQ_BELOW_LG)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [drawerKey, setDrawerKey] = useState<string | null>(null)
  const [masterPickerOpen, setMasterPickerOpen] = useState(false)
  const [pickerItemId, setPickerItemId] = useState('')
  const [pickerCode, setPickerCode] = useState('')

  const totals = useMemo(
    () =>
      lines.reduce(
        (acc, l) => ({
          qty: acc.qty + (Number(l.uomQuantity ?? l.quantity) || 0),
          lineTotal: acc.lineTotal + (Number(l.lineTotal) || 0),
        }),
        { qty: 0, lineTotal: 0 },
      ),
    [lines],
  )

  const drawerLine = drawerKey ? lines.find((l) => l.key === drawerKey) : null

  const openEdit = (key: string) => {
    setDrawerMode('edit')
    setDrawerKey(key)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerKey(null)
  }

  const handleMasterPick = () => {
    if (!pickerItemId) return
    if (onAddCatalogLine) {
      onAddCatalogLine(pickerItemId)
    } else {
      onAddLine()
    }
    setMasterPickerOpen(false)
    setPickerItemId('')
    setPickerCode('')
  }

  const secondaryOverflow = secondaryActions.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon ?? MoreHorizontal,
    onClick: a.onClick,
    disabled: a.disabled,
    disabledReason: a.disabledReason,
  }))

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const initialForDrawer =
    drawerMode === 'edit' && drawerLine
      ? drawerLine
      : {
          lineType: 'SERVICE' as const,
          itemType: 'service' as const,
          productType: 'service' as const,
          category: 'job_work' as const,
          itemId: '',
          itemCode: '',
          itemName: '',
          description: '',
          hsnCode: '',
          sacCode: '',
          uom: 'NOS',
          uomQuantity: 1,
          quantity: 1,
          rate: 0,
        }

  return (
    <>
      <PurchaseTableToolbar>
        <ErpButton
          type="button"
          size="sm"
          variant="secondary"
          icon={Plus}
          disabled={!editable}
          onClick={() => {
            setPickerItemId('')
            setPickerCode('')
            setMasterPickerOpen(true)
          }}
        >
          + Add from Item Master
        </ErpButton>
        <ErpButton
          type="button"
          size="sm"
          variant="secondary"
          icon={Plus}
          disabled={!editable}
          onClick={() => {
            setDrawerMode('create')
            setDrawerKey(null)
            setDrawerOpen(true)
          }}
          title="Add free-text goods or service line without Item Master"
        >
          + Quick Manual Entry
        </ErpButton>
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

      {showLifecycleStrip ? <PoLineLifecycleStrip lines={lines} formatCurrency={formatCurrency} /> : null}

      {lines.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No item lines yet"
          description="Add from Item Master or use Quick Manual Entry for goods/services without a catalog item."
          className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 py-12"
          action={
            editable ? (
              <div className="flex flex-wrap justify-center gap-2">
                <ErpButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setMasterPickerOpen(true)}
                >
                  + Add from Item Master
                </ErpButton>
                <ErpButton
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={Plus}
                  onClick={() => {
                    setDrawerMode('create')
                    setDrawerKey(null)
                    setDrawerOpen(true)
                  }}
                >
                  + Quick Manual Entry
                </ErpButton>
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile / tablet cards */}
          <ul className="flex flex-col gap-2 lg:hidden" aria-label="Item lines">
            {lines.map((line) => {
              const open = Boolean(expanded[line.key])
              const itemErr = showErrors ? lineErrors[`${line.key}:item`] : undefined
              const hsnErr = showErrors ? lineErrors[`${line.key}:hsn`] : undefined
              const hasErr = Boolean(itemErr || hsnErr)
              return (
                <li
                  key={line.key}
                  className={cn(
                    'rounded-md border border-erp-border bg-erp-surface shadow-sm',
                    hasErr && 'border-erp-danger-fg/50',
                  )}
                >
                  <div className="flex items-start gap-2 p-3">
                    <button
                      type="button"
                      className="mt-0.5 rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                      onClick={() => toggleExpand(line.key)}
                      aria-expanded={open}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-erp-text">
                        <span className="tabular-nums text-erp-muted">#{line.lineNo}</span>
                        <span className="mx-1.5 text-erp-border">·</span>
                        {lineItemDescription(line)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-erp-muted">
                        HSN {(line.hsnCode || line.sacCode || '-').trim()} ·{' '}
                        {formatPoLineGstLabel(line, isInterstate)}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-erp-muted">
                        {Number(line.uomQuantity ?? line.quantity) || 0} {line.uom} ×{' '}
                        {formatCurrency(line.rate)}
                        {formatPoDiscountDisplay(line) !== '-'
                          ? ` · Disc ${formatPoDiscountDisplay(line)}`
                          : ''}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold tabular-nums">
                        {formatCurrency(line.lineTotal)}
                      </p>
                      {itemErr || hsnErr ? (
                        <p className="mt-1 text-[11px] text-erp-danger-fg">
                          {itemErr || hsnErr}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      {editable ? (
                        <>
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                            title="Edit"
                            onClick={() => openEdit(line.key)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {onDuplicateLine ? (
                            <button
                              type="button"
                              className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                              title="Duplicate"
                              onClick={() => onDuplicateLine(line.key)}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="rounded p-1 text-erp-danger-fg hover:bg-red-50"
                            title="Delete"
                            onClick={() => onRemoveLine(line.key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {open ? <MoreDetailsPanel line={line} /> : null}
                </li>
              )
            })}
          </ul>

          {/* Desktop compact table — ~9 columns, no horizontal scroll on normal widths */}
          <div className="relative hidden overflow-x-auto rounded-md border border-erp-border lg:block">
            <table className="erp-table w-full min-w-[56rem] table-fixed text-[11px]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[9%]" />
                <col className="w-[7%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left">Item / Description</th>
                  <th className="text-left">HSN/SAC</th>
                  <th className="num">Qty</th>
                  <th className="text-center">UOM</th>
                  <th className="num">Rate</th>
                  <th className="num">Discount</th>
                  <th className="text-left">GST</th>
                  <th className="num">Amount</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const itemErr = showErrors ? lineErrors[`${line.key}:item`] : undefined
                  const hsnErr = showErrors ? lineErrors[`${line.key}:hsn`] : undefined
                  const qtyErr = showErrors ? lineErrors[`${line.key}:quantity`] : undefined
                  const rateErr = showErrors ? lineErrors[`${line.key}:rate`] : undefined
                  const hasErr = Boolean(itemErr || hsnErr || qtyErr || rateErr)
                  const open = Boolean(expanded[line.key])
                  const freeText = isPoFreeTextLine(line)
                  return (
                    <Fragment key={line.key}>
                      <tr
                        className={cn(hasErr && 'bg-red-50/40', freeText && 'bg-slate-50/40')}
                      >
                        <td className="align-top">
                          <div className="flex items-start gap-1">
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 rounded p-0.5 text-erp-muted hover:bg-erp-surface-alt"
                              onClick={() => toggleExpand(line.key)}
                              title="More details"
                              aria-expanded={open}
                            >
                              {open ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-erp-text" title={lineItemDescription(line)}>
                                <span className="mr-1 tabular-nums text-erp-muted">
                                  {line.lineNo}.
                                </span>
                                {lineItemDescription(line)}
                              </p>
                              <p className="text-[10px] text-erp-muted">
                                {isPoServiceLine(line) ? 'Service' : 'Goods'}
                                {freeText ? ' · Manual' : line.itemCode ? ' · Catalog' : ''}
                              </p>
                              {itemErr ? (
                                <p className="text-[10px] text-erp-danger-fg">{itemErr}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="align-top font-mono text-[11px]">
                          {(line.hsnCode || line.sacCode || '-').trim() || '-'}
                          {hsnErr ? (
                            <p className="font-sans text-[10px] text-erp-danger-fg">{hsnErr}</p>
                          ) : null}
                        </td>
                        <td className="num align-top tabular-nums">
                          {Number(line.uomQuantity ?? line.quantity) || 0}
                          {qtyErr ? (
                            <p className="text-[10px] text-erp-danger-fg">{qtyErr}</p>
                          ) : null}
                        </td>
                        <td className="align-top text-center uppercase">{line.uom || '-'}</td>
                        <td className="num align-top tabular-nums">
                          {formatCurrency(line.rate)}
                          {rateErr ? (
                            <p className="text-[10px] text-erp-danger-fg">{rateErr}</p>
                          ) : null}
                        </td>
                        <td className="num align-top tabular-nums">
                          {formatPoDiscountDisplay(line)}
                        </td>
                        <td className="align-top text-[10px] leading-snug text-erp-muted">
                          {formatPoLineGstLabel(line, isInterstate)}
                        </td>
                        <td className="num align-top font-medium tabular-nums">
                          {formatCurrency(line.lineTotal)}
                        </td>
                        <td className="align-top">
                          <div className="flex items-center justify-center gap-0.5">
                            {editable ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                                  title="Edit"
                                  aria-label="Edit line"
                                  onClick={() => openEdit(line.key)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                                  title="More details"
                                  aria-label="More details"
                                  onClick={() => toggleExpand(line.key)}
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                {onDuplicateLine ? (
                                  <button
                                    type="button"
                                    className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                                    title="Duplicate"
                                    aria-label="Duplicate line"
                                    onClick={() => onDuplicateLine(line.key)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="rounded p-1 text-erp-danger-fg hover:bg-red-50"
                                  title="Delete"
                                  aria-label="Delete line"
                                  onClick={() => onRemoveLine(line.key)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                                title="More details"
                                onClick={() => toggleExpand(line.key)}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-erp-surface-alt/40">
                          <td colSpan={9} className="px-3 py-2">
                            <MoreDetailsPanel line={line} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-erp-surface-alt font-semibold">
                  <td colSpan={2}>Total</td>
                  <td className="num tabular-nums">{totals.qty}</td>
                  <td colSpan={4} />
                  <td className="num tabular-nums">{formatCurrency(totals.lineTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

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
            onPatchLine(drawerKey, patch)
            closeDrawer()
            return
          }
          if (onCreateQuickLine) {
            onCreateQuickLine(patch)
            closeDrawer()
            return
          }
          // Fallback stack: append blank then caller may need remount
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
        onDuplicate={
          drawerMode === 'edit' && drawerKey && onDuplicateLine
            ? () => {
                onDuplicateLine(drawerKey)
                closeDrawer()
              }
            : undefined
        }
      />

      <PurchaseLineDetailsDrawer
        open={masterPickerOpen}
        onClose={() => setMasterPickerOpen(false)}
        title="Add from Item Master"
        subtitle="Search and select a catalog item — code, HSN, UOM, rate, and GST autofill"
        widthClassName="max-w-lg"
        footer={
          <>
            <ErpButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMasterPickerOpen(false)}
            >
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              size="sm"
              variant="primary"
              disabled={!pickerItemId}
              onClick={handleMasterPick}
            >
              Add Line
            </ErpButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12px] text-erp-muted">
            Pick an active purchasable item. Line is added to the grid; use Edit for qty,
            discount, and dates.
          </p>
          <PurchaseItemCodeCell
            itemId={pickerItemId}
            itemCode={pickerCode}
            catalogItems={catalogItems}
            disabled={!editable}
            allowManual={false}
            labelMode="name"
            textClassName="text-[12px]"
            className="w-full max-w-none"
            emptyCatalogHint="No purchasable items from Item Master"
            onSelectItem={(id) => {
              setPickerItemId(id)
              const item = catalogItems.find((i) => i.id === id)
              setPickerCode(item?.itemCode ?? '')
            }}
            onClearCatalog={() => {
              setPickerItemId('')
              setPickerCode('')
            }}
            onManualCodeChange={() => undefined}
          />
        </div>
      </PurchaseLineDetailsDrawer>
    </>
  )
}

function MoreDetailsPanel({ line }: { line: CompactPoLinesEditorLine }) {
  const vis = resolvePoMoreDetailsVisibility({
    ...line,
    showPrAlways: Boolean(line.prLineId || line.requisitionNo || line.prSources?.length),
  })
  if (!vis.showAny) {
    return (
      <p className="px-3 py-2 text-[11px] text-erp-muted">
        No additional details on this line. Use Edit to set delivery, QC, or remarks.
      </p>
    )
  }
  return (
    <dl className="grid gap-x-4 gap-y-1 px-1 py-1 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
      {vis.showSpecification ? (
        <Detail term="Specification" value={line.specification} />
      ) : null}
      {vis.showExpectedDelivery ? (
        <Detail
          term="Expected delivery"
          value={line.expectedDeliveryDate || line.requiredDate || '-'}
        />
      ) : null}
      {vis.showPrRef ? (
        <Detail
          term="PR ref"
          value={
            line.requisitionNo ||
            line.prSources?.map((s) => s.requisitionNumber).filter(Boolean).join(', ') ||
            '-'
          }
        />
      ) : null}
      {vis.showWarehouse ? (
        <Detail term="Warehouse" value={line.warehouseName || line.warehouseId || '-'} />
      ) : null}
      {vis.showGstGroup ? (
        <Detail term="GST group" value={line.gstGroupCode || line.gstGroupId || '-'} />
      ) : null}
      {vis.showQc ? (
        <Detail term="QC required" value={line.qcRequired ? 'Yes' : 'No'} />
      ) : null}
      {vis.showQualityTest && line.qualityTestGroupCode ? (
        <Detail term="Quality test" value={line.qualityTestGroupCode} />
      ) : null}
      {vis.showRemarks ? <Detail term="Remarks" value={line.remarks} /> : null}
      {line.binCode ? <Detail term="Bin" value={line.binCode} /> : null}
    </dl>
  )
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
        {term}
      </dt>
      <dd className="truncate text-erp-text" title={value}>
        {value || '-'}
      </dd>
    </div>
  )
}
