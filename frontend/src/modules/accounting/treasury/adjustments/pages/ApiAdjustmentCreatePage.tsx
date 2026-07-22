import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { notify } from '@/store/toastStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useTreasuryAccountOptions } from '../../transfers/hooks/useTreasuryAccountOptions'
import { createAdjustmentDraft } from '../api/treasury-adjustment.api'
import { EMPTY_ADJUSTMENT_FORM, AdjustmentForm, buildCreateAdjustmentPayload, type AdjustmentFormValues } from '../components/AdjustmentForm'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'
import { parseDecimal } from '../utils/format'

function validateForm(values: AdjustmentFormValues): { treasuryAccountId?: string; adjustmentDate?: string; lines?: string } {
  const errors: { treasuryAccountId?: string; adjustmentDate?: string; lines?: string } = {}
  if (!values.treasuryAccountId) errors.treasuryAccountId = 'Select the bank account'
  if (!values.adjustmentDate) errors.adjustmentDate = 'Date is required'
  if (values.lines.length === 0) {
    errors.lines = 'At least one offset line is required'
  } else if (values.lines.some((l) => !l.accountId || parseDecimal(l.amount) <= 0)) {
    errors.lines = 'Every line needs a GL account and a positive amount'
  }
  return errors
}

export function ApiAdjustmentCreatePage() {
  const navigate = useNavigate()
  const perms = useTreasuryAdjustmentPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts: allAccounts, loading: accountsLoading } = useTreasuryAccountOptions(legalEntityId)
  const accounts = useMemo(() => allAccounts.filter((a) => a.accountType === 'BANK'), [allAccounts])
  const [values, setValues] = useState<AdjustmentFormValues>(EMPTY_ADJUSTMENT_FORM)
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validateForm>>({})
  const [saving, setSaving] = useState(false)

  if (!perms.canCreate) {
    return (
      <AdjustmentWorkspaceShell title="New Bank Transaction">
        <p className="text-[13px] text-erp-muted">You do not have permission to create treasury bank transactions.</p>
      </AdjustmentWorkspaceShell>
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
      const created = await createAdjustmentDraft(buildCreateAdjustmentPayload(values, legalEntityId))
      notify.success(`Draft bank transaction ${created.draftReference} created`)
      navigate(`/accounting/bank-cash/treasury-adjustments/${created.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create bank transaction draft')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdjustmentWorkspaceShell
      title="New Bank Transaction"
      description="Create a draft bank charge, interest, fee, direct debit/credit, or other non-transfer bank transaction."
      actions={
        <ErpButton icon={Save} loading={saving} onClick={() => void save()}>
          Save draft
        </ErpButton>
      }
    >
      <PageBackLink to="/accounting/bank-cash/treasury-adjustments" label="Back to bank transactions" className="mb-3" />
      <AdjustmentForm
        values={values}
        onChange={setValues}
        accounts={accounts}
        accountsLoading={accountsLoading}
        legalEntityId={legalEntityId}
        disabled={saving}
        fieldErrors={fieldErrors}
      />
    </AdjustmentWorkspaceShell>
  )
}
