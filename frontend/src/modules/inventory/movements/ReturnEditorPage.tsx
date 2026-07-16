import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCardFormPage } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { MovementAuditTimeline } from '@/components/inventory/movements/MovementPreviewPanels'
import {
  createReturnDraft,
  getReturnById,
  getReturnSourceDetails,
  getReturnSourceDocuments,
  postReturnDemo,
  InventoryServiceError,
} from '@/services/inventory'
import type { InventoryReturn, InventoryReturnType, ReturnLine, ReturnSourceDocument, SalesReturnCondition } from '@/types/inventoryDomain'
import { RETURN_STATUS_LABELS, RETURN_TYPE_LABELS, SALES_RETURN_CONDITION_LABELS } from '@/utils/inventoryMovementLabels'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { notify } from '@/store/toastStore'
import { BatchSelector } from '@/components/inventory/BatchSelector'
import { SerialSelector } from '@/components/inventory/SerialSelector'

function today() {
  return new Date().toISOString().slice(0, 10)
}

type EditorLine = ReturnLine & { _key: string }

export function ReturnEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id
  const navigate = useNavigate()
  const perms = useInventoryPermissions()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [doc, setDoc] = useState<InventoryReturn | null>(null)
  const [returnType, setReturnType] = useState<InventoryReturnType>(
    (searchParams.get('type') as InventoryReturnType) || 'purchase_return',
  )
  const [sourceDocs, setSourceDocs] = useState<ReturnSourceDocument[]>([])
  const [sourceDocumentId, setSourceDocumentId] = useState(searchParams.get('sourceId') ?? '')
  const [returnDate, setReturnDate] = useState(today())
  const [lines, setLines] = useState<EditorLine[]>([])
  const [partyName, setPartyName] = useState<string | null>(null)
  const [sourceNo, setSourceNo] = useState('')

  const loadDoc = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await getReturnById(id)
      if (!r) { navigate('/inventory/movements/returns'); return }
      setDoc(r)
      setReturnType(r.returnType)
      setSourceDocumentId(r.sourceDocumentId)
      setSourceNo(r.sourceDocumentNo)
      setPartyName(r.partyOrDepartment)
      setReturnDate(r.returnDate)
      setLines(r.lines.map((l) => ({ ...l, _key: l.id })))
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { void loadDoc() }, [loadDoc])

  useEffect(() => {
    if (!isNew) return
    void getReturnSourceDocuments(returnType).then(setSourceDocs)
  }, [returnType, isNew])

  useEffect(() => {
    if (!isNew || !sourceDocumentId) {
      if (!sourceDocumentId) setLines([])
      return
    }
    void getReturnSourceDetails(returnType, sourceDocumentId).then((details) => {
      if (!details) return
      setPartyName(details.partyOrDepartment)
      setSourceNo(details.sourceDocumentNo)
      setLines(details.lines.map((l) => ({ ...l, _key: l.id, returnQty: 0, returnValue: 0 })))
    })
  }, [returnType, sourceDocumentId, isNew])

  const readOnly = Boolean(doc?.status === 'posted')

  function updateLine(key: string, patch: Partial<EditorLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l
        const next = { ...l, ...patch }
        next.returnValue = next.returnQty * next.unitCost
        return next
      }),
    )
  }

  async function handleConfirm() {
    if (!sourceDocumentId) {
      notify.error('Select a source document')
      return
    }
    setSaving(true)
    try {
      const created = await createReturnDraft({
        returnType,
        sourceDocumentId,
        returnDate,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          returnQty: l.returnQty,
          reason: l.reason,
          condition: l.condition,
          batchNo: l.batchNo,
          serialNo: l.serialNo,
          remarks: l.remarks,
        })),
      })
      notify.success(`Return ${created.documentNumber} created`)
      navigate(`/inventory/movements/returns/${created.id}`)
    } catch (e) {
      notify.error(e instanceof InventoryServiceError ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function handlePost() {
    if (!doc) return
    try {
      const updated = await postReturnDemo(doc.id)
      setDoc(updated)
      notify.success('Return posted — inventory updated')
    } catch (e) {
      notify.error(e instanceof InventoryServiceError ? e.message : 'Post failed')
    }
  }

  if (loading) {
    return (
      <OperationalPageShell title="Return" badge="Inventory">
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const statusLabel = doc ? RETURN_STATUS_LABELS[doc.status] : 'New'

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Inventory & Warehouse"
      title={isNew ? 'Source-Driven Return' : `Return ${doc?.documentNumber ?? ''}`}
      description="Select source document — vendor, customer and lines load automatically."
      recordNo={doc?.documentNumber}
      statusChip={<StatusDot label={statusLabel} tone={statusToneFromLabel(statusLabel)} />}
      breadcrumbs={[
        { label: 'Inventory & Warehouse', to: '/inventory' },
        { label: 'Returns', to: '/inventory/movements/returns' },
        { label: isNew ? 'New' : doc?.documentNumber ?? 'Detail' },
      ]}
      favoritePath={isNew ? '/inventory/movements/returns/new' : `/inventory/movements/returns/${id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            isNew && perms.canCreateReturn
              ? { id: 'confirm', label: saving ? 'Confirming…' : 'Confirm Return', icon: Save, onClick: () => void handleConfirm(), disabled: saving || readOnly }
              : doc?.status === 'draft' && perms.canPostReturn
                ? { id: 'post', label: 'Post Return', icon: Send, onClick: () => void handlePost() }
                : undefined
          }
        />
      )}
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Return Type</label>
            <Select value={returnType} onChange={(e) => { setReturnType(e.target.value as InventoryReturnType); setSourceDocumentId('') }} disabled={readOnly || !isNew} className="w-full">
              {Object.entries(RETURN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          {isNew ? (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-erp-muted">Source Document</label>
              <Select value={sourceDocumentId} onChange={(e) => setSourceDocumentId(e.target.value)} disabled={readOnly} className="w-full">
                <option value="">Select source…</option>
                {sourceDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.documentNo} — {d.partyOrDepartment ?? '—'} ({d.eligibleQty} eligible)
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-erp-muted">Source Document</label>
              <Input value={sourceNo} readOnly disabled className="w-full" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Return Date</label>
            <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
        </div>

        {partyName ? (
          <div className="rounded-lg border border-erp-border bg-erp-surface-2 px-4 py-3 text-[12px]">
            <span className="text-erp-muted">Party / Department: </span>
            <span className="font-medium text-erp-text">{partyName}</span>
          </div>
        ) : null}

        <table className="erp-table w-full text-[12px]">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Eligible</th>
              <th className="text-right">Return Qty</th>
              <th>Batch</th>
              <th>Serial</th>
              {returnType === 'sales_return' ? <th>Condition</th> : null}
              <th>Reason</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l._key}>
                <td><span className="font-mono">{l.itemCode}</span> {l.itemName}</td>
                <td className="num">{formatNumber(l.eligibleQty)}</td>
                <td className="num">
                  {readOnly || !isNew ? formatNumber(l.returnQty) : (
                    <input
                      type="number"
                      min={0}
                      max={l.eligibleQty}
                      className="erp-input h-8 w-24 text-right"
                      value={l.returnQty}
                      onChange={(e) => updateLine(l._key, { returnQty: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td>
                  {readOnly || !isNew ? (
                    <span className="font-mono text-xs">{l.batchNo ?? '—'}</span>
                  ) : l.batchTracking && l.returnQty > 0 ? (
                    <BatchSelector
                      itemId={l.itemId}
                      warehouseId={l.warehouseId}
                      qty={l.returnQty}
                      value={l.batchNo}
                      method="fefo"
                      onChange={(batchNo) => updateLine(l._key, { batchNo })}
                    />
                  ) : (
                    <span className="font-mono text-xs">{l.batchNo ?? '—'}</span>
                  )}
                </td>
                <td>
                  {readOnly || !isNew ? (
                    <span className="font-mono text-xs">{l.serialNo ?? '—'}</span>
                  ) : l.serialTracking && l.returnQty > 0 ? (
                    <SerialSelector
                      itemId={l.itemId}
                      warehouseId={l.warehouseId}
                      requiredQty={Math.floor(l.returnQty)}
                      value={l.serialNo ? [l.serialNo] : []}
                      onChange={(serials) => updateLine(l._key, { serialNo: serials[0] ?? null })}
                    />
                  ) : (
                    <span className="font-mono text-xs">{l.serialNo ?? '—'}</span>
                  )}
                </td>
                {returnType === 'sales_return' ? (
                  <td>
                    {readOnly || !isNew ? (l.condition ? SALES_RETURN_CONDITION_LABELS[l.condition] : '—') : (
                      <select
                        className="erp-input h-8"
                        value={l.condition ?? ''}
                        onChange={(e) => updateLine(l._key, { condition: e.target.value as SalesReturnCondition })}
                      >
                        <option value="">Select…</option>
                        {Object.entries(SALES_RETURN_CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                  </td>
                ) : null}
                <td>
                  {readOnly || !isNew ? (l.reason ?? '—') : (
                    <input
                      className="erp-input h-8 w-full"
                      value={l.reason ?? ''}
                      onChange={(e) => updateLine(l._key, { reason: e.target.value })}
                      placeholder="Return reason"
                    />
                  )}
                </td>
                <td className="num">{formatCurrency(l.returnValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {doc ? (
          <div>
            <h3 className="mb-2 text-[13px] font-semibold">Audit</h3>
            <MovementAuditTimeline entries={doc.auditHistory} />
            {readOnly ? <p className="mt-2 text-[11px] text-erp-muted">Posted returns are read-only.</p> : null}
          </div>
        ) : null}
      </div>
    </ErpCardFormPage>
  )
}
