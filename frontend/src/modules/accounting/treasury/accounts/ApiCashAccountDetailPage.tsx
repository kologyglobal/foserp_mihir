import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Power, RefreshCw, Wallet, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import * as treasuryApi from '@/services/api/treasuryApi'
import type { TreasuryAccountDto } from './treasury-account.types'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { BANK_CASH_BREADCRUMB } from '../../bankCashUi'

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-1 text-[13px] text-erp-text">{value || '-'}</dd>
    </div>
  )
}

export function ApiCashAccountDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState<TreasuryAccountDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await treasuryApi.getTreasuryAccount(id)
      if (response.data.accountType !== 'CASH') throw new Error('This record is not a cash treasury account.')
      setAccount(response.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cash account.')
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const runLifecycle = async (action: 'activate' | 'deactivate' | 'close') => {
    if (!account) return
    const reason = await appPromptNote({
      title: `${action[0].toUpperCase()}${action.slice(1)} cash account?`,
      confirmLabel: action[0].toUpperCase() + action.slice(1),
      tone: action === 'activate' ? 'default' : 'danger',
      note: { required: action !== 'activate', label: 'Reason' },
    })
    if (reason === null) return
    setBusy(true)
    try {
      if (action === 'activate') await treasuryApi.activateTreasuryAccount(account.id, account.updatedAt, reason)
      if (action === 'deactivate') await treasuryApi.deactivateTreasuryAccount(account.id, account.updatedAt, reason)
      if (action === 'close') await treasuryApi.closeTreasuryAccount(account.id, account.updatedAt, reason)
      notify.success(`Cash account ${action}d.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : `Failed to ${action} cash account.`)
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbs = [
    ...BANK_CASH_BREADCRUMB,
    { label: 'Cash Accounts', to: '/accounting/bank-cash/cash-accounts' },
    { label: account?.code || 'Account' },
  ]

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Cash Account" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!account) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Cash Account" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState
          icon={Wallet}
          title="Cash account unavailable"
          description={error}
          action={<Link className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" to="/accounting/bank-cash/cash-accounts">Back to Cash Accounts</Link>}
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={`${account.code} — ${account.name}`}
      description="Live treasury cash account and GL mapping."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/bank-cash/cash-accounts/${account.id}`}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back', icon: ArrowLeft, onClick: () => navigate('/accounting/bank-cash/cash-accounts') },
            {
              id: 'cash-book',
              label: 'Open Cash Book',
              icon: BookOpen,
              hidden: account.status !== 'ACTIVE',
              onClick: () => navigate(`/accounting/bank-cash/cashbook?treasuryAccountId=${account.id}`),
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
          moreActions={[
            {
              id: 'activate',
              label: 'Activate',
              icon: Power,
              hidden: account.status !== 'INACTIVE',
              disabled: busy,
              onClick: () => void runLifecycle('activate'),
            },
            {
              id: 'deactivate',
              label: 'Deactivate',
              icon: Power,
              hidden: account.status !== 'ACTIVE',
              disabled: busy,
              onClick: () => void runLifecycle('deactivate'),
            },
            {
              id: 'close',
              label: 'Close',
              icon: XCircle,
              hidden: account.status !== 'INACTIVE',
              disabled: busy,
              onClick: () => void runLifecycle('close'),
            },
          ]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-erp-border bg-white px-4 py-3">
        <span className="rounded-full bg-erp-surface-alt px-2 py-0.5 text-[11px] font-semibold">{account.status}</span>
        <span className="text-[12px] text-erp-muted">Cash · {account.currencyCode}</span>
        <span className="text-[12px] text-erp-muted">{account.cashProfile?.locationDescription || 'No location assigned'}</span>
      </div>

      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h2 className="mb-4 text-[14px] font-semibold text-erp-text">Cash account details</h2>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Custodian" value={account.cashProfile?.custodianName} />
          <Field label="Location" value={account.cashProfile?.locationDescription} />
          <Field label="Imprest limit" value={account.cashProfile?.imprestLimit} />
          <Field label="GL account ID" value={<span className="font-mono text-[12px]">{account.glAccountId}</span>} />
          <Field label="Organization branch ID" value={account.branchId ? <span className="font-mono text-[12px]">{account.branchId}</span> : '-'} />
          <Field label="Last updated" value={formatDateTime(account.updatedAt)} />
          <Field label="Description" value={account.description} />
          <Field label="Deactivation reason" value={account.deactivationReason} />
          <Field label="Close reason" value={account.closeReason} />
        </dl>
      </section>
    </OperationalPageShell>
  )
}
