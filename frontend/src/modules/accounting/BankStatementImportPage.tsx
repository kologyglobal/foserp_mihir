import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileUp, Upload } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Select, Textarea } from '@/components/forms/Inputs'
import { BankCashDemoBanner, BankCashEmptyState } from '@/components/accounting/bankCash'
import { getBankCashLookups, importBankStatementDemo, validateBankStatementImport, BankCashServiceError } from '@/services/accounting/bankCashService'
import type { BankCashLookups, StatementImportPreview } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const STEPS = [
  { id: 1, label: 'Select Bank Account' },
  { id: 2, label: 'Upload Statement File' },
  { id: 3, label: 'Parse & Preview' },
  { id: 4, label: 'Review Valid Rows' },
  { id: 5, label: 'Review Warnings & Errors' },
  { id: 6, label: 'Duplicate Detection' },
  { id: 7, label: 'Confirm & Import' },
]

const SAMPLE_CSV = 'Date,Value Date,Description,Reference,Debit,Credit,Balance\n2026-07-01,2026-07-01,Sample NEFT credit,REF12345,0,50000,850000'

export function BankStatementImportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useBankCashPermissions()
  const [step, setStep] = useState(1)
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [bankAccountId, setBankAccountId] = useState(searchParams.get('bankAccountId') ?? '')
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<StatementImportPreview | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    void getBankCashLookups().then(setLookups)
  }, [])

  const bankAccountName = lookups?.bankAccounts.find((b) => b.id === bankAccountId)?.label ?? ''

  const validRows = useMemo(() => preview?.rows.filter((r) => r.status === 'Valid') ?? [], [preview])
  const warningRows = useMemo(() => preview?.rows.filter((r) => r.status === 'Warning' || r.status === 'Error') ?? [], [preview])
  const duplicateRows = useMemo(() => preview?.rows.filter((r) => r.status === 'Duplicate') ?? [], [preview])

  const handleFileUpload = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const runParse = async () => {
    if (!bankAccountId || !csvText.trim()) return
    setParsing(true)
    setParseError(null)
    try {
      const result = await validateBankStatementImport(fileName || 'pasted-statement.csv', csvText, bankAccountId)
      setPreview(result)
      setStep(4)
    } catch (err) {
      setParseError(err instanceof BankCashServiceError ? err.message : 'Failed to parse statement file.')
    } finally {
      setParsing(false)
    }
  }

  const confirmImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const statement = await importBankStatementDemo(preview)
      notify.success(`Imported ${statement.lineCount} line(s) as ${statement.statementNumber} (demo — no live bank feed was contacted).`)
      navigate(`/accounting/bank-cash/statements/${statement.id}`)
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const canProceedFromStep = (s: number) => {
    if (s === 1) return Boolean(bankAccountId)
    if (s === 2) return Boolean(csvText.trim())
    return true
  }

  const goNext = () => {
    if (step === 2) {
      setStep(3)
      void runParse()
      return
    }
    setStep((s) => Math.min(7, s + 1))
  }

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Bank & Cash', to: '/accounting/bank-cash' },
    { label: 'Bank Statements', to: '/accounting/bank-cash/statements' },
    { label: 'Import' },
  ]

  if (!perms.canView || !perms.canImportStatement) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Import Bank Statement" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <BankCashEmptyState title="Access denied" description="Missing import statement permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Import Bank Statement"
      description="7-step guided import — parsed and validated in the browser only."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'cancel', label: 'Cancel', onClick: () => navigate('/accounting/bank-cash/statements') }]} />}
    >
      <BankCashDemoBanner message="Statement import is parsed and validated in the browser only. No live bank feed or file server is contacted." />

      <ol className="my-4 flex flex-wrap gap-2" aria-label="Import steps">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-inset',
              step === s.id
                ? 'bg-erp-primary text-white ring-erp-primary'
                : step > s.id
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                  : 'bg-white text-erp-muted ring-erp-border',
            )}
          >
            {step > s.id ? <Check className="h-3 w-3" /> : <span>{s.id}</span>}
            {s.label}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-erp-border bg-white p-4">
        {step === 1 ? (
          <div className="max-w-md">
            <h3 className="mb-3 text-[13px] font-semibold">Select the bank account this statement belongs to</h3>
            <Select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
              <option value="">Select bank account</option>
              {(lookups?.bankAccounts ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </Select>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold">Upload or paste statement CSV for {bankAccountName}</h3>
            <label className="flex h-24 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-erp-border bg-erp-surface-alt/30 text-[12px] text-erp-muted hover:border-erp-primary/40">
              <Upload className="h-5 w-5" />
              {fileName || 'Click to choose a .csv file'}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            </label>
            <p className="text-[11px] text-erp-muted">Or paste CSV content directly (Date, Value Date, Description, Reference, Debit, Credit, Balance):</p>
            <Textarea rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={SAMPLE_CSV} />
            <button type="button" className="text-[11px] font-semibold text-erp-primary" onClick={() => setCsvText(SAMPLE_CSV)}>
              Use sample data
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="py-10 text-center">
            {parsing ? (
              <p className="text-[13px] text-erp-muted">Parsing and validating statement rows…</p>
            ) : parseError ? (
              <div>
                <p className="text-[13px] font-semibold text-rose-800">{parseError}</p>
                <button type="button" className="erp-btn erp-btn-secondary mt-3 h-9 px-3 text-[12px]" onClick={() => setStep(2)}>
                  Back to upload
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-erp-muted">Ready to parse. Click Next to continue.</p>
            )}
          </div>
        ) : null}

        {step === 4 && preview ? (
          <div>
            <h3 className="mb-3 text-[13px] font-semibold">{validRows.length} valid row(s) ready to import</h3>
            <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-lg border border-erp-border">
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Date</th><th>Description</th><th>Reference</th><th className="text-right">Debit</th><th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((r) => (
                    <tr key={r.rowNumber}>
                      <td>{r.lineDate}</td>
                      <td className="max-w-[16rem] truncate">{r.description}</td>
                      <td>{r.reference || '—'}</td>
                      <td className="text-right tabular-nums">{r.debitAmount > 0 ? formatCurrency(r.debitAmount) : '—'}</td>
                      <td className="text-right tabular-nums">{r.creditAmount > 0 ? formatCurrency(r.creditAmount) : '—'}</td>
                    </tr>
                  ))}
                  {validRows.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-erp-muted">No valid rows found.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 5 && preview ? (
          <div>
            <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {warningRows.length} row(s) with warnings or errors
            </h3>
            {warningRows.length === 0 ? (
              <p className="text-[13px] text-erp-muted">No warnings or errors detected.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-lg border border-erp-border">
                <table className="erp-table w-full text-[12px]">
                  <thead>
                    <tr><th>Row</th><th>Date</th><th>Description</th><th>Status</th><th>Message</th></tr>
                  </thead>
                  <tbody>
                    {warningRows.map((r) => (
                      <tr key={r.rowNumber} className={r.status === 'Error' ? 'bg-rose-50' : 'bg-amber-50'}>
                        <td>{r.rowNumber}</td>
                        <td>{r.lineDate || '—'}</td>
                        <td className="max-w-[16rem] truncate">{r.description}</td>
                        <td className="font-semibold">{r.status}</td>
                        <td>{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.errorRowCount > 0 ? (
              <p className="mt-2 text-[12px] font-medium text-rose-800">Rows with errors will be excluded from import. Fix the source file and re-upload if needed.</p>
            ) : null}
          </div>
        ) : null}

        {step === 6 && preview ? (
          <div>
            <h3 className="mb-3 text-[13px] font-semibold">{duplicateRows.length} duplicate row(s) detected</h3>
            {duplicateRows.length === 0 ? (
              <p className="text-[13px] text-erp-muted">No duplicate references found within this file.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-lg border border-erp-border">
                <table className="erp-table w-full text-[12px]">
                  <thead>
                    <tr><th>Row</th><th>Date</th><th>Reference</th><th className="text-right">Amount</th></tr>
                  </thead>
                  <tbody>
                    {duplicateRows.map((r) => (
                      <tr key={r.rowNumber} className="bg-rose-50">
                        <td>{r.rowNumber}</td>
                        <td>{r.lineDate}</td>
                        <td>{r.reference}</td>
                        <td className="text-right tabular-nums">{formatCurrency(Math.max(r.debitAmount, r.creditAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {step === 7 && preview ? (
          <div>
            <h3 className="mb-3 text-[13px] font-semibold">Confirm import for {bankAccountName}</h3>
            <dl className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
              <div><dt className="text-erp-muted">Valid rows</dt><dd className="font-semibold text-emerald-800">{preview.validRowCount}</dd></div>
              <div><dt className="text-erp-muted">Warnings</dt><dd className="font-semibold text-amber-800">{preview.warningRowCount}</dd></div>
              <div><dt className="text-erp-muted">Errors</dt><dd className="font-semibold text-rose-800">{preview.errorRowCount}</dd></div>
              <div><dt className="text-erp-muted">Duplicates</dt><dd className="font-semibold text-rose-800">{preview.duplicateRowCount}</dd></div>
              <div><dt className="text-erp-muted">Total Debits</dt><dd className="font-semibold tabular-nums">{formatCurrency(preview.totalDebits)}</dd></div>
              <div><dt className="text-erp-muted">Total Credits</dt><dd className="font-semibold tabular-nums">{formatCurrency(preview.totalCredits)}</dd></div>
            </dl>
            {!preview.canImport ? (
              <p className="mt-3 text-[12px] font-medium text-rose-800">This file cannot be imported — resolve errors and re-upload.</p>
            ) : (
              <p className="mt-3 text-[12px] text-erp-muted">Importing creates a demo bank statement record with {preview.validRowCount} line(s), ready for reconciliation.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex justify-between">
        <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
          <ArrowLeft className="mr-1 inline h-4 w-4" />
          Back
        </button>
        {step < 7 ? (
          <button
            type="button"
            className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
            disabled={!canProceedFromStep(step) || parsing || (step === 3 && !preview)}
            onClick={goNext}
          >
            {step === 2 ? (parsing ? 'Parsing…' : 'Parse & Continue') : 'Next'}
            <ArrowRight className="ml-1 inline h-4 w-4" />
          </button>
        ) : (
          <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" disabled={!preview?.canImport || importing} onClick={() => void confirmImport()}>
            <FileUp className="mr-1 inline h-4 w-4" />
            {importing ? 'Importing…' : 'Confirm & Import'}
          </button>
        )}
      </div>
    </OperationalPageShell>
  )
}
