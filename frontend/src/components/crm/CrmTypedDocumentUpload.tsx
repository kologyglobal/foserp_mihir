import { useCallback, useMemo, useRef, useState } from 'react'
import { FileText, ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import { useDocumentTypeOptions } from '../../hooks/useCrmMasters'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import {
  buildAcceptAttribute,
  documentTypeUploadHint,
  formatFileSize,
  isPreviewableImage,
  isPreviewablePdf,
  parseAllowedFileTypes,
  readFileAsDataUrl,
  validateCrmUploadFile,
} from '../../utils/crmDocumentUploadUtils'
import { cn } from '../../utils/cn'

function genAttachmentId() {
  return `att-${crypto.randomUUID().slice(0, 8)}`
}

export interface CrmTypedDocumentUploadProps {
  attachments: CrmTypedAttachment[]
  onChange: (attachments: CrmTypedAttachment[]) => void
  disabled?: boolean
  className?: string
}

export function CrmTypedDocumentUpload({
  attachments,
  onChange,
  disabled = false,
  className,
}: CrmTypedDocumentUploadProps) {
  const documentTypeOptions = useDocumentTypeOptions()
  const getByCode = useCrmMasterStore((s) => s.getByCode)
  const [selectedTypeCode, setSelectedTypeCode] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedType = selectedTypeCode ? getByCode('document-types', selectedTypeCode) : undefined
  const allowedExtensions = useMemo(
    () => (selectedType ? parseAllowedFileTypes(selectedType.attributes.fileTypes) : []),
    [selectedType],
  )
  const acceptAttr = useMemo(() => buildAcceptAttribute(allowedExtensions), [allowedExtensions])
  const canUpload = Boolean(selectedType) && !disabled && !isReading

  const typeSelectOptions = useMemo(
    () => documentTypeOptions.map((o) => ({
      value: o.value,
      label: o.label,
      searchText: o.label.toLowerCase(),
    })),
    [documentTypeOptions],
  )

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (!selectedType) {
      setUploadError('Select a document type before uploading.')
      return
    }

    setUploadError(null)
    setIsReading(true)
    const next = [...attachments]
    const errors: string[] = []

    try {
      for (const file of Array.from(files)) {
        const validationError = validateCrmUploadFile(file, selectedType)
        if (validationError) {
          errors.push(validationError)
          continue
        }

        let previewUrl: string | null = null
        if (isPreviewableImage(file.type) || isPreviewablePdf(file.type, file.name)) {
          try {
            previewUrl = await readFileAsDataUrl(file)
          } catch {
            previewUrl = null
          }
        }

        next.push({
          id: genAttachmentId(),
          documentTypeCode: selectedType.code,
          documentTypeName: selectedType.name,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          previewUrl,
          uploadedAt: new Date().toISOString(),
        })
      }

      if (errors.length) setUploadError(errors[0])
      if (next.length > attachments.length) onChange(next)
    } finally {
      setIsReading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [attachments, onChange, selectedType])

  function handlePickFiles() {
    if (!canUpload) {
      setUploadError('Select a document type before uploading.')
      return
    }
    fileInputRef.current?.click()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!canUpload) return
    void processFiles(e.dataTransfer.files)
  }

  function removeAttachment(id: string) {
    onChange(attachments.filter((a) => a.id !== id))
  }

  return (
    <div className={cn('crm-typed-doc-upload col-span-2', className)}>
      <div className="crm-typed-doc-upload__type-row">
        <label className="crm-typed-doc-upload__label">
          Attachment type <span className="text-red-600">*</span>
        </label>
        <ErpSmartSelect
          options={typeSelectOptions}
          value={selectedTypeCode}
          onChange={(v) => {
            setSelectedTypeCode(v ?? '')
            setUploadError(null)
          }}
          placeholder="Choose from Document Type / Attachment Master…"
          appearance="dropdown"
          disabled={disabled}
          allowEmpty
        />
        {selectedType ? (
          <p className="crm-typed-doc-upload__hint">{documentTypeUploadHint(selectedType)}</p>
        ) : (
          <p className="crm-typed-doc-upload__hint crm-typed-doc-upload__hint--muted">
            Select an attachment type to enable upload. Types are managed in CRM Document Type / Attachment Master.
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptAttr || undefined}
        multiple
        disabled={!canUpload}
        onChange={(e) => void processFiles(e.target.files ?? [])}
      />

      <div
        className={cn(
          'crm-typed-doc-upload__dropzone',
          canUpload && 'crm-typed-doc-upload__dropzone--ready',
          !canUpload && 'crm-typed-doc-upload__dropzone--disabled',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          if (canUpload) e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={handleDrop}
        onClick={handlePickFiles}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handlePickFiles()
          }
        }}
        role="button"
        tabIndex={canUpload ? 0 : -1}
        aria-disabled={!canUpload}
      >
        <Upload className="crm-typed-doc-upload__dropzone-icon" aria-hidden />
        <span className="crm-typed-doc-upload__dropzone-title">
          {isReading ? 'Reading file…' : canUpload ? 'Drag and drop or click to upload' : 'Select document type first'}
        </span>
        <span className="crm-typed-doc-upload__dropzone-hint">
          {selectedType
            ? documentTypeUploadHint(selectedType)
            : 'Document type master controls allowed formats and size'}
        </span>
      </div>

      {uploadError ? (
        <p className="crm-typed-doc-upload__error" role="alert">{uploadError}</p>
      ) : null}

      {attachments.length > 0 ? (
        <div className="crm-typed-doc-upload__gallery">
          <div className="crm-typed-doc-upload__gallery-head">
            <Paperclip className="h-4 w-4" aria-hidden />
            <span>{attachments.length} file{attachments.length === 1 ? '' : 's'} attached</span>
          </div>
          <ul className="crm-typed-doc-upload__list">
            {attachments.map((att) => (
              <li key={att.id} className="crm-typed-doc-upload__item">
                <CrmAttachmentPreview attachment={att} />
                <div className="crm-typed-doc-upload__meta">
                  <p className="crm-typed-doc-upload__filename">{att.fileName}</p>
                  <p className="crm-typed-doc-upload__filemeta">
                    {att.documentTypeName}
                    {' · '}
                    {formatFileSize(att.sizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  className="crm-typed-doc-upload__remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAttachment(att.id)
                  }}
                  disabled={disabled}
                  aria-label={`Remove ${att.fileName}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function CrmAttachmentPreview({ attachment }: { attachment: CrmTypedAttachment }) {
  const { previewUrl, mimeType, fileName } = attachment

  if (previewUrl && isPreviewableImage(mimeType)) {
    return (
      <div className="crm-typed-doc-upload__preview crm-typed-doc-upload__preview--image">
        <img src={previewUrl} alt={fileName} />
      </div>
    )
  }

  if (previewUrl && isPreviewablePdf(mimeType, fileName)) {
    return (
      <div className="crm-typed-doc-upload__preview crm-typed-doc-upload__preview--pdf">
        <iframe src={previewUrl} title={`Preview of ${fileName}`} />
      </div>
    )
  }

  return (
    <div className="crm-typed-doc-upload__preview crm-typed-doc-upload__preview--file">
      {isPreviewableImage(mimeType) ? (
        <ImageIcon className="h-6 w-6" aria-hidden />
      ) : (
        <FileText className="h-6 w-6" aria-hidden />
      )}
    </div>
  )
}
