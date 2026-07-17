import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import {
  createJobWorkOrder,
  getJobWorkOrderById,
  getWorkOrders,
  updateJobWorkOrder,
} from '@/services/manufacturing'
import type { WorkOrder } from '@/types/manufacturingWorkOrder'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

const PROCESSES = [
  'Welding',
  'Machining',
  'Painting',
  'Galvanizing',
  'Cutting',
  'Fabrication',
  'Heat Treatment',
  'Other',
]

const VENDORS = [
  'ABC Welding Works',
  'SS Fab Solutions',
  'Pune Coatings Pvt Ltd',
  'Metro Machine Shop',
]

export function JobWorkFormPage() {
  const { jobWorkId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const isEdit = Boolean(jobWorkId)

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [workOrderId, setWorkOrderId] = useState(searchParams.get('workOrderId') ?? '')
  const [vendorName, setVendorName] = useState('')
  const [process, setProcess] = useState('')
  const [materialToSend, setMaterialToSend] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rate, setRate] = useState(0)
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getWorkOrders().then((list) => {
      setWorkOrders(list.filter((w) => !['closed', 'cancelled'].includes(w.status)))
    })
  }, [])

  useEffect(() => {
    if (!jobWorkId) return
    void getJobWorkOrderById(jobWorkId).then((item) => {
      if (!item) {
        notify.error('Job work not found')
        navigate('/manufacturing/job-work')
        return
      }
      if (item.status !== 'draft') {
        notify.error('Only draft job work can be edited')
        navigate(`/manufacturing/job-work/${jobWorkId}`)
        return
      }
      setWorkOrderId(item.workOrderId)
      setVendorName(item.vendorName)
      setProcess(item.process)
      setMaterialToSend(item.materialToSend ?? item.itemName)
      setQuantity(item.orderedQty)
      setExpectedReturnDate(item.expectedReturnDate)
      setRate(item.rate)
      setRemarks(item.remarks ?? '')
      setLoading(false)
    })
  }, [jobWorkId, navigate])

  const selectedWo = useMemo(
    () => workOrders.find((w) => w.id === workOrderId) ?? null,
    [workOrderId, workOrders],
  )

  useEffect(() => {
    if (isEdit || !selectedWo) return
    setMaterialToSend((prev) => prev || `${selectedWo.finishedItemCode} — process material`)
    setQuantity((prev) => (prev > 1 ? prev : Math.max(1, selectedWo.remainingQty || selectedWo.plannedQty || 1)))
  }, [isEdit, selectedWo])

  const save = async () => {
    if (!perms.canCreateJobWork && !isEdit) {
      notify.error('No permission to create job work')
      return
    }
    if (!selectedWo || !vendorName.trim() || !process.trim() || quantity <= 0) {
      notify.error('Work order, vendor, process and quantity are required')
      return
    }
    if (!materialToSend.trim()) {
      notify.error('Material to send is required')
      return
    }
    if (!expectedReturnDate) {
      notify.error('Expected return date is required')
      return
    }

    setSaving(true)
    try {
      const input = {
        workOrderId: selectedWo.id,
        workOrderNo: selectedWo.woNumber,
        vendorId: `vendor-${vendorName.replace(/\W/g, '').toLowerCase()}`,
        vendorName: vendorName.trim(),
        process: process.trim(),
        quantity,
        rate: rate || 0,
        rateBasis: 'per_piece' as const,
        expectedReturnDate,
        itemId: selectedWo.finishedItemId,
        itemCode: selectedWo.finishedItemCode,
        itemName: selectedWo.finishedItemName,
        uom: selectedWo.uom,
        materialToSend: materialToSend.trim(),
        remarks: remarks.trim() || undefined,
      }

      const r = isEdit && jobWorkId
        ? await updateJobWorkOrder(jobWorkId, {
            ...input,
            orderedQty: quantity,
            pendingQty: quantity,
            expectedCost: (rate || 0) * quantity,
            materialToSend: input.materialToSend,
            remarks: input.remarks,
          })
        : await createJobWorkOrder(input)

      if (!r.ok || !r.jobWork) {
        notify.error(r.error ?? 'Save failed')
        return
      }
      notify.success(isEdit ? 'Job work updated' : 'Job work created')
      navigate(`/manufacturing/job-work/${r.jobWork.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState variant="card" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={isEdit ? 'Edit Job Work' : 'Create Job Work'}
      description="Select WO → Vendor → Material → Expected return. Keep it simple."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Job Work', to: '/manufacturing/job-work' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : 'Save Draft',
            icon: Save,
            disabled: saving,
            onClick: () => void save(),
          }}
          secondaryActions={[
            { id: 'cancel', label: 'Cancel', onClick: () => navigate('/manufacturing/job-work') },
          ]}
        />
      )}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <ManufacturingDemoBanner message="Rate is a placeholder for planning only — no vendor accounting posts from this screen." />

        <ErpCardSection title="Job work details">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Work Order" required className="sm:col-span-2">
              <Select
                value={workOrderId}
                onChange={(e) => setWorkOrderId(e.target.value)}
                disabled={isEdit}
              >
                <option value="">Select work order</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.woNumber} — {wo.finishedItemCode} ({wo.status})
                  </option>
                ))}
              </Select>
            </FormField>

            {selectedWo ? (
              <p className="sm:col-span-2 rounded-md border border-erp-border bg-slate-50 px-3 py-2 text-[12px] text-erp-muted">
                Finished item: <strong className="text-erp-text">{selectedWo.finishedItemCode} — {selectedWo.finishedItemName}</strong>
                {' · '}Planned {selectedWo.plannedQty} {selectedWo.uom}
              </p>
            ) : null}

            <FormField label="Vendor" required>
              <Input
                list="jw-vendor-list"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Select or type vendor"
              />
              <datalist id="jw-vendor-list">
                {VENDORS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </FormField>

            <FormField label="Process / Operation" required>
              <Select value={process} onChange={(e) => setProcess(e.target.value)}>
                <option value="">Select process</option>
                {PROCESSES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Material to Send" required className="sm:col-span-2">
              <Input
                value={materialToSend}
                onChange={(e) => setMaterialToSend(e.target.value)}
                placeholder="e.g. MS Plate / Chassis sub-assembly"
              />
            </FormField>

            <FormField label="Quantity" required>
              <Input
                type="number"
                min={0.001}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </FormField>

            <FormField label="Expected Return Date" required>
              <Input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </FormField>

            <FormField label="Rate (placeholder)" hint="Planning estimate only — not posted to accounts">
              <Input
                type="number"
                min={0}
                step="any"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                placeholder="0"
              />
            </FormField>

            <FormField label="Remarks" className="sm:col-span-2">
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Instructions for vendor / stores"
              />
            </FormField>
          </div>
        </ErpCardSection>

        <p className="text-[12px] text-erp-muted">
          Flow after save: Send Material → Receive Qty → Reconcile → Link Vendor Invoice (placeholder) → Close
        </p>
      </div>
    </OperationalPageShell>
  )
}
