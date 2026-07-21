import { useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { canSelectPlanningRowForPo } from '@/services/purchase'
import type { PurchasePlanningSheetRow, Vendor } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'

export type CreatePoModalForm = {
  poDate: string
  warehouse: string
  deliveryAddress: string
  paymentTerms: string
  deliveryTerms: string
  remarks: string
}

type Props = {
  open: boolean
  rows: PurchasePlanningSheetRow[]
  warehouses: { id: string; name: string }[]
  /** Used to resolve vendor display names when row.preferredVendorName is empty (API mode). */
  vendors?: Vendor[]
  creating?: boolean
  onClose: () => void
  onConfirm: (form: CreatePoModalForm) => void
}

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

export function PurchasePlanningCreatePoModal({
  open,
  rows,
  warehouses,
  vendors = [],
  creating,
  onClose,
  onConfirm,
}: Props) {
  const [form, setForm] = useState<CreatePoModalForm>({
    poDate: today(),
    warehouse: warehouses[0]?.id ?? '',
    deliveryAddress: '',
    paymentTerms: 'Net 30',
    deliveryTerms: 'Ex-Works',
    remarks: '',
  })

  const analysis = useMemo(() => {
    const errors: string[] = []
    const ineligible = rows.filter((r) => !canSelectPlanningRowForPo(r))
    for (const r of ineligible) {
      const gaps: string[] = []
      if (!r.actionMessage) gaps.push('Action Message')
      if (!['vendor_selected', 'approved', 'po_pending'].includes(r.status)) {
        gaps.push('ready status')
      }
      if (!r.preferredVendorId) gaps.push('vendor')
      const qty = r.netPurchaseQuantity > 0 ? r.netPurchaseQuantity : r.requiredQuantity
      if (!(qty > 0)) gaps.push('quantity')
      if (!(r.expectedRate > 0)) gaps.push('rate')
      if (!r.requiredByDate) gaps.push('required date')
      errors.push(`${r.planningNumber}: missing ${gaps.join(', ') || 'eligibility'}`)
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
      amount: items.reduce((s, i) => s + i.estimatedAmount, 0),
    }))

    const vendorCount = vendorGroups.filter((g) => g.vendorId !== '__none__').length
    const poCount = vendorCount
    const allEligible = ineligible.length === 0 && rows.length > 0

    return { errors, vendorGroups, vendorCount, poCount, allEligible }
  }, [rows, vendors])

  return (
    <Modal
      open={open}
      onClose={() => !creating && onClose()}
      closeDisabled={creating}
      title="Create Purchase Order"
      description="Review selection and commercial defaults before creating POs."
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
                ? 'Fix missing data on all selected rows before creating POs'
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
          The system will create one Purchase Order for each selected vendor.
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
          <p className="mb-2 text-[12px] font-semibold text-erp-text">Vendor-grouped preview</p>
          <div className="max-h-48 space-y-2 overflow-auto rounded-md border border-erp-border">
            {analysis.vendorGroups.map((g) => (
              <div key={g.vendorId} className="border-b border-erp-border px-3 py-2 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-erp-text">{g.vendorName}</span>
                  <span className="tabular-nums text-erp-muted">
                    {g.items.length} item{g.items.length === 1 ? '' : 's'} ·{' '}
                    {formatCurrency(g.amount)}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5 text-[12px] text-erp-muted">
                  {g.items.map((i) => (
                    <li key={i.id}>
                      {i.itemCode} — {i.itemName} · qty{' '}
                      {i.netPurchaseQuantity || i.requiredQuantity}
                    </li>
                  ))}
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
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">Warehouse</span>
            <Select
              value={form.warehouse}
              onChange={(e) => setForm((f) => ({ ...f, warehouse: e.target.value }))}
            >
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
            <Textarea
              rows={2}
              value={form.deliveryAddress}
              onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">Payment terms</span>
            <Input
              value={form.paymentTerms}
              onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-erp-muted">Delivery terms</span>
            <Input
              value={form.deliveryTerms}
              onChange={(e) => setForm((f) => ({ ...f, deliveryTerms: e.target.value }))}
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
