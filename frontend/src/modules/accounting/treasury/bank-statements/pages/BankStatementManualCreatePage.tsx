import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { useTreasuryStatementPermissions } from '@/utils/permissions/treasuryStatement'
import { createManualStatement, fetchTreasuryBankAccounts } from '../api/bank-statement.api'
import type { TreasuryAccountSummary } from '../api/bank-statement.types'
import { BankStatementWorkspaceShell } from '../components/BankStatementWorkspaceShell'

export function BankStatementManualCreatePage() {
  const navigate = useNavigate()
  const perms = useTreasuryStatementPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const [accounts, setAccounts] = useState<TreasuryAccountSummary[]>([])
  const [treasuryAccountId, setTreasuryAccountId] = useState('')
  const [statementReference, setStatementReference] = useState('')
  const [statementDate, setStatementDate] = useState('')
  const [periodStartDate, setPeriodStartDate] = useState('')
  const [periodEndDate, setPeriodEndDate] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [closingBalance, setClosingBalance] = useState('0')
  const [totalCreditAmount, setTotalCreditAmount] = useState('0')
  const [totalDebitAmount, setTotalDebitAmount] = useState('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetchTreasuryBankAccounts(legalEntityId)
      .then((r) => setAccounts(r.items))
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load accounts'))
  }, [legalEntityId])

  const handleSave = async () => {
    if (!treasuryAccountId || !statementReference.trim()) {
      notify.error('Bank account and reference are required')
      return
    }
    setSaving(true)
    try {
      const created = await createManualStatement({
        legalEntityId,
        treasuryAccountId,
        statementReference: statementReference.trim(),
        statementDate: statementDate || periodEndDate,
        periodStartDate: periodStartDate || statementDate,
        periodEndDate: periodEndDate || statementDate,
        openingBalance: Number(openingBalance),
        closingBalance: Number(closingBalance),
        totalCreditAmount: Number(totalCreditAmount),
        totalDebitAmount: Number(totalDebitAmount),
      })
      notify.success('Manual statement created')
      navigate(`/accounting/bank-cash/statements/${created.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  if (!perms.canManualEntry) {
    return (
      <BankStatementWorkspaceShell title="Manual Statement">
        <p className="text-[13px] text-erp-muted">You do not have permission to create manual statements.</p>
      </BankStatementWorkspaceShell>
    )
  }

  return (
    <BankStatementWorkspaceShell title="Manual Statement">
      <PageBackLink to="/accounting/bank-cash/statements" label="Back to statements" className="mb-3" />

      <div className="grid max-w-2xl gap-3 rounded-lg border border-erp-border bg-white p-4">
        <label className="text-[12px]">
          Bank account *
          <Select className="mt-1 h-9 w-full" value={treasuryAccountId} onChange={(e) => setTreasuryAccountId(e.target.value)}>
            <option value="">Choose…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-[12px]">
          Statement reference *
          <Input className="mt-1 h-9" value={statementReference} onChange={(e) => setStatementReference(e.target.value)} />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-[12px]">
            Statement date
            <Input type="date" className="mt-1 h-9" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
          </label>
          <label className="text-[12px]">
            Period start
            <Input type="date" className="mt-1 h-9" value={periodStartDate} onChange={(e) => setPeriodStartDate(e.target.value)} />
          </label>
          <label className="text-[12px]">
            Period end
            <Input type="date" className="mt-1 h-9" value={periodEndDate} onChange={(e) => setPeriodEndDate(e.target.value)} />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[12px]">
            Opening balance
            <Input type="number" className="mt-1 h-9" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </label>
          <label className="text-[12px]">
            Closing balance
            <Input type="number" className="mt-1 h-9" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} />
          </label>
          <label className="text-[12px]">
            Total credits
            <Input type="number" className="mt-1 h-9" value={totalCreditAmount} onChange={(e) => setTotalCreditAmount(e.target.value)} />
          </label>
          <label className="text-[12px]">
            Total debits
            <Input type="number" className="mt-1 h-9" value={totalDebitAmount} onChange={(e) => setTotalDebitAmount(e.target.value)} />
          </label>
        </div>
        <ErpButton icon={Save} disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Create draft statement'}
        </ErpButton>
      </div>
    </BankStatementWorkspaceShell>
  )
}
