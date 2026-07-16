import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { useSalesStore } from '../../store/salesStore'
import {
  downloadLeadImportTemplate,
  getLeadImportFieldGuide,
  importLeadRows,
  LEAD_IMPORT_HEADERS,
  parseLeadImportCsv,
  type LeadImportPreviewRow,
} from '../../utils/leadImport'
import { formatCurrency } from '../../utils/formatters/currency'
import { cn } from '../../utils/cn'
import { isApiMode } from '../../config/apiConfig'
import { importLeadsApi } from '../../services/api/crmApi'
import { syncAllCrmFromApi } from '../../services/bridges/crmApiBridge'

interface LeadImportDialogProps {
  open: boolean
  onClose: () => void
  onImported?: (count: number) => void
}

export function LeadImportDialog({ open, onClose, onImported }: LeadImportDialogProps) {
  const createLead = useSalesStore((s) => s.createLead)
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<LeadImportPreviewRow[]>([])
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const fieldGuide = getLeadImportFieldGuide()

  if (!open) return null

  function reset() {
    setRows([])
    setHeaderError(null)
    setFileName('')
    setResultMessage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFile(file: File) {
    setResultMessage(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseLeadImportCsv(text)
      if (parsed.headerErrors.length > 0) {
        setHeaderError(parsed.headerErrors[0] ?? 'Invalid CSV')
        setRows([])
        return
      }
      setHeaderError(null)
      setRows(parsed.rows)
    }
    reader.readAsText(file)
  }

  function handleImport() {
    const validRows = rows.filter((r) => r.errors.length === 0)
    if (validRows.length === 0) return
    setImporting(true)
    if (isApiMode()) {
      void (async () => {
        try {
          const payloadRows = validRows.map((r) => ({
            'Prospect Name': r.input.prospectName,
            Source: r.input.source,
            Industry: r.input.industry,
            'Lead Owner': r.input.leadOwnerName,
            'Expected Value': String(r.input.expectedValue),
            Probability: String(r.input.probability),
            Priority: r.input.priority,
            Stage: r.input.stage,
            'Contact Person': r.input.contactPerson ?? '',
            Mobile: r.input.mobile ?? '',
            Email: r.input.email ?? '',
            'Product Requirement': r.input.productRequirement,
            Remarks: r.input.remarks,
            'Expected Close Date': r.input.expectedCloseDate ?? '',
            'Expected Qty': r.input.expectedQty != null ? String(r.input.expectedQty) : '',
            'Created Date': r.input.createdDate,
          }))
          const res = await importLeadsApi(payloadRows, 'skip')
          await syncAllCrmFromApi()
          setImporting(false)
          if (res.data.imported > 0) onImported?.(res.data.imported)
          setResultMessage(
            `Imported ${res.data.imported}, updated ${res.data.updated}, skipped ${res.data.skipped}, failed ${res.data.failed}.`,
          )
        } catch (err) {
          setImporting(false)
          setResultMessage(err instanceof Error ? err.message : 'Import failed')
        }
      })()
      return
    }
    const result = importLeadRows(
      (input) => createLead(input) as { ok: boolean; error?: string; leadId?: string },
      validRows,
    )
    setImporting(false)
    if (result.imported > 0) {
      onImported?.(result.imported)
    }
    if (result.failed === 0) {
      setResultMessage(`${result.imported} lead${result.imported === 1 ? '' : 's'} imported successfully.`)
      setRows([])
    } else {
      setResultMessage(
        `Imported ${result.imported}; ${result.failed} failed. ${result.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.message}`).join(' · ')}`,
      )
    }
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length
  const errorCount = rows.length - validCount

  return (
    <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lead-import-title">
      <div className="erp-modal-panel max-w-4xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="lead-import-title" className="text-[16px] font-semibold text-erp-text">
              Import Leads
            </h2>
            <p className="mt-1 text-[13px] text-erp-muted">
              Download the CSV template, fill in your leads, then upload the file. Rows are validated before import.
            </p>
          </div>
          <button type="button" onClick={handleClose} className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-erp-primary text-[12px] font-bold text-white">1</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-semibold text-erp-text">Download CSV template</h3>
                <p className="mt-1 text-[12px] text-erp-muted">
                  Includes {LEAD_IMPORT_HEADERS.length} columns with two sample rows. Open in Excel or Google Sheets.
                </p>
                <ErpButton
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Download}
                  className="mt-3"
                  onClick={downloadLeadImportTemplate}
                >
                  Download lead-import-template.csv
                </ErpButton>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-erp-primary text-[12px] font-bold text-white">2</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-semibold text-erp-text">Upload filled CSV</h3>
                <p className="mt-1 text-[12px] text-erp-muted">
                  Keep the header row. Required columns: Prospect Name and Expected Value.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ErpButton type="button" variant="secondary" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                    Choose CSV File
                  </ErpButton>
                  {fileName ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-erp-muted">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      {fileName}
                    </span>
                  ) : null}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-4 rounded-lg border border-erp-border">
          <div className="border-b border-erp-border bg-erp-surface-alt/60 px-3 py-2">
            <p className="text-[12px] font-semibold text-erp-text">Template columns</p>
          </div>
          <div className="max-h-44 overflow-auto">
            <table className="erp-table w-full text-[11px]">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Required</th>
                  <th>Example</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {fieldGuide.map((field) => (
                  <tr key={field.column}>
                    <td className="font-medium">{field.column}</td>
                    <td>{field.required ? 'Yes' : 'No'}</td>
                    <td className="text-erp-muted">{field.example}</td>
                    <td className="text-erp-muted">{field.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {headerError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{headerError}</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-medium text-erp-text">
              Preview — {validCount} ready{errorCount > 0 ? `, ${errorCount} with errors` : ''}
            </p>
            <div className="max-h-64 overflow-auto rounded-md border border-erp-border">
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Prospect</th>
                    <th>Owner</th>
                    <th className="num">Value</th>
                    <th>Stage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row) => (
                    <tr key={row.rowNo}>
                      <td>{row.rowNo}</td>
                      <td>{row.input.prospectName || '—'}</td>
                      <td>{row.input.leadOwnerName}</td>
                      <td className="num">{formatCurrency(row.input.expectedValue)}</td>
                      <td>{row.input.stage}</td>
                      <td className={cn(row.errors.length ? 'text-red-700' : 'text-emerald-700')}>
                        {row.errors.length ? row.errors[0] : 'Ready'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 ? (
              <p className="mt-1 text-[11px] text-erp-muted">Showing first 50 of {rows.length} rows.</p>
            ) : null}
          </div>
        ) : null}

        {resultMessage ? (
          <p className="mt-3 rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[13px] text-erp-text">
            {resultMessage}
          </p>
        ) : null}

        <ErpButtonGroup className="mt-5 justify-end">
          <ErpButton type="button" variant="secondary" onClick={handleClose} disabled={importing}>
            Close
          </ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            onClick={handleImport}
            disabled={importing || validCount === 0}
          >
            {importing ? 'Importing…' : `Import ${validCount} Lead${validCount === 1 ? '' : 's'}`}
          </ErpButton>
        </ErpButtonGroup>
      </div>
    </div>
  )
}
