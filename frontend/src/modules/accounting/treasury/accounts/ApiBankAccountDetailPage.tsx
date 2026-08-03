import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileUp, Landmark, Power, RefreshCw, XCircle } from 'lucide-react'
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
      <dd className="mt-1 text-[13px] text-erp-text">{value || '—'}</dd>
    </div>
  )
}

export function ApiBankAccountDetailPage() {
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
      if (response.data.accountType !== 'BANK') throw new Error('This record is not a bank treasury account.')
      setAccount(response.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bank account.')
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
      title: `${action[0].toUpperCase()}${action.slice(1)} bank account?`,
      confirmLabel: action[0].toUpperCase() + action.slice(1),
      tone: action === 'activate' ? 'default' : 'danger',
      note: {
        required: action !== 'activate',
        label: 'Reason',
      },
    })
    if (reason === null) return
    setBusy(true)
    try {
      if (action === 'activate') await treasuryApi.activateTreasuryAccount(account.id, account.updatedAt, reason)
      if (action === 'deactivate') await treasuryApi.deactivateTreasuryAccount(account.id, account.updatedAt, reason)
      if (action === 'close') await treasuryApi.closeTreasuryAccount(account.id, account.updatedAt, reason)
      notify.success(`Bank account ${action}d.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : `Failed to ${action} bank account.`)
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbs = [
    ...BANK_CASH_BREADCRUMB,
    { label: 'Bank Accounts', to: '/accounting/bank-cash/bank-accounts' },
    { label: account?.code || 'Account' },
  ]

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Bank Account" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!account) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Bank Account" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState
          icon={Landmark}
          title="Bank account unavailable"
          description={error}
          action={<Link className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" to="/accounting/bank-cash/bank-accounts">Back to Bank Accounts</Link>}
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
      description="Live treasury bank account and GL mapping."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/bank-cash/bank-accounts/${account.id}`}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back', icon: ArrowLeft, onClick: () => navigate('/accounting/bank-cash/bank-accounts') },
            {
              id: 'statement',
              label: 'Import Statement',
              icon: FileUp,
              hidden: account.status !== 'ACTIVE',
              onClick: () => navigate(`/accounting/bank-cash/statements/import?treasuryAccountId=${account.id}`),
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
        <span className="text-[12px] text-erp-muted">{account.bankProfile?.bankAccountKind} · {account.currencyCode}</span>
        <span className="font-mono text-[12px] text-erp-muted">{account.bankProfile?.accountNumberMasked || 'Account number not recorded'}</span>
      </div>

      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h2 className="mb-4 text-[14px] font-semibold text-erp-text">Bank account details</h2>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Bank" value={account.bankProfile?.bankName} />
          <Field label="Bank branch" value={account.bankProfile?.branchName} />
          <Field label="Account holder" value={account.bankProfile?.accountHolderName} />
          <Field label="Account number" value={account.bankProfile?.accountNumberMasked} />
          <Field label="IFSC" value={account.bankProfile?.ifscCode} />
          <Field label="SWIFT" value={account.bankProfile?.swiftCode} />
          <Field label="MICR" value={account.bankProfile?.micrCode} />
          <Field label="UPI VPA" value={account.bankProfile?.upiVpa} />
          <Field label="Overdraft limit" value={account.bankProfile?.overdraftLimit} />
          <Field label="GL account ID" value={<span className="font-mono text-[12px]">{account.glAccountId}</span>} />
          <Field label="Organization branch ID" value={account.branchId ? <span className="font-mono text-[12px]">{account.branchId}</span> : '—'} />
          <Field label="Last updated" value={formatDateTime(account.updatedAt)} />
          <Field label="Description" value={account.description} />
          <Field label="Deactivation reason" value={account.deactivationReason} />
          <Field label="Close reason" value={account.closeReason} />
        </dl>
      </section>
    </OperationalPageShell>
  )
}
