import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar, type ErpCommandAction } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { formatDateTime } from '@/utils/dates/format'
import { getStoredSession } from '@/services/api/client'
import {
  addMaintenancePart,
  closeMaintenanceTicket,
  getMaintenanceCloseReadiness,
  getMaintenanceTicket,
  holdMaintenanceTicket,
  MAX_MAINTENANCE_PHOTOS,
  resumeMaintenanceTicket,
  startMaintenanceRepair,
  testMaintenanceMachine,
  updateMaintenanceTicket,
  uploadMaintenancePhoto,
  type CloseReadiness,
  type MaintenanceFailureCategory,
  type MaintenancePhotoCategory,
  type MaintenanceTechnicianType,
  type MaintenanceTicket,
  type MaintenanceTestResult,
} from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMasterStore } from '@/store/masterStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import {
  MAINTENANCE_BREADCRUMB,
  formatInr,
  formatStatusLabel,
  maintenanceStatusTone,
} from '../maintenanceUi'

type ModalKind = 'start' | 'update' | 'test' | 'close' | 'part' | 'hold' | 'photo' | null

export function MaintenanceTicketDetailPage() {
  const { id = '' } = useParams()
  const perms = useMaintenancePermissions()
  const [ticket, setTicket] = useState<MaintenanceTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [readiness, setReadiness] = useState<CloseReadiness | null>(null)

  // form state
  const [techType, setTechType] = useState<MaintenanceTechnicianType>('INTERNAL')
  const [technicianUserId, setTechnicianUserId] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [repairDetails, setRepairDetails] = useState('')
  const [failureCategory, setFailureCategory] = useState<MaintenanceFailureCategory | ''>('')
  const [serviceCost, setServiceCost] = useState('')
  const [otherCost, setOtherCost] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [testResult, setTestResult] = useState<MaintenanceTestResult>('PASS')
  const [testRemarks, setTestRemarks] = useState('')
  const [closingRemarks, setClosingRemarks] = useState('')
  const [holdStatus, setHoldStatus] = useState<'ON_HOLD' | 'WAITING_FOR_PART'>('WAITING_FOR_PART')
  const [holdReason, setHoldReason] = useState('')
  const [partDesc, setPartDesc] = useState('')
  const [partItemId, setPartItemId] = useState('')
  const [partWarehouseId, setPartWarehouseId] = useState('')
  const [partQty, setPartQty] = useState('1')
  const [partUnitCost, setPartUnitCost] = useState('0')
  const [partShortage, setPartShortage] = useState('')
  const [partRemarks, setPartRemarks] = useState('')
  const [photoCategory, setPhotoCategory] = useState<MaintenancePhotoCategory>('BEFORE')
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const stockableItems = useMasterStore((s) => s.items.filter((i) => i.isStockable && i.isActive))
  const warehouses = useMasterStore((s) => s.warehouses.filter((w) => w.isActive))
  const selectedPartItem = useMemo(
    () => stockableItems.find((i) => i.id === partItemId) ?? null,
    [stockableItems, partItemId],
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getMaintenanceTicket(id)
      setTicket(res.data)
      setRepairDetails(res.data.repairDetails ?? '')
      setFailureCategory(res.data.failureCategory ?? '')
      setServiceCost(String(res.data.serviceCost ?? 0))
      setOtherCost(String(res.data.otherCost ?? 0))
      setServiceDescription(res.data.serviceDescription ?? '')
      setInvoiceNumber(res.data.invoiceNumber ?? '')
      setInvoiceDate(res.data.invoiceDate ? res.data.invoiceDate.slice(0, 10) : '')
      setTechnicianName(res.data.technicianName ?? '')
      setOperatorName(res.data.operatorName ?? '')
      setContractorId(res.data.contractorId ?? '')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load ticket')
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const openStart = () => {
    const session = getStoredSession()
    const sessionUserId = session?.user?.id ?? ''
    setTechnicianUserId(sessionUserId)
    setTechType('INTERNAL')
    if (!operatorName) {
      const name =
        [session?.user?.firstName, session?.user?.lastName].filter(Boolean).join(' ').trim() ||
        session?.user?.email ||
        ''
      setOperatorName(name)
    }
    setModal('start')
  }

  const closed = ticket?.status === 'CLOSED' || ticket?.status === 'CANCELLED'

  const openClose = async () => {
    if (!id) return
    try {
      const res = await getMaintenanceCloseReadiness(id)
      setReadiness(res.data)
      setModal('close')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Close readiness failed')
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      setModal(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const primary: ErpCommandAction[] = []
  const secondary: ErpCommandAction[] = [
    { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
  ]

  if (ticket && !closed) {
    if (
      perms.canStart &&
      ['REPORTED', 'ON_HOLD', 'WAITING_FOR_PART'].includes(ticket.status) &&
      !ticket.repairStartedAt
    ) {
      primary.push({ id: 'start', label: 'Start Maintenance', onClick: openStart })
    }
    if (perms.canUpdate && ticket.repairStartedAt) {
      secondary.push({ id: 'update', label: 'Parts / Service / Cost', onClick: () => setModal('update') })
      secondary.push({ id: 'part', label: 'Parts Changed', onClick: () => setModal('part') })
      if ((ticket.photos?.length ?? 0) < MAX_MAINTENANCE_PHOTOS) {
        secondary.push({ id: 'photo', label: 'Add Photos', onClick: () => setModal('photo') })
      }
      secondary.push({ id: 'hold', label: 'Hold', onClick: () => setModal('hold') })
    }
    if (perms.canUpdate && ['ON_HOLD', 'WAITING_FOR_PART'].includes(ticket.status)) {
      secondary.push({
        id: 'resume',
        label: 'Resume',
        onClick: () =>
          void run(async () => {
            await resumeMaintenanceTicket(id)
            notify.success('Ticket resumed')
          }),
      })
    }
    if (perms.canTest && ['IN_REPAIR', 'TESTING', 'WAITING_FOR_PART'].includes(ticket.status)) {
      primary.push({ id: 'test', label: 'Test Machine', onClick: () => setModal('test') })
    }
    if (perms.canClose && ticket.repairStartedAt) {
      primary.push({ id: 'close', label: 'Close', onClick: () => void openClose() })
    }
  }

  if (loading || !ticket) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Maintenance"
        title="Ticket"
        breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Tickets', to: '/maintenance/tickets' }, { label: '…' }]}
        autoBreadcrumbs={false}
      >
        {loading ? <LoadingState variant="card" /> : <p className="text-sm text-erp-muted">Ticket not found.</p>}
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title={ticket.ticketNumber}
      description={`${ticket.machine?.name ?? ''} · Priority ${ticket.priority} · Downtime ${ticket.downtimeLabel ?? '—'}`}
      breadcrumbs={[
        MAINTENANCE_BREADCRUMB,
        { label: 'Tickets', to: '/maintenance/tickets' },
        { label: ticket.ticketNumber },
      ]}
      autoBreadcrumbs={false}
      actions={<StatusDot label={formatStatusLabel(ticket.status)} tone={maintenanceStatusTone(ticket.status)} />}
      commandBar={
        <ErpCommandBar
          inline
          sticky
          primaryAction={primary[0]}
          secondaryActions={[...primary.slice(1), ...secondary.filter((a) => a.id !== 'refresh')]}
          moreActions={secondary.filter((a) => a.id === 'refresh')}
          moreActionsLabel="More"
        />
      }
    >
      <div className="space-y-5">
        <Section title="Issue">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Field
              label="Machine"
              value={
                <Link to={`/maintenance/machines/${ticket.machineId}/history`} className="text-erp-primary hover:underline">
                  {ticket.machine?.code} — {ticket.machine?.name}
                </Link>
              }
            />
            <Field label="Work Centre" value={ticket.machine?.workCentre?.name ?? '—'} />
            <Field label="Problem" value={ticket.problem} />
            <Field label="Priority" value={ticket.priority} />
            <Field label="Operator Name" value={ticket.operatorName ?? '—'} />
            <Field label="Reported At" value={formatDateTime(ticket.reportedAt)} />
            <Field
              label="Location"
              value={
                ticket.reportedLocationLabel ||
                (ticket.reportedLatitude != null && ticket.reportedLongitude != null
                  ? `${ticket.reportedLatitude}, ${ticket.reportedLongitude}`
                  : ticket.machine?.workCentre?.name ?? '—')
              }
            />
            {ticket.reportedLatitude != null && ticket.reportedLongitude != null ? (
              <Field
                label="GPS"
                value={`${ticket.reportedLatitude.toFixed(5)}, ${ticket.reportedLongitude.toFixed(5)}${
                  ticket.reportedAccuracyM != null ? ` (±${Math.round(ticket.reportedAccuracyM)}m)` : ''
                }`}
              />
            ) : null}
            {ticket.workOrderId ? (
              <Field
                label="Work Order"
                value={
                  <Link to={`/manufacturing/work-orders/${ticket.workOrderId}`} className="text-erp-primary hover:underline">
                    View WO
                  </Link>
                }
              />
            ) : null}
            {ticket.jobCardCode ? <Field label="Job Card" value={ticket.jobCardCode} /> : null}
            {ticket.operationName ? <Field label="Operation" value={ticket.operationName} /> : null}
          </dl>
        </Section>

        <Section title="Assignment & Repair">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Field label="Technician Type" value={ticket.technicianType ?? '—'} />
            <Field label="Operator Name" value={ticket.operatorName ?? '—'} />
            <Field
              label={ticket.technicianType === 'EXTERNAL' ? 'External Contractor / Vendor' : 'Internal User / Technician'}
              value={
                ticket.technicianType === 'EXTERNAL'
                  ? ticket.contractor?.name ?? ticket.technicianName ?? '—'
                  : ticket.technicianName ?? ticket.technicianUserId ?? '—'
              }
            />
            <Field label="Repair Started" value={ticket.repairStartedAt ? formatDateTime(ticket.repairStartedAt) : '—'} />
            <Field label="Failure Category" value={ticket.failureCategory ?? '—'} />
            <Field label="Repair Details" value={ticket.repairDetails ?? '—'} />
            <Field label="Service Performed" value={ticket.serviceDescription ?? '—'} />
            <Field label="Invoice Number" value={ticket.invoiceNumber ?? '—'} />
            <Field label="Invoice Date" value={ticket.invoiceDate ? ticket.invoiceDate.slice(0, 10) : '—'} />
            <Field label="Test Result" value={ticket.testResult ?? '—'} />
            <Field label="Tested At" value={ticket.testedAt ? formatDateTime(ticket.testedAt) : '—'} />
          </dl>
        </Section>

        <Section title="Parts Changed">
          {ticket.inventoryPostingPending ? (
            <p className="mb-2 text-xs text-amber-800">
              Inventory posting incomplete — one or more stockable spare lines still lack an ISSUE movement.
            </p>
          ) : ticket.parts.some((p) => p.inventoryMovementId) ? (
            <p className="mb-2 text-xs text-emerald-800">
              Stockable spares are issued from inventory (`ISSUE_TO_MAINTENANCE`). Free-text lines are ticket-only.
            </p>
          ) : ticket.parts.length > 0 ? (
            <p className="mb-2 text-xs text-erp-muted">
              Parts are recorded on the ticket only (no stockable item selected — no inventory ISSUE).
            </p>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-erp-border">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-[11px] uppercase text-erp-muted">
                <tr>
                  <th className="px-3 py-2">Part</th>
                  <th className="px-3 py-2">Qty</th>
                  {perms.canViewCost ? <th className="px-3 py-2 text-right">Unit</th> : null}
                  {perms.canViewCost ? <th className="px-3 py-2 text-right">Total</th> : null}
                  <th className="px-3 py-2">Inventory</th>
                  <th className="px-3 py-2">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {ticket.parts.map((p) => (
                  <tr key={p.id} className="border-t border-erp-border/60">
                    <td className="px-3 py-2">{p.description}</td>
                    <td className="px-3 py-2">{p.qty}</td>
                    {perms.canViewCost ? <td className="px-3 py-2 text-right">{formatInr(p.unitCost)}</td> : null}
                    {perms.canViewCost ? <td className="px-3 py-2 text-right">{formatInr(p.totalCost)}</td> : null}
                    <td className="px-3 py-2 text-xs">
                      {p.inventoryMovementId
                        ? 'Issued'
                        : p.itemId && p.warehouseId
                          ? 'Pending ISSUE'
                          : 'Ticket only'}
                    </td>
                    <td className="px-3 py-2">
                      {p.shortageQty && p.shortageQty > 0 ? (
                        <Link
                          to={`/purchase/requisitions/new?source=MAINTENANCE&sourceDocumentId=${encodeURIComponent(ticket.id)}&purchasePurpose=${encodeURIComponent(`MAINTENANCE · ${ticket.ticketNumber}`)}&remarks=${encodeURIComponent(`sourceType:MAINTENANCE | maintenanceTicketId:${ticket.id} | ${ticket.ticketNumber} · ${p.description}`)}`}
                          className="text-erp-primary hover:underline"
                        >
                          Part Shortage — Create PR
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
                {!ticket.parts.length ? (
                  <tr>
                    <td className="px-3 py-3 text-erp-muted" colSpan={6}>
                      No parts recorded
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {perms.canViewCost ? (
            <div className="mt-3 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Parts</span>
                <span className="tabular-nums">{formatInr(ticket.partsCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service</span>
                <span className="tabular-nums">{formatInr(ticket.serviceCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Other</span>
                <span className="tabular-nums">{formatInr(ticket.otherCost)}</span>
              </div>
              <div className="flex justify-between border-t border-erp-border pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatInr(ticket.totalCost)}</span>
              </div>
            </div>
          ) : null}
        </Section>

        <Section title={`Photos (${ticket.photos.length}/${MAX_MAINTENANCE_PHOTOS})`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ticket.photos.map((ph) => (
              <li key={ph.id} className="rounded-md border border-erp-border px-3 py-2 text-sm">
                <div className="font-medium">{ph.originalFilename}</div>
                <div className="text-xs text-erp-muted">
                  {ph.category} · {formatDateTime(ph.uploadedAt)}
                </div>
              </li>
            ))}
            {!ticket.photos.length ? (
              <li className="text-sm text-erp-muted">No photos yet — required before close</li>
            ) : null}
          </ul>
        </Section>

        <Section title="History">
          <ul className="space-y-1 text-sm text-erp-muted">
            <li>Reported · {formatDateTime(ticket.reportedAt)}</li>
            {ticket.repairStartedAt ? <li>Repair started · {formatDateTime(ticket.repairStartedAt)}</li> : null}
            {ticket.testedAt ? (
              <li>
                Test {ticket.testResult} · {formatDateTime(ticket.testedAt)}
              </li>
            ) : null}
            {ticket.closedAt ? <li>Closed · {formatDateTime(ticket.closedAt)}</li> : null}
          </ul>
        </Section>
      </div>

      {/* Start Maintenance */}
      <Modal
        open={modal === 'start'}
        onClose={() => setModal(null)}
        title="Start Maintenance"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await startMaintenanceRepair(id, {
                    technicianType: techType,
                    technicianUserId: techType === 'INTERNAL' ? technicianUserId || undefined : undefined,
                    contractorId: techType === 'EXTERNAL' ? contractorId || undefined : undefined,
                    technicianName: technicianName || undefined,
                    operatorName: operatorName || undefined,
                  })
                  notify.success('Maintenance started')
                })
              }
            >
              Start Maintenance
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Operator Name" required>
            <Input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Operator attending the machine" />
          </FormField>
          <FormField label="Resource Type" required>
            <Select value={techType} onChange={(e) => setTechType(e.target.value as MaintenanceTechnicianType)}>
              <option value="INTERNAL">Internal User / Technician</option>
              <option value="EXTERNAL">External Contractor / Vendor</option>
            </Select>
          </FormField>
          {techType === 'INTERNAL' ? (
            <>
              <FormField label="Internal User ID" required>
                <Input value={technicianUserId} onChange={(e) => setTechnicianUserId(e.target.value)} placeholder="User UUID" />
              </FormField>
              <FormField label="Technician Name">
                <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Contractor / Vendor ID">
                <Input value={contractorId} onChange={(e) => setContractorId(e.target.value)} placeholder="Vendor UUID" />
              </FormField>
              <FormField label="Contractor / Technician Name">
                <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} />
              </FormField>
            </>
          )}
        </div>
      </Modal>

      {/* Update */}
      <Modal
        open={modal === 'update'}
        onClose={() => setModal(null)}
        title="Parts, Service & Cost"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await updateMaintenanceTicket(id, {
                    repairDetails,
                    failureCategory: failureCategory || null,
                    serviceDescription: serviceDescription || null,
                    serviceCost: perms.canManageCost ? Number(serviceCost || 0) : undefined,
                    otherCost: perms.canManageCost ? Number(otherCost || 0) : undefined,
                    invoiceNumber: invoiceNumber || null,
                    invoiceDate: invoiceDate || null,
                    technicianName: technicianName || null,
                    contractorId: contractorId || null,
                    operatorName: operatorName || null,
                  })
                  notify.success('Ticket updated')
                })
              }
            >
              Save
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Operator Name">
            <Input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} />
          </FormField>
          <FormField label="Repair Details" required>
            <Textarea value={repairDetails} onChange={(e) => setRepairDetails(e.target.value)} rows={4} placeholder="What was wrong? What was done?" />
          </FormField>
          <FormField label="Failure Category">
            <Select value={failureCategory} onChange={(e) => setFailureCategory(e.target.value as MaintenanceFailureCategory | '')}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {['MECHANICAL', 'ELECTRICAL', 'HYDRAULIC', 'PNEUMATIC', 'CONTROL', 'OTHER'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Service Performed" hint="Description of external or internal service work">
            <Textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} rows={2} />
          </FormField>
          {perms.canManageCost ? (
            <FormField label="Service Amount">
              <Input type="number" min={0} value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} />
            </FormField>
          ) : null}
          <FormField label="Invoice Number" required>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </FormField>
          <FormField label="Invoice Date">
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </FormField>
          {perms.canManageCost ? (
            <FormField label="Other Cost">
              <Input type="number" min={0} value={otherCost} onChange={(e) => setOtherCost(e.target.value)} />
            </FormField>
          ) : null}
        </div>
      </Modal>

      {/* Test */}
      <Modal
        open={modal === 'test'}
        onClose={() => setModal(null)}
        title="Test Machine"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await testMaintenanceMachine(id, { result: testResult, remarks: testRemarks || undefined })
                  notify.success(testResult === 'PASS' ? 'Test passed' : 'Test failed — repair continues')
                })
              }
            >
              Submit Test
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Result" required>
            <Select value={testResult} onChange={(e) => setTestResult(e.target.value as MaintenanceTestResult)}>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
            </Select>
          </FormField>
          <FormField label="Remarks">
            <Textarea value={testRemarks} onChange={(e) => setTestRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* Close */}
      <Modal
        open={modal === 'close'}
        onClose={() => setModal(null)}
        title="Close Ticket"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={busy || !readiness?.ready}
              onClick={() =>
                void run(async () => {
                  await closeMaintenanceTicket(id, { closingRemarks: closingRemarks || undefined })
                  notify.success('Ticket closed')
                })
              }
            >
              Close Ticket
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="grid gap-1">
            <div>Machine · {ticket.machine?.code}</div>
            <div>Test · {ticket.testResult ?? '—'}</div>
            <div>Downtime · {ticket.downtimeLabel ?? '—'}</div>
            {perms.canViewCost ? (
              <>
                <div>Parts · {formatInr(ticket.partsCost)}</div>
                <div>Service · {formatInr(ticket.serviceCost)}</div>
                <div className="font-semibold">Total · {formatInr(ticket.totalCost)}</div>
              </>
            ) : null}
          </div>
          {readiness ? (
            <ul className="space-y-1">
              {readiness.checks.map((c) => (
                <li key={c.code} className={c.ok ? 'text-emerald-700' : 'text-rose-700'}>
                  {c.ok ? '✓' : '✗'} {c.message}
                </li>
              ))}
            </ul>
          ) : null}
          <FormField label="Closing Remarks">
            <Textarea value={closingRemarks} onChange={(e) => setClosingRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* Hold */}
      <Modal
        open={modal === 'hold'}
        onClose={() => setModal(null)}
        title="Hold Ticket"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await holdMaintenanceTicket(id, { status: holdStatus, reason: holdReason })
                  notify.success('Ticket on hold')
                })
              }
            >
              Hold
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Status">
            <Select value={holdStatus} onChange={(e) => setHoldStatus(e.target.value as typeof holdStatus)}>
              <option value="WAITING_FOR_PART">WAITING FOR PART</option>
              <option value="ON_HOLD">ON HOLD</option>
            </Select>
          </FormField>
          <FormField label="Reason" required>
            <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* Part */}
      <Modal
        open={modal === 'part'}
        onClose={() => setModal(null)}
        title="Parts Changed"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white"
              disabled={busy || !partDesc.trim() || (Boolean(partItemId) && !partWarehouseId)}
              onClick={() =>
                void run(async () => {
                  await addMaintenancePart(id, {
                    itemId: partItemId || undefined,
                    warehouseId: partItemId ? partWarehouseId || undefined : undefined,
                    description: partDesc,
                    qty: Number(partQty || 0),
                    unitCost: Number(partUnitCost || 0),
                    remarks: partRemarks.trim() || undefined,
                    shortageQty: partShortage ? Number(partShortage) : undefined,
                  })
                  notify.success(partItemId ? 'Part issued from inventory' : 'Part recorded on ticket')
                  setPartDesc('')
                  setPartItemId('')
                  setPartWarehouseId('')
                  setPartQty('1')
                  setPartUnitCost('0')
                  setPartShortage('')
                  setPartRemarks('')
                })
              }
            >
              {partItemId ? 'Issue Part' : 'Add Part'}
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField
            label="Stock Item (optional)"
            hint="Select a stockable item to post an inventory ISSUE. Leave empty for free-text ticket-only recording."
          >
            <Select
              value={partItemId}
              onChange={(e) => {
                const nextId = e.target.value
                setPartItemId(nextId)
                const item = stockableItems.find((i) => i.id === nextId)
                if (item) {
                  setPartDesc(`${item.itemCode} — ${item.itemName}`)
                  if (perms.canManageCost) setPartUnitCost(String(item.standardRate ?? 0))
                }
              }}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {stockableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.itemCode} — {item.itemName}
                </option>
              ))}
            </Select>
          </FormField>
          {partItemId ? (
            <FormField label="Issue Warehouse" required hint="Stock is decremented from this warehouse (fail-closed if insufficient).">
              <Select value={partWarehouseId} onChange={(e) => setPartWarehouseId(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouseCode} — {w.warehouseName}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField label="Item Name" required>
            <Input
              value={partDesc}
              onChange={(e) => setPartDesc(e.target.value)}
              placeholder="Part / item name"
              disabled={Boolean(selectedPartItem)}
            />
          </FormField>
          <FormField label="Qty" required>
            <Input type="number" min={0} value={partQty} onChange={(e) => setPartQty(e.target.value)} />
          </FormField>
          {perms.canManageCost ? (
            <FormField label="Unit Cost" hint={partItemId ? 'Used as issue rate hint; costing may override from layers' : undefined}>
              <Input type="number" min={0} value={partUnitCost} onChange={(e) => setPartUnitCost(e.target.value)} />
            </FormField>
          ) : null}
          <FormField label="Remarks">
            <Input value={partRemarks} onChange={(e) => setPartRemarks(e.target.value)} />
          </FormField>
          <FormField label="Shortage Qty" hint="If stock is short, hold WAITING_FOR_PART and create a PR from the shortage link.">
            <Input type="number" min={0} value={partShortage} onChange={(e) => setPartShortage(e.target.value)} />
          </FormField>
        </div>
      </Modal>

      {/* Photo */}
      <Modal
        open={modal === 'photo'}
        onClose={() => setModal(null)}
        title="Add Photo"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white"
              disabled={busy || !photoFile || (ticket.photos.length >= MAX_MAINTENANCE_PHOTOS)}
              onClick={() =>
                void run(async () => {
                  if (!photoFile) return
                  await uploadMaintenancePhoto(id, photoFile, photoCategory)
                  notify.success('Photo uploaded')
                  setPhotoFile(null)
                })
              }
            >
              Upload
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <p className="text-xs text-erp-muted">
            {ticket.photos.length} of {MAX_MAINTENANCE_PHOTOS} photographs used. Required before closing.
          </p>
          <FormField label="Category">
            <Select value={photoCategory} onChange={(e) => setPhotoCategory(e.target.value as MaintenancePhotoCategory)}>
              {['BEFORE', 'DURING', 'AFTER', 'OTHER'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Photo" required>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
          </FormField>
        </div>
      </Modal>
    </OperationalPageShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-erp-border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-erp-fg">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-erp-fg">{value}</dd>
    </div>
  )
}
