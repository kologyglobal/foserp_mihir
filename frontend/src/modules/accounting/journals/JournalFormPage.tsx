import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createJournal,
  getJournal,
  updateJournal,
  validateJournal,
  submitJournal,
} from '@/services/bridges/journalApiBridge'
import { getAccountTree, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { AccountTreeNode } from '@/types/financeSetup'
import type { JournalLine } from '@/types/journals'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { JournalsWorkspaceShell } from './JournalsWorkspaceShell'

interface FormValues {
  documentDate: string
  postingDate: string
  referenceNumber?: string
  externalReference?: string
  narration?: string
  lines: Array<{ accountId: string; debitAmount: string; creditAmount: string; lineNarration?: string }>
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function flattenAccounts(nodes: AccountTreeNode[]): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = []
  for (const node of nodes) {
    if (!node.isGroup) out.push({ id: node.id, label: `${node.accountCode} — ${node.accountName}` })
    if (node.children?.length) out.push(...flattenAccounts(node.children))
  }
  return out
}

function defaultLines(): JournalLine[] {
  return [
    { accountId: '', debitAmount: '0', creditAmount: '0' },
    { accountId: '', debitAmount: '0', creditAmount: '0' },
  ]
}

export function JournalFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useFinancePermissions()
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string }>>([])
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | undefined>()

  const form = useForm<FormValues>({
    defaultValues: {
      documentDate: today(),
      postingDate: today(),
      lines: defaultLines().map((l) => ({
        accountId: l.accountId,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')

  const totals = useMemo(() => {
    const debit = lines.reduce((acc, l) => acc + Number(l.debitAmount || 0), 0)
    const credit = lines.reduce((acc, l) => acc + Number(l.creditAmount || 0), 0)
    return { debit: debit.toFixed(4), credit: credit.toFixed(4), balanced: Math.abs(debit - credit) < 0.0001 }
  }, [lines])

  useEffect(() => {
    void (async () => {
      try {
        const leId = resolveLegalEntityId()
        const tree = await getAccountTree(leId)
        setAccounts(flattenAccounts(tree))
      } catch {
        setAccounts([])
      }
    })()
  }, [])

  const loadExisting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const journal = await getJournal(id)
      setUpdatedAt(journal.updatedAt)
      form.reset({
        documentDate: journal.documentDate,
        postingDate: journal.postingDate,
        referenceNumber: journal.referenceNumber ?? '',
        externalReference: journal.externalReference ?? '',
        narration: journal.narration ?? '',
        lines: journal.lines.map((l) => ({
          accountId: l.accountId,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          lineNarration: l.lineNarration ?? '',
        })),
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load journal')
    } finally {
      setLoading(false)
    }
  }, [form, id])

  useEffect(() => {
    if (mode === 'edit') void loadExisting()
  }, [loadExisting, mode])

  const buildPayload = (values: FormValues) => ({
    legalEntityId: resolveLegalEntityId(),
    documentDate: values.documentDate,
    postingDate: values.postingDate,
    referenceNumber: values.referenceNumber || null,
    externalReference: values.externalReference || null,
    narration: values.narration || null,
    lines: values.lines,
    ...(mode === 'edit' && updatedAt ? { updatedAt } : {}),
  })

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createJournal(buildPayload(values))
        notify.success('Journal draft saved')
        navigate(`/accounting/entries/journals/${created.id}`)
      } else if (id) {
        const updated = await updateJournal(id, buildPayload(values))
        setUpdatedAt(updated.updatedAt)
        notify.success('Journal draft updated')
        navigate(`/accounting/entries/journals/${id}`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  })

  const onValidate = async () => {
    if (mode === 'create') {
      notify.info('Save the draft first, then validate from the detail page.')
      return
    }
    if (!id) return
    try {
      const report = await validateJournal(id)
      if (report.valid) notify.success('Validation passed')
      else notify.error(report.errors[0]?.message ?? 'Validation failed')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    }
  }

  const onSubmit = async () => {
    if (!id) return
    try {
      await submitJournal(id)
      notify.success('Journal submitted')
      navigate(`/accounting/entries/journals/${id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    }
  }

  const canEdit = mode === 'create' ? perms.canCreateVoucher : perms.canEditVoucher

  if (!canEdit) {
    return (
      <JournalsWorkspaceShell title={mode === 'create' ? 'New Journal' : 'Edit Journal'}>
        <p className="text-[13px] text-erp-muted">You do not have permission to {mode === 'create' ? 'create' : 'edit'} journals.</p>
      </JournalsWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <JournalsWorkspaceShell title="Edit Journal">
        <LoadingState variant="form" />
      </JournalsWorkspaceShell>
    )
  }

  return (
    <JournalsWorkspaceShell
      title={mode === 'create' ? 'New Journal' : 'Edit Journal'}
      actions={
        <div className="flex flex-wrap gap-2">
          <ErpButton variant="secondary" onClick={() => navigate('/accounting/entries/journals')}>
            Cancel
          </ErpButton>
          <ErpButton variant="secondary" onClick={() => void onValidate()} disabled={saving}>
            Validate
          </ErpButton>
          {mode === 'edit' && perms.canSubmitVoucher ? (
            <ErpButton variant="secondary" onClick={() => void onSubmit()} disabled={saving}>
              Submit
            </ErpButton>
          ) : null}
          <ErpButton variant="primary" onClick={() => void onSave()} disabled={saving}>
            Save draft
          </ErpButton>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Document date">
            <Input type="date" {...form.register('documentDate')} />
          </FormField>
          <FormField label="Posting date">
            <Input type="date" {...form.register('postingDate')} />
          </FormField>
          <FormField label="Reference">
            <Input {...form.register('referenceNumber')} placeholder="Optional — draft ref auto-generated if empty" />
          </FormField>
          <FormField label="External reference">
            <Input {...form.register('externalReference')} />
          </FormField>
        </div>
        <FormField label="Narration">
          <Textarea rows={2} {...form.register('narration')} />
        </FormField>

        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="w-full min-w-[760px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-slate-50 text-left text-erp-muted">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Account</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
                <th className="px-2 py-2">Line narration</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b border-erp-border/70">
                  <td className="px-2 py-2">{index + 1}</td>
                  <td className="px-2 py-2">
                    <select
                      className="w-full rounded border border-erp-border px-2 py-1.5 text-[12px]"
                      value={lines[index]?.accountId ?? ''}
                      onChange={(e) => form.setValue(`lines.${index}.accountId`, e.target.value, { shouldDirty: true })}
                    >
                      <option value="">Select account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="text-right tabular-nums"
                      value={lines[index]?.debitAmount ?? '0'}
                      onChange={(e) => form.setValue(`lines.${index}.debitAmount`, e.target.value, { shouldDirty: true })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="text-right tabular-nums"
                      value={lines[index]?.creditAmount ?? '0'}
                      onChange={(e) => form.setValue(`lines.${index}.creditAmount`, e.target.value, { shouldDirty: true })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={lines[index]?.lineNarration ?? ''}
                      onChange={(e) => form.setValue(`lines.${index}.lineNarration`, e.target.value, { shouldDirty: true })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    {fields.length > 2 ? (
                      <button
                        type="button"
                        className="text-[11px] text-rose-700 hover:underline"
                        onClick={() => remove(index)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td colSpan={2} className="px-2 py-2">
                  Totals {totals.balanced ? '(balanced)' : '(unbalanced)'}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{totals.debit}</td>
                <td className="px-2 py-2 text-right tabular-nums">{totals.credit}</td>
                <td colSpan={2} className="px-2 py-2">
                  <button
                    type="button"
                    className="text-[12px] text-sky-700 hover:underline"
                    onClick={() => append({ accountId: '', debitAmount: '0', creditAmount: '0' })}
                  >
                    + Add line
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </form>
    </JournalsWorkspaceShell>
  )
}

export function JournalNewPage() {
  return <JournalFormPage mode="create" />
}

export function JournalEditPage() {
  return <JournalFormPage mode="edit" />
}
