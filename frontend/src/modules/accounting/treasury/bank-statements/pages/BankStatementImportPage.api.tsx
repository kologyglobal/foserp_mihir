import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Upload } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { useTreasuryStatementPermissions } from '@/utils/permissions/treasuryStatement'
import { fetchTreasuryBankAccounts } from '../api/bank-statement.api'
import {
  executeBatchImport,
  fetchMappingTemplates,
  inspectBatch,
  previewBatch,
  uploadImportBatch,
} from '../api/bank-statement-import.api'
import type {
  BankStatementMappingConfig,
  BankStatementParsingConfig,
  ImportBatchDto,
  ImportPreviewResult,
  TreasuryAccountSummary,
} from '../api/bank-statement.types'
import { buildMappingConfig, flattenMappingConfig } from '../mappers/column-mapping.mapper'
import { ImportIssuePanel } from '../components/ImportIssuePanel'
import { ImportWizardSteps } from '../components/ImportWizardSteps'
import { StatementBalanceSummary } from '../components/StatementBalanceSummary'
import { StatementLineGrid } from '../components/StatementLineGrid'
import { BankStatementWorkspaceShell } from '../components/BankStatementWorkspaceShell'
import {
  AMOUNT_MODE_LABELS,
  defaultMappingForHeaders,
  formatNeedsColumnMapping,
  IMPORT_FILE_ACCEPT,
  IMPORT_FORMAT_LABELS,
  inferImportFormat,
  isStructuredImportFormat,
  MAPPABLE_FIELDS,
} from '../utils/bankStatementUi'

