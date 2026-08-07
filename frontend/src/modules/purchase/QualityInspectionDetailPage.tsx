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
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { DecimalInput, Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  acceptQualityInspection,
  cancelQualityInspection,
  getQualityInspectionById,
  holdQualityInspection,
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
import { appConfirm } from '@/store/confirmDialogStore'
import { getPurchaseLineBaseUomCode, purchaseLineHasDualUom, toUomQuantityFromBase } from '@/utils/purchaseLineUom'

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
        status="-"
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
  const resultLabel = qi.result ? QUALITY_INSPECTION_RESULT_LABELS[qi.result] : '-'

  // Dual-UOM display: qi.*Qty are base/stock qty (authoritative); the vendor/
  // purchase UOM equivalents use the same conversion factor snapshot the GRN
  // used — never a fresh live lookup — so QC always agrees with the GRN.
  const factor = qi.uomConversionFactor || 1
  const baseUomCode = getPurchaseLineBaseUomCode(qi.itemId)
  const showDualUom =
    purchaseLineHasDualUom({ itemId: qi.itemId, uomConversionFactor: factor }) && Boolean(qi.uom) && Boolean(baseUomCode)
  const dualUomLine = (baseQty: number, uomQtyFromApi?: number) => {
    if (!showDualUom) return null
    const uomQty = uomQtyFromApi ?? toUomQuantityFromBase(baseQty, factor)
    return (
      <p className="mt-0.5 text-[11px] tabular-nums text-erp-muted">
        {formatNumber(uomQty)} {qi.uom} · {formatNumber(baseQty)} {baseUomCode}
      </p>
    )
  }

  const headerFacts = [
    { label: 'Vendor', value: qi.vendor.name || '-' },
    { label: 'GRN', value: qi.goodsReceiptNumber || '-' },
    { label: 'PO', value: qi.purchaseOrderNumber || '-' },
    { label: 'Inspection Date', value: formatDate(qi.documentDate) },
  ]

  const documentFactBox = (
    <PurchaseDocumentFactBox
      vendor={{
        id: qi.vendor.id,
        code: qi.vendor.code,
        name: qi.vendor.name,
      }}
      documentStatus={{
        statusLabel,
        ...purchaseDocumentApprovalFact(qi.status, qi.inspector.name || null),
        createdBy: qi.createdBy || qi.inspector.name || null,
        modifiedBy: qi.updatedBy,
        modifiedDate: qi.updatedAt ? formatDate(qi.updatedAt.slice(0, 10)) : null,
      }}
      related={buildPurchaseRelatedLinks({
        purchaseOrderId: qi.purchaseOrderId || null,
        purchaseOrderNumber: qi.purchaseOrderNumber || null,
        goodsReceiptId: qi.goodsReceiptId || null,
        goodsReceiptNumber: qi.goodsReceiptNumber || null,
      })}
    />
  )

  return (
    <PurchaseCardFormShell
      className="purchase-qi-form-page"
      title={qi.documentNumber}
      description={`${qi.itemCode} · ${qi.goodsReceiptNumber}`}
      recordNo={qi.documentNumber}
      recordTitle={
        [qi.itemCode, qi.itemName].filter(Boolean).join(' — ') ||
        qi.goodsReceiptNumber ||
        'Quality Inspection'
      }
      status={statusLabel}
      statusKey={qi.status}
      statusTone={purchaseStatusTone(qi.status)}
      favoritePath={`/purchase/quality-inspections/${qi.id}`}
      breadcrumbs={[
        { label: 'Quality Inspections', to: '/purchase/quality-inspections' },
        { label: qi.documentNumber },
      ]}
      backLink={{ to: '/purchase/quality-inspections', label: 'Back to Quality Inspections' }}
      recordHeaderFacts={headerFacts}
      factBox={documentFactBox}
      collapsibleFactBox
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
              : !canEdit
                ? {
                    // Completing the inspection already posts GRN inventory,
                    // so guide the user to the GRN instead of a dead Post action.
                    id: 'view-grn',
                    label: 'View GRN',
                    icon: PackageCheck,
                    onClick: () => navigate(`/purchase/grn/${qi.goodsReceiptId}`),
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
              pin: true,
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
              pin: true,
            },
          ]}
          moreActions={[
            {
              id: 'hold',
              label: 'Put on Hold',
              icon: PauseCircle,
              onClick: () =>
                void runAction(() => holdQualityInspection(qi.id, remarks), 'Inspection on hold'),
              hidden: !perms.canInspectQuality || !canEdit,
              disabled: saving,
            },
            {
              id: 'cancel',
              label: 'Cancel Inspection',
              icon: XCircle,
              onClick: () => {
                void (async () => {
                  const ok = await appConfirm({
                    title: 'Cancel quality inspection?',
                    description: 'This cancels the inspection. You can create a new one from the GRN if needed.',
                    confirmLabel: 'Cancel inspection',
                    tone: 'danger',
                  })
                  if (!ok) return
                  await runAction(
                    () => cancelQualityInspection(qi.id, remarks || 'Cancelled'),
                    'Inspection cancelled',
                  )
                })()
              },
              hidden: !perms.canCancelQuality || !canEdit,
              disabled: saving,
            },
            {
              id: 'deviation',
              label: 'Request Deviation Approval',
              icon: ShieldAlert,
              onClick: () => setDeviationOpen(true),
              hidden: !perms.canInspectQuality || !canEdit,
              disabled: saving,
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
              onClick: () => {
                navigate(`/purchase/returns/new?qiId=${qi.id}`)
              },
              hidden: !perms.canCreateReturn || qi.rejectedQty <= 0,
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
      <ErpCardSection title="Header" defaultOpen columns={1}>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <ErpViewField label="Batch / Lot" value={qi.batchLotNo || '-'} />
          <ErpViewField
            label="Received Qty"
            value={
              <>
                {formatNumber(qi.receivedQty)}
                {dualUomLine(qi.receivedQty, qi.receivedUomQty)}
              </>
            }
          />
          {canEdit ? (
            <>
              <ErpFieldRow label="Sample Qty">
                <DecimalInput
                  min={0}
                  value={sampleQty}
                  onChange={setSampleQty}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Accepted Qty">
                <DecimalInput
                  min={0}
                  value={acceptedQty}
                  onChange={setAcceptedQty}
                />
                {dualUomLine(acceptedQty)}
              </ErpFieldRow>
              <ErpFieldRow label="Rejected Qty">
                <DecimalInput
                  min={0}
                  value={rejectedQty}
                  onChange={setRejectedQty}
                />
                {dualUomLine(rejectedQty)}
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
              <ErpViewField
                label="Accepted Qty"
                value={
                  <>
                    {formatNumber(qi.acceptedQty)}
                    {dualUomLine(qi.acceptedQty, qi.acceptedUomQty)}
                  </>
                }
              />
              <ErpViewField
                label="Rejected Qty"
                value={
                  <>
                    {formatNumber(qi.rejectedQty)}
                    {dualUomLine(qi.rejectedQty, qi.rejectedUomQty)}
                  </>
                }
              />
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
            <ErpViewField label="Remarks" value={qi.remarks || '-'} />
          )}
        </div>
      </ErpCardSection>

      <ErpCardSection title="Parameters" defaultOpen columns={1} className="purchase-qi-parameters-section">
        {parameters.length === 0 ? (
          <p className="text-sm text-erp-muted">
            No parameter checklist on this inspection yet. Save after create seeds Visual / Documentation defaults.
          </p>
        ) : (
        <div className="purchase-qi-parameters-scroll w-full min-w-0 max-w-full overflow-x-auto rounded-md border border-erp-border">
          <table className="erp-table w-full min-w-[40rem] text-[12px]">
            <thead>
              <tr>
                <th className="min-w-[8rem] text-left">Parameter</th>
                <th className="min-w-[10rem] text-left">Specification</th>
                <th className="num w-28">Min</th>
                <th className="num w-28">Max</th>
                <th className="num w-28">Observed</th>
                <th className="w-20">Unit</th>
                <th className="w-28">Result</th>
                <th className="min-w-[10rem]">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p, i) => (
                <tr key={p.id} className="align-top">
                  <td>{p.parameter}</td>
                  <td>{p.specification}</td>
                  <td className="num">
                    {canEdit ? (
                      <DecimalInput
                        min={0}
                        className="h-8 w-full min-w-[5rem] text-right"
                        value={p.minValue ?? 0}
                        onChange={(v) => {
                          const next = [...parameters]
                          next[i] = { ...p, minValue: v }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.minValue ?? '-'
                    )}
                  </td>
                  <td className="num">
                    {canEdit ? (
                      <DecimalInput
                        min={0}
                        className="h-8 w-full min-w-[5rem] text-right"
                        value={p.maxValue ?? 0}
                        onChange={(v) => {
                          const next = [...parameters]
                          next[i] = { ...p, maxValue: v }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.maxValue ?? '-'
                    )}
                  </td>
                  <td className="num">
                    {canEdit ? (
                      <DecimalInput
                        min={0}
                        className="h-8 w-full min-w-[5rem] text-right"
                        value={p.observedValue ?? 0}
                        onChange={(v) => {
                          const next = [...parameters]
                          next[i] = { ...p, observedValue: v }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.observedValue ?? '-'
                    )}
                  </td>
                  <td>{p.unit || '-'}</td>
                  <td>
                    {canEdit ? (
                      <Select
                        className="h-8 min-w-[6.5rem] text-[12px]"
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
                  <td>
                    {canEdit ? (
                      <Input
                        className="h-8 w-full min-w-[8rem]"
                        value={p.remarks}
                        onChange={(e) => {
                          const next = [...parameters]
                          next[i] = { ...p, remarks: e.target.value }
                          setParameters(next)
                        }}
                      />
                    ) : (
                      p.remarks || '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
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
          Material accepted and GRN posted. Accepting the quality inspection posts accepted quantity
          to stock — use Stock balances to confirm on-hand after QI complete / Post inventory.
        </p>
      </Modal>
    </PurchaseCardFormShell>
  )
}
