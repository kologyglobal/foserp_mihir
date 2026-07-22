import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { notify } from '@/store/toastStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useTreasuryAccountOptions } from '../../transfers/hooks/useTreasuryAccountOptions'
import { createStandingInstructionDraft } from '../api/standing-instruction.api'
import { EMPTY_SI_FORM, SIForm, buildCreateSiPayload, type SIFormValues } from '../components/SIForm'
import { SIWorkspaceShell } from '../components/SIWorkspaceShell'
import { parseDecimal } from '../utils/format'

function validateForm(values: SIFormValues): Partial<Record<'treasuryAccountId' | 'name' | 'accountId' | 'fixedAmount', string>> {
  const errors: Partial<Record<'treasuryAccountId' | 'name' | 'accountId' | 'fixedAmount', string>> = {}
  if (!values.treasuryAccountId) errors.treasuryAccountId = 'Select the bank account'
  if (!values.name.trim()) errors.name = 'Name is required'
  if (!values.accountId) errors.accountId = 'Select the offset GL account'
  if (values.amountMode === 'FIXED' && parseDecimal(values.fixedAmount) <= 0) errors.fixedAmount = 'Enter a valid fixed amount'
  return errors
}

export function ApiSICreatePage() {
  const navigate = useNavigate()
  const perms = useTreasuryAdjustmentPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts: allAccounts, loading: accountsLoading } = useTreasuryAccountOptions(legalEntityId)
  const accounts = useMemo(() => allAccounts.filter((a) => a.accountType === 'BANK'), [allAccounts])
  const [values, setValues] = useState<SIFormValues>(EMPTY_SI_FORM)
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validateForm>>({})
  const [saving, setSaving] = useState(false)

  if (!perms.canManageStandingInstructions) {
    return (
      <SIWorkspaceShell title="New Standing Instruction">
        <p className="text-[13px] text-erp-muted">You do not have permission to create standing instructions.</p>
      </SIWorkspaceShell>
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
      const created = await createStandingInstructionDraft(buildCreateSiPayload(values, legalEntityId))
      notify.success(`Standing instruction "${created.name}" created`)
      navigate(`/accounting/bank-cash/standing-instructions/${created.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create standing instruction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SIWorkspaceShell
      title="New Standing Instruction"
      description="Create a recurring template that generates draft bank transactions on schedule."
      actions={
        <ErpButton icon={Save} loading={saving} onClick={() => void save()}>
          Save
        </ErpButton>
      }
    >
      <PageBackLink to="/accounting/bank-cash/standing-instructions" label="Back to standing instructions" className="mb-3" />
      <SIForm
        values={values}
        onChange={setValues}
        accounts={accounts}
        accountsLoading={accountsLoading}
        legalEntityId={legalEntityId}
        disabled={saving}
        fieldErrors={fieldErrors}
      />
    </SIWorkspaceShell>
  )
}
