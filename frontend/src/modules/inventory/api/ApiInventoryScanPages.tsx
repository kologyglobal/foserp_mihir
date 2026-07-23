/**
 * Live inventory barcode scan — lookup item/lot/serial then post stock movements.
 */
import { useMemo, useState } from 'react'
import { QrCode } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { BarcodeScanDialog } from '@/components/barcode/BarcodeScanDialog'
import { Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LocationSelect } from '@/components/masters/LocationSelect'
import { lookupInventoryCode } from '@/services/api/inventorySetupApi'
import { postInwardStock, postIssueStock } from '@/services/api/inventoryApi'
import {
  createInventoryTransfer,
  dispatchInventoryTransfer,
  receiveInventoryTransfer,
  submitInventoryTransfer,
  approveInventoryTransfer,
} from '@/services/api/inventoryDocumentsApi'
import { useMasterStore } from '@/store/masterStore'
import { resolveLocationWarehouseId } from '@/utils/locationUtils'
import { notify } from '@/store/toastStore'

function useScanForm<T extends Record<string, string>>(initial: T) {
  const [form, setForm] = useState(initial)
  const set = (name: string, value: string) =>
    setForm((prev) => ({ ...prev, [name]: value }))
  return { form, set }
}

function FieldInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  name: string
  value: string
  onChange: (name: string, value: string) => void
  type?: string
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="mt-1 w-full rounded border px-3 py-2"
      />
    </label>
  )
}

function ScanShell({
  title,
  description,
  submitLabel,
  children,
  onScan,
}: {
  title: string
  description: string
  submitLabel: string
  children: React.ReactNode
  onScan: (scan: string) => Promise<{ ok: boolean; message?: string; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        autoBreadcrumbs
        badge="Live"
      />
      <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
        Live scan — resolves item code / lot / serial via Inventory lookup, then posts stock movements.
      </p>
      <div className="max-w-md space-y-4 rounded-lg border border-erp-border bg-white p-4">{children}</div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded bg-erp-accent px-4 py-2 text-sm text-white"
      >
        <QrCode className="h-4 w-4" /> {submitLabel}
      </button>
      <BarcodeScanDialog
        open={open}
        title={title}
        onClose={() => setOpen(false)}
        onSubmit={(scan) => onScan(scan)}
        submitLabel={submitLabel}
        fields={children}
      />
    </div>
  )
}

async function resolveScan(code: string, warehouseId?: string) {
  const res = await lookupInventoryCode(code, warehouseId)
  const match = res.data.matches[0]
  if (!match) throw new Error(`No item/lot/serial found for “${code}”`)
  return match
}

export function ApiScanToReceivePage() {
  const locations = useMasterStore((s) => s.locations)
  const warehouses = useMasterStore((s) => s.warehouses)
  const defaultLoc = locations.find((l) => l.isDefault) ?? locations[0]
  const { form, set } = useScanForm({
    locationId: defaultLoc?.id ?? '',
    warehouseId: defaultLoc?.warehouseId ?? warehouses[0]?.id ?? '',
    qty: '1',
    remarks: '',
  })

  return (
    <ScanShell
      title="Scan To Receive"
      description="Post an inward stock receipt by scanning item code, lot, or serial."
      submitLabel="Receive"
      onScan={async (scan) => {
        try {
          if (!form.warehouseId) return { ok: false, error: 'Select a warehouse / location first' }
          const qty = Number(form.qty)
          if (!(qty > 0)) return { ok: false, error: 'Quantity must be greater than zero' }
          const match = await resolveScan(scan, form.warehouseId)
          await postInwardStock({
            itemId: match.itemId,
            warehouseId: form.warehouseId,
            quantity: qty,
            remarks: form.remarks || `Scan receive ${scan}`,
            referenceNo: match.lotNumber ?? match.serialNumber ?? scan,
            idempotencyKey: `scan-inward-${match.itemId}-${form.warehouseId}-${Date.now()}`,
          })
          notify.success(`Received ${qty} of ${match.itemCode}`)
          return { ok: true, message: `Received ${qty} × ${match.itemCode}` }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Receive failed'
          notify.error(msg)
          return { ok: false, error: msg }
        }
      }}
    >
      <label className="block text-sm">
        Location
        <div className="mt-1">
          <LocationSelect
            value={form.locationId}
            onChange={(locId) => {
              set('locationId', locId)
              set('warehouseId', resolveLocationWarehouseId(locId, locations) ?? form.warehouseId)
            }}
            usage="all"
          />
        </div>
      </label>
      <label className="block text-sm">
        Warehouse
        <Select
          value={form.warehouseId}
          onChange={(e) => set('warehouseId', e.target.value)}
          className="mt-1 w-full"
        >
          <option value="">{SELECT_PLACEHOLDER}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.warehouseName}
            </option>
          ))}
        </Select>
      </label>
      <FieldInput label="Qty" name="qty" value={form.qty} onChange={set} type="number" />
      <FieldInput label="Remarks" name="remarks" value={form.remarks} onChange={set} />
    </ScanShell>
  )
}

