import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { DecimalInput, Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { syncCoreMastersFromApi } from '@/services/bridges/masterApiBridge'
import {
  canSelectPlanningRowForPo,
  planningOrderableQuantity,
} from '@/services/purchase'
import type { PurchasePlanningSheetRow, Vendor } from '@/types/purchaseDomain'
import type { Location } from '@/types/master'
import { useMasterStore } from '@/store/masterStore'
import { formatCurrency } from '@/utils/formatters/currency'
import {
  filterLocationsByUsage,
  formatLocationAddress,
  locationDisplayLabel,
} from '@/utils/locationUtils'

export type CreatePoModalForm = {
  poDate: string
  warehouse: string
  deliveryAddressOptionId: string
  deliveryAddress: string
  orderQuantities: Record<string, number>
  remarks: string
}

type WarehouseOption = {
  id: string
  name: string
  address?: string
}

type DeliveryAddressOption = {
  id: string
  label: string
  address: string
}

type Props = {
  open: boolean
  rows: PurchasePlanningSheetRow[]
  warehouses: WarehouseOption[]
  /** Used to resolve vendor display names when row.preferredVendorName is empty (API mode). */
  vendors?: Vendor[]
  creating?: boolean
  onClose: () => void
  onConfirm: (form: CreatePoModalForm) => void
}

const CUSTOM_ADDRESS_ID = '__custom__'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function vendorLabel(
  vendorId: string,
  rowName: string | null | undefined,
  vendors: Vendor[],
): string {
  if (vendorId === '__none__') return 'No vendor selected'
  const fromRow = (rowName ?? '').trim()
  if (fromRow && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(fromRow)) return fromRow
  const match = vendors.find((v) => v.id === vendorId)
  if (match) {
    const code = match.vendorCode?.trim()
    const name = match.vendorName?.trim()
    if (code && name) return `${code} — ${name}`
    return name || code || vendorId
  }
  return fromRow || vendorId
}

function buildDeliveryAddressOptions(
  warehouseId: string,
  warehouses: WarehouseOption[],
  locations: Location[],
): DeliveryAddressOption[] {
  const options: DeliveryAddressOption[] = []
  const purchaseLocs = filterLocationsByUsage(locations, 'purchase')

  const appendWarehouse = (wh: WarehouseOption) => {
    const address = wh.address?.trim() || wh.name?.trim()
    if (!address) return
    options.push({
      id: `wh:${wh.id}`,
      label: `${wh.name} (warehouse)`,
      address,
    })
  }

  const appendLocation = (loc: Location) => {
    const address = formatLocationAddress(loc)
    if (!address.trim()) return
    options.push({
      id: `loc:${loc.id}`,
      label: locationDisplayLabel(loc),
      address,
    })
  }

  if (warehouseId) {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) appendWarehouse(wh)
    purchaseLocs
      .filter((loc) => loc.warehouseId === warehouseId)
      .forEach(appendLocation)
  }

  for (const wh of warehouses) {
    if (wh.id === warehouseId) continue
    appendWarehouse(wh)
  }

  if (!warehouseId) {
    purchaseLocs.forEach(appendLocation)
  }

  const seen = new Set<string>()
  const unique = options.filter((o) => {
    if (seen.has(o.address)) return false
    seen.add(o.address)
    return true
  })

  return [
    ...unique,
    { id: CUSTOM_ADDRESS_ID, label: 'Custom address…', address: '' },
  ]
}

function initialOrderQuantities(rows: PurchasePlanningSheetRow[]): Record<string, number> {
  return Object.fromEntries(
    rows.map((r) => [r.id, planningOrderableQuantity(r)]),
  )
}

