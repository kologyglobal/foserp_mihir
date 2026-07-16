import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Wand2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { BankCashDemoBanner, BankCashEmptyState, BankStatementStatusBadge, MatchStatusBadge } from '@/components/accounting/bankCash'
import { getBankStatementById, getReconciliations } from '@/services/accounting/bankCashService'
import type { BankStatement, BankStatementLine, Reconciliation } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{value ?? '—'}</dd>
    </div>
  )
}

export function BankStatementDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [statement, setStatement] = useState<BankStatement | null>(null)
  const [lines, setLines] = useState<BankStatementLine[]>([])
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const result = await getBankStatementById(id)
      if (signal?.cancelled) return
      if (!result) {
        setStatement(null)
        setError('Bank statement not found')
        setLoading(false)
        return
      }
      setStatement(result.statement)
      setLines(result.lines)
      const recons = await getReconciliations({ bankAccountId: result.statement.bankAccountId })
      if (signal?.cancelled) return
      setReconciliation(recons.find((r) => r.statementId === result.statement.id) ?? null)
      setLoading(false)
    } catch (err) {
      if (signal?.cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load statement')
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load])

  const totals = useMemo(
    () => ({
      matched: lines.filter((l) => l.matchStatus === 'Matched').length,
      unmatched: lines.filter((l) => l.matchStatus === 'Unmatched').length,
      duplicates: lines.filter((l) => l.isDuplicate).length,
    }),
    [lines],
  )

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Bank & Cash', to: '/accounting/bank-cash' },
    { label: 'Bank Statements', to: '/accounting/bank-cash/statements' },
    { label: statement?.statementNumber ?? '…' },
  ]

  if (!perms.canView || !perms.canViewStatement) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Bank Statement" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <BankCashEmptyState title="Access denied" description="You cannot view bank statements." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Bank Statement" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!statement || error) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <BankCashEmptyState
          title="Bank statement not found"
          description={error ?? undefined}
          actions={<Link to="/accounting/bank-cash/statements" className="erp-btn erp-btn-primary inline-flex h-9 items-center px-4 text-[13px]">Back to statements</Link>}
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={statement.statementNumber}
      description={`${statement.bankAccountName} · ${formatDate(statement.periodFrom)} – ${formatDate(statement.periodTo)}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/bank-cash/statements/${statement.id}`}
      showDescription
      kpiStrip={[
        { id: 'closing', label: 'Closing Balance', value: formatCurrency(statement.closingBalance), accent: 'blue' },
        { id: 'matched', label: 'Matched Lines', value: totals.matched, accent: 'green' },
        { id: 'unmatched', label: 'Unmatched Lines', value: totals.unmatched, accent: 'amber' },
        { id: 'duplicates', label: 'Duplicates', value: totals.duplicates, accent: totals.duplicates > 0 ? 'red' : 'slate' },
      ]}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canViewReconciliation
              ? {
                  id: 'reconcile',
                  label: 'Reconcile',
                  icon: Wand2,
                  variant: 'primary',
                  onClick: () =>
                    navigate(
                      reconciliation
                        ? `/accounting/bank-cash/reconciliation/${reconciliation.id}`
                        : `/accounting/bank-cash/reconciliation?bankAccountId=${statement.bankAccountId}&statementId=${statement.id}`,
                    ),
                }
              : undefined
          }
        />
      )}
    >
      <BankCashDemoBanner message="Statement import is parsed and validated in the browser only. No live bank feed is contacted." />

      <div className="mt-4 rounded-lg border border-erp-border bg-white p-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Opening Balance" value={formatCurrency(statement.openingBalance)} />
          <Field label="Closing Balance" value={formatCurrency(statement.closingBalance)} />
          <Field label="Total Debits" value={formatCurrency(statement.totalDebits)} />
          <Field label="Total Credits" value={formatCurrency(statement.totalCredits)} />
          <Field label="File Name" value={statement.fileName ?? '—'} />
          <Field label="Imported By" value={statement.importedBy ?? '—'} />
          <Field label="Imported At" value={formatDateTime(statement.importedAt)} />
          <Field label="Status" value={<BankStatementStatusBadge status={statement.status} />} />
        </dl>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-erp-border bg-white">
        <table className="erp-table w-full text-[13px]">
          <thead>
            <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-left">Match Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-erp-border/70">
                <td className="px-3 py-2">{formatDate(l.lineDate)}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2 text-erp-muted">{l.reference || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.debitAmount > 0 ? formatCurrency(l.debitAmount) : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.creditAmount > 0 ? formatCurrency(l.creditAmount) : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.balance)}</td>
                <td className="px-3 py-2"><MatchStatusBadge status={l.matchStatus} /></td>
              </tr>
            ))}
            {lines.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-erp-muted">No lines in this statement.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </OperationalPageShell>
  )
}
