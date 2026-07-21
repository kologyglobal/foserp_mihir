import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryTransferPermissions, mergeAllowedAction } from '@/utils/permissions/treasuryTransfer'
import { updateTransferDraft } from '../api/treasury-transfer.api'
import { useTransferDetail } from '../hooks/useTransferDetail'
import { useTreasuryAccountOptions } from '../hooks/useTreasuryAccountOptions'
import { EMPTY_TRANSFER_FORM, TransferForm, type TransferFormValues } from '../components/TransferForm'
import { TransferWorkspaceShell } from '../components/TransferWorkspaceShell'
import { parseDecimal } from '../utils/treasuryTransferUi'
import type { TreasuryTransferDto } from '../api/treasury-transfer.types'

function toFormValues(t: TreasuryTransferDto): TransferFormValues {
  return {
    sourceTreasuryAccountId: t.sourceTreasuryAccountId,
    destinationTreasuryAccountId: t.destinationTreasuryAccountId,
    transferAmount: t.transferAmount,
    transferDate: t.transferDate.slice(0, 10),
    externalReference: t.externalReference ?? '',
    narration: t.narration ?? '',
    transferPurpose: t.transferPurpose,
    postingMode: t.postingMode,
    sourcePostingDate: t.sourcePostingDate.slice(0, 10),
    expectedReceiptDate: t.expectedReceiptDate ? t.expectedReceiptDate.slice(0, 10) : '',
    sourceBranchId: t.sourceBranchId ?? '',
    destinationBranchId: t.destinationBranchId ?? '',
    internalNote: t.internalNote ?? '',
  }
}

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

export function ApiTransferEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useTreasuryTransferPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts, loading: accountsLoading } = useTreasuryAccountOptions(legalEntityId)
  const { transfer, loading } = useTransferDetail(id, perms.canEdit)
  const [values, setValues] = useState<TransferFormValues>(EMPTY_TRANSFER_FORM)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof TransferFormValues, string>>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (transfer) setValues(toFormValues(transfer))
  }, [transfer])

  if (!perms.canEdit) {
    return (
      <TransferWorkspaceShell title="Edit Transfer">
        <p className="text-[13px] text-erp-muted">You do not have permission to edit treasury transfers.</p>
      </TransferWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />

  if (!transfer) {
    return (
      <TransferWorkspaceShell title="Edit Transfer">
        <p className="text-[13px] text-erp-muted">Transfer not found.</p>
      </TransferWorkspaceShell>
    )
  }

  if (!mergeAllowedAction(true, transfer.allowedActions.canEdit)) {
    return (
      <TransferWorkspaceShell title="Edit Transfer">
        <PageBackLink to={`/accounting/bank-cash/transfers/${transfer.id}`} label="Back to transfer" className="mb-3" />
        <p className="text-[13px] text-erp-muted">This transfer is no longer editable in its current status.</p>
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
      await updateTransferDraft(transfer.id, {
        sourceTreasuryAccountId: values.sourceTreasuryAccountId,
        destinationTreasuryAccountId: values.destinationTreasuryAccountId,
        transferPurpose: values.transferPurpose,
        transferDate: values.transferDate,
        sourcePostingDate: values.sourcePostingDate || values.transferDate,
        expectedReceiptDate: values.expectedReceiptDate || null,
        postingMode: values.postingMode || undefined,
        transferAmount: values.transferAmount,
        externalReference: values.externalReference || null,
        narration: values.narration || null,
        internalNote: values.internalNote || null,
        sourceBranchId: values.sourceBranchId || null,
        destinationBranchId: values.destinationBranchId || null,
        expectedUpdatedAt: transfer.updatedAt,
      })
      notify.success('Transfer updated')
      navigate(`/accounting/bank-cash/transfers/${transfer.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to update transfer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <TransferWorkspaceShell
      title={`Edit ${transfer.draftReference}`}
      description="Update this draft transfer before submitting it for approval."
      actions={
        <ErpButton icon={Save} loading={saving} onClick={() => void save()}>
          Save changes
        </ErpButton>
      }
    >
      <PageBackLink to={`/accounting/bank-cash/transfers/${transfer.id}`} label="Back to transfer" className="mb-3" />
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
