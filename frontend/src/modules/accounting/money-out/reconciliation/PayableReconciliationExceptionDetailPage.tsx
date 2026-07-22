import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  acknowledgePayableReconciliationException,
  getPayableReconciliationException,
} from '@/services/bridges/payablesApiBridge'
import type { PayableReconciliationExceptionDto } from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { payableReconciliationExceptionSeverityTone } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayableReconciliationExceptionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [row, setRow] = useState<PayableReconciliationExceptionDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [acknowledging, setAcknowledging] = useState(false)

  const load = useCallback(async () => {
    if (!id || !isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setRow(await getPayableReconciliationException(id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load exception')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canReconcileExceptionView) void load()
  }, [load, perms.canReconcileExceptionView])

  const canAcknowledge =
    row &&
    !row.isAcknowledged &&
    (row.severity === 'INFO' || row.severity === 'WARNING') &&
    perms.canReconcileExceptionAcknowledge

  const onAcknowledge = async () => {
    if (!id || !canAcknowledge) return
    const confirmedNote = await appPromptNote({
      title: 'Acknowledge exception',
      description: 'Add an optional note explaining why this exception is accepted.',
      confirmLabel: 'Acknowledge',
      note: {
        required: false,
        label: 'Note (optional)',
        placeholder: 'Reviewed and accepted for close readiness…',
        defaultValue: note,
      },
    })
    if (confirmedNote === null) return
    setAcknowledging(true)
    try {
      const updated = await acknowledgePayableReconciliationException(id, confirmedNote || undefined)
      setRow(updated)
      notify.success('Exception acknowledged')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to acknowledge exception')
    } finally {
      setAcknowledging(false)
    }
  }

  if (!perms.canReconcileExceptionView) {
    return (
      <MoneyOutWorkspaceShell title="Exception">
        <p className="text-[13px] text-erp-muted">You do not have permission to view reconciliation exceptions.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Exception">
        <p className="text-[13px] text-erp-muted">AP reconciliation requires API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Reconciliation exception"
      commandBar={
        <div className="flex flex-wrap gap-2">
          {row ? (
            <Link
              to={`/accounting/money-out/reconciliation/exceptions?runId=${row.runId}`}
              className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
            >
              Back to list
            </Link>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
          {canAcknowledge ? (
            <ErpButton icon={Check} loading={acknowledging} onClick={() => void onAcknowledge()}>
              Acknowledge
            </ErpButton>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : !row ? (
        <p className="text-[13px] text-erp-muted">Exception not found.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ErpStatusChip label={row.severity} tone={payableReconciliationExceptionSeverityTone(row.severity)} />
            <span className="text-[13px] font-semibold text-erp-text">{row.code}</span>
            {row.isAcknowledged ? <ErpStatusChip label="Acknowledged" tone="success" /> : null}
          </div>

          <dl className="grid gap-2 text-[12px] md:grid-cols-2">
            <Field label="Category" value={row.category.replace(/_/g, ' ')} />
            <Field label="Run">
              <Link to={`/accounting/money-out/reconciliation/runs/${row.runId}`} className="text-erp-accent hover:underline">
                View run
              </Link>
            </Field>
            <Field label="Created" value={new Date(row.createdAt).toLocaleString()} />
            <Field label="Acknowledged" value={row.isAcknowledged ? row.acknowledgedAt ?? 'Yes' : 'No'} />
          </dl>

          <section>
            <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Message</h3>
            <p className="text-[13px] text-erp-text">{row.message}</p>
          </section>

          {row.acknowledgementNote ? (
            <section>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Acknowledgement note</h3>
              <p className="text-[13px] text-erp-text">{row.acknowledgementNote}</p>
            </section>
          ) : null}

          {row.details ? (
            <section>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Details</h3>
              <pre className="overflow-x-auto rounded border border-erp-border bg-slate-50 p-2 text-[11px]">
                {JSON.stringify(row.details, null, 2)}
              </pre>
            </section>
          ) : null}

          {canAcknowledge ? (
            <section>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Acknowledge (optional note)</h3>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="text-[12px]" />
              <ErpButton className="mt-2" icon={Check} loading={acknowledging} onClick={() => void onAcknowledge()}>
                Acknowledge WARNING/INFO
              </ErpButton>
            </section>
          ) : row.severity === 'ERROR' || row.severity === 'BLOCKER' ? (
            <p className="text-[12px] text-erp-muted">ERROR and BLOCKER exceptions cannot be acknowledged — resolve the underlying issue.</p>
          ) : null}

          <button
            type="button"
            className="text-[12px] text-erp-accent hover:underline"
            onClick={() => navigate(`/accounting/money-out/reconciliation/runs/${row.runId}`)}
          >
            Open parent run →
          </button>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div>
      <dt className="text-erp-muted">{label}</dt>
      <dd className="font-medium text-erp-text">{children ?? value ?? '—'}</dd>
    </div>
  )
}
