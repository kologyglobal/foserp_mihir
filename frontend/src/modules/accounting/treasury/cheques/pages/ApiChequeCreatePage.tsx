import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { notify } from '@/store/toastStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryChequePermissions } from '@/utils/permissions/treasuryCheque'
import { useTreasuryAccountOptions } from '../../transfers/hooks/useTreasuryAccountOptions'
import { createChequeDraft } from '../api/treasury-cheque.api'
import { EMPTY_CHEQUE_FORM, ChequeForm, buildCreateChequePayload, type ChequeFormValues } from '../components/ChequeForm'
import { ChequeWorkspaceShell } from '../components/ChequeWorkspaceShell'
import { parseDecimal } from '../utils/format'

function validateForm(values: ChequeFormValues): Partial<Record<keyof ChequeFormValues, string>> {
  const errors: Partial<Record<keyof ChequeFormValues, string>> = {}
  if (!values.treasuryAccountId) errors.treasuryAccountId = 'Select the bank account'
  if (!values.chequeNumber.trim()) errors.chequeNumber = 'Cheque number is required'
  if (!values.chequeDate) errors.chequeDate = 'Cheque date is required'
  if (!values.payeeOrDrawerName.trim()) errors.payeeOrDrawerName = 'Payee / drawer name is required'
  if (!values.amount || parseDecimal(values.amount) <= 0) errors.amount = 'Enter a valid amount'
  if (values.isPdc && !values.pdcMaturityDate) errors.pdcMaturityDate = 'PDC maturity date is required'
  return errors
}

export function ApiChequeCreatePage() {
  const navigate = useNavigate()
  const perms = useTreasuryChequePermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts: allAccounts, loading: accountsLoading } = useTreasuryAccountOptions(legalEntityId)
  const accounts = useMemo(() => allAccounts.filter((a) => a.accountType === 'BANK'), [allAccounts])
  const [values, setValues] = useState<ChequeFormValues>(EMPTY_CHEQUE_FORM)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ChequeFormValues, string>>>({})
  const [saving, setSaving] = useState(false)

  if (!perms.canCreate) {
    return (
      <ChequeWorkspaceShell title="New Cheque">
        <p className="text-[13px] text-erp-muted">You do not have permission to create treasury cheques.</p>
      </ChequeWorkspaceShell>
    )
  }

  const save = async () => {
    const errors = validateForm(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      notify.error('Fix the highlighted fields before saving')
      return
    }
    setSaving(true)
    try {
      const created = await createChequeDraft(buildCreateChequePayload(values, legalEntityId))
      notify.success(`Draft cheque ${created.draftReference} created`)
      navigate(`/accounting/bank-cash/cheques/${created.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create cheque draft')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ChequeWorkspaceShell
      title="New Cheque"
      description="Create a draft issued or received cheque for a treasury bank account."
      actions={
        <ErpButton icon={Save} loading={saving} onClick={() => void save()}>
          Save draft
        </ErpButton>
      }
    >
      <PageBackLink to="/accounting/bank-cash/cheques" label="Back to cheques" className="mb-3" />
      <ChequeForm
        values={values}
        onChange={setValues}
        accounts={accounts}
        accountsLoading={accountsLoading}
        legalEntityId={legalEntityId}
        disabled={saving}
        fieldErrors={fieldErrors}
      />
    </ChequeWorkspaceShell>
  )
}