export function PurchasePlanningCreatePoModal({
  open,
  rows,
  warehouses,
  vendors = [],
  creating,
  onClose,
  onConfirm,
}: Props) {
  const storeLocations = useMasterStore((s) => s.locations)
  const [masterLocations, setMasterLocations] = useState<Location[]>([])
  const [form, setForm] = useState<CreatePoModalForm>({
    poDate: today(),
    warehouse: '',
    deliveryAddressOptionId: '',
    deliveryAddress: '',
    orderQuantities: {},
    remarks: '',
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      if (storeLocations.length > 0) {
        setMasterLocations(storeLocations)
        return
      }
      try {
        await syncCoreMastersFromApi()
        if (!cancelled) {
          setMasterLocations(useMasterStore.getState().locations)
        }
      } catch {
        if (!cancelled) setMasterLocations([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, storeLocations])

  const locations = masterLocations.length > 0 ? masterLocations : storeLocations

  const addressOptions = useMemo(
    () => buildDeliveryAddressOptions(form.warehouse, warehouses, locations),
    [form.warehouse, warehouses, locations],
  )

  useEffect(() => {
    if (!open) return
    const defaultWarehouseId = warehouses[0]?.id ?? ''
    setForm({
      poDate: today(),
      warehouse: defaultWarehouseId,
      deliveryAddressOptionId: '',
      deliveryAddress: '',
      orderQuantities: initialOrderQuantities(rows),
      remarks: '',
    })
  }, [open, rows, warehouses])

  useEffect(() => {
    if (!open || !form.warehouse) return
    const options = buildDeliveryAddressOptions(form.warehouse, warehouses, locations)
    const first = options.find((o) => o.id !== CUSTOM_ADDRESS_ID)
    if (!first) return
    setForm((f) => {
      if (f.deliveryAddress.trim() && f.deliveryAddressOptionId) return f
      return {
        ...f,
        deliveryAddressOptionId: first.id,
        deliveryAddress: first.address,
      }
    })
  }, [open, form.warehouse, warehouses, locations])

  const onWarehouseChange = (warehouseId: string) => {
    const options = buildDeliveryAddressOptions(warehouseId, warehouses, locations)
    const first = options.find((o) => o.id !== CUSTOM_ADDRESS_ID)
    setForm((f) => ({
      ...f,
      warehouse: warehouseId,
      deliveryAddressOptionId: first?.id ?? CUSTOM_ADDRESS_ID,
      deliveryAddress: first?.address ?? '',
    }))
  }

  const onAddressOptionChange = (optionId: string) => {
    const match = addressOptions.find((o) => o.id === optionId)
    setForm((f) => ({
      ...f,
      deliveryAddressOptionId: optionId,
      deliveryAddress: optionId === CUSTOM_ADDRESS_ID ? f.deliveryAddress : match?.address ?? '',
    }))
  }

  const setRowQty = (rowId: string, value: number, max: number) => {
    const qty = Math.max(0, Math.min(max, value))
    setForm((f) => ({
      ...f,
      orderQuantities: { ...f.orderQuantities, [rowId]: qty },
    }))
  }

  const analysis = useMemo(() => {
    const errors: string[] = []
    const ineligible = rows.filter((r) => !canSelectPlanningRowForPo(r))
    for (const r of ineligible) {
      const gaps: string[] = []
      if (!['vendor_selected', 'approved', 'po_pending', 'partially_ordered'].includes(r.status)) {
        gaps.push('ready status')
      }
      if (!r.preferredVendorId) gaps.push('vendor')
      if (!(planningOrderableQuantity(r) > 0)) gaps.push('quantity')
      if (!(r.expectedRate > 0)) gaps.push('rate')
      if (!r.requiredByDate) gaps.push('required date')
      errors.push(`${r.planningNumber}: missing ${gaps.join(', ') || 'eligibility'}`)
    }

    for (const r of rows) {
      const max = planningOrderableQuantity(r)
      const qty = form.orderQuantities[r.id] ?? 0
      if (!(qty > 0)) {
        errors.push(`${r.planningNumber}: PO quantity must be greater than zero`)
      } else if (qty > max + 1e-6) {
        errors.push(`${r.planningNumber}: PO quantity cannot exceed ${max}`)
      }
    }

    const byVendor = new Map<string, PurchasePlanningSheetRow[]>()
    for (const r of rows) {
      const key = r.preferredVendorId || '__none__'
      const list = byVendor.get(key) ?? []
      list.push(r)
      byVendor.set(key, list)
    }

    const vendorGroups = [...byVendor.entries()].map(([vendorId, items]) => ({
      vendorId,
      vendorName: vendorLabel(vendorId, items[0]?.preferredVendorName, vendors),
      items,
      amount: items.reduce((s, i) => {
        const qty = form.orderQuantities[i.id] ?? planningOrderableQuantity(i)
        const rate = i.negotiatedRate ?? i.expectedRate
        return s + qty * rate
      }, 0),
    }))

    const vendorCount = vendorGroups.filter((g) => g.vendorId !== '__none__').length
    const poCount = vendorCount
    const allValid =
      ineligible.length === 0 &&
      rows.length > 0 &&
      rows.every((r) => {
        const max = planningOrderableQuantity(r)
        const qty = form.orderQuantities[r.id] ?? 0
        return qty > 0 && qty <= max + 1e-6
      })

    return { errors, vendorGroups, vendorCount, poCount, allEligible: allValid }
  }, [rows, vendors, form.orderQuantities])

  return (
    <Modal
      open={open}
      onClose={() => !creating && onClose()}
      closeDisabled={creating}
      title="Create Purchase Order"
      description="Set PO quantities, date, and delivery address before creating POs."
      size="lg"
      footer={
        <ErpButtonGroup className="justify-end">
          <ErpButton type="button" variant="secondary" disabled={creating} onClick={onClose}>
            Cancel
          </ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            icon={ShoppingCart}
            disabled={creating || !analysis.allEligible}
            disabledReason={
              !analysis.allEligible
                ? 'Fix missing data and PO quantities before creating POs'
                : undefined
            }
            onClick={() => onConfirm(form)}
          >
            {creating ? 'Creating…' : 'Create Purchase Order'}
          </ErpButton>
        </ErpButtonGroup>
      }
    >
      <div className="space-y-4 text-[13px]">
        <div className="grid gap-2 rounded-md border border-erp-border bg-erp-surface-alt/50 p-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">
              Selected rows
            </p>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-erp-text">
              {rows.length}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">
              Vendors
            </p>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-erp-text">
              {analysis.vendorCount}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">
              POs to create
            </p>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-erp-text">
              {analysis.poCount}
            </p>
          </div>
        </div>

        <p className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-2 text-[12px] text-erp-text">
          One PO per vendor. Adjust PO quantity per line (defaults to remaining qty). Payment and
          delivery terms come from Purchase Setup and vendor master.
        </p>

        {analysis.errors.length > 0 ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="font-semibold text-red-800">Missing data</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-red-700">
              {analysis.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[12px] font-semibold text-erp-text">Lines & PO quantities</p>
          <div className="max-h-56 space-y-2 overflow-auto rounded-md border border-erp-border">
            {analysis.vendorGroups.map((g) => (
              <div key={g.vendorId} className="border-b border-erp-border px-3 py-2 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-erp-text">{g.vendorName}</span>
                  <span className="tabular-nums text-erp-muted">
                    {formatCurrency(g.amount)}
                  </span>
                </div>
                <ul className="mt-2 space-y-2">
                  {g.items.map((i) => {
                    const max = planningOrderableQuantity(i)
                    const qty = form.orderQuantities[i.id] ?? max
                    return (
                      <li
                        key={i.id}
                        className="grid gap-2 rounded border border-erp-border/60 bg-erp-surface-alt/30 p-2 sm:grid-cols-[1fr_7rem_5rem]"
                      >
                        <div className="min-w-0 text-[12px]">
                          <span className="font-mono text-erp-text">{i.itemCode}</span>
                          <span className="text-erp-muted"> — {i.itemName}</span>
                          <div className="mt-0.5 text-[11px] text-erp-muted">
                            Remaining {max} {i.uom}
                          </div>
                        </div>
                        <label className="block">
                          <span className="mb-0.5 block text-[11px] font-medium text-erp-muted">
                            PO qty
                          </span>
                          <DecimalInput
                            min={0}
                            max={max}
                            className="h-8 w-full text-right"
                            value={qty}
                            onChange={(v) => setRowQty(i.id, v, max)}
                          />
                        </label>
                        <div className="self-end text-right text-[11px] tabular-nums text-erp-muted">
                          {i.uom}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">PO date</span>
            <Input
              type="date"
              value={form.poDate}
              onChange={(e) => setForm((f) => ({ ...f, poDate: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">
              Delivery warehouse
            </span>
            <Select value={form.warehouse} onChange={(e) => onWarehouseChange(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">
              Delivery address
            </span>
            <Select
              value={form.deliveryAddressOptionId}
              onChange={(e) => onAddressOptionChange(e.target.value)}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {addressOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">
              Address details
            </span>
            <Textarea
              rows={3}
              value={form.deliveryAddress}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  deliveryAddress: e.target.value,
                  deliveryAddressOptionId: CUSTOM_ADDRESS_ID,
                }))
              }
              placeholder="Pick an address above or type a custom delivery address"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">Remarks</span>
            <Textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            />
          </label>
        </div>
      </div>
    </Modal>
  )
}
