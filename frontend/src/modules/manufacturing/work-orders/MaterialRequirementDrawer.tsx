import { useEffect, useState } from 'react'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import {
  addWorkOrderMaterialRequirement,
  updateWorkOrderMaterialRequirement,
} from '@/services/api/manufacturingApi'
import type { ProductionOrderMaterial } from '@/types/manufacturingProduction'
import { notify } from '@/store/toastStore'

type Props = {
  open: boolean
  onClose: () => void
  workOrderId: string
  /** When set, edit mode; otherwise add mode. */
  material: ProductionOrderMaterial | null
  onSaved: () => void
}

/**
 * Add or edit a WO material requirement (this work order only — also updates the WO BOM snapshot line).
 */
export function MaterialRequirementDrawer({ open, onClose, workOrderId, material, onSaved }: Props) {
  const editing = Boolean(material)
  const lockedItem = Boolean(
    material && (Number(material.reservedQty) > 0 || Number(material.issuedQty) > 0),
  )

  const [itemId, setItemId] = useState('')
  const [itemLabel, setItemLabel] = useState('')
  const [uomId, setUomId] = useState('')
  const [requiredQty, setRequiredQty] = useState('1')
  const [makeOrBuy, setMakeOrBuy] = useState<'MAKE' | 'BUY'>('BUY')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (material) {
      setItemId(material.itemId)
      setItemLabel(`${material.item.code} — ${material.item.name}`)
      setUomId(material.uomId)
      setRequiredQty(String(Number(material.requiredQty) || 1))
      setMakeOrBuy('BUY')
      setRemarks(material.remarks ?? '')
    } else {
      setItemId('')
      setItemLabel('')
      setUomId('')
      setRequiredQty('1')
      setMakeOrBuy('BUY')
      setRemarks('')
    }
  }, [open, material])

  const save = async () => {
    if (!itemId || !uomId || Number(requiredQty) <= 0) {
      notify.error('Item, UOM and required quantity are required')
      return
    }
    setBusy(true)
    try {
      if (editing && material) {
        await updateWorkOrderMaterialRequirement(workOrderId, material.id, {
          requiredQty: Number(requiredQty),
          ...(lockedItem
            ? {}
            : {
                itemId,
                uomId,
              }),
          remarks: remarks.trim() || null,
        })
        notify.success('Material requirement updated')
      } else {
        await addWorkOrderMaterialRequirement(workOrderId, {
          itemId,
          uomId,
          requiredQty: Number(requiredQty),
          makeOrBuy,
          lineType: 'RAW_MATERIAL',
          remarks: remarks.trim() || undefined,
        })
        notify.success('Material requirement added')
      }
      onSaved()
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Unable to save material')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit material requirement' : 'Add material requirement'}
      description="Changes apply to this work order only (BOM snapshot + materials). Master BOM is not changed."
      size="md"
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormField
          label="Item"
          required
          hint={
            lockedItem
              ? 'Item is locked after reservation or issue. Adjust quantity only, or return/release first.'
              : 'Pick from Item Master.'
          }
        >
          {lockedItem ? (
            <Input value={itemLabel} readOnly />
          ) : (
            <ItemLookupSelect
              value={itemId}
              allowEmpty
              placeholder="Search item…"
              onChange={(sel) => {
                setItemId(sel?.itemId ?? '')
                setUomId(sel?.uomId ?? '')
                setItemLabel(sel ? `${sel.itemCode} — ${sel.itemName}` : '')
              }}
            />
          )}
        </FormField>
        <FormField label="Required quantity" required>
          <Input
            type="number"
            min={0.001}
            step="any"
            value={requiredQty}
            onChange={(e) => setRequiredQty(e.target.value)}
          />
        </FormField>
        {!editing ? (
          <FormField label="Make / Buy">
            <Select value={makeOrBuy} onChange={(e) => setMakeOrBuy(e.target.value as 'MAKE' | 'BUY')}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              <option value="BUY">Buy</option>
              <option value="MAKE">Make</option>
            </Select>
          </FormField>
        ) : null}
        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
        {!uomId && itemId ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            Selected item has no base UOM. Set UOM on the item in Item Master.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
