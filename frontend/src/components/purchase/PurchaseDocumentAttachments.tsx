import { useCallback, useRef, useState, type DragEvent } from 'react'
import { Paperclip, Plus, Trash2, Upload } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PurchaseTableToolbar } from '@/components/purchase/purchaseCardFormShared'
import { formatDate } from '@/utils/dates/format'
import { fileExtension, formatFileSize } from '@/utils/crmDocumentUploadUtils'
import { cn } from '@/utils/cn'

export type PurchaseDocumentAttachmentRow = {
  id: string
  fileName: string
  type: string
  uploadedBy: string
  uploadedAt: string
  sizeBytes: number | null
}

export type PurchaseDocumentAttachmentsProps = {
  files: PurchaseDocumentAttachmentRow[]
  onChange: (files: PurchaseDocumentAttachmentRow[]) => void
  disabled?: boolean
  /** Supporting copy under the drop-zone title */
  hint?: string
  /** Demo actor name used when stubbing uploads */
  uploadedBy?: string
  className?: string
}

function inferType(fileName: string, mimeType?: string): string {
  const ext = fileExtension(fileName)
  if (ext === 'pdf') return 'PDF'
  if (ext === 'dwg' || ext === 'dxf') return 'Drawing'
  if (ext === 'doc' || ext === 'docx') return 'Document'
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'Spreadsheet'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'Image'
  if (mimeType?.startsWith('image/')) return 'Image'
  return 'Other'
}

/** Map persisted attachment id strings into display rows (demo seed / legacy refs). */
export function purchaseAttachmentRowsFromIds(
  ids: string[],
  opts?: { uploadedBy?: string },
): PurchaseDocumentAttachmentRow[] {
  return ids.map((id) => ({
    id,
    fileName: id,
    type: 'Other',
    uploadedBy: opts?.uploadedBy ?? '—',
    uploadedAt: '',
    sizeBytes: null,
  }))
}

export function purchaseAttachmentIdsFromRows(rows: PurchaseDocumentAttachmentRow[]): string[] {
  return rows.map((r) => r.id)
}

function stubRowsFromFiles(
  fileList: FileList | File[],
  uploadedBy: string,
): PurchaseDocumentAttachmentRow[] {
  const files = Array.from(fileList)
  const now = new Date().toISOString()
  return files.map((file) => ({
    id: `att-${crypto.randomUUID().slice(0, 10)}`,
    fileName: file.name,
    type: inferType(file.name, file.type),
    uploadedBy,
    uploadedAt: now,
    sizeBytes: file.size,
  }))
}

function formatUploadedDate(iso: string): string {
  if (!iso) return '—'
  const day = iso.slice(0, 10)
  return formatDate(day) || '—'
}

/**
 * Compact purchase-document attachments panel (demo stub upload).
 * Empty: horizontal drop zone ~≤120px total. With files: dense metadata table.
 */
export function PurchaseDocumentAttachments({
  files,
  onChange,
  disabled = false,
  hint = 'Specifications, drawings, quotations, and supporting documents',
  uploadedBy = 'Demo User',
  className,
}: PurchaseDocumentAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (disabled || !list || list.length === 0) return
      onChange([...files, ...stubRowsFromFiles(list, uploadedBy)])
    },
    [disabled, files, onChange, uploadedBy],
  )

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (disabled) return
    setDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const removeAt = (id: string) => {
    if (disabled) return
    onChange(files.filter((f) => f.id !== id))
  }

  const countLabel = `${files.length} file${files.length === 1 ? '' : 's'}`
  const showDropzone = !disabled && files.length === 0
  const showAdd = !disabled

  return (
    <div className={cn('purchase-doc-attachments space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {showDropzone ? (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'flex w-full items-center gap-3 rounded-md border border-dashed px-3 py-2.5 text-left transition-colors',
            dragging
              ? 'border-erp-primary bg-erp-primary-soft'
              : 'border-erp-border bg-erp-surface-alt/60 hover:border-erp-primary hover:bg-erp-primary-soft/50',
          )}
        >
          <Upload className="h-4 w-4 shrink-0 text-erp-muted" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-erp-text">
              Drop files here or browse
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-erp-muted">{hint}</span>
          </span>
        </button>
      ) : null}

      {disabled && files.length === 0 ? (
        <p className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 px-3 py-2.5 text-[12px] text-erp-muted">
          No attachments linked
        </p>
      ) : null}

      <PurchaseTableToolbar>
        {showAdd ? (
          <ErpButton
            type="button"
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={openPicker}
          >
            Add Attachment
          </ErpButton>
        ) : (
          <span className="text-[12px] font-medium text-erp-text">Attachments</span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-erp-muted">
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          {countLabel}
        </span>
      </PurchaseTableToolbar>

      {files.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-erp-border">
          <table className="w-full min-w-[36rem] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-erp-surface-alt text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                <th className="px-2.5 py-1.5 font-semibold">File Name</th>
                <th className="px-2.5 py-1.5 font-semibold">Type</th>
                <th className="px-2.5 py-1.5 font-semibold">Uploaded By</th>
                <th className="px-2.5 py-1.5 font-semibold">Uploaded Date</th>
                <th className="px-2.5 py-1.5 font-semibold">Size</th>
                {!disabled ? (
                  <th className="px-2.5 py-1.5 font-semibold text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-erp-border last:border-b-0">
                  <td className="max-w-[14rem] truncate px-2.5 py-1.5 font-medium text-erp-text" title={file.fileName}>
                    {file.fileName}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-erp-muted">{file.type}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-erp-muted">{file.uploadedBy || '—'}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums text-erp-muted">
                    {formatUploadedDate(file.uploadedAt)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums text-erp-muted">
                    {file.sizeBytes != null ? formatFileSize(file.sizeBytes) : '—'}
                  </td>
                  {!disabled ? (
                    <td className="px-2.5 py-1.5 text-right">
                      <button
                        type="button"
                        className="inline-flex rounded p-1 text-erp-danger-fg hover:bg-red-50"
                        title="Remove attachment"
                        onClick={() => removeAt(file.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
