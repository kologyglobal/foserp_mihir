import { useCallback, useEffect, useMemo, useState } from 'react'
import { Landmark, Plus, RefreshCw, ScrollText, ShieldOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Select } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import * as treasuryApi from '@/services/api/treasuryApi'
import type { TreasuryTransferDto } from '../transfers/api/treasury-transfer.types'
import type { TreasuryChequeDto } from '../cheques/api/treasury-cheque.types'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { BANK_CASH_BREADCRUMB } from '../../bankCashUi'

type DepositRow =
  | {
      id: string
      kind: 'CASH'
      number: string
      date: string
      bankAccount: string
      source: string
      amount: number
      currencyCode: string
      status: string
      reference: string | null
      detailPath: string
    }
  | {
      id: string
      kind: 'CHEQUE'
      number: string
      date: string
      bankAccount: string
      source: string
      amount: number
      currencyCode: string
      status: string
      reference: string | null
      detailPath: string
    }

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

function transferToRow(item: TreasuryTransferDto): DepositRow {
  return {
    id: `transfer-${item.id}`,
    kind: 'CASH',
    number: item.transferNumber || item.draftReference,
    date: item.transferDate,
    bankAccount: item.destinationAccount
      ? `${item.destinationAccount.code} — ${item.destinationAccount.name}`
      : item.destinationTreasuryAccountId,
    source: item.sourceAccount
      ? `${item.sourceAccount.code} — ${item.sourceAccount.name}`
      : item.sourceTreasuryAccountId,
    amount: Number(item.transferAmount),
    currencyCode: item.currencyCode,
    status: item.status,
    reference: item.externalReference || null,
    detailPath: `/accounting/bank-cash/transfers/${item.id}`,
  }
}

function chequeToRow(item: TreasuryChequeDto): DepositRow {
  return {
    id: `cheque-${item.id}`,
    kind: 'CHEQUE',
    number: item.chequeRegisterNumber || item.draftReference || item.chequeNumber,
    date: item.depositDate || item.chequeDate,
    bankAccount: item.bankName
      ? `${item.bankName}${item.branchName ? ` — ${item.branchName}` : ''}`
      : item.treasuryAccountId,
    source: item.payeeOrDrawerName,
    amount: Number(item.amount),
    currencyCode: item.currencyCode,
    status: item.status,
    reference: item.chequeNumber,
    detailPath: `/accounting/bank-cash/cheques/${item.id}`,
  }
}

export function ApiBankDepositsPage() {
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const legalEntityId = useMemo(() => {
    try {
      return resolveLegalEntityId()
    } catch {
      return ''
    }
  }, [])
  const [rows, setRows] = useState<DepositRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    if (!legalEntityId) {
      setError('Select a legal entity before opening the bank deposit register.')
      setLoadState('error')
      return
    }
    setLoadState('loading')
    setError('')
    try {
      const [transfers, cheques] = await Promise.all([
        treasuryApi.listTreasuryTransfers({
          legalEntityId,
          transferType: 'CASH_TO_BANK',
          search: search.trim() || undefined,
          limit: 100,
        }),
        treasuryApi.listTreasuryCheques({
          legalEntityId,
          direction: 'RECEIVED',
          search: search.trim() || undefined,
          limit: 100,
        }),
      ])
      const combined = [
        ...transfers.items
          .filter((item) => item.transferPurpose === 'CASH_DEPOSIT')
          .map(transferToRow),
        ...cheques.items.map(chequeToRow),
      ]
        .filter((row) => (!kind || row.kind === kind) && (!status || row.status === status))
        .sort((a, b) => b.date.localeCompare(a.date))
      setRows(combined)
      setLoadState(combined.length ? 'ready' : 'empty')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live bank deposits.')
      setLoadState('error')
    }
  }, [kind, legalEntityId, search, status])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(
    () => [
      { id: 'count', label: 'Deposit records', value: rows.length, accent: 'blue' },
      { id: 'cash', label: 'Cash deposits', value: rows.filter((row) => row.kind === 'CASH').length, accent: 'green' },
      { id: 'cheque', label: 'Cheque deposits', value: rows.filter((row) => row.kind === 'CHEQUE').length, accent: 'blue' },
      {
        id: 'pending',
        label: 'Awaiting posting',
        value: rows.filter((row) => ['DRAFT', 'PENDING_APPROVAL', 'READY', 'READY_TO_POST'].includes(row.status)).length,
        accent: 'amber',
      },
    ],
    [rows],
  )

  if (!perms.canViewDeposits) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank Deposits"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Deposits' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing deposit view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank Deposits"
      description="Live workbench for cash-to-bank transfers and received cheque deposits."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Deposits' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/deposits"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateDeposit
              ? {
                  id: 'cash-deposit',
                  label: 'New Cash Deposit',
                  icon: Plus,
                  onClick: () => navigate('/accounting/bank-cash/transfers/new?purpose=CASH_DEPOSIT'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'cheque-deposit',
              label: 'New Received Cheque',
              icon: Landmark,
              onClick: () => navigate('/accounting/bank-cash/cheques/new?direction=RECEIVED'),
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      <BankCashWorkspaceTabs active="deposits" />

      <div className="mb-3 mt-4 flex flex-wrap gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Deposit, cheque, account or drawer…"
          className="min-w-[16rem] flex-1"
        />
        <Select wrapClassName="w-40" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All deposit types</option>
          <option value="CASH">Cash deposits</option>
          <option value="CHEQUE">Cheque deposits</option>
        </Select>
        <Select wrapClassName="w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="READY">Ready cheque</option>
          <option value="READY_TO_POST">Ready to post</option>
          <option value="DEPOSITED">Deposited</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLEARED">Cleared</option>
          <option value="BOUNCED">Bounced</option>
          <option value="REVERSED">Reversed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={7} /></div> : null}
        {loadState === 'error' ? (
          <div className="p-6"><EmptyState icon={ScrollText} title="Could not load bank deposits" description={error} /></div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState icon={Landmark} title="No live bank deposits found" description="Create a cash deposit transfer or register a received cheque." />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1000px] text-left text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Deposit Type</th>
                  <th className="px-3 py-2">Destination Bank</th>
                  <th className="px-3 py-2">Source / Drawer</th>
                  <th className="px-3 py-2">External Reference</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2"><TableLink to={row.detailPath}>{row.number}</TableLink></td>
                    <td className="px-3 py-2">{formatDate(row.date)}</td>
                    <td className="px-3 py-2">{row.kind === 'CASH' ? 'Cash deposit' : 'Cheque deposit'}</td>
                    <td className="px-3 py-2">{row.bankAccount}</td>
                    <td className="px-3 py-2">{row.source}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{row.reference || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(row.amount)} {row.currencyCode}</td>
                    <td className="px-3 py-2">{row.status.replaceAll('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>
    </OperationalPageShell>
  )
}
