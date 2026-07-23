/**
 * FORM-C — Accounting-style posting drawers for work order materials.
 * Material Issue and Material Return with explicit position + impact preview.
 * Posting actions are explicit; the backend remains the source of truth.
 */
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Textarea } from '@/components/forms/Inputs'
import { PostingImpactPanel } from '../../ui'
import type { ProductionOrderMaterial } from '@/types/manufacturingProduction'

const num = (v: string | number | null | undefined) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3))

interface IssueDrawerProps {
  open: boolean
  onClose: () => void
  material: ProductionOrderMaterial | null
  workOrderNo: string
  busy?: boolean
  onSubmit: (payload: { materialId: string; quantity: number; remarks?: string; idempotencyKey: string }) => Promise<void> | void
}

/** FORM 9 — Material Issue posting preview. */
export function MaterialIssueDrawer({ open, onClose, material, workOrderNo, busy, onSubmit }: IssueDrawerProps) {
  const [qty, setQty] = useState('')
  const [remarks, setRemarks] = useState('')

  const position = useMemo(() => {
    if (!material) return null
    const required = num(material.requiredQty)
    const issued = num(material.issuedQty)
    const returned = num(material.returnedQty)
    const reserved = num(material.reservedQty)
    const remaining = Math.max(0, required - issued + returned)
    const free = material.freeQty != null ? num(material.freeQty) : null
    return { required, issued, returned, reserved, remaining, free }
  }, [material])

  useEffect(() => {
    if (!open || !position) return
    setQty(position.remaining > 0 ? fmt(position.remaining) : '')
    setRemarks('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material?.id])

  if (!material || !position) return null

  const quantity = num(qty)
  const overRemaining = quantity > position.remaining
  const overStock = position.free != null && quantity > position.free
  const noStock = position.free != null && position.free <= 0
  const canPost = quantity > 0 && !overRemaining && !noStock && !busy

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Post Material Issue"
      description={`${material.item.code} — ${material.item.name} · ${workOrderNo}`}
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              void onSubmit({
                materialId: material.id,
                quantity,
                remarks: remarks.trim() || undefined,
                idempotencyKey: crypto.randomUUID(),
              })
            }
            disabled={!canPost}
          >
            {busy ? 'Posting…' : 'Post Material Issue'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-erp-surface-alt px-3 py-2 text-[12px] sm:grid-cols-5">
          <div>
            <p className="text-erp-muted">Required</p>
            <p className="font-semibold tabular-nums">{fmt(position.required)}</p>
          </div>
          <div>
            <p className="text-erp-muted">Reserved</p>
            <p className="font-semibold tabular-nums">{fmt(position.reserved)}</p>
          </div>
          <div>
            <p className="text-erp-muted">Issued</p>
            <p className="font-semibold tabular-nums">{fmt(position.issued)}</p>
          </div>
          <div>
            <p className="text-erp-muted">Remaining</p>
            <p className="font-semibold tabular-nums">{fmt(position.remaining)}</p>
          </div>
          <div>
            <p className="text-erp-muted">Available</p>
            <p className="font-semibold tabular-nums">{position.free != null ? fmt(position.free) : '—'}</p>
          </div>
        </div>

        <FormField
          label="Issue Quantity"
          required
          error={
            overRemaining
              ? `Cannot exceed remaining requirement (${fmt(position.remaining)})`
              : undefined
          }
          hint={material.warehouse ? `From ${material.warehouse.code} — ${material.warehouse.name}` : undefined}
        >
          <Input
            type="number"
            min={0}
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="text-right text-[15px] font-semibold"
            error={overRemaining}
          />
        </FormField>
        {noStock ? (
          <p className="text-[12px] font-medium text-rose-800">
            No unrestricted stock is available in this warehouse (Available = 0). Receive stock via GRN / Opening /
            Transfer before issuing to the work order.
          </p>
        ) : overStock ? (
          <p className="text-[12px] font-medium text-amber-800">
            Requested quantity exceeds unrestricted available stock ({fmt(position.free!)}). The server will reject the
            posting if stock is insufficient.
          </p>
        ) : null}

        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>

        <PostingImpactPanel
          rows={[
            { label: 'Inventory decrease', value: `${fmt(quantity)} ${material.uom.code}`, tone: 'warning' },
            { label: 'Issued after posting', value: fmt(position.issued + quantity) },
            {
              label: 'Remaining requirement',
              value: fmt(Math.max(0, position.remaining - quantity)),
              tone: position.remaining - quantity <= 0 ? 'success' : 'default',
            },
          ]}
          warning="This action posts an Inventory transaction and cannot be directly edited. Use a correction to reverse."
        />
      </div>
    </Modal>
  )
}

interface ReturnDrawerProps {
  open: boolean
  onClose: () => void
  material: ProductionOrderMaterial | null
  workOrderNo: string
  busy?: boolean
  onSubmit: (payload: { materialId: string; quantity: number; remarks?: string; idempotencyKey: string }) => Promise<void> | void
}

/** FORM 10 — Material Return posting preview. */
export function MaterialReturnDrawer({ open, onClose, material, workOrderNo, busy, onSubmit }: ReturnDrawerProps) {
  const [qty, setQty] = useState('')
  const [remarks, setRemarks] = useState('')

  const position = useMemo(() => {
    if (!material) return null
    const issued = num(material.issuedQty)
    const returned = num(material.returnedQty)
    const returnable = Math.max(0, issued - returned)
    return { issued, returned, returnable }
  }, [material])

  useEffect(() => {
    if (!open || !position) return
    setQty('')
    setRemarks('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material?.id])

  if (!material || !position) return null

  const quantity = num(qty)
  const overReturnable = quantity > position.returnable
  const canPost = quantity > 0 && !overReturnable && remarks.trim().length > 0 && !busy

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Post Material Return"
      description={`${material.item.code} — ${material.item.name} · ${workOrderNo}`}
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              void onSubmit({
                materialId: material.id,
                quantity,
                remarks: remarks.trim() || undefined,
                idempotencyKey: crypto.randomUUID(),
              })
            }
            disabled={!canPost}
          >
            {busy ? 'Posting…' : 'Post Material Return'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2 rounded-md bg-erp-surface-alt px-3 py-2 text-[12px]">
          <div>
            <p className="text-erp-muted">Issued</p>
            <p className="font-semibold tabular-nums">{fmt(position.issued)}</p>
          </div>
          <div>
            <p className="text-erp-muted">Already returned</p>
            <p className="font-semibold tabular-nums">{fmt(position.returned)}</p>
          </div>
          <div>
            <p className="text-erp-muted">Returnable</p>
            <p className="font-semibold tabular-nums">{fmt(position.returnable)}</p>
          </div>
        </div>

        <FormField
          label="Return Quantity"
          required
          error={overReturnable ? `Cannot exceed returnable balance (${fmt(position.returnable)})` : undefined}
          hint={material.warehouse ? `Back to ${material.warehouse.code} — ${material.warehouse.name}` : undefined}
        >
          <Input
            type="number"
            min={0}
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="text-right text-[15px] font-semibold"
            error={overReturnable}
          />
        </FormField>

        <FormField label="Reason / Remarks" required hint="Returns require a business reason for the audit trail.">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>

        <PostingImpactPanel
          rows={[
            { label: 'Inventory increase', value: `${fmt(quantity)} ${material.uom.code}`, tone: 'success' },
            { label: 'Work order responsibility', value: `− ${fmt(quantity)}` },
            { label: 'Returned after posting', value: fmt(position.returned + quantity) },
          ]}
          warning="This action posts an Inventory transaction and cannot be directly edited."
        />
      </div>
    </Modal>
  )
}
