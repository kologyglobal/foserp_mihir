import { useCallback, useMemo, useRef, useState } from 'react'
import { Download, FileText, ImageIcon, Paperclip, RefreshCw, Trash2, Upload } from 'lucide-react'
import {
  buildAcceptAttribute,
  formatFileSize,
  isPreviewableImage,
  isPreviewablePdf,
  readFileAsDataUrl,
  validateErpUploadFile,
} from '../../utils/crmDocumentUploadUtils'
import { cn } from '../../utils/cn'

function genFileId() {
  return `doc-${crypto.randomUUID().slice(0, 8)}`
}

export type ErpDocumentUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'error'

/** Selected / staged document metadata for ErpDocumentUpload. */
export type ErpDocumentFileMeta = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  previewUrl?: string | null
  /** Original File when chosen from disk (API upload / SO confirm). */
  file?: File
  category?: string
  documentTypeCode?: string
  documentTypeName?: string
  uploadedAt?: string
  uploadStatus?: ErpDocumentUploadStatus
  /** 0–100 while uploading. */
  uploadProgress?: number
  uploadError?: string | null
  /** Remote / blob URL for download when already persisted. */
  downloadUrl?: string | null
}

export type DocumentUploadHandler = (args: {
  file: File
  meta: ErpDocumentFileMeta
  onProgress: (pct: number) => void
}) => Promise<Partial<ErpDocumentFileMeta> | void>

/**
 * Required shape for reusable CRM / Sales document upload.
 * Prefer `ErpDocumentUploadProps` at call sites; this alias matches the task contract.
 */
export type DocumentUploadProps = {
  category: string
  acceptedMimeTypes: string[]
  acceptedExtensions: string[]
  maxFileSizeMb: number
  maxFiles: number
  allowPreview: boolean
  allowRemove: boolean
  /** Controlled file list (preferred). */
  files?: ErpDocumentFileMeta[]
  /** Alias for `files`. */
  value?: ErpDocumentFileMeta[]
  onChange?: (files: ErpDocumentFileMeta[]) => void
  disabled?: boolean
  /** External / form-level error (shown with internal validation errors). */
  error?: string | null
  /** Optional CRM Document Type master code stamped onto new files. */
  documentTypeCode?: string
  documentTypeName?: string
  className?: string
  hint?: string
  dropzoneTitle?: string
  /** Hide dropzone when at capacity and files already listed. */
  hideDropzoneWhenFull?: boolean
  /**
   * When set, validated files are uploaded immediately (API / bridge).
   * Progress + retry are managed by this component.
   */
  onUpload?: DocumentUploadHandler
  /** Download action (blob URL, data URL, or API download). */
  onDownload?: (file: ErpDocumentFileMeta) => void | Promise<void>
  allowDownload?: boolean
  /** Show retry for failed uploads (requires `onUpload`). Default true when `onUpload` set. */
  allowRetry?: boolean
}

export type ErpDocumentUploadProps = DocumentUploadProps

function resolveFiles(props: Pick<DocumentUploadProps, 'files' | 'value'>): ErpDocumentFileMeta[] {
  return props.files ?? props.value ?? []
}

function triggerBrowserDownload(file: ErpDocumentFileMeta) {
  const href = file.downloadUrl || file.previewUrl
  if (!href) return
  const a = document.createElement('a')
  a.href = href
  a.download = file.fileName
  a.rel = 'noopener'
  a.click()
}

