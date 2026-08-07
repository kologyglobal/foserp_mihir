import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import {
  PurchaseLineDetailsDrawer,
  PurchaseLineDrawerSection,
} from '@/components/purchase/PurchaseLineDetailsDrawer'
import { useMasterStore } from '@/store/masterStore'
import type { PurchaseOrderLine } from '@/types/purchaseDomain'
import { cn } from '@/utils/cn'
import {
  formatPoLineGstLabel,
  isPoServiceLine,
  mapPoDiscountFields,
  resolvePoDiscountMode,
  type PoDiscountMode,
} from '@/utils/poCompactLineHelpers'
import { appConfirm } from '@/store/confirmDialogStore'

export type QuickManualLineDraft = Partial<PurchaseOrderLine> & {
  key?: string
  lineType?: 'GOODS' | 'SERVICE'
}

export type QuickManualLineDrawerProps = {
  open: boolean
  mode: 'create' | 'edit'
  /** Catalog line: item locked; free-text when itemId empty */
  initial: QuickManualLineDraft | null
  isInterstate: boolean
  qualityTestGroupOptions?: Array<{ code: string; label: string }>
  /** When true, show QC fields for goods / when already QC-required */
  showQualityFields?: boolean
  onClose: () => void
  onSave: (patch: Partial<PurchaseOrderLine>) => void
  onDelete?: () => void
  onDuplicate?: () => void
  formatCurrency?: (n: number) => string
}

type FormState = {
  lineType: 'GOODS' | 'SERVICE'
  itemName: string
  description: string
  hsnCode: string
  hsnId: string | null
  gstGroupId: string | null
  gstGroupCode: string
  gstRatePct: number
  uom: string
  uomId: string | null
  uomQuantity: number
  rate: number
  discountMode: PoDiscountMode
  discountValue: number
  expectedDeliveryDate: string
  qcRequired: boolean
  qualityTestGroupCode: string
  remarks: string
  specification: string
  warehouseId: string
  warehouseName: string
  requisitionNo: string
}

function draftToForm(initial: QuickManualLineDraft | null): FormState {
  const lineType: 'GOODS' | 'SERVICE' =
    initial?.lineType === 'SERVICE' || initial?.itemType === 'service' ? 'SERVICE' : 'GOODS'
  const discountMode = resolvePoDiscountMode(initial ?? {})
  const discountValue =
    discountMode === 'pct'
      ? Number(initial?.discountPct) || 0
      : Number(initial?.discountAmount) || 0
  return {
    lineType,
    itemName: (initial?.itemName || initial?.description || '').trim(),
    description: (initial?.description || initial?.itemName || '').trim(),
    hsnCode: (initial?.hsnCode || initial?.sacCode || '').trim(),
    hsnId: initial?.hsnId ?? null,
    gstGroupId: initial?.gstGroupId ?? null,
    gstGroupCode: initial?.gstGroupCode ?? '',
    gstRatePct: Number(initial?.gstRatePct) || 0,
    uom: initial?.uom || 'NOS',
    uomId: initial?.uomId ?? null,
    uomQuantity: Number(initial?.uomQuantity ?? initial?.quantity) || 1,
    rate: Number(initial?.rate) || 0,
    discountMode,
    discountValue,
    expectedDeliveryDate:
      initial?.expectedDeliveryDate || initial?.requiredDate || '',
    qcRequired: Boolean(initial?.qcRequired),
    qualityTestGroupCode: initial?.qualityTestGroupCode ?? '',
    remarks: initial?.remarks ?? '',
    specification: initial?.specification ?? '',
    warehouseId: initial?.warehouseId ?? '',
    warehouseName: initial?.warehouseName ?? '',
    requisitionNo: initial?.requisitionNo ?? '',
  }
}

/**
 * Quick Manual Entry / Edit Line drawer for PO compact grid.
 * Collects only entry-safe fields — no lifecycle qty columns.
 */
