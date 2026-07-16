import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { ErpButton } from '../erp/ErpButton'
import { isApiMode } from '../../config/apiConfig'
import {
  downloadMasterImportTemplate,
  importMasterCsv,
} from '../../services/api/masterBatchApi'
import { syncBatchMastersFromApi } from '../../services/bridges/masterBatchApiBridge'
import { formatApiError } from '../../services/api/apiErrors'

type MasterImportResource = 'items' | 'vendors' | 'hsn-sac'

const RESOURCE_LABELS: Record<MasterImportResource, string> = {
  items: 'Items',
  vendors: 'Vendors',
  'hsn-sac': 'HSN/SAC',
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
}

interface MasterBatchImportDialogProps {
  open: boolean
  onClose: () => void
  resource: MasterImportResource
  onImported?: () => void
}

export function MasterBatchImportDialog({
  open,
  onClose,
  resource,
  onImported,
}: MasterBatchImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [duplicateMode, setDuplicateMode] = useState<'reject' | 'skip' | 'update'>('skip')
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function reset() {
    setFileName('')
    setRowCount(0)
    setRows([])
    setMessage(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleDownloadTemplate() {
    if (!isApiMode()) {
      setError('Import is available in API mode only.')
      return
    }
    try {
      await downloadMasterImportTemplate(resource)
    } catch (err) {
      setError(formatApiError(err))
    }
  }

  function handleFile(file: File) {
    setError(null)
    setMessage(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsvRows(String(reader.result ?? ''))
      setRows(parsed)
      setRowCount(parsed.length)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!isApiMode()) {
      setError('Import is available in API mode only.')
      return
    }
    if (rows.length === 0) {
      setError('Upload a CSV file with at least one data row.')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const res = await importMasterCsv(resource, { rows, duplicateMode })
      const summary = res.data
      await syncBatchMastersFromApi()
      onImported?.()
      setMessage(
        `Imported ${summary.imported}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}.`,
      )
      if (summary.failed === 0) {
        setRows([])
        setRowCount(0)
      }
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-erp-border px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">Import {RESOURCE_LABELS[resource]}</h3>
            <p className="text-xs text-slate-500">Upload CSV using the master import template</p>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <ErpButton type="button" variant="secondary" size="sm" onClick={() => void handleDownloadTemplate()}>
              <Download className="mr-1.5 h-4 w-4" />
              Download template
            </ErpButton>
            <ErpButton type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />
              Choose CSV
            </ErpButton>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>

          {fileName ? (
            <p className="flex items-center gap-2 text-sm text-erp-text">
              <FileSpreadsheet className="h-4 w-4 text-erp-muted" />
              {fileName} · {rowCount} row{rowCount === 1 ? '' : 's'}
            </p>
          ) : null}

          <label className="block text-sm">
            <span className="font-medium text-erp-text">Duplicate handling</span>
            <select
              className="erp-input mt-1 w-full"
              value={duplicateMode}
              onChange={(e) => setDuplicateMode(e.target.value as typeof duplicateMode)}
            >
              <option value="skip">Skip existing</option>
              <option value="update">Update existing</option>
              <option value="reject">Reject duplicates</option>
            </select>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}

          {!isApiMode() ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Demo mode uses seeded data. Switch to API mode to import into the tenant database.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-erp-border px-5 py-4">
          <ErpButton type="button" variant="ghost" onClick={handleClose} disabled={importing}>
            Cancel
          </ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            disabled={importing || rows.length === 0 || !isApiMode()}
            onClick={() => void handleImport()}
          >
            {importing ? 'Importing…' : `Import ${rowCount} row${rowCount === 1 ? '' : 's'}`}
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
