import { useMemo, useState } from 'react'
import { Download, Paperclip, Trash2, Upload } from 'lucide-react'
import { useEntityAttachments } from '../../../hooks/useEntityAttachments'
import { canCrmPermission } from '../../../utils/permissions/crm'
import type { CrmEntityTypeApi } from '../../../types/crmEntity'
import { AttachmentUploadDialog } from './AttachmentUploadDialog'
import { ErpButton } from '../../erp/ErpButton'
import { formatDateTime } from '../../../utils/dates/format'
import { useCrmMasterStore } from '../../../store/crmMasterStore'
import { systemConfirm } from '../../../utils/systemConfirm'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface EntityAttachmentsPanelProps {
  entityType: CrmEntityTypeApi
  entityId: string
  title?: string
  className?: string
}

export function EntityAttachmentsPanel({
  entityType,
  entityId,
  title = 'Documents & Attachments',
  className,
}: EntityAttachmentsPanelProps) {
  const {
    attachments,
    loading,
    error,
    pending,
    uploadProgress,
    uploadFile,
    deleteAttachment,
    downloadAttachment,
    isApiBacked,
  } = useEntityAttachments(entityType, entityId)
  const [uploadOpen, setUploadOpen] = useState(false)
  const getByCode = useCrmMasterStore((s) => s.getByCode)
  const masterEntries = useCrmMasterStore((s) => s.entries)

  const typeLabelByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of masterEntries) {
      if (e.kind === 'document-types') map.set(e.code, e.name)
    }
    return map
  }, [masterEntries])

  if (!isApiBacked) return null

  const canCreate = canCrmPermission('crm.attachment.create')
  const canDelete = canCrmPermission('crm.attachment.delete')
  const canView = canCrmPermission('crm.attachment.view')

  if (!canView) {
    return <p className="text-[13px] text-erp-muted">You do not have permission to view attachments.</p>
  }

  function resolveTypeLabel(code?: string, name?: string): string | null {
    if (!code && !name) return null
    if (name) return name
    if (!code) return null
    return typeLabelByCode.get(code) ?? getByCode('document-types', code)?.name ?? code
  }

  return (
    <section className={className ?? 'ent-360-docs'} aria-label={title}>
      <div className="ent-360-docs__head">
        <h2 className="ent-360-docs__title">{title}</h2>
        {canCreate ? (
          <button type="button" className="ent-360-docs__upload" onClick={() => setUploadOpen(true)} disabled={pending}>
            <Upload className="mr-1 inline h-3.5 w-3.5" />
            Upload
          </button>
        ) : null}
      </div>

      {loading ? <p className="text-[13px] text-erp-muted">Loading attachments…</p> : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

      {!loading && attachments.length === 0 ? (
        <div
          className="ent-360-docs__dropzone"
          onClick={canCreate ? () => setUploadOpen(true) : undefined}
          onKeyDown={canCreate ? (e) => e.key === 'Enter' && setUploadOpen(true) : undefined}
          role={canCreate ? 'button' : undefined}
          tabIndex={canCreate ? 0 : undefined}
        >
          <Paperclip className="mx-auto mb-2 h-6 w-6 text-erp-muted" />
          <p className="font-medium text-erp-text">No documents yet</p>
          <p className="text-[13px] text-erp-muted">Select an attachment type, then upload files</p>
        </div>
      ) : (
        <ul className="ent-360-docs__list">
          {attachments.map((doc) => {
            const typeLabel = resolveTypeLabel(doc.documentType, doc.documentTypeName)
            return (
              <li key={doc.id} className="ent-360-docs__item flex flex-wrap items-center gap-2">
                <span className="ent-360-docs__name">{doc.originalFilename}</span>
                {typeLabel ? <span className="ent-360-docs__type">{typeLabel}</span> : null}
                <span className="ent-360-docs__type">{formatFileSize(doc.fileSize)}</span>
                <span className="ent-360-docs__date">
                  {doc.uploadedByName || 'User'} · {formatDateTime(doc.createdAt)}
                </span>
                <div className="ml-auto flex gap-1">
                  <ErpButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={Download}
                    onClick={() => void downloadAttachment(doc.id, doc.originalFilename)}
                  >
                    Download
                  </ErpButton>
                  {canDelete ? (
                    <ErpButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={Trash2}
                      disabled={pending}
                      onClick={() => {
                        void systemConfirm({
                          title: 'Delete attachment?',
                          description: `Delete “${doc.originalFilename}”? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          cancelLabel: 'Cancel',
                          variant: 'danger',
                        }).then((ok) => {
                          if (ok) void deleteAttachment(doc.id)
                        })
                      }}
                    >
                      Delete
                    </ErpButton>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AttachmentUploadDialog
        open={uploadOpen}
        pending={pending}
        uploadProgress={uploadProgress}
        onClose={() => setUploadOpen(false)}
        onUpload={uploadFile}
      />
    </section>
  )
}
