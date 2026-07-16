import { useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { ErpButton } from '../../erp/ErpButton'
import { ErpSmartSelect } from '../../erp/ErpSmartSelect'
import { useDocumentTypeOptions } from '../../../hooks/useCrmMasters'
import { useCrmMasterStore } from '../../../store/crmMasterStore'
import {
  buildAcceptAttribute,
  documentTypeUploadHint,
  parseAllowedFileTypes,
  validateCrmUploadFile,
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
  uploadProgress,
  onClose,
  onUpload,
}: AttachmentUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const documentTypeOptions = useDocumentTypeOptions()
  const getByCode = useCrmMasterStore((s) => s.getByCode)
  const [documentTypeCode, setDocumentTypeCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedType = documentTypeCode ? getByCode('document-types', documentTypeCode) : undefined
  const allowedExtensions = useMemo(
    () => (selectedType ? parseAllowedFileTypes(selectedType.attributes.fileTypes) : []),
    [selectedType],
  )
  const acceptAttr = useMemo(() => buildAcceptAttribute(allowedExtensions), [allowedExtensions])
  const canChooseFile = Boolean(selectedType) && !pending

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

  async function handleFile(file: File) {
    if (!selectedType) {
      setError('Select an attachment type before uploading.')
      return
    }
    const validation = validateCrmUploadFile(file, selectedType)
    if (validation) {
      setError(validation)
      return
    }
    if (file.size > CRM_MAX_ATTACHMENT_BYTES) {
      setError(`File exceeds ${Math.round(CRM_MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB limit.`)
      return
    }
    setError(null)
    const result = await onUpload(file, selectedType.code)
    if (result.ok) {
      setDocumentTypeCode('')
      onClose()
    } else {
      setError(result.error ?? 'Upload failed')
    }
  }

  function handleChooseFile() {
    if (!canChooseFile) {
      setError('Select an attachment type before uploading.')
      return
    }
    inputRef.current?.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-erp-border bg-erp-surface p-4 shadow-lg">
        <h3 className="text-[15px] font-semibold text-erp-text">Upload attachment</h3>
        <p className="mt-1 text-[13px] text-erp-muted">
          Choose attachment type from master, then upload. Max{' '}
          {Math.round(CRM_MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB.
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

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={acceptAttr || undefined}
            disabled={!canChooseFile}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />

          <ErpButton
            type="button"
            icon={Upload}
            disabled={!canChooseFile}
            onClick={handleChooseFile}
          >
            {pending
              ? uploadProgress != null
                ? `Uploading… ${uploadProgress}%`
                : 'Uploading…'
              : canChooseFile
                ? 'Choose file'
                : 'Select type first'}
          </ErpButton>

          {error ? (
            <p className="text-[13px] text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <ErpButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setDocumentTypeCode('')
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
