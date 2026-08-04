import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { ErpCardSection, ErpFieldRow } from '@/components/erp/card-form'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { DecimalInput, Input, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getPurchaseRequisitionById,
  PURCHASE_REQUISITION_STATUS_LABELS,
  revisePurchaseRequisition,
} from '@/services/purchase'
import type { PurchaseRequisition } from '@/types/purchaseDomain'
import { notify } from '@/store/toastStore'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'

const REVISABLE = new Set(['approved', 'partially_converted'])

export function PurchaseRequisitionRevisePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pr, setPr] = useState<PurchaseRequisition | null>(null)
  const [reason, setReason] = useState('')
  const [requiredDate, setRequiredDate] = useState('')
  const [purpose, setPurpose] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lineQty, setLineQty] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getPurchaseRequisitionById(id)
      if (cancelled) return
      if (!row) {
        notify.error('Purchase requisition not found')
        navigate('/purchase/requisitions')
        return
      }
      if (!REVISABLE.has(row.status)) {
        notify.error('This PR cannot be revised in its current status')
        navigate(`/purchase/requisitions/${row.id}`)
        return
      }
      setPr(row)
      setRequiredDate(row.expectedDeliveryDate ?? '')
      setPurpose(row.purpose ?? '')
      setRemarks(row.remarks ?? '')
      setLineQty(Object.fromEntries(row.lines.map((l) => [l.id, l.quantity])))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading || !pr) {
    return (
      <PurchaseCardFormShell
        title="Revise Purchase Requisition"
        description="Loading…"
        status="…"
        favoritePath="/purchase/requisitions"
        breadcrumbs={[{ label: 'Purchase Requisitions', to: '/purchase/requisitions' }, { label: 'Loading' }]}
        footer={null}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title={`Revise ${pr.documentNumber}`}
      description={`Creates revision ${pr.revisionNo + 1} — update header fields or line quantities with a recorded reason.`}
      recordNo={pr.documentNumber}
      status={PURCHASE_REQUISITION_STATUS_LABELS[pr.status]}
      statusTone={purchaseStatusTone(pr.status)}
      favoritePath={`/purchase/requisitions/${pr.id}/revise`}
      breadcrumbs={[
        { label: 'Purchase Requisitions', to: '/purchase/requisitions' },
        { label: pr.documentNumber, to: `/purchase/requisitions/${pr.id}` },
        { label: 'Revise' },
      ]}
      backLink={{ to: `/purchase/requisitions/${pr.id}`, label: 'Back to PR' }}
      footer={
        <FormActionBar
          sticky
          cancelFirst
          dirty
          busy={saving}
          onCancel={() => navigate(`/purchase/requisitions/${pr.id}`)}
          onSave={async () => {
            if (!reason.trim()) {
              notify.error('Revision reason is required')
              return
            }
            setSaving(true)
            try {
              await revisePurchaseRequisition(pr.id, {
                reason: reason.trim(),
                requiredDate: requiredDate || null,
                purchasePurpose: purpose,
                remarks,
                lines: pr.lines
                  .filter((l) => (lineQty[l.id] ?? l.quantity) !== l.quantity)
                  .map((l) => ({ id: l.id, requiredQuantity: lineQty[l.id] ?? l.quantity })),
              })
              notify.success('Purchase requisition revised')
              navigate(`/purchase/requisitions/${pr.id}`)
            } catch (e) {
              notify.error(e instanceof Error ? e.message : 'Revision failed')
            } finally {
              setSaving(false)
            }
          }}
        />
      }
    >
      <ErpCardSection title="Revision reason" defaultOpen>
        <ErpFieldRow label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection title="Header changes" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <ErpFieldRow label="Required date">
            <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Purpose">
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Remarks" className="sm:col-span-2">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </ErpFieldRow>
        </div>
      </ErpCardSection>

      <ErpCardSection title="Line quantities" defaultOpen>
        <div className="space-y-3">
          {pr.lines.map((line) => (
            <div key={line.id} className="grid gap-2 sm:grid-cols-[1fr_120px] sm:items-end">
              <div>
                <p className="font-mono text-[12px]">{line.itemCode}</p>
                <p className="text-sm">{line.itemName}</p>
              </div>
              <DecimalInput
                min={0}
                value={lineQty[line.id] ?? line.quantity}
                onChange={(v) => setLineQty((prev) => ({ ...prev, [line.id]: v }))}
              />
            </div>
          ))}
        </div>
      </ErpCardSection>
    </PurchaseCardFormShell>
  )
}
