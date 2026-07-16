import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { ErpButton } from '../../erp/ErpButton'
import { Input } from '../../forms/Inputs'
import { CRM_MAX_ATTACHMENT_BYTES, isAllowedAttachmentFile } from '../../../hooks/useEntityAttachments'

interface AttachmentUploadDialogProps {
  open: boolean
  pending?: boolean
  uploadProgress?: number | null
  onClose: () => void
  onUpload: (file: File, documentType?: string) => Promise<{ ok: boolean; error?: string }>
}

export function AttachmentUploadDialog({
  open,
  pending = false,
  uploadProgress,
  onClose,
  onUpload,
}: AttachmentUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [documentType, setDocumentType] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleFile(file: File) {
    const validation = isAllowedAttachmentFile(file)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    const result = await onUpload(file, documentType.trim() || undefined)
    if (result.ok) {
      setDocumentType('')
      onClose()
    } else {
      setError(result.error ?? 'Upload failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-erp-border bg-erp-surface p-4 shadow-lg">
        <h3 className="text-[15px] font-semibold text-erp-text">Upload attachment</h3>
        <p className="mt-1 text-[13px] text-erp-muted">
          Max {Math.round(CRM_MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB · PDF, images, Office docs, CSV, plain text
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-medium text-erp-muted">Document type (optional)</label>
          <Input
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            placeholder="e.g. RFQ, Drawing"
            disabled={pending}
            className="erp-input"
          />

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />

          <ErpButton
            type="button"
            icon={Upload}
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? (uploadProgress != null ? `Uploading… ${uploadProgress}%` : 'Uploading…') : 'Choose file'}
          </ErpButton>

          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        </div>

        <div className="mt-4 flex justify-end">
          <ErpButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
