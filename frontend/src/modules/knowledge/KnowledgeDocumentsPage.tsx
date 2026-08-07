import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Upload } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import {
  createKnowledgeDocumentMarkdown,
  fetchKnowledgeDocuments,
  reindexKnowledgeDocument,
  uploadKnowledgeDocumentFile,
  type KnowledgeDocumentRow,
} from '@/services/api/knowledgeApi'
import { canKbPermission } from '@/utils/permissions/knowledge'
import { PageBackLink } from '@/components/ui/PageBackLink'

const SAMPLE_MD = `# ERP knowledge starter

## Sales order flow
1. Qualify the lead and convert to company/opportunity when required.
2. Create a quotation, send for approval, then convert to a sales order.
3. Confirm the sales order before fulfilment.

## Copilot tips
- Copilot answers from **indexed** documents only.
- Reindex after content changes if status is not READY.

## Support
Upload policy PDFs, SOPs, and product specs so chat/copilot can cite them.
`

export function KnowledgeDocumentsPage() {
  const [rows, setRows] = useState<KnowledgeDocumentRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const canView = canKbPermission('kb.document.view')
  const canCreate = canKbPermission('kb.document.create')
  const canReindex = canKbPermission('kb.document.reindex')

  const load = useCallback(async () => {
    if (!isApiMode() || !canView) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchKnowledgeDocuments({ limit: 50 })
      setRows(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => {
    if (!isApiMode()) {
      setError('Document register requires API mode.')
      setLoading(false)
      return
    }
    if (!canView) {
      setError('Permission kb.document.view required.')
      setLoading(false)
      return
    }
    void load()
  }, [canView, load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canCreate || saving) return
    setError(null)
    setNotice(null)
    setSaving(true)
    try {
      if (file) {
        const res = await uploadKnowledgeDocumentFile({
          file,
          title: title.trim() || file.name,
          publish: true,
        })
        const st = res.data?.status ?? 'created'
        const chunks = res.data?.index?.chunkCount
        setNotice(
          `Uploaded “${res.data?.title ?? file.name}” (${st}${chunks != null ? `, ${chunks} chunks` : ''}).`,
        )
      } else {
        const t = title.trim()
        const body = markdown.trim()
        if (!t || !body) {
          setError('Enter a title and markdown content, or choose a file.')
          return
        }
        const res = await createKnowledgeDocumentMarkdown({
          title: t,
          markdownContent: body,
          publish: true,
        })
        const st = res.data?.status ?? 'created'
        const chunks = res.data?.index?.chunkCount
        setNotice(
          `Created “${res.data?.title ?? t}” (${st}${chunks != null ? `, ${chunks} chunks` : ''}).`,
        )
        setMarkdown('')
        setTitle('')
      }
      setFile(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleReindex(id: string) {
    if (!canReindex) return
    setError(null)
    try {
      const res = await reindexKnowledgeDocument(id)
      setNotice(
        `Reindexed “${res.data?.title ?? id}” (${res.data?.status ?? 'ok'}${
          res.data?.index?.chunkCount != null ? `, ${res.data.index.chunkCount} chunks` : ''
        }).`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function useSample() {
    setTitle('ERP knowledge starter')
    setMarkdown(SAMPLE_MD)
    setFile(null)
  }

  return (
    <div className="erp-page erp-page--enterprise mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <PageBackLink to="/knowledge" label="Knowledge" />
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-erp-text">Knowledge documents</h1>
          <p className="mt-1 text-sm text-erp-muted">
            Indexed corpus for Knowledge chat and global Copilot.
          </p>
        </div>
        <Link to="/knowledge" className="text-sm font-medium text-sky-800 hover:underline">
          Open chat
        </Link>
      </header>

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      {canCreate && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-3 rounded-lg border border-erp-border bg-white p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-erp-text">Add document</h2>
            <button
              type="button"
              className="text-xs font-medium text-sky-800 hover:underline"
              onClick={useSample}
            >
              Insert sample SOP
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-erp-muted" htmlFor="kb-doc-title">
              Title
            </label>
            <input
              id="kb-doc-title"
              className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sales order SOP"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-erp-muted" htmlFor="kb-doc-md">
              Markdown / text content
            </label>
            <textarea
              id="kb-doc-md"
              className="mt-1 min-h-[140px] w-full rounded-md border border-erp-border px-3 py-2 font-mono text-sm"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Paste policy text, SOPs, product notes…"
              disabled={saving || Boolean(file)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-erp-muted" htmlFor="kb-doc-file">
              Or upload a file (PDF, DOCX, XLSX, CSV, text)
            </label>
            <input
              id="kb-doc-file"
              type="file"
              className="mt-1 block w-full text-sm"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
              }}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-800 px-3 py-2 text-sm font-medium text-white hover:bg-sky-900 disabled:opacity-50"
            disabled={saving || (!file && (!title.trim() || !markdown.trim()))}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {file ? 'Upload & index' : 'Create & index'}
          </button>
        </form>
      )}

      {!canCreate && canView && (
        <p className="text-sm text-erp-muted">
          You can view documents but need <code className="text-xs">kb.document.create</code> to
          upload.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-erp-border bg-slate-50 text-xs uppercase text-erp-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-erp-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-erp-muted">
                  No documents yet. Use the form above to add Markdown or upload a file.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-erp-border">
                <td className="px-3 py-2 font-medium text-erp-text">{r.title}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.kind}</td>
                <td className="px-3 py-2 text-erp-muted">
                  {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}
                </td>
                <td className="px-3 py-2">
                  {canReindex && (
                    <button
                      type="button"
                      className="text-xs font-medium text-sky-800 hover:underline"
                      onClick={() => void handleReindex(r.id)}
                    >
                      Reindex
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
