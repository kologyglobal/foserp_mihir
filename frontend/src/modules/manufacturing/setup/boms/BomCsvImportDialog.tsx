import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { isApiMode } from '@/config/apiConfig'
import {
  confirmBomCsvImport,
  downloadBomImportTemplate,
  previewBomCsvImport,
  type BomImportPreview,
  type BomImportResult,
} from '@/services/api/manufacturingApi'
import { formatApiError } from '@/services/api/apiErrors'
import { parseBomImportCsv } from '@/utils/bomImport'

interface BomCsvImportDialogProps {
  open: boolean
  restrictBomCode?: string
  onClose: () => void
  onImported: (result: BomImportResult) => void
}

export function BomCsvImportDialog({
  open,
  restrictBomCode,
  onClose,
  onImported,
}: BomCsvImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<BomImportPreview | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)

  if (!open) return null

  const reset = () => {
    setFileName('')
    setRows([])
    setPreview(null)
    setErrors([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    if (importing) return
    reset()
    onClose()
  }

  const downloadTemplate = async () => {
    if (!isApiMode()) {
      setErrors(['BOM CSV import is available in live API mode.'])
      return
    }
    try {
      await downloadBomImportTemplate()
    } catch (error) {
      setErrors([formatApiError(error)])
    }
  }

  const selectFile = async (file: File) => {
    setFileName(file.name)
    setRows([])
    setPreview(null)
    setErrors([])
    const text = await file.text()
    const parsed = parseBomImportCsv(text)
    if (parsed.errors.length) {
      setErrors(parsed.errors.slice(0, 20))
      return
    }
    setRows(parsed.rows)
    if (!isApiMode()) {
      setErrors(['BOM CSV import is available in live API mode.'])
      return
    }
    setPreviewing(true)
    try {
      const response = await previewBomCsvImport(parsed.rows, restrictBomCode)
      setPreview(response.data)
    } catch (error) {
      setErrors([formatApiError(error)])
    } finally {
      setPreviewing(false)
    }
  }

  const confirm = async () => {
    if (!preview?.ready || rows.length === 0 || importing) return
    setImporting(true)
    setErrors([])
    try {
      const response = await confirmBomCsvImport(rows, crypto.randomUUID(), restrictBomCode)
      onImported(response.data)
      reset()
    } catch (error) {
      setErrors([formatApiError(error)])
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bom-import-title">
      <div className="erp-modal-panel max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="bom-import-title" className="text-[16px] font-semibold text-erp-text">
              {restrictBomCode ? `Import New Revision — ${restrictBomCode}` : 'Import Product BOMs'}
            </h2>
            <p className="mt-1 text-[13px] text-erp-muted">
              Upload one combined CSV. The server resolves tenant item/UOM codes, validates the full tree, and creates Draft versions only.
            </p>
          </div>
          <button type="button" onClick={close} className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <section className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">1. Download template</p>
            <p className="mt-1 text-[12px] text-erp-muted">No internal UUIDs are used. Keep one consistent output header per BOM code.</p>
            <ErpButton type="button" size="sm" variant="secondary" className="mt-3" onClick={() => void downloadTemplate()}>
              <Download className="mr-1.5 h-4 w-4" />
              Download Template
            </ErpButton>
          </section>
          <section className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">2. Upload combined CSV</p>
            <p className="mt-1 text-[12px] text-erp-muted">Use line_ref and parent_line_ref for hierarchy. The server derives levels and detects cycles.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ErpButton type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" />
                Choose CSV
              </ErpButton>
              {fileName ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-erp-muted">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {fileName}
                </span>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void selectFile(file)
                }}
              />
            </div>
          </section>
        </div>

        {previewing ? (
          <p className="mt-4 rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[13px] text-erp-muted">
            Resolving tenant codes and validating BOM structures…
          </p>
        ) : null}

        {errors.length ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            <p className="font-semibold">Import cannot continue</p>
            <ul className="ml-4 mt-1 list-disc">
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        ) : null}

        {preview ? (
          <div className="mt-4 space-y-3">
            <div className={`rounded-md border px-3 py-2 text-[12px] ${
              preview.ready
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}>
              <strong>{preview.bomCount}</strong> BOM(s), <strong>{preview.lineCount}</strong> lines · {preview.errorCount} errors · {preview.warningCount} warnings.
              {preview.ready ? ' Ready to create Draft revisions.' : ' Correct the CSV and upload it again.'}
            </div>

            <div className="max-h-[360px] overflow-auto rounded-md border border-erp-border">
              {preview.groups.map((group) => (
                <section key={group.bomCode} className="border-b border-erp-border last:border-b-0">
                  <div className="sticky top-0 flex flex-wrap items-center justify-between gap-2 bg-erp-surface-alt px-3 py-2 text-[12px]">
                    <span>
                      <strong>{group.bomCode}</strong> — {group.bomName} · {group.outputItemCode}
                    </span>
                    <span className="font-medium text-erp-primary">
                      {group.action === 'CREATE_BOM' ? 'New BOM' : 'New revision'} · v{group.nextVersionNumber}
                    </span>
                  </div>
                  {group.errors.length ? (
                    <ul className="ml-7 list-disc px-3 py-2 text-[11px] text-red-700">
                      {group.errors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  ) : null}
                  <table className="erp-table w-full text-[11px]">
                    <thead>
                      <tr>
                        <th>CSV row</th>
                        <th>Ref / Parent</th>
                        <th>Component</th>
                        <th>Qty / UOM</th>
                        <th>Level</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={`${group.bomCode}-${row.row}`}>
                          <td>{row.row}</td>
                          <td>{row.lineRef}{row.parentLineRef ? ` / ${row.parentLineRef}` : ''}</td>
                          <td>{row.itemCode}{row.itemName ? ` — ${row.itemName}` : ''}</td>
                          <td>{row.quantity} {row.uomCode}</td>
                          <td>{row.level}</td>
                          <td className={row.errors.length ? 'text-red-700' : row.warnings.length ? 'text-amber-700' : 'text-emerald-700'}>
                            {row.errors[0] ?? row.warnings[0] ?? 'Ready'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          </div>
        ) : null}

        {!isApiMode() ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            BOM CSV import is available in live API mode.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2 border-t border-erp-border pt-4">
          <ErpButton type="button" variant="ghost" onClick={close} disabled={importing}>Cancel</ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            loading={importing}
            disabled={!preview?.ready || importing || !isApiMode()}
            onClick={() => void confirm()}
          >
            Confirm Import
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
