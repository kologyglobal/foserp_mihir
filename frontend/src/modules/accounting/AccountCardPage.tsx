import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  Copy,
  Pencil,
  Power,
  ScrollText,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountFormDrawer, AccountStatusBadge, AccountTypeBadge } from '@/components/accounting/coa'
import {
  activateAccount,
  ChartOfAccountsServiceError,
  deactivateAccount,
  duplicateAccount,
  getAccountBalance,
  getAccountById,
  getAccountLedgerPreview,
  getAccounts,
  getDimensionLookups,
} from '@/services/accounting/chartOfAccountsService'
import type {
  AccountBalance,
  AccountLedgerPreviewLine,
  ChartOfAccount,
} from '@/types/chartOfAccounts'
import { useCoaPermissions } from '@/utils/permissions/chartOfAccounts'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { AccountDeactivateDialog } from '@/components/accounting/coa/AccountDeactivateDialog'
import { cn } from '@/utils/cn'

type CardTab =
  | 'general'
  | 'hierarchy'
  | 'posting'
  | 'compliance'
  | 'manufacturing'
  | 'dimensions'
  | 'balance'
  | 'ledger'
  | 'audit'

const TABS: { id: CardTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'hierarchy', label: 'Hierarchy' },
  { id: 'posting', label: 'Posting Controls' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'balance', label: 'Balance Summary' },
  { id: 'ledger', label: 'Related Ledger Entries' },
  { id: 'audit', label: 'Audit History' },
]

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value || '—'}</dd>
    </div>
  )
}

