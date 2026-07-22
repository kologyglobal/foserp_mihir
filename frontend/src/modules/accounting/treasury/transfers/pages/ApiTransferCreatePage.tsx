import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { notify } from '@/store/toastStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryTransferPermissions } from '@/utils/permissions/treasuryTransfer'
import { createTransferDraft } from '../api/treasury-transfer.api'
import { useTreasuryAccountOptions } from '../hooks/useTreasuryAccountOptions'
import { EMPTY_TRANSFER_FORM, TransferForm, buildCreateTransferPayload, type TransferFormValues } from '../components/TransferForm'
import { TransferWorkspaceShell } from '../components/TransferWorkspaceShell'
import { parseDecimal } from '../utils/treasuryTransferUi'

function validateForm(values: TransferFormValues): Partial<Record<keyof TransferFormValues, string>> {
  const errors: Partial<Record<keyof TransferFormValues, string>> = {}
  if (!values.sourceTreasuryAccountId) errors.sourceTreasuryAccountId = 'Select the source account'
  if (!values.destinationTreasuryAccountId) errors.destinationTreasuryAccountId = 'Select the destination account'
  if (values.sourceTreasuryAccountId && values.sourceTreasuryAccountId === values.destinationTreasuryAccountId) {
    errors.destinationTreasuryAccountId = 'Destination must differ from source'
  }
  if (!values.transferAmount || parseDecimal(values.transferAmount) <= 0) errors.transferAmount = 'Enter a valid amount'
  if (!values.transferDate) errors.transferDate = 'Transfer date is required'
  return errors
}

export function ApiTransferCreatePage() {
  const navigate = useNavigate()
  const perms = useTreasuryTransferPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts, loading: accountsLoading } = useTreasuryAccountOptions(legalEntityId)
  const [values, setValues] = useState<TransferFormValues>(EMPTY_TRANSFER_FORM)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof TransferFormValues, string>>>({})
  const [saving, setSaving] = useState(false)

  if (!perms.canCreate) {
    return (
      <TransferWorkspaceShell title="New Transfer">
        <p className="text-[13px] text-erp-muted">You do not have permission to create treasury transfers.</p>
      </TransferWorkspaceShell>
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
      const created = await createTransferDraft(buildCreateTransferPayload(values, legalEntityId))
      notify.success(`Draft transfer ${created.draftReference} created`)
      navigate(`/accounting/bank-cash/transfers/${created.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create transfer draft')
    } finally {
      setSaving(false)
    }
  }

  return (
    <TransferWorkspaceShell
      title="New Transfer"
      description="Create a draft internal transfer between two treasury accounts."
      actions={
        <ErpButton icon={Save} loading={saving} onClick={() => void save()}>
          Save draft
        </ErpButton>
      }
    >
      <PageBackLink to="/accounting/bank-cash/transfers" label="Back to transfers" className="mb-3" />
      <TransferForm
        values={values}
        onChange={setValues}
        accounts={accounts}
        accountsLoading={accountsLoading}
        legalEntityId={legalEntityId}
        disabled={saving}
        fieldErrors={fieldErrors}
      />
    </TransferWorkspaceShell>
  )
}
