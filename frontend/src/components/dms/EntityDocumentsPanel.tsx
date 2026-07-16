import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, FileText, Upload } from 'lucide-react'
import { DataGrid } from '../design-system/DataGrid'
import { Entity360Panel } from '../design-system/Entity360Shell'
import { EmptyState } from '../ui/EmptyState'
import type { DmsEntityType } from '../../types/dms'
import { DMS_ENTITY_LABELS } from '../../types/dms'
import { getDocumentsForEntity } from '../../utils/dmsIntegration'
import { DmsCategoryBadge, DmsLatestBadge, DmsWorkflowBadge } from './DmsBadges'
import { formatDate } from '../../utils/dates/format'
import { useDmsStore } from '../../store/dmsStore'
import { getFileContent, triggerDownload } from '../../utils/fileStorage'
import { DocumentUploadDrawer } from './DocumentUploadDrawer'
import { Button } from '../ui/Button'

type Props = {
  entityType: DmsEntityType
  entityId: string
  entityLabel?: string
  title?: string
  showHubLink?: boolean
  allowUpload?: boolean
}

export function EntityDocumentsPanel({
  entityType,
  entityId,
  entityLabel,
  title,
  showHubLink = true,
  allowUpload = true,
}: Props) {
  const documents = useMemo(
    () => getDocumentsForEntity(entityType, entityId),
    [entityType, entityId],
  )
  const approveDocument = useDmsStore((s) => s.approveDocument)
  const markObsolete = useDmsStore((s) => s.markObsolete)
  const supersedeDocument = useDmsStore((s) => s.supersedeDocument)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const panelTitle = title ?? `${DMS_ENTITY_LABELS[entityType]} Documents`

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleView(row: (typeof documents)[0]) {
    if (!row.registryId) {
      show('View available for DMS registry documents only')
      return
    }
    window.open(`/documents/${row.registryId}`, '_blank')
  }

  function handleDownload(row: (typeof documents)[0]) {
    const ref = row.storageRef
    if (!ref) {
      show('No file content stored for this document')
      return
    }
    const content = getFileContent(ref) ?? ref
    triggerDownload(row.fileName, content, row.mimeType)
  }

  function handleApprove(registryId: string) {
    const r = approveDocument(registryId)
    show(r.ok ? 'Document approved' : r.error ?? 'Approve failed')
  }

  function handleObsolete(registryId: string) {
    const r = markObsolete(registryId)
    show(r.ok ? 'Marked obsolete' : r.error ?? 'Failed')
  }

  function handleReplace(registryId: string, fileName: string) {
    const r = supersedeDocument(registryId, {
      fileName: fileName.replace(/(\.\w+)?$/, '-v2$1') || `${fileName}-v2`,
      revision: 'Rev-next',
      notes: 'Replaced from entity panel',
    })
    show(r.ok ? 'New version created' : r.error ?? 'Replace failed')
  }

  return (
    <Entity360Panel title={panelTitle}>
      {toast && (
        <p className="border-b border-erp-border bg-erp-surface-alt px-4 py-2 text-sm">{toast}</p>
      )}
      <div className="flex items-center justify-between border-b border-erp-border px-4 py-2">
        {showHubLink ? (
          <Link
            to={`/documents?entityType=${entityType}&entityId=${entityId}`}
            className="text-sm text-erp-accent hover:underline"
          >
            Open in Document Center
          </Link>
        ) : (
          <span />
        )}
        {allowUpload && (
          <Button size="sm" variant="secondary" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1 h-3 w-3" />
            Upload
          </Button>
        )}
      </div>
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents linked"
          description="Upload drawings, certificates, QC reports, or photos for this record."
          action={
            allowUpload ? (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                Upload document
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataGrid
          data={documents}
          columns={[
            {
              accessorKey: 'title',
              header: 'Document',
              cell: ({ row }) => (
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-erp-muted" aria-hidden />
                  <span>
                    {row.original.registryId ? (
                      <Link to={`/documents/${row.original.registryId}`} className="font-medium text-erp-accent hover:underline">
                        {row.original.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{row.original.title}</span>
                    )}
                    {row.original.documentNo && (
                      <span className="ml-2 text-xs text-erp-muted">{row.original.documentNo}</span>
                    )}
                  </span>
                </span>
              ),
            },
            {
              accessorKey: 'category',
              header: 'Type',
              cell: ({ row }) => <DmsCategoryBadge category={row.original.category} />,
            },
            {
              accessorKey: 'version',
              header: 'Ver',
              cell: ({ row }) => (
                <span className="text-xs">
                  v{row.original.version ?? 1}
                  {row.original.revision ? ` · ${row.original.revision}` : ''}
                </span>
              ),
            },
            {
              accessorKey: 'workflowStatus',
              header: 'Status',
              cell: ({ row }) => <DmsWorkflowBadge status={row.original.workflowStatus} />,
            },
            {
              accessorKey: 'isLatest',
              header: 'Latest',
              cell: ({ row }) => <DmsLatestBadge isLatest={row.original.isLatest ?? true} />,
            },
            {
              accessorKey: 'uploadedByName',
              header: 'Uploaded by',
              cell: ({ row }) => row.original.uploadedByName ?? '—',
            },
            {
              accessorKey: 'uploadedAt',
              header: 'Date',
              cell: ({ row }) => formatDate(row.original.uploadedAt.slice(0, 10)),
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => {
                const rid = row.original.registryId
                return (
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="text-xs text-erp-accent hover:underline" onClick={() => handleView(row.original)}>
                      <Eye className="mr-0.5 inline h-3 w-3" />
                      View
                    </button>
                    <button type="button" className="text-xs text-erp-accent hover:underline" onClick={() => handleDownload(row.original)}>
                      Download
                    </button>
                    {rid && (
                      <>
                        <button type="button" className="text-xs text-erp-accent hover:underline" onClick={() => handleReplace(rid, row.original.fileName)}>
                          Replace
                        </button>
                        <button type="button" className="text-xs text-erp-accent hover:underline" onClick={() => handleApprove(rid)}>
                          Approve
                        </button>
                        <button type="button" className="text-xs text-erp-muted hover:underline" onClick={() => handleObsolete(rid)}>
                          Obsolete
                        </button>
                      </>
                    )}
                  </div>
                )
              },
            },
          ]}
          compact
        />
      )}
      <DocumentUploadDrawer
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultEntityType={entityType}
        defaultEntityId={entityId}
        defaultEntityLabel={entityLabel}
        onUploaded={() => show('Document uploaded')}
      />
    </Entity360Panel>
  )
}

export function useEntityDocumentCount(entityType: DmsEntityType, entityId: string | undefined): number {
  return useMemo(() => {
    if (!entityId) return 0
    return getDocumentsForEntity(entityType, entityId).length
  }, [entityType, entityId])
}
