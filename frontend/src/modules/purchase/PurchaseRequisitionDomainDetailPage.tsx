import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ClipboardList, Pencil, Printer, Send, ShoppingCart } from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { PurchaseRequisitionWorkflowStrip } from '@/components/purchase/PurchaseDocumentWorkflowStrip'
import { PurchaseRequisitionLinesTable } from '@/components/purchase/PurchaseRequisitionLinesTable'
import {
  PurchaseAuditTimeline,
  buildDemoPurchaseTimeline,
} from '@/components/purchase/PurchaseAuditTimeline'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { ErpCardSection, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { TableLink } from '@/components/ui/AppLink'
import {
  convertPurchaseRequisitionToRfq,
  getPurchaseRequisitionById,
  getRFQById,
  getPurchaseOrderById,
  getVendors,
  submitPurchaseRequisition,
  updatePurchaseRequisition,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  PurchaseServiceError,
} from '@/services/purchase'
import type { PurchaseRequisition, Vendor } from '@/types/purchaseDomain'
import { purchaseRequisitionApprovalStatusLabel } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { usePurchasePermissions } from '@/utils/permissions'
import {
  canConvertPrToRfq,
  isPrPendingPo,
  prProcurementPathLabel,
  purchasePlanningSheetHrefForPr,
} from '@/utils/purchaseRequisitionNextStep'
import { mapPurchaseCategoryToEngineeringProductType } from '@/utils/purchaseProductType'
import type { PrEditorLine } from '@/utils/purchaseRequisitionValidation'
import { PurchaseRequisitionDocumentPage } from './PurchaseFormPages'

export function PurchaseRequisitionDomainDetailPage({
  mode = 'view',
}: {
  mode?: 'view' | 'edit'
}) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const [pr, setPr] = useState<PurchaseRequisition | null>(null)
  const [linkedRfqNo, setLinkedRfqNo] = useState<string | null>(null)
  const [linkedPoNo, setLinkedPoNo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notDomain, setNotDomain] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [department, setDepartment] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [converting, setConverting] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])

  const canEdit = pr && (pr.status === 'draft' || pr.status === 'rejected')
  const showCreateRfq = pr ? canConvertPrToRfq(pr) && perms.canCreateRfq : false
  const showViewRfq = Boolean(pr?.convertedRfqId)
  const showViewPlanning = pr ? isPrPendingPo(pr) : false

  const worksheetLines = useMemo(
    () =>
      (pr?.lines ?? []).map(
        (l): PrEditorLine => ({
          ...l,
          key: l.id || crypto.randomUUID(),
          actionMessage: false,
          productType: mapPurchaseCategoryToEngineeringProductType(l.category),
          category: l.category || '',
        }),
      ),
    [pr?.lines],
  )

  const createRfq = async () => {
    if (!pr) return
    setConverting(true)
    try {
      const rfq = await convertPurchaseRequisitionToRfq(pr.id)
      notify.success(`RFQ ${rfq.documentNumber} created`)
      navigate(`/purchase/rfqs/${rfq.id}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not create RFQ')
    } finally {
      setConverting(false)
    }
  }

  useEffect(() => {
    void getVendors().then(setVendors)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getPurchaseRequisitionById(id)
      if (cancelled) return
      if (!row) {
        setNotDomain(true)
        setPr(null)
        setLoading(false)
        return
      }
      setPr(row)
      setRemarks(row.remarks)
      setDepartment(row.department)
      if (row.convertedRfqId) {
        const rfq = await getRFQById(row.convertedRfqId)
        if (!cancelled) setLinkedRfqNo(rfq?.documentNumber ?? null)
      }
      if (row.convertedPoId) {
        const po = await getPurchaseOrderById(row.convertedPoId)
        if (!cancelled) setLinkedPoNo(po?.documentNumber ?? null)
      }
      setLoading(false)
      if (searchParams.get('print') === '1') {
        window.setTimeout(() => window.print(), 400)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, searchParams])

  const requiredBy = useMemo(() => {
    if (!pr) return null
    return (
      pr.expectedDeliveryDate ??
      (pr.lines.length ? [...pr.lines].map((l) => l.requiredDate).sort()[0] : null)
    )
  }, [pr])

  const headerFacts = useMemo(() => {
    if (!pr) return []
    return [
      { label: 'Requester', value: pr.requester.name },
      { label: 'Department', value: pr.department || '—' },
      { label: 'PR Date', value: formatDate(pr.documentDate) },
      { label: 'Required By', value: requiredBy ? formatDate(requiredBy) : '—' },
    ]
  }, [pr, requiredBy])

  const save = async () => {
    if (!pr || !canEdit) return
    setSaving(true)
    try {
      const updated = await updatePurchaseRequisition(pr.id, {
        department,
        remarks,
      })
      setPr(updated)
      notify.success('Requisition updated')
      navigate(`/purchase/requisitions/${pr.id}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    if (!pr || submitting) return
    setSubmitting(true)
    try {
      const submitted = await submitPurchaseRequisition(pr.id)
      setPr(submitted)
      notify.success(`${submitted.documentNumber} submitted for approval`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Purchase Requisition"
        description="Loading…"
        status="…"
        favoritePath="/purchase/requisitions"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Requisitions', to: '/purchase/requisitions' },
          { label: 'Loading' },
        ]}
        backLink={{ to: '/purchase/requisitions', label: 'Back to Requisitions' }}
        footer={null}
        stickyFooter={false}
        detailMode
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  if (notDomain) {
    return <PurchaseRequisitionDocumentPage readOnly={mode === 'view'} />
  }

  if (!pr) {
    return (
      <PurchaseCardFormShell
        title="Purchase Requisition"
        description="Not found"
        status="—"
        favoritePath="/purchase/requisitions"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Requisitions', to: '/purchase/requisitions' },
          { label: 'Not found' },
        ]}
        backLink={{ to: '/purchase/requisitions', label: 'Back to Requisitions' }}
        footer={null}
        stickyFooter={false}
        detailMode
      >
        <EmptyState
          icon={ClipboardList}
          title="Requisition not found"
          description="This purchase requisition is not in the demo service data."
          action={
            <Link to="/purchase/requisitions" className="erp-btn erp-btn--primary text-[13px]">
              Back to list
            </Link>
          }
        />
      </PurchaseCardFormShell>
    )
  }

  const statusLabel = purchaseRequisitionApprovalStatusLabel(pr.status)
  const preferredLineVendor = pr.lines.find((l) => l.preferredVendorId && l.preferredVendorName)
  const headerVendor = pr.vendor

  const documentFactBox = (
    <PurchaseDocumentFactBox
      vendor={
        headerVendor
          ? {
              id: headerVendor.id,
              code: headerVendor.code,
              name: headerVendor.name,
            }
          : preferredLineVendor
            ? {
                id: preferredLineVendor.preferredVendorId ?? undefined,
                name: preferredLineVendor.preferredVendorName ?? undefined,
              }
            : null
      }
      documentStatus={{
        statusLabel,
        ...purchaseDocumentApprovalFact(pr.status, pr.approver?.name),
        createdBy: pr.createdBy,
        modifiedBy: pr.updatedBy,
        modifiedDate: pr.updatedAt ? formatDate(pr.updatedAt.slice(0, 10)) : null,
      }}
      related={buildPurchaseRelatedLinks({
        rfqId: pr.convertedRfqId,
        rfqNumber: linkedRfqNo,
        purchaseOrderId: pr.convertedPoId,
        purchaseOrderNumber: linkedPoNo,
      })}
    />
  )

  const canSubmitDraft =
    mode === 'view' && pr.status === 'draft' && perms.canSubmitRequisition
  const primaryAction =
    mode === 'edit' && canEdit && perms.canEditRequisition
      ? {
          id: 'save',
          label: saving ? 'Saving…' : 'Save',
          onClick: () => void save(),
          disabled: saving,
        }
      : showCreateRfq
        ? {
            id: 'rfq',
            label: converting ? 'Creating…' : 'Create RFQ',
            icon: ShoppingCart,
            onClick: () => void createRfq(),
            disabled: converting,
          }
        : showViewPlanning
          ? {
              id: 'view-planning',
              label: 'View Planning Items',
              icon: ClipboardList,
              onClick: () => navigate(purchasePlanningSheetHrefForPr(pr.documentNumber)),
            }
          : canSubmitDraft
            ? {
                id: 'submit',
                label: submitting ? 'Submitting…' : 'Submit',
                icon: Send,
                onClick: () => void submit(),
                disabled: submitting,
              }
            : undefined

  return (
    <PurchaseCardFormShell
      title={pr.documentNumber}
      description={`${PURCHASE_REQUISITION_SOURCE_LABELS[pr.source]} · ${pr.location.name}`}
      recordNo={pr.documentNumber}
      status={statusLabel}
      statusTone={purchaseStatusTone(pr.status)}
      statusKey={pr.status}
      company={pr.department || pr.requester.name}
      favoritePath={`/purchase/requisitions/${pr.id}`}
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'Requisitions', to: '/purchase/requisitions' },
        { label: pr.documentNumber },
      ]}
      backLink={{ to: '/purchase/requisitions', label: 'Back to Requisitions' }}
      createdBy={pr.createdBy}
      createdDate={formatDate(pr.createdAt.slice(0, 10))}
      modifiedBy={pr.updatedBy ?? undefined}
      modifiedDate={pr.updatedAt ? formatDate(pr.updatedAt.slice(0, 10)) : undefined}
      recordHeaderFacts={headerFacts}
      factBox={documentFactBox}
      collapsibleFactBox
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          collapseSecondaryOnNarrow={false}
          primaryAction={primaryAction}
          secondaryActions={[
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              pin: true,
              onClick: () => navigate(`/purchase/requisitions/${pr.id}/edit`),
              hidden: !(canEdit && mode === 'view' && perms.canEditRequisition),
            },
            {
              id: 'rfq-sec',
              label: converting ? 'Creating…' : 'Create RFQ',
              icon: ShoppingCart,
              onClick: () => void createRfq(),
              disabled: converting,
              hidden: !showCreateRfq || Boolean(primaryAction && primaryAction.id === 'rfq'),
            },
            {
              id: 'view-rfq',
              label: 'View RFQ',
              icon: ShoppingCart,
              onClick: () => navigate(`/purchase/rfqs/${pr.convertedRfqId}`),
              hidden: !showViewRfq,
            },
            {
              id: 'view-planning-sec',
              label: 'View Planning Items',
              icon: ClipboardList,
              onClick: () => navigate(purchasePlanningSheetHrefForPr(pr.documentNumber)),
              hidden:
                !showViewPlanning ||
                Boolean(primaryAction && primaryAction.id === 'view-planning'),
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              pin: true,
              onClick: () => window.print(),
            },
          ]}
        />
      }
      footer={null}
      stickyFooter={false}
      detailMode
    >
      <div className="space-y-3">
        <PurchaseRequisitionWorkflowStrip
          status={pr.status}
          rfqRequired={pr.rfqRequired}
          purpose="Purchase requisitions — request, approve, then source via RFQ or direct planning."
          nextActionContext={{
            canSubmit: canSubmitDraft,
            canCreateRfq: showCreateRfq,
            canOpenPlanning: showViewPlanning,
          }}
        />

        <ErpCardSection title="General" subtitle="Identity, requester, and process path" defaultOpen>
          <ErpViewField label="PR Number" value={pr.documentNumber} />
          <ErpViewField label="Requisition Date" value={formatDate(pr.documentDate)} />
          <ErpViewField
            label="Status"
            value={<StatusDot label={statusLabel} tone={statusToneFromLabel(pr.status)} />}
          />
          <ErpViewField
            label="Department"
            value={
              mode === 'edit' && canEdit ? (
                <input
                  className="erp-input h-9 w-full text-[13px]"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              ) : (
                pr.department || '—'
              )
            }
          />
          <ErpViewField label="Requested By" value={pr.requester.name} />
          <ErpViewField label="Required By Date" value={requiredBy ? formatDate(requiredBy) : '—'} />
          <ErpViewField label="Warehouse" value={pr.location.name} />
          <ErpViewField label="Priority" value={PURCHASE_REQUISITION_PRIORITY_LABELS[pr.priority]} />
          <ErpViewField label="Source" value={PURCHASE_REQUISITION_SOURCE_LABELS[pr.source]} />
          <ErpViewField
            label="RFQ Required?"
            value={
              pr.rfqRequired
                ? 'Yes, Vendor quotations required'
                : 'No, Direct purchase planning'
            }
          />
          <ErpViewField label="Process path" value={prProcurementPathLabel(pr)} />
          <ErpViewField label="Estimated Value" value={formatCurrency(pr.totalAmount)} />
          <ErpViewField label="Purchase Purpose" value={pr.purpose || '—'} colSpan={3} />
          <ErpViewField
            label="Linked RFQ"
            value={
              linkedRfqNo && pr.convertedRfqId ? (
                <TableLink to={`/purchase/rfqs/${pr.convertedRfqId}`}>{linkedRfqNo}</TableLink>
              ) : (
                '—'
              )
            }
          />
          <ErpViewField
            label="Linked PO"
            value={
              linkedPoNo && pr.convertedPoId ? (
                <TableLink to={`/purchase/orders/${pr.convertedPoId}`}>{linkedPoNo}</TableLink>
              ) : (
                '—'
              )
            }
          />
        </ErpCardSection>

        <ErpCardSection
          title="Item Lines"
          subtitle={`${pr.lines.length} line${pr.lines.length === 1 ? '' : 's'} · ${formatCurrency(pr.totalAmount)}`}
          columns={1}
          defaultOpen
        >
          <PurchaseRequisitionLinesTable
            lines={worksheetLines}
            catalogItems={[]}
            vendors={vendors}
            editable={false}
            readOnly
            reqNo={pr.documentNumber}
            formatCurrency={formatCurrency}
            estimatedTotal={pr.totalAmount}
          />
        </ErpCardSection>

        <ErpCardSection title="Remarks" subtitle="Notes and restrictions" collapsible defaultOpen={false}>
          {mode === 'edit' && canEdit ? (
            <ErpViewField
              label="Remarks"
              colSpan={3}
              value={
                <textarea
                  className="erp-input min-h-[80px] w-full text-[13px]"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              }
            />
          ) : (
            <ErpViewField label="Remarks" value={pr.remarks || '—'} colSpan={3} />
          )}
          {pr.status === 'cancelled' ? (
            <div className="col-span-full">
              <Badge color="red">Cancelled — read-only</Badge>
            </div>
          ) : null}
          {pr.status === 'pending_approval' ? (
            <div className="col-span-full">
              <Badge color="orange">Pending approval — requester cannot edit</Badge>
            </div>
          ) : null}
        </ErpCardSection>

        <ErpCardSection title="Audit" subtitle="Lifecycle history" columns={1} collapsible defaultOpen={false}>
          <PurchaseAuditTimeline
            entityType="purchase-requisition"
            entityId={pr.id}
            title="Audit Timeline"
            demoEvents={buildDemoPurchaseTimeline({
              entityId: pr.id,
              entityType: 'PurchaseRequisition',
              createdAt: pr.createdAt,
              createdBy: pr.createdBy,
              updatedAt: pr.updatedAt,
              updatedBy: pr.updatedBy,
              statusLabel: PURCHASE_REQUISITION_STATUS_LABELS[pr.status],
            })}
          />
        </ErpCardSection>
      </div>
    </PurchaseCardFormShell>
  )
}
