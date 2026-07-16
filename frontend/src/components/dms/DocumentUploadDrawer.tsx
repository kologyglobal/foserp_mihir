import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '../ui/Button'
import { Select } from '../forms/Inputs'
import {
  DMS_DOCUMENT_TYPE_LABELS,
  DMS_ENTITY_LABELS,
  type DmsDocumentType,
  type DmsEntityType,
} from '../../types/dms'
import { useDmsStore } from '../../store/dmsStore'
import { readFileAsDataUrl } from '../../utils/fileStorage'

const UPLOAD_TYPES = Object.entries(DMS_DOCUMENT_TYPE_LABELS).filter(([k]) =>
  !['customer_drawing', 'vendor_drawing', 'certificate', 'test_report', 'photo'].includes(k),
) as [DmsDocumentType, string][]

type Props = {
  open: boolean
  onClose: () => void
  defaultEntityType?: DmsEntityType
  defaultEntityId?: string
  defaultEntityLabel?: string
  defaultCategory?: DmsDocumentType
  onUploaded?: (documentId: string) => void
}

export function DocumentUploadDrawer({
  open,
  onClose,
  defaultEntityType,
  defaultEntityId,
  defaultEntityLabel,
  defaultCategory = 'engineering_drawing',
  onUploaded,
}: Props) {
  const uploadDocument = useDmsStore((s) => s.uploadDocument)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DmsDocumentType>(defaultCategory)
  const [revision, setRevision] = useState('')
  const [remarks, setRemarks] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Select a file to upload')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const content = await readFileAsDataUrl(file)
      const r = uploadDocument({
        title: title || file.name,
        fileName: file.name,
        category,
        mimeType: file.type,
        fileContent: content,
        revision: revision || undefined,
        remarks: remarks || undefined,
        entityLinks:
          defaultEntityType && defaultEntityId
            ? [{ entityType: defaultEntityType, entityId: defaultEntityId, entityLabel: defaultEntityLabel }]
            : [],
      })
      if (!r.ok) {
        setError(r.error ?? 'Upload failed')
        return
      }
      onUploaded?.(r.documentId!)
      onClose()
      setTitle('')
      setFile(null)
      setRevision('')
      setRemarks('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-erp-border bg-erp-surface shadow-erp-md">
        <div className="border-b border-erp-border px-5 py-4">
          <h2 className="text-base font-semibold">Upload Document</h2>
          {defaultEntityType && defaultEntityId && (
            <p className="mt-1 text-xs text-erp-muted">
              Linked to {DMS_ENTITY_LABELS[defaultEntityType]} · {defaultEntityLabel ?? defaultEntityId}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-5">
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-erp-muted">Document name</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-erp-border px-3 py-2"
                placeholder="Drawing title"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-erp-muted">Document type</span>
              <Select value={category} onChange={(e) => setCategory(e.target.value as DmsDocumentType)}>
                {UPLOAD_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-erp-muted">Revision</span>
              <input
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                className="w-full rounded border border-erp-border px-3 py-2"
                placeholder="Rev-A"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-erp-muted">File</span>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-erp-muted">Remarks</span>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded border border-erp-border px-3 py-2"
                rows={2}
              />
            </label>
            {error && <p className="text-sm text-erp-danger">{error}</p>}
          </div>
          <div className="mt-auto flex gap-2 pt-6">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <Upload className="mr-2 h-4 w-4" />
              {busy ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
      </aside>
    </>
  )
}