export function ApiScanToIssuePage() {
  const locations = useMasterStore((s) => s.locations)
  const warehouses = useMasterStore((s) => s.warehouses)
  const defaultLoc = locations.find((l) => l.isDefault) ?? locations[0]
  const { form, set } = useScanForm({
    locationId: defaultLoc?.id ?? '',
    warehouseId: defaultLoc?.warehouseId ?? warehouses[0]?.id ?? '',
    qty: '1',
    remarks: '',
  })

  return (
    <ScanShell
      title="Scan To Issue"
      description="Issue stock by scanning item code, lot, or serial."
      submitLabel="Issue"
      onScan={async (scan) => {
        try {
          if (!form.warehouseId) return { ok: false, error: 'Select a warehouse / location first' }
          const qty = Number(form.qty)
          if (!(qty > 0)) return { ok: false, error: 'Quantity must be greater than zero' }
          const match = await resolveScan(scan, form.warehouseId)
          await postIssueStock({
            itemId: match.itemId,
            warehouseId: form.warehouseId,
            quantity: qty,
            remarks: form.remarks || `Scan issue ${scan}`,
            referenceNo: match.lotNumber ?? match.serialNumber ?? scan,
            idempotencyKey: `scan-issue-${match.itemId}-${form.warehouseId}-${Date.now()}`,
          })
          notify.success(`Issued ${qty} of ${match.itemCode}`)
          return { ok: true, message: `Issued ${qty} × ${match.itemCode}` }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Issue failed'
          notify.error(msg)
          return { ok: false, error: msg }
        }
      }}
    >
      <label className="block text-sm">
        Location
        <div className="mt-1">
          <LocationSelect
            value={form.locationId}
            onChange={(locId) => {
              set('locationId', locId)
              set('warehouseId', resolveLocationWarehouseId(locId, locations) ?? form.warehouseId)
            }}
            usage="all"
          />
        </div>
      </label>
      <label className="block text-sm">
        Warehouse
        <Select
          value={form.warehouseId}
          onChange={(e) => set('warehouseId', e.target.value)}
          className="mt-1 w-full"
        >
          <option value="">{SELECT_PLACEHOLDER}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.warehouseName}
            </option>
          ))}
        </Select>
      </label>
      <FieldInput label="Qty" name="qty" value={form.qty} onChange={set} type="number" />
      <FieldInput label="Remarks" name="remarks" value={form.remarks} onChange={set} />
    </ScanShell>
  )
}

export function ApiScanToTransferPage() {
  const locations = useMasterStore((s) => s.locations)
  const warehouses = useMasterStore((s) => s.warehouses)
  const defaultLoc = locations.find((l) => l.isDefault) ?? locations[0]
  const secondLoc = useMemo(
    () => locations.find((l) => l.id !== defaultLoc?.id) ?? defaultLoc,
    [locations, defaultLoc],
  )
  const { form, set } = useScanForm({
    fromLocationId: defaultLoc?.id ?? '',
    fromWarehouseId: defaultLoc?.warehouseId ?? warehouses[0]?.id ?? '',
    toLocationId: secondLoc?.id ?? '',
    toWarehouseId: secondLoc?.warehouseId ?? warehouses[1]?.id ?? warehouses[0]?.id ?? '',
    qty: '1',
  })

  return (
    <ScanShell
      title="Scan To Transfer"
      description="Create and complete an inter-warehouse transfer by scanning an item code."
      submitLabel="Transfer"
      onScan={async (scan) => {
        try {
          if (!form.fromWarehouseId || !form.toWarehouseId) {
            return { ok: false, error: 'Select from and to warehouses' }
          }
          if (form.fromWarehouseId === form.toWarehouseId) {
            return { ok: false, error: 'From and To warehouses must differ' }
          }
          const qty = Number(form.qty)
          if (!(qty > 0)) return { ok: false, error: 'Quantity must be greater than zero' }
          const match = await resolveScan(scan, form.fromWarehouseId)
          const created = await createInventoryTransfer({
            fromWarehouseId: form.fromWarehouseId,
            toWarehouseId: form.toWarehouseId,
            remarks: `Scan transfer ${scan}`,
            lines: [{ itemId: match.itemId, quantity: qty }],
          })
          const id = created.data.id
          await submitInventoryTransfer(id).catch(() => undefined)
          await approveInventoryTransfer(id).catch(() => undefined)
          await dispatchInventoryTransfer(id)
          const refreshed = await receiveInventoryTransfer(
            id,
            (created.data.lines ?? []).map((line) => ({
              lineId: line.id,
              quantity: qty,
            })),
          )
          notify.success(`Transferred ${qty} of ${match.itemCode}`)
          return {
            ok: true,
            message: `Transfer ${refreshed.data.transferNumber ?? id} completed for ${match.itemCode}`,
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Transfer failed'
          notify.error(msg)
          return { ok: false, error: msg }
        }
      }}
    >
      <label className="block text-sm">
        From Location
        <div className="mt-1">
          <LocationSelect
            value={form.fromLocationId}
            onChange={(locId) => {
              set('fromLocationId', locId)
              set('fromWarehouseId', resolveLocationWarehouseId(locId, locations) ?? form.fromWarehouseId)
            }}
            usage="all"
          />
        </div>
      </label>
      <label className="block text-sm">
        To Location
        <div className="mt-1">
          <LocationSelect
            value={form.toLocationId}
            onChange={(locId) => {
              set('toLocationId', locId)
              set('toWarehouseId', resolveLocationWarehouseId(locId, locations) ?? form.toWarehouseId)
            }}
            usage="all"
          />
        </div>
      </label>
      <FieldInput label="Qty" name="qty" value={form.qty} onChange={set} type="number" />
    </ScanShell>
  )
}
