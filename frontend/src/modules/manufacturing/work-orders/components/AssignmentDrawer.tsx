import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { fetchAdminUsersApi } from '@/services/api/adminApi'
import { createAssignment, listMachines, listWorkCentres } from '@/services/api/manufacturingApi'
import type { CreateAssignmentPayload } from '@/types/manufacturingPhase2b'
import type { ProductionOrderStage, WorkOrderDetail } from '@/types/manufacturingProduction'
import { notify } from '@/store/toastStore'
import { t } from '../../i18n/operatorStrings'

interface AssignmentDrawerProps {
  open: boolean
  onClose: () => void
  workOrder: WorkOrderDetail
  onCreated: () => void
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const ASSIGNABLE_STAGE_STATUSES = new Set(['READY', 'IN_PROGRESS'])

/** Supervisor assign-work drawer — create assignment against a work order stage. */
export function AssignmentDrawer({ open, onClose, workOrder, onCreated }: AssignmentDrawerProps) {
  const assignableStages = workOrder.stages.filter((s) => ASSIGNABLE_STAGE_STATUSES.has(s.status))
  const [stageId, setStageId] = useState('')
  const [userId, setUserId] = useState('')
  const [machineId, setMachineId] = useState('')
  const [workCentreId, setWorkCentreId] = useState('')
  const [assignedQuantity, setAssignedQuantity] = useState(String(workOrder.plannedQuantity))
  const [assignmentDate, setAssignmentDate] = useState(todayIsoDate())
  const [workInstruction, setWorkInstruction] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([])
  const [machines, setMachines] = useState<Array<{ id: string; label: string }>>([])
  const [workCentres, setWorkCentres] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    if (!open) return
    setStageId(assignableStages[0]?.id ?? '')
    setAssignedQuantity(String(workOrder.plannedQuantity))
    setAssignmentDate(todayIsoDate())
    setWorkInstruction('')
    setNotes('')
    void Promise.all([
      fetchAdminUsersApi().then((rows) =>
        setUsers(rows.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}`.trim() || u.email }))),
      ),
      listMachines({ limit: 100 }).then((res) =>
        setMachines(res.data.map((m) => ({ id: m.id, label: `${m.code} — ${m.name}` }))),
      ),
      listWorkCentres({ limit: 100 }).then((res) =>
        setWorkCentres(res.data.map((wc) => ({ id: wc.id, label: `${wc.code} — ${wc.name}` }))),
      ),
    ]).catch(() => {
      notify.warning('Some lookup lists failed to load')
    })
  }, [assignableStages, open, workOrder.plannedQuantity])

  const selectedStage: ProductionOrderStage | undefined = assignableStages.find((s) => s.id === stageId)

  const submit = async () => {
    if (!stageId || !userId || !assignedQuantity) return
    setBusy(true)
    try {
      const payload: CreateAssignmentPayload = {
        productionOrderId: workOrder.id,
        stageId,
        userId,
        assignedQuantity: Number(assignedQuantity) || 0,
        assignmentDate,
        machineId: machineId || undefined,
        workCentreId: workCentreId || selectedStage?.workCentreId || undefined,
        workInstruction: workInstruction.trim() || undefined,
        notes: notes.trim() || undefined,
      }
      const res = await createAssignment(payload)
      res.data.warnings?.forEach((w) => notify.warning(w))
      notify.success('Assignment created')
      onCreated()
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create assignment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('assignment.assignWork')}
      description={`${workOrder.workOrderNo} · assign operator to a ready stage.`}
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || !stageId || !userId} onClick={() => void submit()}>
            Assign
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <FormField label="Stage" required>
          <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
            <option value="">{assignableStages.length === 0 ? 'No assignable stages' : 'Select stage…'}</option>
            {assignableStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Operator" required>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select operator…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Assigned quantity" required>
          <Input type="number" min={0} step="any" value={assignedQuantity} onChange={(e) => setAssignedQuantity(e.target.value)} />
        </FormField>
        <FormField label="Assignment date" required>
          <Input type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} />
        </FormField>
        <FormField label="Work centre">
          <Select value={workCentreId} onChange={(e) => setWorkCentreId(e.target.value)}>
            <option value="">Default / stage work centre</option>
            {workCentres.map((wc) => (
              <option key={wc.id} value={wc.id}>
                {wc.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Machine">
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">None</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Work instructions">
          <Textarea value={workInstruction} onChange={(e) => setWorkInstruction(e.target.value)} rows={3} />
        </FormField>
        <FormField label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Modal>
  )
}
