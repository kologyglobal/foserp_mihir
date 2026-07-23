import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Cog,
  Droplets,
  Layers,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { Button } from '@/design-system/components/Button'
import type { ProductionOrderBomSnapshot, ProductionOrderBomSnapshotLine } from '@/types/manufacturingProduction'
import { BOM_LINE_TYPE_VALUES, type BomLineType, type MakeOrBuy } from '@/types/manufacturingSetup'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import {
  buildWoBomOutlineIndexMap,
  buildWoBomTree,
  collectExpandableWoBomIds,
  flattenWoBomTree,
} from '../setup/boms/bomOutlineIndex'

const LINE_TYPE_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  RAW_MATERIAL: { label: 'Raw material', icon: Box, className: 'bg-slate-100 text-slate-700' },
  BOUGHT_OUT: { label: 'Bought out', icon: ShoppingCart, className: 'bg-amber-50 text-amber-800' },
  CONSUMABLE: { label: 'Consumable', icon: Droplets, className: 'bg-sky-50 text-sky-800' },
  SUBASSEMBLY: { label: 'Subassembly', icon: Layers, className: 'bg-indigo-50 text-indigo-800' },
  MANUFACTURED_COMPONENT: { label: 'Manufactured', icon: Cog, className: 'bg-violet-50 text-violet-800' },
  PACKAGING: { label: 'Packaging', icon: Package, className: 'bg-emerald-50 text-emerald-800' },
  SERVICE: { label: 'Service', icon: Wrench, className: 'bg-rose-50 text-rose-800' },
}

function LineBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold', className)}>{label}</span>
  )
}

function formatQty(value: string | number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '')
}

export type WoBomLineSavePayload = {
  itemId: string
  uomId: string
  perUnitQuantity?: number
  requiredQuantity?: number
  scrapPercent: number
  makeOrBuy: MakeOrBuy
  lineType: BomLineType
  isOptional: boolean
  descriptionOverride: string | null
  parentLineId?: string | null
}

type Draft = {
  mode: 'edit' | 'add'
  lineId: string | null
  parentLineId: string | null
  itemId: string
  uomId: string
  itemLocked: boolean
  perUnitQuantity: string
  requiredQuantity: string
  scrapPercent: string
  makeOrBuy: MakeOrBuy
  lineType: BomLineType
  isOptional: boolean
  descriptionOverride: string
  qtyMode: 'perUnit' | 'required'
}

type Props = {
  snapshot: ProductionOrderBomSnapshot
  itemLabel: (line: ProductionOrderBomSnapshotLine) => string
  headerActions?: ReactNode
  banner?: ReactNode
  canEdit?: boolean
  busy?: boolean
  isItemLocked?: (line: ProductionOrderBomSnapshotLine) => boolean
  onSaveLine: (lineId: string | null, payload: WoBomLineSavePayload) => Promise<void>
  onRemoveLine: (line: ProductionOrderBomSnapshotLine) => void
}

function emptyDraft(parentLineId: string | null = null): Draft {
  return {
    mode: 'add',
    lineId: null,
    parentLineId,
    itemId: '',
    uomId: '',
    itemLocked: false,
    perUnitQuantity: '1',
    requiredQuantity: '',
    scrapPercent: '0',
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    isOptional: false,
    descriptionOverride: '',
    qtyMode: 'perUnit',
  }
}

function draftFromLine(line: ProductionOrderBomSnapshotLine, itemLocked: boolean): Draft {
  return {
    mode: 'edit',
    lineId: line.id,
    parentLineId: line.parentLineId,
    itemId: line.itemId,
    uomId: line.uomId,
    itemLocked,
    perUnitQuantity: String(Number(line.perUnitQuantity) || 1),
    requiredQuantity: String(Number(line.requiredQuantity) || 0),
    scrapPercent: String(Number(line.scrapPercent) || 0),
    makeOrBuy: line.makeOrBuy === 'MAKE' ? 'MAKE' : 'BUY',
    lineType: (BOM_LINE_TYPE_VALUES.includes(line.lineType as BomLineType)
      ? line.lineType
      : 'RAW_MATERIAL') as BomLineType,
    isOptional: Boolean(line.isOptional),
    descriptionOverride: line.descriptionOverride ?? '',
    qtyMode: 'required',
  }
}

/**
 * WO BOM snapshot multilevel grid with inline (raw) editing — no popup.
 */
