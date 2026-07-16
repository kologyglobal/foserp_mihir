import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createReceiptDraft,
  getReceiptById,
  getReceiptSourceDetails,
  getReceiptSourceDocuments,
  postReceiptDemo,
  updateReceiptDraft,
  validateReceiptLines,
} from '@/services/inventory'
import type { InventoryReceipt, MovementLine, MovementSourceDocument, ReceiptSourceType } from '@/types/inventoryDomain'
import { RECEIPT_SOURCE_LABELS } from '@/utils/inventoryMovementLabels'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import {
  MovementDemoBanner,
  MovementDocumentHeader,
  MovementLineGrid,
  MovementPreviewPanels,
  MovementSection,
  MovementWizardSteps,
} from '@/components/inventory/movements/movementShared'

const RECEIPT_SOURCES: ReceiptSourceType[] = [
  'purchase_order', 'production_output', 'transfer_receipt', 'customer_return', 'job_work_receipt', 'direct_receipt',
]

const STEPS = ['Select source type', 'Select source document', 'Confirm quantities']

function today() { return new Date().toISOString().slice(0, 10) }

export function QuickReceiptPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const isEdit = Boolean(id)
  const [step, setStep] = useState(isEdit ? 3 : 1)
  const [sourceType, setSourceType] = useState<ReceiptSourceType>('purchase_order')
  const [sourceDocs, setSourceDocs] = useState<MovementSourceDocument[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [lines, setLines] = useState<MovementLine[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [detailedMode, setDetailedMode] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [receiptId, setReceiptId] = useState<string | null>(id ?? null)
  const [existing, setExisting] = useState<InventoryReceipt | null>(null)

  useEffect(() => {
    if (!id) return
    getReceiptById(id).then((r) => {
      if (!r) { navigate('/inventory/movements/receipts'); return }
      setExisting(r)
      setSourceType(r.sourceType)
      setSelectedDocId(r.sourceDocumentId)
      setLines(r.lines)
      setWarehouseId(r.warehouseId)
      setDetailedMode(r.mode === 'detailed')
      setReceiptId(r.id)
      setLoading(false)
    })
  }, [id, navigate])

  const loadSourceDocs = useCallback(async () => {
    setSourceDocs(await getReceiptSourceDocuments(sourceType))
  }, [sourceType])

  useEffect(() => { if (step === 2) void loadSourceDocs() }, [step, loadSourceDocs])

  const loadSourceDetails = async (docId: string) => {
    const details = await getReceiptSourceDetails(sourceType, docId)
    if (!details) return
    setSelectedDocId(docId)
    setLines(details.lines)
    setWarehouseId(details.warehouseId)
    setStep(3)
  }

  const onLineChange = (lineId: string, patch: Partial<MovementLine>) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch, acceptedQty: patch.receivedQty ?? l.receivedQty } : l)))
  }

  const receiveAll = () => setLines((prev) => prev.map((l) => ({ ...l, receivedQty: l.pendingQty, acceptedQty: l.pendingQty })))
  const clearQty = () => setLines((prev) => prev.map((l) => ({ ...l, receivedQty: 0, acceptedQty: 0 })))

  const saveDraft = async () => {
    const input = {
      sourceType,
      sourceDocumentId: selectedDocId,
      warehouseId,
      documentDate: today(),
      postingDate: today(),
      mode: detailedMode ? 'detailed' as const : 'quick' as const,
      lines: lines.map((l) => ({ itemId: l.itemId, receivedQty: l.receivedQty, pendingQty: l.pendingQty, acceptedQty: l.acceptedQty, batchNo: l.batchNo, serialNo: l.serialNo, expiryDate: l.expiryDate })),
    }
    try {
      const doc = receiptId ? await updateReceiptDraft(receiptId, input) : await createReceiptDraft(input)
      setReceiptId(doc.id)
      notify.success('Draft saved')
      navigate(`/inventory/movements/receipts/${doc.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const postDemo = async () => {
    const errors = validateReceiptLines(lines)
    if (errors.length) { notify.error(errors[0]); return }
    try {
      let docId = receiptId
      if (!docId) {
        const draft = await createReceiptDraft({
          sourceType, sourceDocumentId: selectedDocId, warehouseId,
          documentDate: today(), postingDate: today(),
          lines: lines.map((l) => ({ itemId: l.itemId, receivedQty: l.receivedQty, pendingQty: l.pendingQty })),
        })
        docId = draft.id
      } else {
        await updateReceiptDraft(docId, { lines: lines.map((l) => ({ itemId: l.itemId, receivedQty: l.receivedQty, pendingQty: l.pendingQty })) })
      }
      await postReceiptDemo(docId)
      notify.success('Receipt posted (demo) — inventory ledger updated')
      navigate(`/inventory/movements/receipts/${docId}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Post failed')
    }
  }

  if (!perms.canCreateReceipt && !isEdit) return <p className="p-6 text-red-600">Access denied</p>
  if (loading) return <LoadingState variant="form" />

  const previewDoc = existing ?? ({
    id: '', documentNumber: 'Draft', movementType: 'receipt', documentDate: today(), postingDate: today(),
    sourceType, sourceDocumentId: selectedDocId, sourceDocumentNo: sourceDocs.find((d) => d.id === selectedDocId)?.documentNo ?? null,
    warehouseId, warehouseName: sourceDocs.find((d) => d.id === selectedDocId)?.warehouseName ?? '—', plantCode: '—',
    status: 'draft', createdBy: 'Demo User', approvedBy: null, postedBy: null, createdAt: today(), updatedAt: today(),
    vendorName: null, gateEntryNo: null, vehicleNo: null, lrNo: null, lines, mode: detailedMode ? 'detailed' : 'quick',
    costPreview: null, accountingPreview: null, attachments: [], auditHistory: [],
  } as InventoryReceipt)

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={isEdit ? `Edit Receipt — ${existing?.documentNumber}` : 'Quick Receipt'}
      breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Receipts', to: '/inventory/movements/receipts' }, { label: isEdit ? 'Edit' : 'New' }]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          secondaryActions={[
            { id: 'all', label: 'Receive All Pending', onClick: receiveAll },
            { id: 'clear', label: 'Clear Quantities', onClick: clearQty },
            ...(perms.canEditReceipt ? [{ id: 'save', label: 'Save Draft', onClick: () => void saveDraft() }] : []),
            ...(perms.canPostReceipt ? [{ id: 'post', label: 'Post Receipt Demo', onClick: () => void postDemo() }] : []),
          ]}
        />
      )}
    >
      <MovementDemoBanner />
      {!isEdit ? <MovementWizardSteps step={step} steps={STEPS} /> : null}

      {step === 1 ? (
        <MovementSection title="Source Type">
          <div className="grid gap-2 sm:grid-cols-2">
            {RECEIPT_SOURCES.map((st) => (
              <button key={st} type="button" className={`rounded-lg border p-3 text-left text-[13px] ${sourceType === st ? 'border-erp-primary bg-erp-primary/5' : 'border-erp-border'}`} onClick={() => setSourceType(st)}>
                {RECEIPT_SOURCE_LABELS[st]}
              </button>
            ))}
          </div>
          <button type="button" className="erp-btn erp-btn-primary mt-4 h-9 px-4" onClick={() => setStep(2)}>Next</button>
        </MovementSection>
      ) : null}

      {step === 2 ? (
        <MovementSection title="Source Document">
          {sourceDocs.length === 0 ? <p className="text-erp-muted">No open source documents.</p> : (
            <ul className="space-y-2">{sourceDocs.map((d) => (
              <li key={d.id}><button type="button" className="w-full rounded border border-erp-border p-3 text-left text-[13px] hover:bg-erp-bg-subtle" onClick={() => void loadSourceDetails(d.id)}>
                <span className="font-mono">{d.documentNo}</span> — {d.partyName ?? 'Direct'} · Pending {d.pendingQty}
              </button></li>
            ))}</ul>
          )}
          <button type="button" className="erp-btn erp-btn-ghost mt-4" onClick={() => setStep(1)}>Back</button>
        </MovementSection>
      ) : null}

      {step === 3 ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={detailedMode} onChange={(e) => setDetailedMode(e.target.checked)} /> Detailed Mode</label>
          </div>
          <MovementSection title="Document Header"><MovementDocumentHeader doc={previewDoc} /></MovementSection>
          <MovementSection title="Movement Lines">
            <MovementLineGrid lines={lines} mode="receipt" editable={!existing || ['draft', 'pending_receipt', 'partially_received', 'quality_hold'].includes(existing.status)} onLineChange={onLineChange} />
          </MovementSection>
          {detailedMode ? (
            <>
              <MovementSection title="Logistics"><p className="text-[13px] text-erp-muted">Gate entry, vehicle and LR fields — demo placeholders.</p></MovementSection>
              <MovementPreviewPanels doc={{ ...previewDoc, costPreview: previewDoc.costPreview ?? { lines: [], subtotal: 0, gstAmount: 0, total: 0 } }} />
            </>
          ) : null}
        </>
      ) : null}
    </OperationalPageShell>
  )
}

export function ReceiptDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [doc, setDoc] = useState<InventoryReceipt | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getReceiptById(id).then((r) => { if (!r) navigate('/inventory/movements/receipts'); else setDoc(r); setLoading(false) })
  }, [id, navigate])

  if (loading || !doc) return <LoadingState variant="card" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={doc.documentNumber}
      breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Receipts', to: '/inventory/movements/receipts' }, { label: doc.documentNumber }]}
      autoBreadcrumbs={false}
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[
        ...(doc.status === 'draft' && perms.canEditReceipt ? [{ id: 'edit', label: 'Edit', onClick: () => navigate(`/inventory/movements/receipts/${id}/edit`) }] : []),
        ...(perms.canPostReceipt && doc.status !== 'posted' ? [{ id: 'post', label: 'Post Demo', onClick: async () => { await postReceiptDemo(id!); notify.success('Posted'); window.location.reload() } }] : []),
      ]} />}
    >
      <MovementDemoBanner />
      <MovementSection title="Header"><MovementDocumentHeader doc={doc} /></MovementSection>
      <MovementSection title="Lines"><MovementLineGrid lines={doc.lines} mode="receipt" /></MovementSection>
      <MovementPreviewPanels doc={doc} />
    </OperationalPageShell>
  )
}