export function ErpDocumentUpload({
  category,
  acceptedMimeTypes,
  acceptedExtensions,
  maxFileSizeMb,
  maxFiles,
  allowPreview,
  allowRemove,
  files: filesProp,
  value,
  onChange,
  disabled = false,
  error: externalError = null,
  documentTypeCode,
  documentTypeName,
  className,
  hint,
  dropzoneTitle,
  hideDropzoneWhenFull = false,
  onUpload,
  onDownload,
  allowDownload = true,
  allowRetry,
}: ErpDocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)

  const currentFiles = resolveFiles({ files: filesProp, value })
  const retryEnabled = allowRetry ?? Boolean(onUpload)
  const acceptAttr = useMemo(
    () => buildAcceptAttribute(acceptedExtensions.map((e) => e.replace(/^\./, '').toLowerCase())),
    [acceptedExtensions],
  )
  const atCapacity = currentFiles.length >= maxFiles
  const busyUploading = currentFiles.some((f) => f.uploadStatus === 'uploading')
  const canUpload = !disabled && !isReading && !busyUploading && !atCapacity
  const showDropzone = !(hideDropzoneWhenFull && atCapacity && currentFiles.length > 0)

  const extensionsHint = useMemo(() => {
    if (hint) return hint
    const types =
      acceptedExtensions.length > 0
        ? acceptedExtensions.map((e) => `.${e.replace(/^\./, '')}`).join(', ')
        : 'Any file type'
    return `${types} · up to ${maxFileSizeMb} MB · max ${maxFiles} file${maxFiles === 1 ? '' : 's'}`
  }, [acceptedExtensions, hint, maxFileSizeMb, maxFiles])

  const emitChange = useCallback(
    (next: ErpDocumentFileMeta[]) => {
      onChange?.(next)
    },
    [onChange],
  )

  const patchFile = useCallback(
    (id: string, patch: Partial<ErpDocumentFileMeta>, base?: ErpDocumentFileMeta[]) => {
      const list = base ?? resolveFiles({ files: filesProp, value })
      const next = list.map((f) => (f.id === id ? { ...f, ...patch } : f))
      emitChange(next)
      return next
    },
    [emitChange, filesProp, value],
  )

  const runUpload = useCallback(
    async (
      meta: ErpDocumentFileMeta,
      file: File,
      baseList: ErpDocumentFileMeta[],
    ): Promise<ErpDocumentFileMeta[]> => {
      if (!onUpload) return baseList
      let working = patchFile(
        meta.id,
        { uploadStatus: 'uploading', uploadProgress: 5, uploadError: null },
        baseList,
      )
      try {
        const result = await onUpload({
          file,
          meta: { ...meta, uploadStatus: 'uploading', uploadProgress: 5 },
          onProgress: (pct) => {
            working = patchFile(
              meta.id,
              {
                uploadProgress: Math.max(0, Math.min(100, Math.round(pct))),
                uploadStatus: 'uploading',
              },
              working,
            )
          },
        })
        working = patchFile(
          meta.id,
          {
            uploadStatus: 'uploaded',
            uploadProgress: 100,
            uploadError: null,
            ...(result ?? {}),
            // Keep File for retry only on failure; clear after success.
            file: undefined,
          },
          working,
        )
        return working
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        working = patchFile(
          meta.id,
          { uploadStatus: 'error', uploadProgress: 0, uploadError: message },
          working,
        )
        setInternalError(message)
        return working
      }
    },
    [onUpload, patchFile],
  )

  const processFiles = useCallback(
    async (incoming: FileList | File[]) => {
      if (disabled) return
      if (atCapacity) {
        setInternalError(`Maximum of ${maxFiles} file${maxFiles === 1 ? '' : 's'} allowed.`)
        return
      }

      setInternalError(null)
      setIsReading(true)
      let next = [...currentFiles]
      const errors: string[] = []
      const slotsLeft = Math.max(0, maxFiles - next.length)
      const toUpload: Array<{ meta: ErpDocumentFileMeta; file: File }> = []

      try {
        const list = Array.from(incoming).slice(0, slotsLeft + 1)
        for (const file of list) {
          if (next.length >= maxFiles) {
            errors.push(`Maximum of ${maxFiles} file${maxFiles === 1 ? '' : 's'} allowed.`)
            break
          }

          const validationError = validateErpUploadFile(file, {
            acceptedExtensions,
            acceptedMimeTypes,
            maxFileSizeMb,
            label: documentTypeName || category,
          })
          if (validationError) {
            errors.push(validationError)
            continue
          }

          let previewUrl: string | null = null
          if (
            allowPreview &&
            (isPreviewableImage(file.type) || isPreviewablePdf(file.type, file.name))
          ) {
            try {
              previewUrl = await readFileAsDataUrl(file)
            } catch {
              previewUrl = null
            }
          }

          const meta: ErpDocumentFileMeta = {
            id: genFileId(),
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            previewUrl,
            file,
            category,
            documentTypeCode,
            documentTypeName,
            uploadedAt: new Date().toISOString(),
            uploadStatus: onUpload ? 'pending' : 'uploaded',
            uploadProgress: onUpload ? 0 : 100,
            uploadError: null,
            downloadUrl: previewUrl,
          }
          next.push(meta)
          if (onUpload) toUpload.push({ meta, file })
        }

        if (errors.length) setInternalError(errors[0] ?? null)
        if (next.length > currentFiles.length) {
          emitChange(next)
          for (const item of toUpload) {
            next = await runUpload(item.meta, item.file, next)
          }
        }
      } finally {
        setIsReading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [
      acceptedExtensions,
      acceptedMimeTypes,
      allowPreview,
      atCapacity,
      category,
      currentFiles,
      disabled,
      documentTypeCode,
      documentTypeName,
      emitChange,
      maxFileSizeMb,
      maxFiles,
      onUpload,
      runUpload,
    ],
  )

  function handlePickFiles() {
    if (!canUpload) {
      if (atCapacity) setInternalError(`Maximum of ${maxFiles} file${maxFiles === 1 ? '' : 's'} allowed.`)
      return
    }
    fileInputRef.current?.click()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!canUpload) return
    void processFiles(e.dataTransfer.files)
  }

  function removeFile(id: string) {
    if (!allowRemove || disabled) return
    emitChange(currentFiles.filter((f) => f.id !== id))
    setInternalError(null)
  }

  async function handleDownload(att: ErpDocumentFileMeta) {
    if (!allowDownload) return
    if (onDownload) {
      await onDownload(att)
      return
    }
    if (att.file) {
      const url = URL.createObjectURL(att.file)
      const a = document.createElement('a')
      a.href = url
      a.download = att.fileName
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    triggerBrowserDownload(att)
  }

  function handleRetry(att: ErpDocumentFileMeta) {
    if (!retryEnabled || !onUpload || !att.file || disabled) return
    setInternalError(null)
    void runUpload(att, att.file, currentFiles)
  }

  const displayError = internalError || externalError

  return (
    <div className={cn('erp-document-upload', className)}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptAttr || undefined}
        multiple={maxFiles > 1}
        disabled={!canUpload}
        onChange={(e) => void processFiles(e.target.files ?? [])}
      />

      {showDropzone ? (
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
            {isReading || busyUploading
              ? busyUploading
                ? 'Uploading…'
                : 'Reading file…'
              : dropzoneTitle ??
                (atCapacity
                  ? `Maximum of ${maxFiles} file${maxFiles === 1 ? '' : 's'} reached`
                  : 'Drag and drop or click to upload')}
          </span>
          <span className="crm-typed-doc-upload__dropzone-hint">{extensionsHint}</span>
        </div>
      ) : null}

      {displayError ? (
        <p className="crm-typed-doc-upload__error" role="alert">
          {displayError}
        </p>
      ) : null}

      {currentFiles.length > 0 ? (
        <div className="crm-typed-doc-upload__gallery">
          <div className="crm-typed-doc-upload__gallery-head">
            <Paperclip className="h-4 w-4" aria-hidden />
            <span>
              {currentFiles.length} file{currentFiles.length === 1 ? '' : 's'} attached
            </span>
          </div>
          <ul className="crm-typed-doc-upload__list">
            {currentFiles.map((att) => (
              <li key={att.id} className="crm-typed-doc-upload__item">
                {allowPreview ? (
                  <ErpDocumentPreview file={att} />
                ) : (
                  <div className="crm-typed-doc-upload__preview crm-typed-doc-upload__preview--file">
                    <FileText className="h-6 w-6" aria-hidden />
                  </div>
                )}
                <div className="crm-typed-doc-upload__meta">
                  <p className="crm-typed-doc-upload__filename">{att.fileName}</p>
                  <p className="crm-typed-doc-upload__filemeta">
                    {[att.documentTypeName, formatFileSize(att.sizeBytes), statusLabel(att)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {att.uploadStatus === 'uploading' ? (
                    <div
                      className="crm-typed-doc-upload__progress"
                      role="progressbar"
                      aria-valuenow={att.uploadProgress ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="crm-typed-doc-upload__progress-bar"
                        style={{ width: `${att.uploadProgress ?? 0}%` }}
                      />
                    </div>
                  ) : null}
                  {att.uploadStatus === 'error' && att.uploadError ? (
                    <p className="crm-typed-doc-upload__item-error">{att.uploadError}</p>
                  ) : null}
                </div>
                <div className="crm-typed-doc-upload__actions">
                  {allowDownload &&
                  (att.downloadUrl || att.previewUrl || att.file || onDownload) &&
                  att.uploadStatus !== 'uploading' ? (
                    <button
                      type="button"
                      className="crm-typed-doc-upload__action"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDownload(att)
                      }}
                      disabled={disabled}
                      aria-label={`Download ${att.fileName}`}
                      title="Download"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                  {retryEnabled && att.uploadStatus === 'error' && att.file ? (
                    <button
                      type="button"
                      className="crm-typed-doc-upload__action"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRetry(att)
                      }}
                      disabled={disabled}
                      aria-label={`Retry upload of ${att.fileName}`}
                      title="Retry"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                  {allowRemove ? (
                    <button
                      type="button"
                      className="crm-typed-doc-upload__remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(att.id)
                      }}
                      disabled={disabled || att.uploadStatus === 'uploading'}
                      aria-label={`Remove ${att.fileName}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function statusLabel(att: ErpDocumentFileMeta): string | null {
  if (att.uploadStatus === 'uploading') return `Uploading ${att.uploadProgress ?? 0}%`
  if (att.uploadStatus === 'error') return 'Failed'
  if (att.uploadStatus === 'pending') return 'Pending'
  return null
}

function ErpDocumentPreview({ file }: { file: ErpDocumentFileMeta }) {
  const { previewUrl, mimeType, fileName } = file

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