export function ApiBankStatementImportPage() {
  const navigate = useNavigate()
  const perms = useTreasuryStatementPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const [step, setStep] = useState(1)
  const [accounts, setAccounts] = useState<TreasuryAccountSummary[]>([])
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [treasuryAccountId, setTreasuryAccountId] = useState('')
  const [mappingTemplateId, setMappingTemplateId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [importFormat, setImportFormat] = useState<
    'CSV' | 'XLSX' | 'MT940' | 'CAMT_053' | 'AUTO_DETECT'
  >('AUTO_DETECT')
  const [batch, setBatch] = useState<ImportBatchDto | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [parsingConfig, setParsingConfig] = useState<BankStatementParsingConfig>({})
  const [amountMode, setAmountMode] = useState<BankStatementMappingConfig['amountMode']>('DEBIT_CREDIT_COLUMNS')
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [statementReference, setStatementReference] = useState('')
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [allowPartial, setAllowPartial] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)
  const [resultStatementId, setResultStatementId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [accts, tmpl] = await Promise.all([
          fetchTreasuryBankAccounts(legalEntityId),
          fetchMappingTemplates(legalEntityId),
        ])
        setAccounts(accts.items)
        setTemplates(tmpl.items.map((t) => ({ id: t.id, name: t.name })))
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load bank accounts')
      } finally {
        setLoadingInit(false)
      }
    })()
  }, [legalEntityId])

  const mappingConfig = useMemo(
    () => buildMappingConfig(amountMode, columnMap, dateFormat),
    [amountMode, columnMap, dateFormat],
  )

  const selectedAccount = accounts.find((a) => a.id === treasuryAccountId)

  const handleFileChange = (f: File | null) => {
    if (!f) return
    const fmt = inferImportFormat(f.name)
    if (!fmt) {
      notify.error('Unsupported file type — use CSV, XLSX, MT940 (.sta/.mt940/.txt), or CAMT.053 (.xml)')
      return
    }
    setFile(f)
    setImportFormat(fmt)
  }

  const handleUpload = async () => {
    if (!file || !treasuryAccountId) return
    setBusy(true)
    try {
      const uploaded = await uploadImportBatch({
        treasuryAccountId,
        importFormat,
        file,
        ...(mappingTemplateId && formatNeedsColumnMapping(importFormat)
          ? { mappingTemplateId }
          : {}),
      })
      setBatch(uploaded)
      // Structured formats skip sheet/header + column mapping
      if (isStructuredImportFormat(uploaded.importFormat) || importFormat === 'MT940' || importFormat === 'CAMT_053') {
        setStep(3)
        // Inspect then jump toward preview path
        const res = await inspectBatch(uploaded.id, { expectedUpdatedAt: uploaded.updatedAt })
        setBatch(res.batch)
        const previewRes = await previewBatch(res.batch.id, {
          expectedUpdatedAt: res.batch.updatedAt,
          statementReference: statementReference || undefined,
        })
        setPreview(previewRes.preview)
        if (previewRes.preview.header?.statementReference && !statementReference) {
          setStatementReference(previewRes.preview.header.statementReference)
        }
        setStep(5)
      } else {
        setStep(3)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const handleInspect = async () => {
    if (!batch) return
    setBusy(true)
    try {
      const res = await inspectBatch(batch.id, {
        expectedUpdatedAt: batch.updatedAt,
        parsingConfig,
        mappingConfig,
      })
      setBatch(res.batch)
      const inspect = res.inspect as { headers?: string[]; sheetNames?: string[] }
      setHeaders(inspect.headers ?? [])
      setSheetNames(inspect.sheetNames ?? [])
      const suggested = res.suggestedMapping as unknown as BankStatementMappingConfig
      if (suggested) {
        setAmountMode(suggested.amountMode ?? 'DEBIT_CREDIT_COLUMNS')
        setColumnMap(flattenMappingConfig(suggested))
        if (suggested.dateFormat) setDateFormat(suggested.dateFormat)
      } else if (inspect.headers?.length) {
        const inferred = defaultMappingForHeaders(inspect.headers)
        setColumnMap(flattenMappingConfig(inferred))
      }
      setStep(4)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Inspect failed')
    } finally {
      setBusy(false)
    }
  }

  const handlePreview = async () => {
    if (!batch) return
    setBusy(true)
    try {
      const res = await previewBatch(batch.id, {
        expectedUpdatedAt: batch.updatedAt,
        parsingConfig,
        mappingConfig,
        statementReference: statementReference || undefined,
      })
      setPreview(res.preview)
      if (res.preview.header?.statementReference && !statementReference) {
        setStatementReference(res.preview.header.statementReference)
      }
      setStep(5)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!batch) return
    setBusy(true)
    try {
      const structured = isStructuredImportFormat(batch.importFormat)
      const expectedUpdatedAt = batch.updatedAt
      const res = await executeBatchImport(batch.id, {
        expectedUpdatedAt,
        ...(structured
          ? {}
          : { parsingConfig, mappingConfig }),
        statementReference: statementReference || undefined,
        allowPartial,
        confirmPartialImport: allowPartial,
      })
      setBatch(res.batch)
      setResultStatementId(res.statementId)
      setStep(7)
      notify.success('Bank statement imported')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canImport) {
    return (
      <BankStatementWorkspaceShell title="Import Bank Statement">
        <p className="text-[13px] text-erp-muted">You do not have permission to import bank statements.</p>
      </BankStatementWorkspaceShell>
    )
  }

  if (loadingInit) return <LoadingState variant="form" className="mt-4" />

  return (
    <BankStatementWorkspaceShell title="Import Bank Statement">
      <PageBackLink to="/accounting/bank-cash/statements" label="Back to statements" className="mb-3" />
      <ImportWizardSteps currentStep={step} />

      <div className="mt-4 space-y-4 rounded-lg border border-erp-border bg-white p-4">
        {step === 1 ? (
          <>
            <h2 className="text-[13px] font-semibold">Select treasury bank account</h2>
            <Select
              className="h-9 max-w-md text-[12px]"
              value={treasuryAccountId}
              onChange={(e) => setTreasuryAccountId(e.target.value)}
            >
              <option value="">Choose account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name} ({a.currencyCode})
                </option>
              ))}
            </Select>
            {templates.length > 0 && formatNeedsColumnMapping(importFormat) ? (
              <Select
                className="mt-2 h-9 max-w-md text-[12px]"
                value={mappingTemplateId}
                onChange={(e) => setMappingTemplateId(e.target.value)}
              >
                <option value="">Optional mapping template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-[13px] font-semibold">Upload statement file</h2>
            <p className="text-[12px] text-erp-muted">
              Account: {selectedAccount?.name ?? treasuryAccountId} · CSV, XLSX, MT940, or CAMT.053
            </p>
            <label className="text-[12px]">
              Import format
              <Select
                className="mt-1 h-9 max-w-md text-[12px]"
                value={importFormat}
                onChange={(e) =>
                  setImportFormat(
                    e.target.value as 'CSV' | 'XLSX' | 'MT940' | 'CAMT_053' | 'AUTO_DETECT',
                  )
                }
              >
                {(Object.keys(IMPORT_FORMAT_LABELS) as Array<keyof typeof IMPORT_FORMAT_LABELS>).map(
                  (key) => (
                    <option key={key} value={key}>
                      {IMPORT_FORMAT_LABELS[key]}
                    </option>
                  ),
                )}
              </Select>
            </label>
            <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-erp-border px-4 py-8">
              <Upload className="h-8 w-8 text-erp-muted" />
              <span className="text-[13px] font-semibold">{file?.name ?? 'Choose file'}</span>
              <span className="text-[11px] text-erp-muted">
                {IMPORT_FORMAT_LABELS[importFormat]} · accept {IMPORT_FILE_ACCEPT}
              </span>
              <input
                type="file"
                accept={IMPORT_FILE_ACCEPT}
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="text-[13px] font-semibold">Sheet & header settings</h2>
            {sheetNames.length > 0 ? (
              <Select
                className="h-9 max-w-xs text-[12px]"
                value={parsingConfig.sheetName ?? sheetNames[0]}
                onChange={(e) => setParsingConfig((p) => ({ ...p, sheetName: e.target.value }))}
              >
                {sheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[12px]">
                Header row
                <Input
                  type="number"
                  min={1}
                  className="mt-1 h-9"
                  value={parsingConfig.headerRowNumber ?? 1}
                  onChange={(e) =>
                    setParsingConfig((p) => ({ ...p, headerRowNumber: Number(e.target.value) || 1 }))
                  }
                />
              </label>
              <label className="text-[12px]">
                Data start row
                <Input
                  type="number"
                  min={1}
                  className="mt-1 h-9"
                  value={parsingConfig.dataStartRowNumber ?? 2}
                  onChange={(e) =>
                    setParsingConfig((p) => ({ ...p, dataStartRowNumber: Number(e.target.value) || 2 }))
                  }
                />
              </label>
              {importFormat === 'CSV' ? (
                <label className="text-[12px]">
                  Delimiter
                  <Input
                    className="mt-1 h-9"
                    value={parsingConfig.delimiter ?? ','}
                    onChange={(e) => setParsingConfig((p) => ({ ...p, delimiter: e.target.value }))}
                  />
                </label>
              ) : null}
            </div>
            {headers.length > 0 ? (
              <p className="text-[12px] text-erp-muted">Detected columns: {headers.join(', ')}</p>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="text-[13px] font-semibold">Map columns</h2>
            <Select
              className="mb-3 h-9 max-w-md text-[12px]"
              value={amountMode}
              onChange={(e) => setAmountMode(e.target.value as BankStatementMappingConfig['amountMode'])}
            >
              {Object.entries(AMOUNT_MODE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              className="mb-3 h-9 max-w-xs text-[12px]"
              placeholder="Date format (e.g. DD/MM/YYYY)"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {MAPPABLE_FIELDS.map((field) => (
                <label key={field.key} className="text-[12px]">
                  {field.label}
                  {'required' in field && field.required ? ' *' : ''}
                  <Select
                    className="mt-1 h-9 w-full text-[12px]"
                    value={columnMap[field.key] ?? ''}
                    onChange={(e) => setColumnMap((m) => ({ ...m, [field.key]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
          </>
        ) : null}

        {step === 5 && preview ? (
          <>
            <h2 className="text-[13px] font-semibold">Preview parsed rows</h2>
            <StatementBalanceSummary header={preview.header} currencyCode={selectedAccount?.currencyCode} />
            <div className="flex flex-wrap gap-2 text-[12px]">
              <span>Valid: {preview.validRowCount}</span>
              <span>Warnings: {preview.warningRowCount}</span>
              <span>Errors: {preview.errorRowCount}</span>
              <span>Duplicates: {preview.duplicateRowCount}</span>
            </div>
            <StatementLineGrid rows={preview.rows.slice(0, 100)} currencyCode={selectedAccount?.currencyCode} />
            <ImportIssuePanel issues={preview.issues.slice(0, 50)} />
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h2 className="text-[13px] font-semibold">Confirm import</h2>
            <Input
              className="h-9 max-w-md text-[12px]"
              placeholder="Statement reference"
              value={statementReference}
              onChange={(e) => setStatementReference(e.target.value)}
            />
            {!preview?.canImportStrict ? (
              <label className="mt-2 flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />
                Allow partial import (skip error rows)
              </label>
            ) : null}
            {preview ? <StatementBalanceSummary header={preview.header} currencyCode={selectedAccount?.currencyCode} /> : null}
          </>
        ) : null}

        {step === 7 ? (
          <>
            <h2 className="text-[13px] font-semibold text-emerald-800">Import complete</h2>
            {batch ? (
              <p className="text-[13px]">
                Batch {batch.batchReference} · {batch.importedLineCount} line(s) imported
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {resultStatementId ? (
                <ErpButton onClick={() => navigate(`/accounting/bank-cash/statements/${resultStatementId}`)}>
                  Open statement
                </ErpButton>
              ) : null}
              {batch ? (
                <ErpButton
                  variant="secondary"
                  onClick={() => navigate(`/accounting/bank-cash/import-batches/${batch.id}`)}
                >
                  View batch
                </ErpButton>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {step < 7 ? (
        <div className="mt-4 flex justify-between">
          <ErpButton
            variant="secondary"
            icon={ArrowLeft}
            disabled={step <= 1 || busy}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Back
          </ErpButton>
          <ErpButton
            icon={ArrowRight}
            disabled={busy || (step === 1 && !treasuryAccountId) || (step === 2 && !file)}
            onClick={() => {
              if (step === 1) setStep(2)
              else if (step === 2) void handleUpload()
              else if (step === 3) void handleInspect()
              else if (step === 4) void handlePreview().then(() => setStep(5))
              else if (step === 5) setStep(6)
              else if (step === 6) void handleImport()
            }}
          >
            {busy ? 'Working…' : step === 6 ? 'Import' : 'Next'}
          </ErpButton>
        </div>
      ) : null}
    </BankStatementWorkspaceShell>
  )
}
