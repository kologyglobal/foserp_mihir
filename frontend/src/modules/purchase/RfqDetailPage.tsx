import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Ban,
  Download,
  FileText,
  GitCompare,
  Pencil,
  Printer,
  Send,
  Star,
  Users,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseAuditTimeline,
  buildDemoPurchaseTimeline,
} from '@/components/purchase/PurchaseAuditTimeline'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { ErpCardSection, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { Badge } from '@/components/ui/Badge'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import {
  cancelRFQ,
  getRFQById,
  PurchaseServiceError,
  RFQ_DOMAIN_STATUS_LABELS,
  RFQ_VENDOR_INVITE_STATUS_LABELS,
  sendRFQ,
} from '@/services/purchase'
import type { RequestForQuotation, RfqVendorInviteStatus } from '@/types/purchaseDomain'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseActionGate } from '@/utils/permissions'
import { notify } from '@/store/toastStore'
import { systemConfirm } from '@/utils/systemConfirm'
import { cn } from '@/utils/cn'

function inviteBadgeColor(
  status: RfqVendorInviteStatus,
): 'red' | 'green' | 'yellow' | 'blue' | 'gray' {
  if (status === 'quoted') return 'green'
  if (status === 'sent') return 'blue'
  if (status === 'declined') return 'red'
  if (status === 'no_response') return 'yellow'
  return 'gray'
}

