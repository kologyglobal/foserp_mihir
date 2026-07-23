import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  PauseCircle,
  Printer,
  RotateCcw,
  Save,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  acceptQualityInspection,
  createPurchaseReturnFromGrn,
  getQualityInspectionById,
  holdQualityInspection,
  postGRN,
  PurchaseServiceError,
  QUALITY_INSPECTION_RESULT_LABELS,
  QUALITY_INSPECTION_STATUS_LABELS,
  rejectQualityInspection,
  requestDeviationApproval,
  updateQualityInspection,
} from '@/services/purchase'
import type {
  QualityInspection,
  QualityInspectionParameter,
  QualityInspectionParameterResult,
} from '@/types/purchaseDomain'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { usePurchasePermissions } from '@/utils/permissions'

function editable(status: QualityInspection['status']) {
  return status === 'pending' || status === 'in_progress' || status === 'hold'
}

export function QualityInspectionDetailPage() {
  const { id } = useParams()
  const perms = usePurchasePermissions()
  const navigate = useNavigate()
  const [qi, setQi] = useState<QualityInspection | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sampleQty, setSampleQty] = useState(0)
  const [acceptedQty, setAcceptedQty] = useState(0)
  const [rejectedQty, setRejectedQty] = useState(0)
  const [inspectionPlan, setInspectionPlan] = useState('')
  const [remarks, setRemarks] = useState('')
  const [parameters, setParameters] = useState<QualityInspectionParameter[]>([])
  const [deviationOpen, setDeviationOpen] = useState(false)
  const [deviationRemarks, setDeviationRemarks] = useState('')
  const [inventoryMsgOpen, setInventoryMsgOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getQualityInspectionById(id)
      if (!row) {
        notify.error('Quality inspection not found')
        navigate('/purchase/quality-inspections')
        return
      }
      setQi(row)
      setSampleQty(row.sampleQty)
      setAcceptedQty(row.acceptedQty)
      setRejectedQty(row.rejectedQty)
      setInspectionPlan(row.inspectionPlan)
      setRemarks(row.remarks)
      setParameters(row.parameters.map((p) => ({ ...p })))
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!qi) return
    setSaving(true)
    try {
      const updated = await updateQualityInspection(qi.id, {
        sampleQty,
        acceptedQty,
        rejectedQty,
        inspectionPlan,
        remarks,
        parameters,
      })
      setQi(updated)
      notify.success('Inspection saved')
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (work: () => Promise<QualityInspection>, ok: string) => {
    setSaving(true)
    try {
      await saveQuiet()
      const updated = await work()
      setQi(updated)
      setAcceptedQty(updated.acceptedQty)
      setRejectedQty(updated.rejectedQty)
      notify.success(ok)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  const saveQuiet = async () => {
    if (!qi || !editable(qi.status)) return
    await updateQualityInspection(qi.id, {
      sampleQty,
      acceptedQty,
      rejectedQty,
      inspectionPlan,
      remarks,
      parameters,
    })
  }

  if (loading || !qi) {
    return (
      <PurchaseCardFormShell
        title="Quality Inspection"
        description="Loading…"
        status="—"
        favoritePath="/purchase/quality-inspections"
        breadcrumbs={[
          { label: 'Quality Inspections', to: '/purchase/quality-inspections' },
          { label: 'Loading' },
        ]}
        footer={null}
        detailMode
      >
        {loading ? (
          <LoadingState variant="form" rows={6} />
        ) : (
          <EmptyState icon={ClipboardCheck} title="Not found" />
        )}
      </PurchaseCardFormShell>
    )
  }

  const canEdit = editable(qi.status)
  const statusLabel = QUALITY_INSPECTION_STATUS_LABELS[qi.status]
  const resultLabel = qi.result ? QUALITY_INSPECTION_RESULT_LABELS[qi.result] : '—'

  return (
    <PurchaseCardFormShell
      title={qi.documentNumber}
      description={`${qi.itemCode} · ${qi.goodsReceiptNumber}`}
      recordNo={qi.documentNumber}
      status={statusLabel}
      statusTone={purchaseStatusTone(qi.status)}
      favoritePath={`/purchase/quality-inspections/${qi.id}`}
      breadcrumbs={[
        { label: 'Quality Inspections', to: '/purchase/quality-inspections' },
        { label: qi.documentNumber },
      ]}
      detailMode={!canEdit}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canEdit && perms.canInspectQuality
              ? {
                  id: 'accept',
                  label: 'Accept Material',
                  icon: CheckCircle2,
                  onClick: () =>
                    void runAction(
                      () =>
                        acceptQualityInspection(
                          qi.id,
                          acceptedQty || qi.receivedQty - rejectedQty,
                          rejectedQty,
                        ),
                      'Material accepted',
                    ),
                  disabled: saving,
                }
              : !canEdit && perms.canPostGrn
                ? {
                    id: 'post',
                    label: 'Post GRN',
                    icon: PackageCheck,
                    onClick: async () => {
                      setSaving(true)
                      try {
                        const posted = await postGRN(qi.goodsReceiptId)
                        notify.success(`${posted.documentNumber} posted`)
                        setInventoryMsgOpen(true)
                      } catch (err) {
                        notify.error(err instanceof PurchaseServiceError ? err.message : 'Post failed')
                      } finally {
                        setSaving(false)
                      }
                    },
                    disabled: saving,
                  }
                : undefined
          }
          secondaryActions={[
            {
              id: 'save',
              label: 'Save Inspection',
              icon: Save,
              onClick: () => void save(),
              hidden: !perms.canInspectQuality,
              disabled: saving || !canEdit,
            },
            {
              id: 'reject',
              label: 'Reject Material',
              icon: XCircle,
              onClick: () =>
                void runAction(
                  () => rejectQualityInspection(qi.id, rejectedQty || qi.receivedQty),
                  'Material rejected',
                ),
              hidden: !perms.canInspectQuality,
              disabled: saving || !canEdit,
            },
            {
              id: 'hold',
              label: 'Put on Hold',
              icon: PauseCircle,
              onClick: () =>
                void runAction(() => holdQualityInspection(qi.id, remarks), 'Inspection on hold'),
              hidden: !perms.canInspectQuality,
              disabled: saving || !canEdit,
            },
            {
              id: 'deviation',
              label: 'Request Deviation Approval',
              icon: ShieldAlert,
              onClick: () => setDeviationOpen(true),
              hidden: !perms.canInspectQuality,
              disabled: saving || !canEdit,
            },
            {
              id: 'print',
              label: 'Print GRN',
              icon: Printer,
              onClick: () => navigate(`/purchase/grn/${qi.goodsReceiptId}/print`),
            },
            {
              id: 'return',
              label: 'Create Purchase Return',
              icon: RotateCcw,
              onClick: async () => {
                setSaving(true)
                try {
                  const ret = await createPurchaseReturnFromGrn(qi.goodsReceiptId)
                  notify.success(`Return ${ret.documentNumber} created`)
                  navigate(`/purchase/returns/${ret.id}`)
                } catch (err) {
                  notify.error(err instanceof PurchaseServiceError ? err.message : 'Return failed')
                } finally {
                  setSaving(false)
                }
              },
              hidden: !perms.canCreateReturn,
              disabled: saving,
            },
          ]}
        />
      }
      footer={
        canEdit && perms.canInspectQuality ? (
          <ErpStickySaveBar
            sticky={false}
            isSubmitting={saving}
            onSave={() => void save()}
            submitLabel="Save Inspection"
            cancelLabel="Back"
            onCancel={() => navigate('/purchase/quality-inspections')}
          />
        ) : null
      }
    >
      <ErpCardSection title="Header" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ErpViewField label="Inspection Number" value={qi.documentNumber} />
          <ErpViewField label="Inspection Date" value={formatDate(qi.documentDate)} />
          <ErpViewField
            label="GRN Number"
            value={
              <Link to={`/purchase/grn/${qi.goodsReceiptId}`} className="text-erp-primary">
                {qi.goodsReceiptNumber}
              </Link>
            }
          />
          <ErpViewField label="Item" value={`${qi.itemCode} — ${qi.itemName}`} />
          <ErpViewField label="Batch / Lot" value={qi.batchLotNo || '—'} />
          <ErpViewField label="Received Qty" value={formatNumber(qi.receivedQty)} />
          {canEdit ? (
            <>
              <ErpFieldRow label="Sample Qty">
                <Input
                  type="number"
                  value={sampleQty}
                  onChange={(e) => setSampleQty(Number(e.target.value))}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Accepted Qty">
                <Input
                  type="number"
                  value={acceptedQty}
                  onChange={(e) => setAcceptedQty(Number(e.target.value))}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Rejected Qty">
                <Input
                  type="number"
                  value={rejectedQty}
                  onChange={(e) => setRejectedQty(Number(e.target.value))}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Inspection Plan" className="sm:col-span-2 lg:col-span-3">
                <Input
                  value={inspectionPlan}
                  onChange={(e) => setInspectionPlan(e.target.value)}
                />
              </ErpFieldRow>
            </>
          ) : (
            <>
              <ErpViewField label="Sample Qty" value={formatNumber(qi.sampleQty)} />
              <ErpViewField label="Accepted Qty" value={formatNumber(qi.acceptedQty)} />
              <ErpViewField label="Rejected Qty" value={formatNumber(qi.rejectedQty)} />
              <ErpViewField label="Inspection Plan" value={qi.inspectionPlan} />
            </>
          )}
          <ErpViewField label="Inspector" value={qi.inspector.name} />
          <ErpViewField label="Result" value={resultLabel} />
          <ErpViewField label="Status" value={statusLabel} />
          {canEdit ? (
            <ErpFieldRow label="Remarks" className="sm:col-span-2 lg:col-span-3">
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </ErpFieldRow>
          ) : (
            <ErpViewField label="Remarks" value={qi.remarks || '—'} />
          )}
        </div>
      </ErpCardSection>

      <ErpCardSection title="Parameters" defaultOpen>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs text-erp-muted">
              <tr>
                <th className="px-2 py-2">Parameter</th>
                <th className="px-2 py-2">Specification</th>
                <th className="px-2 py-2">Min</th>
                <th className="px-2 py-2">Max</th>
                <th className="px-2 py-2">Observed</th>
                <th className="px-2 py-2">Unit</th>
                <th className="px-2 py-2">Result</th>
                <th className="px-2 py-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p, i) => (
                <tr key={p.id} className="border-b align-top">
                  <td className="px-2 py-2">{p.parameter}</td>
                  <td className="px-2 py-2">{p.specification}</td>
                  <td className="px-2 py-2">
                    {canEdit ? (
                      <Input
                        type="number"
                        className="w-20"
                        value={p.minValue ?? ''}
                        onChange={(e) => {
                          const next = [...parameters]
                          next[i] = {
                            ...p,
                            minValue: e.target.value === '' ? null : Number(e.target.value),
                          }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.minValue ?? '—'
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {canEdit ? (
                      <Input
                        type="number"
                        className="w-20"
                        value={p.maxValue ?? ''}
                        onChange={(e) => {
                          const next = [...parameters]
                          next[i] = {
                            ...p,
                            maxValue: e.target.value === '' ? null : Number(e.target.value),
                          }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.maxValue ?? '—'
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {canEdit ? (
                      <Input
                        type="number"
                        className="w-20"
                        value={p.observedValue ?? ''}
                        onChange={(e) => {
                          const next = [...parameters]
                          next[i] = {
                            ...p,
                            observedValue: e.target.value === '' ? null : Number(e.target.value),
                          }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.observedValue ?? '—'
                    )}
                  </td>
                  <td className="px-2 py-2">{p.unit || '—'}</td>
                  <td className="px-2 py-2">
                    {canEdit ? (
                      <Select
                        value={p.result}
                        onChange={(e) => {
                          const next = [...parameters]
                          next[i] = {
                            ...p,
                            result: e.target.value as QualityInspectionParameterResult,
                          }
                          setParameters(next)
                        }}
                      >
                        <option value="pass">Pass</option>
                        <option value="fail">Fail</option>
                        <option value="na">N/A</option>
                      </Select>
                    ) : (
                      p.result
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {canEdit ? (
                      <Input
                        className="w-40"
                        value={p.remarks}
                        onChange={(e) => {
                          const next = [...parameters]
                          next[i] = { ...p, remarks: e.target.value }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.remarks || '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ErpCardSection>

      <Modal
        open={deviationOpen}
        onClose={() => setDeviationOpen(false)}
        title="Request Deviation Approval"
        footer={
          <>
            <ErpButton variant="secondary" onClick={() => setDeviationOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              variant="primary"
              disabled={saving}
              onClick={async () => {
                setDeviationOpen(false)
                await runAction(
                  () => requestDeviationApproval(qi.id, deviationRemarks),
                  'Deviation requested — accepted under deviation',
                )
              }}
            >
              Submit Request
            </ErpButton>
          </>
        }
      >
        <ErpFieldRow label="Deviation remarks" required>
          <Textarea
            value={deviationRemarks}
            onChange={(e) => setDeviationRemarks(e.target.value)}
            rows={3}
            placeholder="Why accept under deviation?"
          />
        </ErpFieldRow>
      </Modal>

      <Modal
        open={inventoryMsgOpen}
        onClose={() => setInventoryMsgOpen(false)}
        title="GRN posted"
        footer={
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => setInventoryMsgOpen(false)}>
              Close
            </ErpButton>
            <ErpButton
              variant="primary"
              onClick={() => {
                setInventoryMsgOpen(false)
                navigate('/inventory/stock')
              }}
            >
              View Stock
            </ErpButton>
          </div>
        }
      >
        <p className="text-sm">
          Material accepted and GRN posted. Stock is updated in Inventory and ready to issue.
        </p>
      </Modal>
    </PurchaseCardFormShell>
  )
}
