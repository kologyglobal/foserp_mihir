import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, Clock, FileText, History, Link2, Upload } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Timeline } from '../../components/design-system/Timeline'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { useDmsApprovalQueue } from '../../hooks/useStableStoreData'
import { useDmsStore } from '../../store/dmsStore'
import {
  DMS_DOCUMENT_TYPE_LABELS,
  DMS_ENTITY_LABELS,
  DMS_WORKFLOW_STATUS_LABELS,
  type DmsDocumentType,
  type DmsEntityType,
  type DmsWorkflowStatus,
} from '../../types/dms'
import { getDmsCategoryCoverage, searchDocuments } from '../../utils/dmsIntegration'
import { DmsCategoryBadge, DmsLatestBadge, DmsWorkflowBadge } from '../../components/dms/DmsBadges'
import { DocumentUploadDrawer } from '../../components/dms/DocumentUploadDrawer'
import { formatDate } from '../../utils/dates/format'
import { getFileContent, triggerDownload } from '../../utils/fileStorage'

const ALL_TYPES = Object.entries(DMS_DOCUMENT_TYPE_LABELS).filter(([k]) =>
  !['customer_drawing', 'vendor_drawing', 'certificate', 'test_report', 'photo'].includes(k),
) as [DmsDocumentType, string][]
const ALL_ENTITIES = Object.keys(DMS_ENTITY_LABELS) as DmsEntityType[]
const ALL_STATUSES = Object.keys(DMS_WORKFLOW_STATUS_LABELS).filter((s) =>
  ['draft', 'uploaded', 'under_review', 'approved', 'rejected', 'obsolete'].includes(s),
) as DmsWorkflowStatus[]

export function DocumentRegisterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState<DmsDocumentType | 'all'>(
    (searchParams.get('category') as DmsDocumentType | null) ?? 'all',
  )
  const [entityType, setEntityType] = useState<DmsEntityType | 'all'>(
    (searchParams.get('entityType') as DmsEntityType | null) ?? 'all',
  )
  const [workflowStatus, setWorkflowStatus] = useState<DmsWorkflowStatus | 'all'>(
    (searchParams.get('status') as DmsWorkflowStatus | null) ?? 'all',
  )
  const entityId = searchParams.get('entityId') ?? ''
  const [uploadOpen, setUploadOpen] = useState(false)

  const documents = useMemo(
    () => searchDocuments({ query, category, entityType, entityId: entityId || undefined, workflowStatus }),
    [query, category, entityType, entityId, workflowStatus],
  )
  const coverage = useMemo(() => getDmsCategoryCoverage(), [documents])

  function applyParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  return (
    <OperationalPageShell
      title="Document Center"
      description="Controlled drawings, certificates, QC reports, dispatch documents — versioned and linked across the ERP"
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
          <Link to="/documents/approvals">
            <Button variant="secondary">
              <Clock className="mr-2 h-4 w-4" />
              Approval Queue
            </Button>
          </Link>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_TYPES.slice(0, 8).map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setCategory(type)
              applyParam('category', type)
            }}
            className="rounded-lg border border-erp-border bg-white p-3 text-left hover:border-erp-accent"
          >
            <p className="text-xs text-erp-muted">{label}</p>
            <p className="text-2xl font-semibold">{coverage[type] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-erp-border bg-white p-4">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            applyParam('q', e.target.value)
          }}
          placeholder="Search title, file, document no…"
          className="min-w-[200px] flex-1 rounded border border-erp-border px-3 py-2 text-sm"
        />
        <select value={category} onChange={(e) => { setCategory(e.target.value as DmsDocumentType | 'all'); applyParam('category', e.target.value) }} className="rounded border border-erp-border px-3 py-2 text-sm">
          <option value="all">All types</option>
          {ALL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value as DmsEntityType | 'all'); applyParam('entityType', e.target.value) }} className="rounded border border-erp-border px-3 py-2 text-sm">
          <option value="all">All modules</option>
          {ALL_ENTITIES.map((e) => <option key={e} value={e}>{DMS_ENTITY_LABELS[e]}</option>)}
        </select>
        <select value={workflowStatus} onChange={(e) => { setWorkflowStatus(e.target.value as DmsWorkflowStatus | 'all'); applyParam('status', e.target.value) }} className="rounded border border-erp-border px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{DMS_WORKFLOW_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {entityId && (
        <p className="mb-4 flex items-center gap-2 text-sm text-erp-muted">
          <Link2 className="h-4 w-4" />
          Filtered to {DMS_ENTITY_LABELS[entityType as DmsEntityType] ?? 'entity'} · {entityId}
        </p>
      )}

      <DataGrid
        data={documents}
        columns={[
          {
            accessorKey: 'documentNo',
            header: 'Doc No',
            cell: ({ row }) =>
              row.original.registryId ? (
                <Link to={`/documents/${row.original.registryId}`} className="text-erp-accent hover:underline">
                  {row.original.documentNo ?? row.original.registryId}
                </Link>
              ) : (
                row.original.documentNo ?? '—'
              ),
          },
          { accessorKey: 'title', header: 'Name' },
          { accessorKey: 'category', header: 'Type', cell: ({ row }) => <DmsCategoryBadge category={row.original.category} /> },
          { accessorKey: 'entityType', header: 'Module', cell: ({ row }) => DMS_ENTITY_LABELS[row.original.entityType] },
          { accessorKey: 'version', header: 'Version', cell: ({ row }) => `v${row.original.version ?? 1}` },
          { accessorKey: 'workflowStatus', header: 'Status', cell: ({ row }) => <DmsWorkflowBadge status={row.original.workflowStatus} /> },
          { accessorKey: 'isLatest', header: 'Latest', cell: ({ row }) => <DmsLatestBadge isLatest={row.original.isLatest ?? true} /> },
          { accessorKey: 'uploadedByName', header: 'Uploaded by' },
          { accessorKey: 'uploadedAt', header: 'Date', cell: ({ row }) => formatDate(row.original.uploadedAt.slice(0, 10)) },
        ]}
        emptyMessage="No documents match your filters."
      />

      <DocumentUploadDrawer open={uploadOpen} onClose={() => setUploadOpen(false)} defaultEntityType={entityType !== 'all' ? entityType : undefined} defaultEntityId={entityId || undefined} />
    </OperationalPageShell>
  )
}

