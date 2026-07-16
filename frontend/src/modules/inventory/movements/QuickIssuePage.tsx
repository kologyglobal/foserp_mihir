import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createIssueDraft,
  getBatchSelectionPreview,
  getIssueById,
  getIssueSourceDetails,
  getIssueSourceDocuments,
  postIssueDemo,
  updateIssueDraft,
  validateIssueLines,
} from '@/services/inventory'
import type { BatchSelectionMethod, InventoryIssue, IssueSourceType, MovementLine, MovementSourceDocument } from '@/types/inventoryDomain'
import { BATCH_METHOD_LABELS, ISSUE_SOURCE_LABELS } from '@/utils/inventoryMovementLabels'
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

const ISSUE_SOURCES: IssueSourceType[] = [
  'production_order', 'sales_order', 'maintenance', 'subcontract_issue', 'transfer_issue', 'direct_issue',
]

const STEPS = ['Select source type', 'Select source document', 'Confirm quantities']
function today() { return new Date().toISOString().slice(0, 10) }

export function QuickIssuePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const isEdit = Boolean(id)
  const [step, setStep] = useState(isEdit ? 3 : 1)
  const [sourceType, setSourceType] = useState<IssueSourceType>('production_order')
  const [sourceDocs, setSourceDocs] = useState<MovementSourceDocument[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [lines, setLines] = useState<MovementLine[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [batchMethod, setBatchMethod] = useState<BatchSelectionMethod>('fefo')
  const [detailedMode, setDetailedMode] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [issueId, setIssueId] = useState<string | null>(id ?? null)
  const [existing, setExisting] = useState<InventoryIssue | null>(null)

  useEffect(() => {
    if (!id) return
    getIssueById(id).then((r) => {
      if (!r) { navigate('/inventory/movements/issues'); return }
      setExisting(r)
      setSourceType(r.sourceType)
      setSelectedDocId(r.sourceDocumentId)
      setLines(r.lines)
      setWarehouseId(r.warehouseId)
      setBatchMethod(r.batchMethod)
      setDetailedMode(r.mode === 'detailed')
      setIssueId(r.id)
      setLoading(false)
    })
  }, [id, navigate])

  const loadSourceDocs = useCallback(async () => {
    setSourceDocs(await getIssueSourceDocuments(sourceType))
  }, [sourceType])

  useEffect(() => { if (step === 2) void loadSourceDocs() }, [step, loadSourceDocs])

  const loadSourceDetails = async (docId: string) => {
    const details = await getIssueSourceDetails(sourceType, docId)
    if (!details) return
    setSelectedDocId(docId)
    setLines(details.lines)
    setWarehouseId(details.warehouseId)
    setStep(3)
  }

  const onLineChange = (lineId: string, patch: Partial<MovementLine>) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const issueAllAvailable = () => setLines((prev) => prev.map((l) => ({ ...l, issuedQty: Math.min(l.pendingQty || l.availableQty, l.availableQty) })))
  const issuePending = () => setLines((prev) => prev.map((l) => ({ ...l, issuedQty: l.pendingQty })))
  const clearQty = () => setLines((prev) => prev.map((l) => ({ ...l, issuedQty: 0 })))

  const autoSelectBatches = async () => {
    const updated = [...lines]
    for (let i = 0; i < updated.length; i++) {
      const line = updated[i]
      if (!line.batchTracking || line.issuedQty <= 0) continue
      const preview = await getBatchSelectionPreview(line.itemId, line.warehouseId, line.issuedQty, batchMethod)
      if (preview[0]) updated[i] = { ...line, batchNo: preview[0].batchNo, expiryDate: preview[0].expiryDate }
    }
    setLines(updated)
    notify.success('Batches auto-selected')
  }

  const saveDraft = async () => {
    const input = {
      sourceType, sourceDocumentId: selectedDocId, warehouseId,
      documentDate: today(), postingDate: today(), batchMethod,
      mode: detailedMode ? 'detailed' as const : 'quick' as const,
      lines: lines.map((l) => ({ itemId: l.itemId, issuedQty: l.issuedQty, pendingQty: l.pendingQty, batchNo: l.batchNo })),
    }
    try {
      const doc = issueId ? await updateIssueDraft(issueId, input) : await createIssueDraft(input)
      setIssueId(doc.id)
      notify.success('Draft saved')
      navigate(`/inventory/movements/issues/${doc.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const postDemo = async () => {
    const errors = validateIssueLines(lines, { allowNegativeStock: perms.canOverrideNegativeStock })
    if (errors.length) { notify.error(errors[0]); return }
    try {
      let docId = issueId
      if (!docId) {
        const draft = await createIssueDraft({
          sourceType, sourceDocumentId: selectedDocId, warehouseId,
          documentDate: today(), postingDate: today(), batchMethod,
          lines: lines.map((l) => ({ itemId: l.itemId, issuedQty: l.issuedQty, pendingQty: l.pendingQty })),
        })
        docId = draft.id
      } else {
        await updateIssueDraft(docId, { lines: lines.map((l) => ({ itemId: l.itemId, issuedQty: l.issuedQty, pendingQty: l.pendingQty })) })
      }
      await postIssueDemo(docId, { allowNegativeStock: perms.canOverrideNegativeStock })
      notify.success('Issue posted (demo)')
      navigate(`/inventory/movements/issues/${docId}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Post failed')
    }
  }

  if (!perms.canCreateIssue && !isEdit) return <p className="p-6 text-red-600">Access denied</p>
  if (loading) return <LoadingState variant="form" />

  const previewDoc = existing ?? ({
    id: '', documentNumber: 'Draft', movementType: 'issue', documentDate: today(), postingDate: today(),
    sourceType, sourceDocumentId: selectedDocId, sourceDocumentNo: sourceDocs.find((d) => d.id === selectedDocId)?.documentNo ?? null,
    warehouseId, warehouseName: '—', plantCode: '—', status: 'draft', createdBy: 'Demo User', approvedBy: null, postedBy: null,
    createdAt: today(), updatedAt: today(), department: null, costCentre: null, batchMethod, lines,
    mode: detailedMode ? 'detailed' : 'quick', costPreview: null, accountingPreview: null, attachments: [], auditHistory: [],
  } as InventoryIssue)

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={isEdit ? `Edit Issue — ${existing?.documentNumber}` : 'Quick Material Issue'}
      breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Issues', to: '/inventory/movements/issues' }, { label: isEdit ? 'Edit' : 'New' }]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          secondaryActions={[
            { id: 'all', label: 'Issue All Available', onClick: issueAllAvailable },
            { id: 'pending', label: 'Issue Pending Qty', onClick: issuePending },
            { id: 'batch', label: 'Auto Select Batches', onClick: () => void autoSelectBatches() },
            { id: 'clear', label: 'Clear Quantities', onClick: clearQty },
            ...(perms.canEditIssue ? [{ id: 'save', label: 'Save Draft', onClick: () => void saveDraft() }] : []),
            ...(perms.canPostIssue ? [{ id: 'post', label: 'Post Issue Demo', onClick: () => void postDemo() }] : []),
          ]}
        />
      )}
    >
      <MovementDemoBanner />
      {!isEdit ? <MovementWizardSteps step={step} steps={STEPS} /> : null}

      {step === 1 ? (
        <MovementSection title="Source Type">
          <div className="grid gap-2 sm:grid-cols-2">
            {ISSUE_SOURCES.map((st) => (
              <button key={st} type="button" className={`rounded-lg border p-3 text-left text-[13px] ${sourceType === st ? 'border-erp-primary bg-erp-primary/5' : 'border-erp-border'}`} onClick={() => setSourceType(st)}>
                {ISSUE_SOURCE_LABELS[st]}
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
              <li key={d.id}><button type="button" className="w-full rounded border p-3 text-left text-[13px] hover:bg-erp-bg-subtle" onClick={() => void loadSourceDetails(d.id)}>
                <span className="font-mono">{d.documentNo}</span> · Pending {d.pendingQty}
              </button></li>
            ))}</ul>
          )}
          <button type="button" className="erp-btn erp-btn-ghost mt-4" onClick={() => setStep(1)}>Back</button>
        </MovementSection>
      ) : null}

      {step === 3 ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={detailedMode} onChange={(e) => setDetailedMode(e.target.checked)} /> Detailed Mode</label>
            <label className="text-[13px]">Batch method
              <select className="erp-input ml-2 h-8" value={batchMethod} onChange={(e) => setBatchMethod(e.target.value as BatchSelectionMethod)}>
                {Object.entries(BATCH_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <MovementSection title="Document Header"><MovementDocumentHeader doc={previewDoc} /></MovementSection>
          <MovementSection title="Movement Lines">
            <MovementLineGrid lines={lines} mode="issue" batchMethod={batchMethod} editable={!existing || ['draft', 'pending_issue', 'partially_issued'].includes(existing.status)} onLineChange={onLineChange} />
          </MovementSection>
          {detailedMode ? <MovementPreviewPanels doc={previewDoc} /> : null}
        </>
      ) : null}
    </OperationalPageShell>
  )
}