export function AccountCardPage() {
  const { accountId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useCoaPermissions()

  const [account, setAccount] = useState<ChartOfAccount | null>(null)
  const [allAccounts, setAllAccounts] = useState<ChartOfAccount[]>([])
  const [balance, setBalance] = useState<AccountBalance | null>(null)
  const [ledger, setLedger] = useState<AccountLedgerPreviewLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CardTab>(() =>
    searchParams.get('tab') === 'ledger' ? 'ledger' : 'general',
  )
  const [editOpen, setEditOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [dimensionLookups, setDimensionLookups] = useState({
    costCentres: [] as { id: string; code: string; name: string }[],
    departments: [] as { id: string; code: string; name: string }[],
    projects: [] as { id: string; code: string; name: string }[],
    plants: [] as { id: string; code: string; name: string }[],
    locations: [] as { id: string; code: string; name: string }[],
  })
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const [acc, accounts, dims] = await Promise.all([
        getAccountById(accountId),
        getAccounts({}),
        getDimensionLookups(),
      ])
      if (signal?.cancelled) return
      if (!acc) {
        setAccount(null)
        setError('Account not found')
        setLoading(false)
        return
      }
      setAccount(acc)
      setAllAccounts(accounts)
      setDimensionLookups(dims)
      if (perms.canViewBalance) {
        const [bal, led] = await Promise.all([
          getAccountBalance(acc.id),
          getAccountLedgerPreview(acc.id),
        ])
        if (signal?.cancelled) return
        setBalance(bal)
        setLedger(led)
      } else {
        setBalance(null)
        setLedger([])
      }
      setLoading(false)
    } catch (err) {
      if (signal?.cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load account')
      setLoading(false)
    }
  }, [accountId, perms.canViewBalance])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const parent = useMemo(
    () => (account?.parentId ? allAccounts.find((a) => a.id === account.parentId) : undefined),
    [account, allAccounts],
  )
  const children = useMemo(
    () => (account ? allAccounts.filter((a) => a.parentId === account.id) : []),
    [account, allAccounts],
  )

  const dimLabel = (id: string | null, list: { id: string; code: string; name: string }[]) => {
    if (!id) return '—'
    const found = list.find((d) => d.id === id)
    return found ? `${found.code} — ${found.name}` : id
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Account Card"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Chart of Accounts', to: '/accounting/chart-of-accounts' },
          { label: 'Account' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ScrollText} title="Access denied" description="You cannot view this account." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Account Card"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Chart of Accounts', to: '/accounting/chart-of-accounts' },
          { label: '…' },
        ]}
        autoBreadcrumbs={false}
      >
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!account || error) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Account Card"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Chart of Accounts', to: '/accounting/chart-of-accounts' },
          { label: 'Not found' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState
          icon={ScrollText}
          title="Account not found"
          description={error ?? 'This account does not exist in the demo chart.'}
          action={(
            <Link to="/accounting/chart-of-accounts" className="erp-btn erp-btn-primary inline-flex h-9 items-center px-4 text-[13px]">
              Back to Chart of Accounts
            </Link>
          )}
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
      description="Account card · configuration and demo balances (no live posting)."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Chart of Accounts', to: '/accounting/chart-of-accounts' },
        { label: account.code },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/chart-of-accounts/${account.id}`}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canEdit
              ? { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditOpen(true) }
              : undefined
          }
          secondaryActions={[
            {
              id: 'back',
              label: 'Back',
              icon: ArrowLeft,
              onClick: () => navigate('/accounting/chart-of-accounts'),
            },
            {
              id: 'duplicate',
              label: 'Duplicate',
              icon: Copy,
              hidden: !perms.canCreate,
              onClick: async () => {
                try {
                  const copy = await duplicateAccount(account.id)
                  notify.success(`Duplicated as ${copy.code}`)
                  navigate(`/accounting/chart-of-accounts/${copy.id}`)
                } catch (err) {
                  notify.error(err instanceof ChartOfAccountsServiceError ? err.message : 'Duplicate failed')
                }
              },
            },
          ]}
          moreActions={[
            {
              id: 'activate',
              label: 'Activate',
              icon: Power,
              hidden: account.active || !perms.canActivate,
              onClick: async () => {
                try {
                  await activateAccount(account.id)
                  notify.success('Account activated')
                  setRefreshToken((n) => n + 1)
                } catch (err) {
                  notify.error(err instanceof ChartOfAccountsServiceError ? err.message : 'Failed')
                }
              },
            },
            {
              id: 'deactivate',
              label: 'Deactivate',
              icon: Ban,
              hidden: !account.active || !perms.canDeactivate,
              onClick: () => setDeactivateOpen(true),
            },
          ]}
        />
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-white px-4 py-3">
        <AccountTypeBadge type={account.accountType} />
        <AccountStatusBadge active={account.active} />
        <span className="text-[12px] text-erp-muted">{account.category}</span>
        {account.systemAccount ? (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
            System account
          </span>
        ) : null}
        {perms.canViewBalance ? (
          <span className="ml-auto text-[13px] font-semibold tabular-nums text-erp-text">
            {formatCurrency(account.currentBalance)}
            <span className="ml-1 text-[11px] font-normal text-erp-muted">(demo)</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-erp-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              tab === t.id
                ? 'border border-b-white border-erp-border bg-white text-erp-primary'
                : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-b-lg border border-t-0 border-erp-border bg-white p-4">
        {tab === 'general' ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Account Code" value={account.code} />
            <Field label="Account Name" value={account.name} />
            <Field label="Alias" value={account.alias || '—'} />
            <Field label="Type" value={account.accountType} />
            <Field label="Category" value={account.category} />
            <Field label="Normal Balance" value={account.normalBalance} />
            <Field label="Active" value={account.active ? 'Yes' : 'No'} />
            <Field label="System Account" value={account.systemAccount ? 'Yes' : 'No'} />
            <Field label="Description" value={account.description || '—'} />
          </dl>
        ) : null}

        {tab === 'hierarchy' ? (
          <div className="space-y-4">
            <Field
              label="Parent Account"
              value={
                parent ? (
                  <Link className="text-erp-primary hover:underline" to={`/accounting/chart-of-accounts/${parent.id}`}>
                    {parent.code} — {parent.name}
                  </Link>
                ) : (
                  'Root group'
                )
              }
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Child Accounts</p>
              {children.length === 0 ? (
                <p className="mt-1 text-[13px] text-erp-muted">No child accounts.</p>
              ) : (
                <ul className="mt-2 divide-y divide-erp-border rounded-lg border border-erp-border">
                  {children.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/accounting/chart-of-accounts/${c.id}`}
                        className="flex items-center justify-between px-3 py-2 text-[13px] hover:bg-erp-surface-alt"
                      >
                        <span>
                          <span className="font-mono font-semibold">{c.code}</span> {c.name}
                        </span>
                        <AccountTypeBadge type={c.accountType} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'posting' ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Allow Direct Posting" value={account.posting.allowDirectPosting ? 'Yes' : 'No'} />
            <Field label="Manual Journal Posting" value={account.posting.allowManualJournalPosting ? 'Yes' : 'No'} />
            <Field label="Reconciliation Required" value={account.posting.reconciliationRequired ? 'Yes' : 'No'} />
            <Field label="Control Account" value={account.posting.isControlAccount ? 'Yes' : 'No'} />
            <Field label="Control Account Type" value={account.posting.controlAccountType ?? '—'} />
            <Field label="Allow Opening Balance" value={account.posting.allowOpeningBalance ? 'Yes' : 'No'} />
            <Field label="Cost Centre Required" value={account.posting.costCentreRequired ? 'Yes' : 'No'} />
            <Field label="Project Required" value={account.posting.projectRequired ? 'Yes' : 'No'} />
            <Field label="Department Required" value={account.posting.departmentRequired ? 'Yes' : 'No'} />
            <Field label="Block Negative Balance" value={account.posting.blockNegativeBalance ? 'Yes' : 'No'} />
            <Field label="Currency" value={account.posting.currency} />
            <Field label="Posting Description Required" value={account.posting.postingDescriptionRequired ? 'Yes' : 'No'} />
          </dl>
        ) : null}

        {tab === 'compliance' ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="GST Relevant" value={account.tax.gstRelevant ? 'Yes' : 'No'} />
            <Field label="GST Account Type" value={account.tax.gstAccountType} />
            <Field label="TDS Relevant" value={account.tax.tdsRelevant ? 'Yes' : 'No'} />
            <Field label="TDS Account Type" value={account.tax.tdsAccountType} />
            <Field label="TCS Relevant" value={account.tax.tcsRelevant ? 'Yes' : 'No'} />
            <Field label="Reverse Charge" value={account.tax.reverseChargeApplicable ? 'Yes' : 'No'} />
            <Field label="Statutory Account" value={account.tax.statutoryAccount ? 'Yes' : 'No'} />
            <Field label="Compliance Notes" value={account.tax.complianceNotes || '—'} />
          </dl>
        ) : null}

        {tab === 'manufacturing' ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Manufacturing Account" value={account.manufacturing.manufacturingAccount ? 'Yes' : 'No'} />
            <Field label="Manufacturing Type" value={account.manufacturing.manufacturingAccountType} />
            <Field label="Inventory Valuation" value={account.manufacturing.inventoryValuationAccount ? 'Yes' : 'No'} />
            <Field label="Consumption" value={account.manufacturing.consumptionAccount ? 'Yes' : 'No'} />
            <Field label="WIP" value={account.manufacturing.wipAccount ? 'Yes' : 'No'} />
            <Field label="Finished Goods" value={account.manufacturing.finishedGoodsAccount ? 'Yes' : 'No'} />
            <Field label="COGS" value={account.manufacturing.cogsAccount ? 'Yes' : 'No'} />
            <Field label="Purchase Variance" value={account.manufacturing.purchaseVarianceAccount ? 'Yes' : 'No'} />
            <Field label="Production Variance" value={account.manufacturing.productionVarianceAccount ? 'Yes' : 'No'} />
            <Field label="Scrap" value={account.manufacturing.scrapAccount ? 'Yes' : 'No'} />
            <Field label="Overhead" value={account.manufacturing.overheadAccount ? 'Yes' : 'No'} />
            <Field label="Cost Element" value={account.manufacturing.costElementType ?? '—'} />
          </dl>
        ) : null}

        {tab === 'dimensions' ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Default Cost Centre" value={dimLabel(account.dimensions.defaultCostCentreId, dimensionLookups.costCentres)} />
            <Field label="Cost Centre Mandatory" value={account.dimensions.costCentreMandatory ? 'Yes' : 'No'} />
            <Field label="Default Department" value={dimLabel(account.dimensions.defaultDepartmentId, dimensionLookups.departments)} />
            <Field label="Department Mandatory" value={account.dimensions.departmentMandatory ? 'Yes' : 'No'} />
            <Field label="Default Project" value={dimLabel(account.dimensions.defaultProjectId, dimensionLookups.projects)} />
            <Field label="Project Mandatory" value={account.dimensions.projectMandatory ? 'Yes' : 'No'} />
            <Field label="Default Plant" value={dimLabel(account.dimensions.defaultPlantId, dimensionLookups.plants)} />
            <Field label="Plant Mandatory" value={account.dimensions.plantMandatory ? 'Yes' : 'No'} />
            <Field label="Default Location" value={dimLabel(account.dimensions.defaultLocationId, dimensionLookups.locations)} />
            <Field label="Location Mandatory" value={account.dimensions.locationMandatory ? 'Yes' : 'No'} />
          </dl>
        ) : null}

        {tab === 'balance' ? (
          perms.canViewBalance && balance ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['Opening Balance', balance.openingBalance],
                  ['Debit Movement', balance.debitMovement],
                  ['Credit Movement', balance.creditMovement],
                  ['Closing Balance', balance.closingBalance],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-erp-border bg-erp-surface/50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
                  <p className="mt-1 text-[15px] font-semibold tabular-nums text-erp-text">{formatCurrency(value)}</p>
                  <p className="text-[10px] text-erp-muted">Demo value</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-erp-muted">Balance viewing is not permitted for your role.</p>
          )
        ) : null}

        {tab === 'ledger' ? (
          <div>
            <p className="mb-2 text-[12px] text-erp-muted">
              Demo ledger preview only — no real posting. Do not use for financial decisions.
            </p>
            {ledger.length === 0 ? (
              <p className="text-[13px] text-erp-muted">No demo ledger activity for this account.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-erp-border">
                <table className="w-full min-w-[640px] text-[12px]">
                  <thead className="bg-erp-surface text-left text-[11px] uppercase text-erp-muted">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Voucher</th>
                      <th className="px-3 py-2">Narration</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((line) => (
                      <tr key={line.id} className="border-t border-erp-border">
                        <td className="px-3 py-2">{line.date}</td>
                        <td className="px-3 py-2 font-mono">{line.voucherNo}</td>
                        <td className="px-3 py-2">{line.narration}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.debit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.credit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'audit' ? (
          perms.canViewAudit ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Created By" value={account.createdBy} />
              <Field label="Created Date" value={formatDateTime(account.createdAt)} />
              <Field label="Modified By" value={account.modifiedBy} />
              <Field label="Modified Date" value={formatDateTime(account.modifiedAt)} />
              {account.deactivatedReason ? (
                <Field label="Deactivation Reason" value={account.deactivatedReason} />
              ) : null}
            </dl>
          ) : (
            <p className="text-[13px] text-erp-muted">Audit information is not permitted for your role.</p>
          )
        ) : null}
      </div>

      <AccountFormDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        account={account}
        accounts={allAccounts}
        dimensionLookups={dimensionLookups}
        canManageSystem={perms.canManageSystem}
        onSaved={(acc) => {
          notify.success(`Updated ${acc.code}`)
          setEditOpen(false)
          setRefreshToken((n) => n + 1)
        }}
      />

      <AccountDeactivateDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        accountName={`${account.code} — ${account.name}`}
        onConfirm={async (reason) => {
          try {
            await deactivateAccount(account.id, reason)
            notify.success('Account deactivated')
            setDeactivateOpen(false)
            setRefreshToken((n) => n + 1)
          } catch (err) {
            notify.error(err instanceof ChartOfAccountsServiceError ? err.message : 'Failed')
          }
        }}
      />
    </OperationalPageShell>
  )
}