export function QuickManualLineDrawer({
  open,
  mode,
  initial,
  isInterstate,
  qualityTestGroupOptions = [],
  showQualityFields = true,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  formatCurrency,
}: QuickManualLineDrawerProps) {
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const gstGroups = useMasterStore((s) => s.gstGroups)
  const gstRates = useMasterStore((s) => s.gstRates)
  const uoms = useMasterStore((s) => s.uoms)
  const getHsn = useMasterStore((s) => s.getHsn)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)

  const [form, setForm] = useState<FormState>(() => draftToForm(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  const isCatalog = Boolean(initial?.itemId)
  const isService = form.lineType === 'SERVICE'

  useEffect(() => {
    if (!open) return
    setForm(draftToForm(initial))
    setErrors({})
    setDirty(false)
  }, [open, initial])

  const patchForm = (partial: Partial<FormState>) => {
    setDirty(true)
    setForm((prev) => ({ ...prev, ...partial }))
  }

  const activeHsnOptions = useMemo(() => {
    return hsnMasters.filter((h) => {
      if (!h.isActive) return false
      if (form.gstGroupId && h.gstGroupId !== form.gstGroupId) return false
      return true
    })
  }, [hsnMasters, form.gstGroupId])

  const rateFromGroup = (groupId: string | null): number => {
    if (!groupId) return 0
    const rates = gstRates.filter((r) => r.gstGroupId === groupId && r.isActive !== false)
    if (!rates.length) return 0
    const sorted = [...rates].sort((a, b) => {
      const ad = a.dateFrom || ''
      const bd = b.dateFrom || ''
      return bd.localeCompare(ad)
    })
    const r = sorted[0]
    const cgst = Number(r?.cgst) || 0
    const sgst = Number(r?.sgst) || 0
    const igst = Number(r?.igst) || 0
    return igst > 0 ? igst : cgst + sgst
  }

  const applyHsnCode = (raw: string) => {
    const code = raw.trim()
    const match = code
      ? hsnMasters.find(
          (h) =>
            h.isActive &&
            h.code.localeCompare(code, undefined, { sensitivity: 'accent' }) === 0,
        )
      : undefined
    if (match) {
      const group = match.gstGroupId ? getGstGroup(match.gstGroupId) : undefined
      const rate = rateFromGroup(match.gstGroupId ?? null)
      patchForm({
        hsnCode: match.code,
        hsnId: match.id,
        gstGroupId: match.gstGroupId ?? form.gstGroupId,
        gstGroupCode: group?.code ?? form.gstGroupCode,
        gstRatePct: rate > 0 ? rate : form.gstRatePct,
      })
      return
    }
    patchForm({ hsnCode: raw, hsnId: null })
  }

  const applyGstGroup = (groupId: string) => {
    const id = groupId || null
    const group = id ? getGstGroup(id) : undefined
    const rate = rateFromGroup(id)
    const currentHsn = form.hsnId ? getHsn(form.hsnId) : null
    let hsnId = form.hsnId
    let hsnCode = form.hsnCode
    if (currentHsn && id && currentHsn.gstGroupId !== id) {
      hsnId = null
      if (isCatalog) hsnCode = ''
    }
    patchForm({
      gstGroupId: id,
      gstGroupCode: group?.code ?? '',
      gstRatePct: rate > 0 ? rate : form.gstRatePct,
      hsnId,
      hsnCode,
    })
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!isCatalog && !form.itemName.trim()) {
      next.itemName = 'Description is required'
    }
    if (!form.hsnId && !form.hsnCode.trim()) {
      next.hsnCode = 'HSN/SAC is required'
    }
    if (!(form.uomQuantity > 0)) next.uomQuantity = 'Qty must be > 0'
    if (!(form.rate >= 0)) next.rate = 'Rate is required'
    if (!form.uom.trim()) next.uom = 'UOM is required'
    if (!form.gstGroupId && !(form.gstRatePct > 0) && !form.hsnId) {
      next.gstGroupId = 'GST group or linked HSN is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const discount = mapPoDiscountFields(form.discountMode, form.discountValue)
    const service = form.lineType === 'SERVICE'
    const patch: Partial<PurchaseOrderLine> = {
      lineType: form.lineType,
      itemType: service ? 'service' : 'raw_material',
      productType: service ? 'service' : isCatalog ? initial?.productType : '',
      category: service ? 'job_work' : isCatalog ? initial?.category : 'raw_material',
      itemName: form.itemName.trim() || form.description.trim(),
      description: form.description.trim() || form.itemName.trim(),
      hsnCode: form.hsnCode.trim(),
      sacCode: service ? form.hsnCode.trim() : null,
      hsnId: form.hsnId,
      gstGroupId: form.gstGroupId,
      gstGroupCode: form.gstGroupCode,
      gstRatePct: form.gstRatePct,
      uom: form.uom,
      uomId: form.uomId,
      uomQuantity: form.uomQuantity,
      quantity: form.uomQuantity,
      rate: form.rate,
      discountPct: discount.discountPct,
      discountAmount: discount.discountAmount,
      qcRequired: service ? false : form.qcRequired,
      qualityTestGroupCode: service
        ? null
        : form.qualityTestGroupCode.trim() || null,
      remarks: form.remarks.trim(),
      specification: form.specification.trim(),
      warehouseId: form.warehouseId,
      warehouseName: form.warehouseName,
      requisitionNo: form.requisitionNo.trim() || null,
    }
    if (!isCatalog) {
      patch.itemId = ''
      patch.itemCode = patch.itemCode ?? ''
      ;(patch as Partial<PurchaseOrderLine> & { manualEntry?: boolean }).manualEntry = true
    }
    onSave(patch)
    setDirty(false)
  }

  const requestClose = async () => {
    if (dirty) {
      const ok = await appConfirm({
        title: 'Discard line changes?',
        description: 'You have unsaved edits on this line. Close without saving?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      })
      if (!ok) return
    }
    onClose()
  }

  const title =
    mode === 'create'
      ? 'Quick Manual Entry'
      : isCatalog
        ? `Edit line · ${initial?.itemCode || initial?.itemName || ''}`
        : 'Edit manual line'

  const gstPreview = formatPoLineGstLabel(
    { gstRatePct: form.gstRatePct },
    isInterstate,
  )

  const uomOptions = useMemo(() => {
    const active = uoms.filter((u) => u.isActive !== false)
    if (!form.uom || active.some((u) => u.uomCode === form.uom)) return active
    return active
  }, [uoms, form.uom])

  return (
    <PurchaseLineDetailsDrawer
      open={open}
      onClose={requestClose}
      title={title}
      subtitle={
        isCatalog
          ? 'Catalog item — adjust qty, rate, tax, and optional details'
          : 'Manual line — enter description, qty, rate, and tax'
      }
      widthClassName="max-w-xl"
      footer={
        <>
          {mode === 'edit' && onDelete ? (
            <ErpButton type="button" size="sm" variant="outline" onClick={onDelete}>
              Delete
            </ErpButton>
          ) : null}
          {mode === 'edit' && onDuplicate ? (
            <ErpButton type="button" size="sm" variant="outline" onClick={onDuplicate}>
              Duplicate
            </ErpButton>
          ) : null}
          <div className="flex-1" />
          <ErpButton type="button" size="sm" variant="outline" onClick={requestClose}>
            Cancel
          </ErpButton>
          <ErpButton type="button" size="sm" variant="primary" onClick={handleSave}>
            Save Line
          </ErpButton>
        </>
      }
    >
      <div className="space-y-4">
        <PurchaseLineDrawerSection title="Line">
          <div className="grid gap-3 sm:grid-cols-2">
            {isCatalog ? (
              <div className="sm:col-span-2 rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2 text-[12px]">
                <span className="font-medium text-erp-text">
                  {initial?.itemCode || '—'}
                </span>
                <span className="mx-1.5 text-erp-muted">·</span>
                <span className="text-erp-text">{initial?.itemName || '—'}</span>
              </div>
            ) : null}

            <label className="block text-[12px] sm:col-span-2">
              <span className="mb-1 block font-medium text-erp-text">
                Description <span className="text-erp-danger-fg">*</span>
              </span>
              <Input
                value={form.itemName}
                onChange={(e) =>
                  patchForm({
                    itemName: e.target.value,
                    description: e.target.value,
                  })
                }
                placeholder="Item / service description"
                className={cn(errors.itemName && 'border-erp-danger-fg')}
              />
              {errors.itemName ? (
                <p className="mt-0.5 text-[11px] text-erp-danger-fg">{errors.itemName}</p>
              ) : null}
            </label>

            <label className="block text-[12px]">
              <span className="mb-1 block font-medium text-erp-text">
                {isService ? 'SAC' : 'HSN'} <span className="text-erp-danger-fg">*</span>
              </span>
              <Input
                list="po-quick-hsn-list"
                value={form.hsnCode}
                onChange={(e) => applyHsnCode(e.target.value)}
                placeholder={isService ? 'SAC e.g. 998314' : 'HSN e.g. 7208'}
                className={cn('font-mono', errors.hsnCode && 'border-erp-danger-fg')}
              />
              <datalist id="po-quick-hsn-list">
                {activeHsnOptions.map((h) => (
                  <option key={h.id} value={h.code}>
                    {h.description ? `${h.code} — ${h.description}` : h.code}
                  </option>
                ))}
              </datalist>
              {errors.hsnCode ? (
                <p className="mt-0.5 text-[11px] text-erp-danger-fg">{errors.hsnCode}</p>
              ) : null}
            </label>

            <label className="block text-[12px]">
              <span className="mb-1 block font-medium text-erp-text">
                GST Group <span className="text-erp-danger-fg">*</span>
              </span>
              <Select
                value={form.gstGroupId ?? ''}
                onChange={(e) => applyGstGroup(e.target.value)}
                className={cn(errors.gstGroupId && 'border-erp-danger-fg')}
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {gstGroups
                  .filter((g) => g.isActive)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code}
                      {g.description ? ` — ${g.description}` : ''}
                    </option>
                  ))}
              </Select>
              <p className="mt-1 text-[11px] tabular-nums text-erp-muted">{gstPreview}</p>
              {errors.gstGroupId ? (
                <p className="mt-0.5 text-[11px] text-erp-danger-fg">{errors.gstGroupId}</p>
              ) : null}
            </label>

            <label className="block text-[12px]">
              <span className="mb-1 block font-medium text-erp-text">
                Qty <span className="text-erp-danger-fg">*</span>
              </span>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.uomQuantity}
                onChange={(e) => patchForm({ uomQuantity: Number(e.target.value) })}
                className={cn(errors.uomQuantity && 'border-erp-danger-fg')}
              />
              {errors.uomQuantity ? (
                <p className="mt-0.5 text-[11px] text-erp-danger-fg">{errors.uomQuantity}</p>
              ) : null}
            </label>

            <label className="block text-[12px]">
              <span className="mb-1 block font-medium text-erp-text">
                UOM <span className="text-erp-danger-fg">*</span>
              </span>
              <Select
                value={form.uom}
                onChange={(e) => {
                  const code = e.target.value
                  const u = uomOptions.find((row) => row.uomCode === code)
                  patchForm({ uom: code, uomId: u?.id ?? null })
                }}
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {uomOptions.map((u) => (
                  <option key={u.id} value={u.uomCode}>
                    {u.uomCode}
                  </option>
                ))}
                {form.uom && !uomOptions.some((u) => u.uomCode === form.uom) ? (
                  <option value={form.uom}>{form.uom}</option>
                ) : null}
              </Select>
            </label>

            <label className="block text-[12px]">
              <span className="mb-1 block font-medium text-erp-text">
                Rate <span className="text-erp-danger-fg">*</span>
              </span>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.rate}
                onChange={(e) => patchForm({ rate: Number(e.target.value) })}
                className={cn(errors.rate && 'border-erp-danger-fg')}
              />
              {formatCurrency && form.rate > 0 ? (
                <p className="mt-0.5 text-[11px] text-erp-muted">{formatCurrency(form.rate)}</p>
              ) : null}
            </label>

            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <label className="block text-[12px]">
                <span className="mb-1 block font-medium text-erp-text">Discount</span>
                <Select
                  value={form.discountMode}
                  onChange={(e) =>
                    patchForm({
                      discountMode: e.target.value === 'flat' ? 'flat' : 'pct',
                    })
                  }
                >
                  <option value="pct">%</option>
                  <option value="flat">Flat</option>
                </Select>
              </label>
              <label className="block text-[12px]">
                <span className="mb-1 block font-medium text-erp-text">
                  {form.discountMode === 'pct' ? 'Discount %' : 'Discount amount'}
                </span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.discountValue}
                  onChange={(e) => patchForm({ discountValue: Number(e.target.value) })}
                />
              </label>
            </div>

            {showQualityFields && !isService ? (
              <>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.qcRequired}
                    onChange={(e) => patchForm({ qcRequired: e.target.checked })}
                  />
                  <span className="font-medium text-erp-text">
                    Quality Inspection Required
                  </span>
                </label>
                {form.qcRequired ? (
                  <label className="block text-[12px] sm:col-span-2">
                    <span className="mb-1 block font-medium text-erp-text">
                      Quality Test Group
                    </span>
                    <Select
                      value={form.qualityTestGroupCode}
                      onChange={(e) =>
                        patchForm({ qualityTestGroupCode: e.target.value })
                      }
                    >
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {qualityTestGroupOptions.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.code}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}
              </>
            ) : null}

            <label className="block text-[12px] sm:col-span-2">
              <span className="mb-1 block font-medium text-erp-text">Remarks</span>
              <Textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => patchForm({ remarks: e.target.value })}
                placeholder="Optional line remarks"
              />
            </label>
          </div>
        </PurchaseLineDrawerSection>

        <PurchaseLineDrawerSection
          title="Optional"
          description="Not required for quick entry"
        >
          <label className="block text-[12px]">
            <span className="mb-1 block font-medium text-erp-text">Specification</span>
            <Input
              value={form.specification}
              onChange={(e) => patchForm({ specification: e.target.value })}
            />
          </label>
          <div className="mt-3">
            <ErpButton
              type="button"
              size="sm"
              variant="outline"
              disabled
              title="TODO: wire Item Master create when shared create-item API is available"
            >
              Save as New Item in Item Master
            </ErpButton>
            <p className="mt-1 text-[11px] text-erp-muted">
              Coming soon — creates a catalog item from this free-text line.
            </p>
          </div>
        </PurchaseLineDrawerSection>
      </div>
    </PurchaseLineDetailsDrawer>
  )
}

export function isServiceDraftLine(line: QuickManualLineDraft | null | undefined) {
  return isPoServiceLine(line ?? {})
}
