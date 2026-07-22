import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { notify } from '@/store/toastStore'
import { useTreasuryStatementPermissions } from '@/utils/permissions/treasuryStatement'
import { fetchBankStatement, updateStatement } from '../api/bank-statement.api'
import { BankStatementWorkspaceShell } from '../components/BankStatementWorkspaceShell'

export function BankStatementEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useTreasuryStatementPermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')
  const [statementReference, setStatementReference] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [closingBalance, setClosingBalance] = useState('0')
  const [totalCreditAmount, setTotalCreditAmount] = useState('0')
  const [totalDebitAmount, setTotalDebitAmount] = useState('0')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const detail = await fetchBankStatement(id)
      const s = detail.statement
      if (!s.allowedActions.canEdit) {
        notify.error('Statement cannot be edited in its current status')
        navigate(`/accounting/bank-cash/statements/${id}`)
        return
      }
      setUpdatedAt(s.updatedAt)
      setStatementReference(s.statementReference)
      setOpeningBalance(s.openingBalance)
      setClosingBalance(s.closingBalance)
      setTotalCreditAmount(s.totalCreditAmount)
      setTotalDebitAmount(s.totalDebitAmount)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load statement')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    if (perms.canEdit && id) void load()
  }, [id, load, perms.canEdit])

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      await updateStatement(id, {
        expectedUpdatedAt: updatedAt,
        statementReference: statementReference.trim(),
        openingBalance: Number(openingBalance),
        closingBalance: Number(closingBalance),
        totalCreditAmount: Number(totalCreditAmount),
        totalDebitAmount: Number(totalDebitAmount),
      })
      notify.success('Statement updated')
      navigate(`/accounting/bank-cash/statements/${id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (!perms.canEdit) {
    return (
      <BankStatementWorkspaceShell title="Edit Statement">
        <p className="text-[13px] text-erp-muted">You do not have permission to edit bank statements.</p>
      </BankStatementWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />

  return (
    <BankStatementWorkspaceShell title="Edit Statement">
      <PageBackLink to={`/accounting/bank-cash/statements/${id}`} label="Back to statement" className="mb-3" />

      <div className="grid max-w-2xl gap-3 rounded-lg border border-erp-border bg-white p-4">
        <label className="text-[12px]">
          Statement reference
          <Input className="mt-1 h-9" value={statementReference} onChange={(e) => setStatementReference(e.target.value)} />
        </label>
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
          {saving ? 'Saving…' : 'Save changes'}
        </ErpButton>
      </div>
    </BankStatementWorkspaceShell>
  )
}