export function RfqDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rfq, setRfq] = useState<RequestForQuotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendOpen, setSendOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getRFQById(id)
      if (!row) {
        notify.error('RFQ not found')
        navigate('/purchase/rfqs')
        return
      }
      setRfq(row)
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!rfq) return
    if (searchParams.get('send') === '1' && rfq.status === 'draft') {
      setSendOpen(true)
    }
    if (searchParams.get('print') === '1') {
      window.print()
      searchParams.delete('print')
      setSearchParams(searchParams, { replace: true })
    }
  }, [rfq, searchParams, setSearchParams])

  const confirmSend = async () => {
    if (!rfq) return
    setBusy(true)
    try {
      const updated = await sendRFQ(rfq.id)
      setRfq(updated)
      setSendOpen(false)
      searchParams.delete('send')
      setSearchParams(searchParams, { replace: true })
      notify.success(
        `${updated.documentNumber} sent to ${updated.vendors.filter((v) => v.selected).length} vendor(s)`,
      )
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  const onCancel = async () => {
    if (!rfq) return
    if (!(await systemConfirm({
      title: 'Cancel this RFQ?',
      description: 'Vendors will no longer be able to respond. This cannot be undone from the register.',
      confirmLabel: 'Cancel RFQ',
      cancelLabel: 'Keep RFQ',
      variant: 'danger',
    }))) return
    try {
      setRfq(await cancelRFQ(rfq.id))
      notify.success('RFQ cancelled')
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Cancel failed')
    }
  }

  const downloadStub = () => {
    if (!rfq) return
    const blob = new Blob(
      [
        [
          `RFQ ${rfq.documentNumber}`,
          `Date ${rfq.documentDate}`,
          `Enquiry due ${rfq.bidDueDate}`,
          `Vendors: ${rfq.vendors.map((v) => v.vendorName).join(', ')}`,
          '',
          ...rfq.lines.map(
            (l) =>
              `${l.lineNo}. ${l.itemCode} ${l.itemName} qty ${l.quantity} ${l.uom} target ${l.targetPrice}`,
          ),
        ].join('\n'),
      ],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${rfq.documentNumber}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const responseStats = useMemo(() => {
    if (!rfq) return { selected: 0, quoted: 0, sent: 0, declined: 0 }
    const selected = rfq.vendors.filter((v) => v.selected)
    return {
      selected: selected.length,
      quoted: selected.filter((v) => v.status === 'quoted').length,
      sent: selected.filter((v) => v.status === 'sent' || v.status === 'no_response').length,
      declined: selected.filter((v) => v.status === 'declined').length,
    }
  }, [rfq])

  if (loading || !rfq) {
    return (
      <PurchaseCardFormShell
        title="RFQ"
        description="Loading…"
        status="…"
        favoritePath="/purchase/rfqs"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'RFQs', to: '/purchase/rfqs' },
          { label: 'Loading' },
        ]}
        footer={null}
        detailMode
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  const selectedVendors = rfq.vendors.filter((v) => v.selected)
  const statusLabel = RFQ_DOMAIN_STATUS_LABELS[rfq.status]
  const isDraft = rfq.status === 'draft'
  const canCompare = [
    'sent',
    'partially_quoted',
    'quotation_received',
    'under_evaluation',
    'closed',
  ].includes(rfq.status)
  const buyerName = rfq.buyer?.name ?? rfq.requester.name
  const purchaseLoc = rfq.purchaseLocation?.name ?? rfq.location.name
  const sourcePrLabel =
    rfq.purchaseRequisitionNumbers?.length > 0
      ? rfq.purchaseRequisitionNumbers.join(', ')
      : 'Manual'

  const sendGate = purchaseActionGate({
    permission: 'purchase.rfq.send',
    statusAllowed: isDraft,
    statusBlockedReason: 'Only Draft RFQs can be sent',
  })
  const editGate = purchaseActionGate({
    permission: 'purchase.rfq.create',
    statusAllowed: isDraft,
  })
  const compareGate = purchaseActionGate({
    permission: 'purchase.rfq.compare',
    statusAllowed: canCompare,
    statusBlockedReason: 'Send the RFQ and collect quotations before comparing',
  })

  const primaryVendor = selectedVendors[0]
  const documentFactBox = (
    <PurchaseDocumentFactBox
      vendor={
        primaryVendor
          ? {
              id: primaryVendor.vendorId,
              code: primaryVendor.vendorCode,
              name: primaryVendor.vendorName,
              rating: primaryVendor.vendorRating,
              paymentTerms: rfq.paymentTerms,
            }
          : null
      }
      purchaseHistory={{
        lastPurchasePrice: primaryVendor?.lastPurchasePrice ?? rfq.lines[0]?.targetPrice ?? null,
        lastVendorName: primaryVendor?.vendorName ?? null,
      }}
      documentStatus={{
        statusLabel,
        ...purchaseDocumentApprovalFact(rfq.status),
        createdBy: rfq.createdBy,
        modifiedBy: rfq.updatedBy,
        modifiedDate: rfq.updatedAt ? formatDate(rfq.updatedAt.slice(0, 10)) : null,
      }}
      related={buildPurchaseRelatedLinks({
        purchaseRequisitionId: rfq.purchaseRequisitionIds[0] ?? null,
        purchaseRequisitionNumber: rfq.purchaseRequisitionNumbers[0] ?? null,
      })}
    />
  )

  return (
    <>
      <PurchaseCardFormShell
        title={rfq.documentNumber}
        description={`${buyerName} · ${purchaseLoc}`}
        recordNo={rfq.documentNumber}
        status={statusLabel}
        statusTone={purchaseStatusTone(rfq.status)}
        company={sourcePrLabel === 'Manual' ? 'Manual RFQ' : `From ${sourcePrLabel}`}
        favoritePath={`/purchase/rfqs/${rfq.id}`}
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'RFQs', to: '/purchase/rfqs' },
          { label: rfq.documentNumber },
        ]}
        createdBy={rfq.createdBy}
        createdDate={formatDate(rfq.createdAt.slice(0, 10))}
        modifiedBy={rfq.updatedBy ?? undefined}
        modifiedDate={rfq.updatedAt ? formatDate(rfq.updatedAt.slice(0, 10)) : undefined}
        documentStrip={[
          { label: 'Status', value: statusLabel, highlight: true },
          { label: 'Enquiry Due', value: formatDate(rfq.bidDueDate), highlight: true },
          { label: 'Buyer', value: buyerName },
          { label: 'Location', value: purchaseLoc },
          { label: 'Vendors', value: `${responseStats.quoted}/${responseStats.selected} quoted` },
          { label: 'Lines', value: String(rfq.lines.length) },
          { label: 'Est. Value', value: formatCurrency(rfq.estimatedValue), highlight: true },
        ]}
        factBox={documentFactBox}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={
              isDraft && !sendGate.hidden
                ? {
                    id: 'send',
                    label: 'Send RFQ',
                    icon: Send,
                    onClick: () => setSendOpen(true),
                    disabled: busy || sendGate.disabled,
                    disabledReason: sendGate.disabledReason,
                  }
                : !compareGate.hidden
                  ? {
                      id: 'compare',
                      label: 'Compare Quotations',
                      icon: GitCompare,
                      onClick: () => navigate(`/purchase/comparison/${rfq.id}`),
                      disabled: compareGate.disabled,
                      disabledReason: compareGate.disabledReason,
                    }
                  : undefined
            }
            secondaryActions={[
              {
                id: 'edit',
                label: 'Edit',
                icon: Pencil,
                onClick: () => navigate(`/purchase/rfqs/${rfq.id}/edit`),
                hidden: editGate.hidden || !isDraft,
              },
              {
                id: 'quotes',
                label: 'Vendor Quotations',
                icon: FileText,
                onClick: () => navigate(`/purchase/vendor-quotations?rfqId=${rfq.id}`),
              },
              {
                id: 'compare-sec',
                label: 'Comparison',
                icon: GitCompare,
                onClick: () => navigate(`/purchase/comparison/${rfq.id}`),
                hidden: compareGate.hidden || (isDraft && !sendGate.hidden),
              },
              {
                id: 'download',
                label: 'Download RFQ',
                icon: Download,
                onClick: downloadStub,
              },
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                onClick: () => window.print(),
              },
            ]}
            destructiveActions={[
              {
                id: 'cancel',
                label: 'Cancel',
                icon: Ban,
                onClick: () => void onCancel(),
                hidden: editGate.hidden || !isDraft,
              },
            ]}
          />
        }
        footer={null}
        detailMode
      >
        <div className="space-y-3">
        <ErpCardSection title="General" subtitle="Identity, buyer, and locations" defaultOpen>
          <ErpViewField label="RFQ Number" value={rfq.documentNumber} />
          <ErpViewField label="RFQ Date" value={formatDate(rfq.documentDate)} />
          <ErpViewField
            label="Status"
            value={<StatusDot label={statusLabel} tone={statusToneFromLabel(rfq.status)} />}
          />
          <ErpViewField label="Enquiry Due Date" value={formatDate(rfq.bidDueDate)} />
          <ErpViewField label="Buyer" value={buyerName} />
          <ErpViewField label="Department" value={rfq.department || '—'} />
          <ErpViewField label="Purchase Location" value={purchaseLoc} />
          <ErpViewField
            label="Delivery Location"
            value={rfq.deliveryLocation?.name ?? '—'}
          />
          <ErpViewField label="Currency" value={rfq.currency} />
          <ErpViewField
            label="Expected Delivery"
            value={rfq.expectedDeliveryDate ? formatDate(rfq.expectedDeliveryDate) : '—'}
          />
          <ErpViewField label="Source PR(s)" hideIfEmpty={sourcePrLabel === 'Manual'}>
            {rfq.purchaseRequisitionIds?.length ? (
              <span className="flex flex-wrap gap-x-2 gap-y-1">
                {rfq.purchaseRequisitionIds.map((prId, i) => (
                  <Link
                    key={prId}
                    className="font-mono text-erp-primary"
                    to={`/purchase/requisitions/${prId}`}
                  >
                    {rfq.purchaseRequisitionNumbers[i] ?? prId}
                  </Link>
                ))}
              </span>
            ) : (
              'Manual'
            )}
          </ErpViewField>
          {sourcePrLabel === 'Manual' ? (
            <ErpViewField label="Origin" value="Manual entry" />
          ) : null}
          <ErpViewField label="Sent At" value={rfq.sentAt ? formatDate(rfq.sentAt.slice(0, 10)) : '—'} />
          <ErpViewField label="Estimated Value" value={formatCurrency(rfq.estimatedValue)} />
        </ErpCardSection>

        <ErpCardSection title="Commercial & Contacts" subtitle="Terms and communication" defaultOpen>
          <ErpViewField label="Payment Terms" value={rfq.paymentTerms} />
          <ErpViewField label="Delivery Terms" value={rfq.deliveryTerms} />
          <ErpViewField label="Freight Terms" value={rfq.freightTerms || '—'} />
          <ErpViewField label="Inspection Requirement" value={rfq.inspectionRequirement || '—'} />
          <ErpViewField label="Technical Contact" value={rfq.technicalContact || '—'} />
          <ErpViewField label="Commercial Contact" value={rfq.commercialContact || '—'} />
          <ErpViewField label="Remarks" value={rfq.remarks || '—'} colSpan={3} />
        </ErpCardSection>

        <ErpCardSection
          title="Item Lines"
          subtitle={`${rfq.lines.length} line${rfq.lines.length === 1 ? '' : 's'}`}
          columns={1}
          defaultOpen
        >
          {rfq.lines.length === 0 ? (
            <EmptyState icon={FileText} title="No lines" description="This RFQ has no item lines." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table min-w-[960px] text-[12px]">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Item</th>
                    <th>Specification</th>
                    <th>HSN/SAC</th>
                    <th className="num">Qty</th>
                    <th>UOM</th>
                    <th>Required</th>
                    <th className="num">Target Price</th>
                    <th className="num">Amount</th>
                    <th>Source PR</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="tabular-nums text-erp-muted">{l.lineNo}</td>
                      <td>
                        <div className="font-mono text-[11px] text-erp-muted">{l.itemCode}</div>
                        <div className="font-medium text-erp-text">{l.itemName}</div>
                      </td>
                      <td className="max-w-[12rem] text-erp-muted">{l.specification || '—'}</td>
                      <td className="font-mono">{l.hsnCode || l.sacCode || '—'}</td>
                      <td className="num tabular-nums">{l.quantity}</td>
                      <td>{l.uom}</td>
                      <td>{formatDate(l.requiredDate)}</td>
                      <td className="num tabular-nums">{formatCurrency(l.targetPrice)}</td>
                      <td className="num tabular-nums font-medium">{formatCurrency(l.amount)}</td>
                      <td className="font-mono">
                        {l.purchaseRequisitionId ? (
                          <Link
                            className="text-erp-primary"
                            to={`/purchase/requisitions/${l.purchaseRequisitionId}`}
                          >
                            {l.purchaseRequisitionNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="text-erp-muted">{l.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ErpCardSection>

        <ErpCardSection
          title="Vendors"
          subtitle={`${responseStats.quoted} of ${responseStats.selected} responded`}
          icon={Users}
          columns={1}
          defaultOpen
        >
          {rfq.vendors.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No vendors"
              description="Invite vendors before sending this RFQ."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table min-w-[1100px] text-[12px]">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>GSTIN</th>
                    <th>State</th>
                    <th>Contact</th>
                    <th>Email / Mobile</th>
                    <th className="num">Rating</th>
                    <th>Invite</th>
                    <th>Sent</th>
                    <th>Responded</th>
                    <th className="num">Last Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.vendors.map((v) => (
                    <tr key={v.id} className={cn(!v.selected && 'opacity-45')}>
                      <td>
                        <div className="font-mono text-[11px] text-erp-muted">{v.vendorCode}</div>
                        <div className="font-medium">
                          {v.vendorName}
                          {!v.selected ? (
                            <span className="ml-1 text-[10px] font-normal text-erp-muted">
                              (not selected)
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="font-mono text-[11px]">{v.gstin || '—'}</td>
                      <td>{v.state}</td>
                      <td>{v.contactPerson || '—'}</td>
                      <td>
                        <div>{v.contactEmail || '—'}</div>
                        <div className="text-erp-muted">{v.contactPhone || '—'}</div>
                      </td>
                      <td className="num">
                        <span className="inline-flex items-center justify-end gap-1 tabular-nums">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {v.vendorRating != null ? v.vendorRating.toFixed(1) : '—'}
                        </span>
                      </td>
                      <td>
                        <Badge color={inviteBadgeColor(v.status)}>
                          {RFQ_VENDOR_INVITE_STATUS_LABELS[v.status]}
                        </Badge>
                      </td>
                      <td>{v.sentAt ? formatDate(v.sentAt.slice(0, 10)) : '—'}</td>
                      <td>{v.respondedAt ? formatDate(v.respondedAt.slice(0, 10)) : '—'}</td>
                      <td className="num tabular-nums">
                        {v.lastPurchasePrice != null
                          ? formatCurrency(v.lastPurchasePrice)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ErpCardSection>

        <ErpCardSection title="Audit Timeline" subtitle="Lifecycle and vendor activity" columns={1} defaultOpen>
          <PurchaseAuditTimeline
            entityType="rfq"
            entityId={rfq.id}
            className="border-0 p-0 shadow-none"
            demoEvents={buildDemoPurchaseTimeline({
              entityId: rfq.id,
              entityType: 'RequestForQuotation',
              createdAt: rfq.createdAt,
              createdBy: rfq.createdBy,
              updatedAt: rfq.updatedAt,
              updatedBy: rfq.updatedBy,
              statusLabel: RFQ_DOMAIN_STATUS_LABELS[rfq.status],
              extra: rfq.sentAt
                ? [{ action: 'RFQ_SENT', actionLabel: 'Sent', timestamp: rfq.sentAt }]
                : [],
            })}
          />
        </ErpCardSection>
        </div>
      </PurchaseCardFormShell>

      <Modal
        open={sendOpen}
        onClose={() => {
          setSendOpen(false)
          searchParams.delete('send')
          setSearchParams(searchParams, { replace: true })
        }}
        title="Send RFQ preview"
      >
        <div className="space-y-4 text-[13px]">
          <p>
            You are about to send <strong>{rfq.documentNumber}</strong> to the vendors below.
            Enquiry due date: <strong>{formatDate(rfq.bidDueDate)}</strong>.
          </p>
          <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
            {selectedVendors.map((v) => {
              const title =
                [v.vendorCode, v.vendorName].filter(Boolean).join(' — ') || 'Vendor (details unavailable)'
              const contact = [v.contactEmail, v.contactPhone].filter(Boolean).join(' · ')
              return (
                <li key={v.id} className="px-3 py-2">
                  <p className="font-medium">{title}</p>
                  {contact ? <p className="text-erp-muted">{contact}</p> : null}
                </li>
              )
            })}
          </ul>
          <p className="text-erp-muted">
            {rfq.lines.length} line(s) · Estimated value {formatCurrency(rfq.estimatedValue)}
          </p>
          <div className="flex justify-end gap-2">
            <ErpButton
              type="button"
              variant="ghost"
              onClick={() => setSendOpen(false)}
              disabled={busy}
            >
              Back
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              icon={Send}
              disabled={busy || selectedVendors.length === 0}
              onClick={() => void confirmSend()}
            >
              {busy ? 'Sending…' : 'Confirm & Send'}
            </ErpButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
