import { useMemo, useState } from 'react'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { Input } from '@/components/forms/Inputs'
import {
  getVoucherImportTemplateCsv,
  importVouchersFromPreview,
  validateVoucherImport,
  VouchersServiceError,
} from '@/services/accounting/vouchersService'
import type { VoucherImportPreview } from '@/types/vouchers'
import { notify } from '@/store/toastStore'

function downloadText(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function VoucherImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<VoucherImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const canImport = useMemo(() => preview && preview.errorCount === 0 && preview.okCount > 0, [preview])

  const onFile = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    setBusy(true)
    try {
      const text = await file.text()
      const p = await validateVoucherImport(file.name, text)
      setPreview(p)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Import validation failed')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const result = await importVouchersFromPreview(preview)
      notify.success(result.message)
      onImported()
      onClose()
      setPreview(null)
      setFileName('')
    } catch (e) {
      notify.error(e instanceof VouchersServiceError ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountDrawerShell
      open={open}
      onClose={onClose}
      title="Import vouchers"
      subtitle="CSV text parse preview — demo validation only"
      widthClassName="max-w-2xl"
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <button
            type="button"
            className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]"
            onClick={() =>
              downloadText('voucher-import-template.csv', getVoucherImportTemplateCsv(), 'text/csv')
            }
          >
            Download template
          </button>
          <div className="flex gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
              disabled={!canImport || busy}
              onClick={() => void confirm()}
            >
              {busy ? 'Working…' : 'Import valid rows'}
            </button>
          </div>
        </div>
      }
    >
      <label className="block text-[12px] font-medium text-erp-text">
        CSV file
        <Input
          type="file"
          accept=".csv,text/csv"
          className="mt-1"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {fileName ? <p className="mt-2 text-[12px] text-erp-muted">Selected: {fileName}</p> : null}
      {preview ? (
        <div className="mt-4">
          <p className="mb-2 text-[12px] text-erp-muted">
            OK {preview.okCount} · Warnings {preview.warningCount} · Errors {preview.errorCount}
          </p>
          <div className="max-h-80 overflow-auto rounded border border-erp-border">
            <table className="erp-table w-full text-[12px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/50 text-left text-[10px] uppercase text-erp-muted">
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Account</th>
                  <th className="px-2 py-1">Dr</th>
                  <th className="px-2 py-1">Cr</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.rowNo} className="border-b border-erp-border/70">
                    <td className="px-2 py-1 tabular-nums">{r.rowNo}</td>
                    <td className="px-2 py-1">{r.voucherType}</td>
                    <td className="px-2 py-1">{r.accountCode}</td>
                    <td className="px-2 py-1">{r.debit || '—'}</td>
                    <td className="px-2 py-1">{r.credit || '—'}</td>
                    <td className="px-2 py-1">
                      <span
                        className={
                          r.status === 'error'
                            ? 'text-red-700'
                            : r.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }
                      >
                        {r.status}
                      </span>
                      {r.messages.length ? (
                        <span className="block text-[10px] text-erp-muted">{r.messages.join('; ')}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AccountDrawerShell>
  )
}
