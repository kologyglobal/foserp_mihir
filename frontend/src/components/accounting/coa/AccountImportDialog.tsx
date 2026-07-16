import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react'
import { AccountDrawerShell } from './AccountDrawerShell'
import {
  getImportTemplateCsv,
  importAccounts,
  validateAccountImport,
  ChartOfAccountsServiceError,
} from '@/services/accounting/chartOfAccountsService'
import type { AccountImportPreview } from '@/types/chartOfAccounts'
import { cn } from '@/utils/cn'

const STEPS = [
  { id: 1, label: 'Download template' },
  { id: 2, label: 'Upload file' },
  { id: 3, label: 'Validate' },
  { id: 4, label: 'Preview' },
  { id: 5, label: 'Errors' },
  { id: 6, label: 'Confirm' },
] as const

function downloadBlob(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function AccountImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported?: (result: { imported: number; message: string }) => void
}) {
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<AccountImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const errorRows = useMemo(() => preview?.rows.filter((r) => r.status === 'error') ?? [], [preview])

  function reset() {
    setStep(1)
    setFileName('')
    setCsvText('')
    setPreview(null)
    setBusy(false)
    setError(null)
    setSuccessMessage(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function runValidate() {
    if (!csvText.trim()) {
      setError('Upload a CSV file before validating.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await validateAccountImport(fileName || 'import.csv', csvText)
      setPreview(result)
      setStep(result.errorRows > 0 ? 5 : 4)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      const result = await importAccounts(preview)
      setSuccessMessage(result.message)
      onImported?.(result)
      setStep(6)
    } catch (e) {
      setError(e instanceof ChartOfAccountsServiceError ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountDrawerShell
      open={open}
      onClose={handleClose}
      eyebrow="Import"
      title="Import chart of accounts"
      subtitle="Demo session only — imports are not persisted to the database"
      widthClassName="max-w-xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold" onClick={handleClose}>
            {successMessage ? 'Close' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            {step > 1 && step < 6 && !successMessage ? (
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={busy}
              >
                Back
              </button>
            ) : null}
            {step === 1 ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold"
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            ) : null}
            {step === 2 ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold"
                onClick={() => setStep(3)}
                disabled={!csvText.trim()}
              >
                Continue
              </button>
            ) : null}
            {step === 3 ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold"
                onClick={runValidate}
                disabled={busy || !csvText.trim()}
              >
                {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                Validate
              </button>
            ) : null}
            {step === 4 && preview ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold"
                onClick={() => setStep(6)}
                disabled={busy}
              >
                Review & confirm
              </button>
            ) : null}
            {step === 5 && preview && preview.errorRows === 0 ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold"
                onClick={() => setStep(4)}
              >
                View preview
              </button>
            ) : null}
            {step === 6 && preview && !successMessage ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-4 text-[12px] font-semibold"
                onClick={runImport}
                disabled={busy || preview.errorRows > 0}
              >
                {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                Confirm import
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <strong>Demo session only.</strong> Imported accounts exist in this browser session via the mock service — they are
        not saved to MySQL.
      </div>

      <ol className="mb-5 flex flex-wrap gap-1">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              step === s.id ? 'bg-erp-primary text-white' : step > s.id ? 'bg-emerald-100 text-emerald-800' : 'bg-erp-surface-alt text-erp-muted',
            )}
          >
            {s.id}. {s.label}
          </li>
        ))}
      </ol>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3 text-[12px]">
          <p>Download the CSV template with mandatory columns for account code, name, type, category, and parent.</p>
          <button
            type="button"
            className="erp-btn erp-btn-secondary h-9 px-3 text-[12px] font-semibold"
            onClick={() => {
              const csv = getImportTemplateCsv()
              downloadBlob('chart-of-accounts-import-template.csv', csv, 'text/csv;charset=utf-8')
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download template
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3 text-[12px]">
          <p>Upload a comma-separated file. Maximum recommended: 500 rows for demo validation.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-erp-border bg-erp-surface px-4 py-8 hover:bg-erp-surface-alt">
            <FileUp className="h-8 w-8 text-erp-muted" />
            <span className="font-semibold text-erp-text">Choose CSV file</span>
            <span className="text-erp-muted">{fileName || 'No file selected'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setFileName(file.name)
                const reader = new FileReader()
                reader.onload = () => {
                  setCsvText(typeof reader.result === 'string' ? reader.result : '')
                  setPreview(null)
                  setError(null)
                }
                reader.readAsText(file)
              }}
            />
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2 text-[12px]">
          <p>
            File: <strong>{fileName || 'import.csv'}</strong> — {csvText.split(/\r?\n/).filter((l) => l.trim()).length} lines
            detected.
          </p>
          <p className="text-erp-muted">Click Validate to parse rows and check mandatory fields, duplicates, and parent references.</p>
        </div>
      ) : null}

      {step === 4 && preview ? (
        <div className="space-y-3">
          <p className="text-[12px] text-erp-muted">
            {preview.validRows} valid / {preview.errorRows} error / {preview.totalRows} total rows
          </p>
          <div className="max-h-[360px] overflow-auto rounded-md border border-erp-border">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-erp-surface text-[10px] font-semibold uppercase text-erp-muted">
                <tr>
                  <th className="px-2 py-1.5">Row</th>
                  <th className="px-2 py-1.5">Code</th>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Type</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((row) => (
                  <tr key={row.rowNumber} className="border-t border-erp-border">
                    <td className="px-2 py-1 tabular-nums">{row.rowNumber}</td>
                    <td className="px-2 py-1 font-mono">{row.code}</td>
                    <td className="px-2 py-1">{row.name}</td>
                    <td className="px-2 py-1">{row.accountType}</td>
                    <td className="px-2 py-1">
                      <span
                        className={cn(
                          'rounded px-1 py-0.5 font-semibold',
                          row.status === 'valid' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800',
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 50 ? (
            <p className="text-[11px] text-erp-muted">Showing first 50 rows of {preview.rows.length}.</p>
          ) : null}
        </div>
      ) : null}

      {step === 5 && preview ? (
        <div className="space-y-3">
          {errorRows.length === 0 ? (
            <p className="text-[12px] text-emerald-800">No validation errors — proceed to preview.</p>
          ) : (
            <ul className="max-h-[400px] space-y-2 overflow-auto text-[12px]">
              {errorRows.map((row) => (
                <li key={row.rowNumber} className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                  <p className="font-semibold text-red-900">
                    Row {row.rowNumber}: {row.code || '(no code)'} — {row.name || '(no name)'}
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-red-800">
                    {row.errors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {step === 6 && preview && !successMessage ? (
        <div className="space-y-3 text-[12px]">
          <p>
            Ready to import <strong>{preview.validRows}</strong> account(s) from <strong>{preview.fileName}</strong>.
          </p>
          <p className="text-erp-muted">
            This action updates the in-memory demo chart only. Refreshing the page will restore seed data unless the mock
            store is extended.
          </p>
          {preview.errorRows > 0 ? (
            <p className="font-semibold text-red-700">Resolve {preview.errorRows} error row(s) before confirming.</p>
          ) : null}
        </div>
      ) : null}
    </AccountDrawerShell>
  )
}
