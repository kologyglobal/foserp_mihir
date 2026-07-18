import { useMemo, useState } from 'react'
import { ErpButton } from '../../erp/ErpButton'
import { ErpSmartSelect } from '../../erp/ErpSmartSelect'
import {
  ErpDocumentUpload,
  type DocumentUploadHandler,
  type ErpDocumentFileMeta,
} from '../../erp/ErpDocumentUpload'
import { getDocumentUploadCategory } from '../../../config/documentUploadCategories'
import { useDocumentTypeOptions } from '../../../hooks/useCrmMasters'
import { useCrmMasterStore } from '../../../store/crmMasterStore'
import {
  documentTypeUploadHint,
  mimeTypesForExtensions,
  parseAllowedFileTypes,
} from '../../../utils/crmDocumentUploadUtils'
import { CRM_MAX_ATTACHMENT_BYTES } from '../../../hooks/useEntityAttachments'

interface AttachmentUploadDialogProps {
  open: boolean
  pending?: boolean
  uploadProgress?: number | null
  onClose: () => void
  onUpload: (file: File, documentType: string) => Promise<{ ok: boolean; error?: string }>
}

export function AttachmentUploadDialog({
  open,
  pending = false,
  onClose,
  onUpload,
}: AttachmentUploadDialogProps) {
  const documentTypeOptions = useDocumentTypeOptions()
  const getByCode = useCrmMasterStore((s) => s.getByCode)
  const [documentTypeCode, setDocumentTypeCode] = useState('')
  const [staged, setStaged] = useState<ErpDocumentFileMeta[]>([])
  const [error, setError] = useState<string | null>(null)

  const selectedType = documentTypeCode ? getByCode('document-types', documentTypeCode) : undefined
  const category = getDocumentUploadCategory(documentTypeCode || 'general_document')

  const allowedExtensions = useMemo(() => {
    if (selectedType) return parseAllowedFileTypes(selectedType.attributes.fileTypes)
    return category?.acceptedExtensions ?? []
  }, [selectedType, category])

  const acceptedMimeTypes = useMemo(() => {
    if (selectedType) return mimeTypesForExtensions(allowedExtensions)
    return category?.acceptedMimeTypes ?? mimeTypesForExtensions(allowedExtensions)
  }, [selectedType, allowedExtensions, category])

  const maxFileSizeMb = Math.min(
    selectedType
      ? Number(selectedType.attributes.maxSizeMb) || category?.maxFileSizeMb || 10
      : category?.maxFileSizeMb || 10,
    Math.round(CRM_MAX_ATTACHMENT_BYTES / (1024 * 1024)),
  )

  const typeSelectOptions = useMemo(
    () =>
      documentTypeOptions.map((o) => ({
        value: o.value,
        label: o.label,
        searchText: o.label.toLowerCase(),
      })),
    [documentTypeOptions],
  )

  if (!open) return null

  const handleUpload: DocumentUploadHandler = async ({ file, onProgress }) => {
    if (!selectedType) {
      throw new Error('Select an attachment type before uploading.')
    }
    onProgress(20)
    const result = await onUpload(file, selectedType.code)
    onProgress(90)
    if (!result.ok) {
      throw new Error(result.error ?? 'Upload failed')
    }
    onProgress(100)
    return { uploadStatus: 'uploaded' as const, uploadProgress: 100 }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-erp-border bg-erp-surface p-4 shadow-lg">
        <h3 className="text-[15px] font-semibold text-erp-text">Upload attachment</h3>
        <p className="mt-1 text-[13px] text-erp-muted">
          Choose attachment type from master, then upload. Max{' '}
          {Math.round(CRM_MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB platform limit.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-medium text-erp-muted">
            Attachment type <span className="text-red-600">*</span>
          </label>
          <ErpSmartSelect
            options={typeSelectOptions}
            value={documentTypeCode}
            onChange={(v) => {
              setDocumentTypeCode(v ?? '')
              setStaged([])
              setError(null)
            }}
            placeholder="Choose from Document Type Master…"
            appearance="dropdown"
            disabled={pending}
            allowEmpty
          />
          {selectedType ? (
            <p className="text-[12px] text-erp-muted">{documentTypeUploadHint(selectedType)}</p>
          ) : (
            <p className="text-[12px] text-erp-muted">
              Select a type to enable upload. Managed under CRM → Document Type Master.
            </p>
          )}

          <ErpDocumentUpload
            category={category?.code || documentTypeCode || 'general_document'}
            acceptedMimeTypes={acceptedMimeTypes}
            acceptedExtensions={allowedExtensions}
            maxFileSizeMb={maxFileSizeMb}
            maxFiles={1}
            allowPreview
            allowRemove
            allowDownload
            allowRetry
            files={staged}
            onChange={(next) => {
              setStaged(next)
              if (next.some((f) => f.uploadStatus === 'uploaded')) {
                setDocumentTypeCode('')
                setError(null)
                // Defer close so ErpDocumentUpload can finish status patch.
                queueMicrotask(() => onClose())
              }
            }}
            onUpload={selectedType ? handleUpload : undefined}
            disabled={pending || !selectedType}
            documentTypeCode={selectedType?.code}
            documentTypeName={selectedType?.name}
            error={error}
            hideDropzoneWhenFull
            dropzoneTitle={
              selectedType ? 'Drag and drop or click to upload' : 'Select document type first'
            }
            hint={
              selectedType
                ? documentTypeUploadHint(selectedType)
                : 'Select a document type to enable upload'
            }
          />
        </div>

        <div className="mt-4 flex justify-end">
          <ErpButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setDocumentTypeCode('')
              setStaged([])
              setError(null)
              onClose()
            }}
            disabled={pending}
          >
            Cancel
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