export function DocumentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const doc = useDmsStore((s) => (id ? s.getDocument(id) : undefined))
  const getVersionHistory = useDmsStore((s) => s.getVersionHistory)
  const getDocumentTimeline = useDmsStore((s) => s.getDocumentTimeline)
  const approveDocument = useDmsStore((s) => s.approveDocument)
  const markObsolete = useDmsStore((s) => s.markObsolete)
  const deleteDocument = useDmsStore((s) => s.deleteDocument)
  const [uploadOpen, setUploadOpen] = useState(false)

  const versions = useMemo(() => (doc ? getVersionHistory(doc.documentNo) : []), [doc, getVersionHistory])
  const timeline = useMemo(() => (id ? getDocumentTimeline(id) : []), [id, getDocumentTimeline])

  if (!doc) {
    return (
      <OperationalPageShell title="Document not found" description="">
        <EmptyState icon={FileText} title="Document not found" description="The requested document does not exist in the registry." action={<Button onClick={() => navigate('/documents')}>Back to register</Button>} />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={doc.title}
      description={`${doc.documentNo} · ${DMS_DOCUMENT_TYPE_LABELS[doc.category]}`}
      badge={doc.workflowStatus ?? doc.status}
      breadcrumbs={[{ label: 'Documents', to: '/documents' }, { label: doc.documentNo }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => {
            if (doc.storageRef) {
              const c = getFileContent(doc.storageRef)
              if (c) triggerDownload(doc.fileName, c, doc.mimeType)
            }
          }}>Download</Button>
          {doc.isLatest !== false && (
            <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>Replace / New Version</Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => approveDocument(doc.id)}>Approve</Button>
          <Button variant="secondary" size="sm" onClick={() => markObsolete(doc.id)}>Mark Obsolete</Button>
          <Button variant="secondary" size="sm" onClick={() => { const r = deleteDocument(doc.id); if (!r.ok) alert(r.error) }}>Delete</Button>
        </div>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Version', `v${doc.version ?? 1}${doc.revision ? ` (${doc.revision})` : ''}`],
          ['Status', DMS_WORKFLOW_STATUS_LABELS[doc.workflowStatus ?? doc.status ?? 'uploaded']],
          ['Uploaded by', doc.uploadedByName],
          ['Uploaded', formatDate(doc.uploadedAt.slice(0, 10))],
          ['Approved by', doc.approvedBy ?? '—'],
          ['Approved', doc.approvedAt ? formatDate(doc.approvedAt.slice(0, 10)) : '—'],
          ['File', doc.fileName],
          ['Latest', doc.isLatest === false ? 'No' : 'Yes'],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-lg border border-erp-border bg-white p-3">
            <p className="text-xs text-erp-muted">{label}</p>
            <p className="font-medium">{val}</p>
          </div>
        ))}
      </div>

      {doc.engineeringMeta && (
        <div className="mb-6 rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-2 font-medium">Engineering Drawing Control</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {doc.engineeringMeta.drawingNo && <><dt className="text-erp-muted">Drawing No</dt><dd>{doc.engineeringMeta.drawingNo}</dd></>}
            {doc.engineeringMeta.drawingRevision && <><dt className="text-erp-muted">Revision</dt><dd>{doc.engineeringMeta.drawingRevision}</dd></>}
            {doc.engineeringMeta.customerApproved && <><dt className="text-erp-muted">Customer Approved</dt><dd>Yes{doc.engineeringMeta.locked ? ' (locked)' : ''}</dd></>}
            {doc.engineeringMeta.effectiveDate && <><dt className="text-erp-muted">Effective Date</dt><dd>{doc.engineeringMeta.effectiveDate}</dd></>}
          </dl>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 font-medium"><History className="h-4 w-4" /> Version History</h3>
        <DataGrid
          data={versions}
          columns={[
            { accessorKey: 'version', header: 'Version', cell: ({ row }) => `v${row.original.version ?? 1}` },
            { accessorKey: 'revision', header: 'Revision' },
            { accessorKey: 'workflowStatus', header: 'Status', cell: ({ row }) => <DmsWorkflowBadge status={row.original.workflowStatus ?? row.original.status} /> },
            { accessorKey: 'isLatest', header: 'Latest', cell: ({ row }) => <DmsLatestBadge isLatest={row.original.isLatest} /> },
            { accessorKey: 'uploadedAt', header: 'Uploaded', cell: ({ row }) => formatDate(row.original.uploadedAt.slice(0, 10)) },
            {
              id: 'link',
              header: '',
              cell: ({ row }) => row.original.id !== doc.id ? <Link to={`/documents/${row.original.id}`} className="text-xs text-erp-accent">Open</Link> : <span className="text-xs text-erp-muted">Current</span>,
            },
          ]}
          compact
          emptyMessage="No version history."
        />
      </div>

      <div className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 font-medium">Document Timeline</h3>
        <Timeline
          events={timeline.map((e) => ({
            id: e.id,
            label: e.label,
            timestamp: formatDate(e.at.slice(0, 10)),
            description: e.byName ? `${e.byName}${e.details ? ` — ${e.details}` : ''}` : e.details,
            status: e.kind === 'approve' ? 'done' : e.kind === 'obsolete' ? 'pending' : 'current',
          }))}
        />
      </div>

      <DocumentUploadDrawer open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </OperationalPageShell>
  )
}

export function DocumentApprovalQueuePage() {
  const queue = useDmsApprovalQueue()
  const approveDocument = useDmsStore((s) => s.approveDocument)
  const submitForReview = useDmsStore((s) => s.submitForReview)

  return (
    <OperationalPageShell title="Document Approval Queue" description="Documents awaiting review or approval" breadcrumbs={[{ label: 'Documents', to: '/documents' }, { label: 'Approval Queue' }]}>
      {queue.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Queue empty" description="No documents pending approval." />
      ) : (
        <DataGrid
          data={queue}
          columns={[
            { accessorKey: 'documentNo', header: 'Doc No', cell: ({ row }) => <Link to={`/documents/${row.original.id}`} className="text-erp-accent">{row.original.documentNo}</Link> },
            { accessorKey: 'title', header: 'Name' },
            { accessorKey: 'category', header: 'Type', cell: ({ row }) => <DmsCategoryBadge category={row.original.category} /> },
            { accessorKey: 'workflowStatus', header: 'Status', cell: ({ row }) => <DmsWorkflowBadge status={row.original.workflowStatus} /> },
            { accessorKey: 'uploadedByName', header: 'Uploaded by' },
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => (
                <div className="flex gap-2">
                  <button type="button" className="text-xs text-erp-accent" onClick={() => submitForReview(row.original.id)}>Review</button>
                  <button type="button" className="text-xs text-erp-accent" onClick={() => approveDocument(row.original.id)}>Approve</button>
                </div>
              ),
            },
          ]}
          compact
        />
      )}
    </OperationalPageShell>
  )
}
