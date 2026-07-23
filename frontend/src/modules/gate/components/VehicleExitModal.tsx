import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { GateModal } from './GateModal'
import { InsideDuration } from './InsideDuration'
import { ErpButton } from '@/components/erp/ErpButton'
import { Checkbox, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { GateVehicle } from '../types/gate.types'
import { gateService } from '../api/gateService'

/** Compact vehicle exit modal — guards against exit-before-entry and duplicate exits. */
export function VehicleExitModal({
  vehicle,
  onClose,
  onDone,
}: {
  vehicle: GateVehicle | null
  onClose: () => void
  onDone: (updated: GateVehicle) => void
}) {
  const [cabinChecked, setCabinChecked] = useState(false)
  const [underbodyChecked, setUnderbodyChecked] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  if (!vehicle) return null
  const checklistDone = cabinChecked && underbodyChecked

  const confirmExit = async () => {
    if (busy) return
    if (!checklistDone) {
      notify.warning('Complete the exit checklist before confirming.')
      return
    }
    setBusy(true)
    try {
      const updated = await gateService.recordVehicleExit(vehicle.id, remarks.trim() || undefined)
      notify.success(`Vehicle ${vehicle.vehicleNumber} exit recorded.`)
      onDone(updated)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not record vehicle exit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GateModal
      open
      onClose={onClose}
      title="Confirm Vehicle Exit"
      subtitle={`${vehicle.entryNumber} · ${vehicle.vehicleNumber}`}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </ErpButton>
          <ErpButton icon={LogOut} onClick={() => void confirmExit()} loading={busy} disabled={busy || !checklistDone}>
            Confirm Vehicle Exit
          </ErpButton>
        </div>
      }
    >
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <div>
          <dt className="text-erp-muted">Vehicle</dt>
          <dd className="font-semibold tabular-nums text-erp-text">{vehicle.vehicleNumber}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Purpose</dt>
          <dd className="font-medium text-erp-text">{vehicle.purpose}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Related document</dt>
          <dd className="font-medium text-erp-text">{vehicle.relatedDocument ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Seal</dt>
          <dd className="font-medium text-erp-text">{vehicle.sealNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Entry time</dt>
          <dd className="font-medium text-erp-text">{vehicle.entryTime ? formatDateTime(vehicle.entryTime) : '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Duration inside</dt>
          <dd className="font-medium">
            <InsideDuration from={vehicle.entryTime} />
          </dd>
        </div>
      </dl>
      <div className="space-y-3">
        <div className="space-y-2 rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2.5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Exit checklist</p>
          <Checkbox label="Cabin checked" checked={cabinChecked} onChange={(e) => setCabinChecked(e.target.checked)} />
          <Checkbox
            label="Underbody / load bed checked"
            checked={underbodyChecked}
            onChange={(e) => setUnderbodyChecked(e.target.checked)}
          />
        </div>
        <FormField label="Exit remarks">
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
        </FormField>
      </div>
    </GateModal>
  )
}
