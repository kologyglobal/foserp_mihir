/**
 * Document Management System tests — npm run test:dms
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { DMS_DEMO_ANCHORS } = await import('../src/data/dms/seedDocuments')
const { useDmsStore } = await import('../src/store/dmsStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { getDocumentsForEntity, searchDocuments } = await import('../src/utils/dmsIntegration')
const {
  assertDocumentUsableForTransaction,
  linkEcoDrawingRevision,
  assertDispatchCloseDocuments,
} = await import('../src/utils/dmsRules')
const { validateQcSubmission } = await import('../src/utils/qcDecisionEngine')
import type { QcParameterResult } from '../src/types/qcParameters'

let passed = 0
let failed = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function reset() {
  resetSessionUserForTests()
  setSessionUserForTests({ role: 'admin' })
}

console.log('\nDMS Tests\n')
reset()

// 1. Upload document to Product 360
const upload1 = useDmsStore.getState().uploadDocument({
  title: 'Product Layout Drawing',
  fileName: 'layout-rev-a.pdf',
  category: 'engineering_drawing',
  fileContent: 'data:application/pdf;base64,VEVTVA==',
  revision: 'Rev-A',
  entityLinks: [{ entityType: 'product', entityId: DMS_DEMO_ANCHORS.productId, entityLabel: '45 M3 Bulker' }],
})
check(1, 'Upload document to Product 360', upload1.ok, upload1.documentId)

// 2. Upload new version
const docId = upload1.documentId!
const v2 = useDmsStore.getState().supersedeDocument(docId, {
  fileName: 'layout-rev-b.pdf',
  revision: 'Rev-B',
  fileContent: 'data:application/pdf;base64,VEVTVDI=',
})
check(2, 'Upload new version supersedes prior', v2.ok, v2.newDocumentId)

// 3. Latest version is marked
const docNo = useDmsStore.getState().getDocument(docId)?.documentNo
const history = docNo ? useDmsStore.getState().getVersionHistory(docNo) : []
const latest = history.find((d) => d.isLatest)
check(3, 'Latest version is marked', latest?.id === v2.newDocumentId, latest?.revision)

// 4. Approved document cannot be deleted
const approvedId = useDmsStore.getState().registerDocument({
  title: 'Approved Cert',
  fileName: 'cert.pdf',
  category: 'test_certificate',
  workflowStatus: 'approved',
  entityLinks: [{ entityType: 'product', entityId: DMS_DEMO_ANCHORS.productId }],
})
useDmsStore.setState((s) => ({
  documents: s.documents.map((d) =>
    d.id === approvedId ? { ...d, workflowStatus: 'approved', status: 'approved', approvedBy: 'QA', approvedAt: new Date().toISOString() } : d,
  ),
}))
const delApproved = useDmsStore.getState().deleteDocument(approvedId)
check(4, 'Approved document cannot be deleted', !delApproved.ok)

// 5. Obsolete document cannot be used
const obsId = useDmsStore.getState().registerDocument({
  title: 'Obsolete Drawing',
  fileName: 'old.pdf',
  category: 'engineering_drawing',
  entityLinks: [{ entityType: 'bom', entityId: DMS_DEMO_ANCHORS.bomId }],
})
useDmsStore.getState().markObsolete(obsId)
const usable = assertDocumentUsableForTransaction(obsId)
check(5, 'Obsolete document cannot be used', !usable.ok)

// 6. ECO links old and new drawing
const ecoId = 'eco-test-001'
const engId = useDmsStore.getState().registerDocument({
  title: 'Tank Drawing',
  fileName: 'tank-rev-a.pdf',
  category: 'engineering_drawing',
  revision: 'Rev-A',
  entityLinks: [{ entityType: 'eco', entityId: ecoId }],
  engineeringMeta: { drawingNo: 'DWG-TANK', drawingRevision: 'Rev-A' },
})
const ecoLink = linkEcoDrawingRevision(ecoId, {
  oldDocumentId: engId,
  newFileName: 'tank-rev-b.pdf',
  newRevision: 'Rev-B',
  drawingNo: 'DWG-TANK',
})
const ecoDocs = useDmsStore.getState().documents.filter((d) => d.entityLinks.some((l) => l.entityType === 'eco' && l.entityId === ecoId))
check(6, 'ECO links old and new drawing', ecoLink.ok && ecoDocs.length >= 2)

// 7. QC photo-required parameter blocks pass without attachment
const photoParams: QcParameterResult[] = [
  {
    parameterId: 'p1',
    parameterName: 'Weld Photo',
    parameterType: 'photo_required',
    mandatory: true,
    attachmentRef: '',
    measuredValue: null,
    passed: true,
  },
]
const qcVal = validateQcSubmission(photoParams)
check(7, 'QC photo-required parameter blocks pass without attachment', !qcVal.canSubmit)

// 8. Dispatch cannot close without POD
const dispatchId = 'dispatch-test-pod'
useDispatchStore.setState((s) => ({
  dispatches: [
    {
      id: dispatchId,
      dispatchNo: 'DSP-TEST-001',
      status: 'pod_received',
      customerId: 'cust-1',
      customerName: 'Test Customer',
      salesOrderId: 'so-1',
      salesOrderNo: 'SO-001',
      plannedDate: '2026-06-01',
      lines: [],
      photos: [],
      checklist: [],
      customerAck: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as (typeof s.dispatches)[0],
    ...s.dispatches,
  ],
}))
const podCheck = assertDispatchCloseDocuments(dispatchId)
const close = useDispatchStore.getState().closeDispatch(dispatchId)
check(8, 'Dispatch cannot close without POD document', !podCheck.ok && !close.ok)

// 9. Document register shows linked documents
const productDocs = getDocumentsForEntity('product', DMS_DEMO_ANCHORS.productId)
const search = searchDocuments({ entityType: 'product', entityId: DMS_DEMO_ANCHORS.productId })
check(9, 'Document register shows linked documents', productDocs.length >= 3 && search.length >= 3, `${search.length} docs`)

// 10. Document timeline records upload, approval, obsolete
const timelineDoc = useDmsStore.getState().registerDocument({
  title: 'Timeline Test',
  fileName: 'tl.pdf',
  category: 'qc_report',
  entityLinks: [{ entityType: 'qc_inspection', entityId: DMS_DEMO_ANCHORS.qcId }],
})
useDmsStore.getState().approveDocument(timelineDoc)
useDmsStore.getState().markObsolete(timelineDoc)
const events = useDmsStore.getState().getDocumentTimeline(timelineDoc)
const kinds = new Set(events.map((e) => e.kind))
check(
  10,
  'Document timeline records upload, approval, obsolete',
  kinds.has('upload') && kinds.has('approve') && kinds.has('obsolete'),
  [...kinds].join(', '),
)

console.log(`\nDMS: ${passed}/${passed + failed} passed${failed ? ` (${failed} failed)` : ''}\n`)
process.exit(failed ? 1 : 0)
