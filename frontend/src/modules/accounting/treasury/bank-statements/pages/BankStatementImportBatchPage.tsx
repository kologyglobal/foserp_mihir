import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, RefreshCw, RotateCcw, XCircle } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { mergeAllowedAction, useTreasuryStatementPermissions } from '@/utils/permissions/treasuryStatement'
import {
  cancelBatch,
  downloadBatchFile,
  fetchImportBatch,
  retryBatchImport,
} from '../api/bank-statement-import.api'
import type { ImportBatchDto } from '../api/bank-statement.types'
import { ImportBatchStatusChip } from '../components/BankStatementStatusChip'
import { ImportIssuePanel } from '../components/ImportIssuePanel'
import { BankStatementWorkspaceShell } from '../components/BankStatementWorkspaceShell'

export function BankStatementImportBatchPage() {
  const { id } = useParams()
  const perms = useTreasuryStatementPermissions()
  const [batch, setBatch] = useState<ImportBatchDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setBatch(await fetchImportBatch(id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load import batch')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canView && id) void load()
  }, [id, load, perms.canView])

  const handleDownload = async () => {
    if (!id || !batch?.allowedActions.canDownloadFile) return
    try {
      const { blob, filename } = await downloadBatchFile(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename ?? batch.sanitisedFileName ?? 'statement-file'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Download failed')
    }
  }

  const handleCancel = async () => {
    if (!batch) return
    const reason = await appPromptNote({
      title: 'Cancel import batch?',
      description: 'Optional reason for audit trail',
      tone: 'danger',
      confirmLabel: 'Cancel batch',
      note: { required: false, label: 'Reason' },
    })
    if (reason === null) return
    setBusy(true)
    try {
      setBatch(await cancelBatch(batch.id, { expectedUpdatedAt: batch.updatedAt, reason: reason || undefined }))
      notify.success('Batch cancelled')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRetry = async () => {
    if (!batch) return
    setBusy(true)
    try {
      const res = await retryBatchImport(batch.id, { expectedUpdatedAt: batch.updatedAt })
      setBatch(res.batch)
      notify.success('Retry completed')
      if (res.statementId) {
        notify.success(`Statement ${res.statementId} created`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Retry failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canView) {
    return (
      <BankStatementWorkspaceShell title="Import Batch">
        <p className="text-[13px] text-erp-muted">You do not have permission to view import batches.</p>
      </BankStatementWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />
  if (!batch) {
    return (
      <BankStatementWorkspaceShell title="Import Batch">
        <p className="text-[13px] text-erp-muted">Import batch not found.</p>
      </BankStatementWorkspaceShell>
    )
  }

  return (
    <BankStatementWorkspaceShell
      title={`Batch ${batch.batchReference}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canDownloadFile, batch.allowedActions.canDownloadFile) ? (
            <ErpButton variant="secondary" icon={Download} onClick={() => void handleDownload()}>
              Download file
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canImport, batch.allowedActions.canRetry) ? (
            <ErpButton icon={RotateCcw} disabled={busy} onClick={() => void handleRetry()}>
              Retry import
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canCancel, batch.allowedActions.canCancel) ? (
            <ErpButton variant="secondary" icon={XCircle} disabled={busy} onClick={() => void handleCancel()}>
              Cancel batch
            </ErpButton>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <PageBackLink to="/accounting/bank-cash/statements/import" label="Back to import" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ImportBatchStatusChip status={batch.status} />
        <span className="text-[12px] text-erp-muted">{batch.importFormat}</span>
      </div>

      <dl className="grid gap-2 rounded-lg border border-erp-border bg-white p-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-erp-muted">File</dt>
          <dd className="font-medium">{batch.originalFileName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Uploaded</dt>
          <dd>{formatDateTime(batch.uploadedAt)}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Lines</dt>
          <dd>
            {batch.importedLineCount} imported / {batch.totalLineCount} total
          </dd>
        </div>
        <div>
          <dt className="text-erp-muted">Issues</dt>
          <dd>
            {batch.errorCount} errors · {batch.warningCount} warnings · {batch.duplicateLineCount} duplicates
          </dd>
        </div>
      </dl>

      {batch.statements && batch.statements.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 text-[13px] font-semibold">Linked statements</h2>
          <ul className="divide-y divide-erp-border rounded-lg border border-erp-border bg-white">
            {batch.statements.map((s) => (
              <li key={s.id} className="px-3 py-2 text-[12px]">
                <Link to={`/accounting/bank-cash/statements/${s.id}`} className="font-semibold text-erp-primary">
                  {s.statementReference}
                </Link>
                <span className="ml-2 text-erp-muted">
                  {s.status} · {s.lineCount} lines
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {batch.issues && batch.issues.length > 0 ? (
        <div className="mt-4">
          <ImportIssuePanel issues={batch.issues} title="Batch issues" />
        </div>
      ) : null}
    </BankStatementWorkspaceShell>
  )
}
