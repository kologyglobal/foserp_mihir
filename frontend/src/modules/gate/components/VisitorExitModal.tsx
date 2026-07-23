import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { GateModal } from './GateModal'
import { InsideDuration } from './InsideDuration'
import { ErpButton } from '@/components/erp/ErpButton'
import { Checkbox, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { VisitorVisit } from '../types/gate.types'
import { gateService } from '../api/gateService'

/** Visitor exit confirmation — prevents duplicate exits via service guard + busy lock. */
export function VisitorExitModal({
  visit,
  onClose,
  onDone,
}: {
  visit: VisitorVisit | null
  onClose: () => void
  onDone: (updated: VisitorVisit) => void
}) {
  const [badgeReturned, setBadgeReturned] = useState(true)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  if (!visit) return null

  const confirmExit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const updated = await gateService.recordVisitorExit(visit.id, {
        badgeReturned,
        exitRemarks: remarks.trim() || undefined,
      })
      notify.success(`Exit recorded for ${visit.visitorName}.`)
      onDone(updated)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not record exit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GateModal
      open
      onClose={onClose}
      title="Record Visitor Exit"
      subtitle={`${visit.entryNumber} · ${visit.visitorName}`}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </ErpButton>
          <ErpButton icon={LogOut} onClick={() => void confirmExit()} loading={busy} disabled={busy}>
            Confirm Exit
          </ErpButton>
        </div>
      }
    >
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <div>
          <dt className="text-erp-muted">Visitor</dt>
          <dd className="font-semibold text-erp-text">{visit.visitorName}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Pass number</dt>
          <dd className="font-medium tabular-nums text-erp-text">{visit.entryNumber}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Entry time</dt>
          <dd className="font-medium text-erp-text">{visit.entryTime ? formatDateTime(visit.entryTime) : '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Visit duration</dt>
          <dd className="font-medium">
            <InsideDuration from={visit.entryTime} />
          </dd>
        </div>
        {visit.belongingsDescription || visit.laptopCarried || visit.equipmentCarried || visit.bagCount > 0 ? (
          <div className="col-span-2">
            <dt className="text-erp-muted">Belongings to verify</dt>
            <dd className="font-medium text-erp-text">
              {[
                visit.laptopCarried ? 'Laptop' : null,
                visit.equipmentCarried ? 'Equipment' : null,
                visit.bagCount > 0 ? `${visit.bagCount} bag${visit.bagCount === 1 ? '' : 's'}` : null,
                visit.belongingsDescription,
              ]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="space-y-3">
        <Checkbox
          label="Visitor badge returned"
          checked={badgeReturned}
          onChange={(e) => setBadgeReturned(e.target.checked)}
        />
        <FormField label="Exit remarks">
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
        </FormField>
      </div>
    </GateModal>
  )
}