export function IssueDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [doc, setDoc] = useState<InventoryIssue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getIssueById(id).then((r) => { if (!r) navigate('/inventory/movements/issues'); else setDoc(r); setLoading(false) })
  }, [id, navigate])

  if (loading || !doc) return <LoadingState variant="card" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={doc.documentNumber}
      breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Issues', to: '/inventory/movements/issues' }, { label: doc.documentNumber }]}
      autoBreadcrumbs={false}
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[
        ...(doc.status === 'draft' && perms.canEditIssue ? [{ id: 'edit', label: 'Edit', onClick: () => navigate(`/inventory/movements/issues/${id}/edit`) }] : []),
        ...(perms.canPostIssue && doc.status !== 'posted' ? [{ id: 'post', label: 'Post Demo', onClick: async () => { await postIssueDemo(id!, { allowNegativeStock: perms.canOverrideNegativeStock }); notify.success('Posted'); window.location.reload() } }] : []),
      ]} />}
    >
      <MovementDemoBanner />
      <MovementSection title="Header"><MovementDocumentHeader doc={doc} /></MovementSection>
      <MovementSection title="Lines"><MovementLineGrid lines={doc.lines} mode="issue" batchMethod={doc.batchMethod} /></MovementSection>
      <MovementPreviewPanels doc={doc} />
    </OperationalPageShell>
  )
}