export function WorkOrderBomSnapshotPanel({
  snapshot,
  itemLabel,
  headerActions,
  banner,
  canEdit = false,
  busy = false,
  isItemLocked,
  onSaveLine,
  onRemoveLine,
}: Props) {
  const tree = useMemo(() => buildWoBomTree(snapshot.lines), [snapshot.lines])
  const outlineIndexById = useMemo(() => buildWoBomOutlineIndexMap(tree), [tree])
  const expandableIds = useMemo(() => collectExpandableWoBomIds(tree), [tree])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(expandableIds))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setExpanded(new Set(expandableIds))
  }, [snapshot.id, expandableIds])

  useEffect(() => {
    setDraft(null)
  }, [snapshot.id, snapshot.lines])

  const visible = useMemo(() => flattenWoBomTree(tree, expanded), [tree, expanded])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(expandableIds))
  const collapseAll = () => setExpanded(new Set())

  const beginEdit = (line: ProductionOrderBomSnapshotLine) => {
    setDraft(draftFromLine(line, Boolean(isItemLocked?.(line))))
  }

  const beginAdd = (parentLineId: string | null = null) => {
    setDraft(emptyDraft(parentLineId))
    if (parentLineId) {
      setExpanded((prev) => new Set(prev).add(parentLineId))
    }
  }

  const cancelDraft = () => setDraft(null)

  const saveDraft = async () => {
    if (!draft) return
    if (!draft.itemId || !draft.uomId) {
      notify.error('Item is required')
      return
    }
    const scrap = Number(draft.scrapPercent)
    if (!Number.isFinite(scrap) || scrap < 0 || scrap > 100) {
      notify.error('Scrap % must be between 0 and 100')
      return
    }

    const payload: WoBomLineSavePayload = {
      itemId: draft.itemId,
      uomId: draft.uomId,
      scrapPercent: scrap,
      makeOrBuy: draft.makeOrBuy,
      lineType: draft.lineType,
      isOptional: draft.isOptional,
      descriptionOverride: draft.descriptionOverride.trim() || null,
      parentLineId: draft.mode === 'add' ? draft.parentLineId : undefined,
    }

    if (draft.mode === 'add' || draft.qtyMode === 'perUnit') {
      const per = Number(draft.perUnitQuantity)
      if (!(per > 0)) {
        notify.error('Per-unit quantity must be greater than zero')
        return
      }
      payload.perUnitQuantity = per
    } else {
      const req = Number(draft.requiredQuantity)
      if (!(req > 0)) {
        notify.error('Required quantity must be greater than zero')
        return
      }
      payload.requiredQuantity = req
    }

    setSaving(true)
    try {
      await onSaveLine(draft.lineId, payload)
      setDraft(null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Unable to save BOM line')
    } finally {
      setSaving(false)
    }
  }

  const disabled = busy || saving
  const editingId = draft?.mode === 'edit' ? draft.lineId : null
  const showAddRow = draft?.mode === 'add'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
            BOM for this work order
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-erp-text">
            BOM snapshot v{snapshot.bomVersionNumber}
          </h3>
          <p className="text-[12px] text-erp-muted">
            Base qty {snapshot.baseQuantity} · Locked {formatDateTime(snapshot.snapshotAt)} ·{' '}
            {snapshot.lines.length} line(s). Edit quantities and items directly in the grid.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {expandableIds.length > 0 ? (
            <>
              <Button size="sm" variant="ghost" onClick={expandAll} disabled={disabled}>
                <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
                Expand
              </Button>
              <Button size="sm" variant="ghost" onClick={collapseAll} disabled={disabled}>
                <ChevronsDownUp className="mr-1 h-3.5 w-3.5" />
                Collapse
              </Button>
            </>
          ) : null}
          {canEdit ? (
            <Button size="sm" variant="secondary" disabled={disabled || Boolean(draft)} onClick={() => beginAdd(null)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add line
            </Button>
          ) : null}
          {headerActions}
        </div>
      </div>

      {banner}

      <div className="overflow-x-auto rounded-lg border border-erp-border">
        <table className="erp-table w-full text-[12px]">
          <thead>
            <tr className="bg-slate-50/90">
              <th className="w-16">Index</th>
              <th className="min-w-[240px]">Item</th>
              <th className="w-28 text-right">Per unit</th>
              <th className="w-20 text-right">Scrap %</th>
              <th className="w-28 text-right">Required</th>
              <th className="w-24">Make/Buy</th>
              <th className="w-36">Type</th>
              <th className="w-20">Optional</th>
              {canEdit ? <th className="w-36 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ node, depth }) => {
              const hasChildren = node.children.length > 0
              const isExpanded = expanded.has(node.id)
              const meta =
                LINE_TYPE_META[node.lineType as BomLineType] ?? LINE_TYPE_META.RAW_MATERIAL
              const TypeIcon = meta.icon
              const outline = outlineIndexById.get(node.id) ?? String(node.sequence)
              const label = itemLabel(node)
              const isAssembly =
                node.lineType === 'SUBASSEMBLY' || node.lineType === 'MANUFACTURED_COMPONENT'
              const isEditing = editingId === node.id

              if (isEditing && draft) {
                return (
                  <tr key={node.id} className="bg-sky-50/50">
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[12px] font-semibold tabular-nums">
                      {outline}
                    </td>
                    <td className="px-3 py-2" colSpan={1}>
                      <div style={{ paddingLeft: depth * 16 }} className="min-w-[220px] space-y-1">
                        {draft.itemLocked ? (
                          <Input value={label} readOnly className="h-8 text-[12px]" />
                        ) : (
                          <ItemLookupSelect
                            value={draft.itemId}
                            allowEmpty
                            placeholder="Search item…"
                            onChange={(sel) =>
                              setDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      itemId: sel?.itemId ?? '',
                                      uomId: sel?.uomId ?? '',
                                    }
                                  : d,
                              )
                            }
                          />
                        )}
                        <Input
                          value={draft.descriptionOverride}
                          placeholder="Description override (optional)"
                          className="h-8 text-[12px]"
                          onChange={(e) =>
                            setDraft((d) => (d ? { ...d, descriptionOverride: e.target.value } : d))
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0.001}
                        step="any"
                        className="h-8 text-right text-[12px]"
                        value={draft.perUnitQuantity}
                        disabled={draft.qtyMode === 'required'}
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, perUnitQuantity: e.target.value, qtyMode: 'perUnit' } : d,
                          )
                        }
                        onFocus={() => setDraft((d) => (d ? { ...d, qtyMode: 'perUnit' } : d))}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        className="h-8 text-right text-[12px]"
                        value={draft.scrapPercent}
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, scrapPercent: e.target.value } : d))
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0.001}
                        step="any"
                        className="h-8 text-right text-[12px]"
                        value={draft.requiredQuantity}
                        disabled={draft.qtyMode === 'perUnit'}
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, requiredQuantity: e.target.value, qtyMode: 'required' } : d,
                          )
                        }
                        onFocus={() => setDraft((d) => (d ? { ...d, qtyMode: 'required' } : d))}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={draft.makeOrBuy}
                        className="h-8 text-[12px]"
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, makeOrBuy: e.target.value as MakeOrBuy } : d,
                          )
                        }
                      >
                        <option value="BUY">BUY</option>
                        <option value="MAKE">MAKE</option>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={draft.lineType}
                        className="h-8 text-[12px]"
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, lineType: e.target.value as BomLineType } : d,
                          )
                        }
                      >
                        {BOM_LINE_TYPE_VALUES.map((v) => (
                          <option key={v} value={v}>
                            {LINE_TYPE_META[v]?.label ?? v}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={draft.isOptional ? 'yes' : 'no'}
                        className="h-8 text-[12px]"
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, isOptional: e.target.value === 'yes' } : d))
                        }
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          disabled={disabled}
                          onClick={() => void saveDraft()}
                          title="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={disabled}
                          onClick={cancelDraft}
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr
                  key={node.id}
                  className={cn(
                    'group transition-colors hover:bg-erp-primary-soft/20',
                    isAssembly && depth === 0 ? 'bg-slate-50/80' : null,
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[12px] font-semibold tabular-nums text-erp-text">
                    {outline}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-stretch">
                      {Array.from({ length: depth }).map((_, i) => (
                        <span
                          key={i}
                          className="ml-[9px] w-[15px] shrink-0 border-l border-erp-border/60"
                          aria-hidden
                        />
                      ))}
                      <div className="flex min-w-0 items-center gap-1.5 py-0.5">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggle(node.id)}
                            className="rounded p-0.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-[18px]" aria-hidden />
                        )}
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                            meta.className,
                          )}
                        >
                          <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-erp-text" title={label}>
                            {label}
                          </span>
                          <span className="block font-mono text-[10px] leading-tight text-erp-muted">
                            {node.descriptionOverride?.trim()
                              ? node.descriptionOverride
                              : `Seq ${node.sequence}`}
                            {hasChildren ? ` · ${node.children.length} sub` : ''}
                          </span>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-semibold">
                    {formatQty(node.perUnitQuantity)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-erp-muted">
                    {Number(node.scrapPercent) > 0 ? `${formatQty(node.scrapPercent)}%` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-semibold text-erp-text">
                    {formatQty(node.requiredQuantity)}
                  </td>
                  <td className="px-3 py-1.5">
                    <LineBadge
                      label={node.makeOrBuy}
                      className={
                        node.makeOrBuy === 'MAKE'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-amber-50 text-amber-800'
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <LineBadge label={meta.label} className={meta.className} />
                  </td>
                  <td className="px-3 py-1.5 text-erp-muted">{node.isOptional ? 'Yes' : '—'}</td>
                  {canEdit ? (
                    <td className="px-3 py-1.5 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5 opacity-80 group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5"
                          title="Edit in grid"
                          disabled={disabled || Boolean(draft)}
                          onClick={() => beginEdit(node)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5"
                          title="Add child"
                          disabled={disabled || Boolean(draft)}
                          onClick={() => beginAdd(node.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {!hasChildren ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-rose-700 hover:text-rose-800"
                            title="Remove line"
                            disabled={disabled || Boolean(draft)}
                            onClick={() => onRemoveLine(node)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )
            })}

            {showAddRow && draft ? (
              <tr className="bg-emerald-50/40">
                <td className="px-3 py-1.5 font-mono text-[11px] text-erp-muted">
                  {draft.parentLineId ? '↳ new' : 'new'}
                </td>
                <td className="px-3 py-2">
                  <div className="min-w-[220px] space-y-1">
                    {draft.parentLineId ? (
                      <p className="text-[11px] text-erp-muted">
                        Child of{' '}
                        {(() => {
                          const parent = snapshot.lines.find((l) => l.id === draft.parentLineId)
                          return parent ? itemLabel(parent) : 'parent'
                        })()}
                      </p>
                    ) : null}
                    <ItemLookupSelect
                      value={draft.itemId}
                      allowEmpty
                      placeholder="Search item…"
                      onChange={(sel) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                itemId: sel?.itemId ?? '',
                                uomId: sel?.uomId ?? '',
                              }
                            : d,
                        )
                      }
                    />
                    <Input
                      value={draft.descriptionOverride}
                      placeholder="Description override (optional)"
                      className="h-8 text-[12px]"
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, descriptionOverride: e.target.value } : d))
                      }
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    className="h-8 text-right text-[12px]"
                    value={draft.perUnitQuantity}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, perUnitQuantity: e.target.value } : d))
                    }
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    className="h-8 text-right text-[12px]"
                    value={draft.scrapPercent}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, scrapPercent: e.target.value } : d))
                    }
                  />
                </td>
                <td className="px-2 py-1.5 text-right text-erp-muted">auto</td>
                <td className="px-2 py-1.5">
                  <Select
                    value={draft.makeOrBuy}
                    className="h-8 text-[12px]"
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, makeOrBuy: e.target.value as MakeOrBuy } : d))
                    }
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    <option value="BUY">BUY</option>
                    <option value="MAKE">MAKE</option>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    value={draft.lineType}
                    className="h-8 text-[12px]"
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, lineType: e.target.value as BomLineType } : d))
                    }
                  >
                    {BOM_LINE_TYPE_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {LINE_TYPE_META[v]?.label ?? v}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    value={draft.isOptional ? 'yes' : 'no'}
                    className="h-8 text-[12px]"
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, isOptional: e.target.value === 'yes' } : d))
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </Select>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <div className="inline-flex items-center gap-0.5">
                    <Button size="sm" className="h-7 px-2" disabled={disabled} onClick={() => void saveDraft()}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" disabled={disabled} onClick={cancelDraft}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {draft?.mode === 'edit' ? (
        <p className="text-[11px] text-erp-muted">
          Tip: focus <strong>Required</strong> to edit WO total, or <strong>Per unit</strong> to edit unit qty. The other
          field recalculates on save.
        </p>
      ) : null}
    </div>
  )
}
