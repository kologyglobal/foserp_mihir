import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import type { ProductionAssignment, ReportIssuePayload } from '@/types/manufacturingPhase2b'
import { ISSUE_SEVERITY_VALUES, ISSUE_TYPE_LABELS, ISSUE_TYPE_VALUES } from '@/types/manufacturingPhase2b'
import { t } from '../i18n/operatorStrings'
import { operatorBtnPrimary, operatorBtnSecondary } from './operatorCss'

interface QuickIssueSheetProps {
  open: boolean
  assignment: ProductionAssignment | null
  onClose: () => void
  busy?: boolean
  onSubmit: (payload: ReportIssuePayload) => Promise<void> | void
}

/** Operator quick issue report from an assignment context. */
export function QuickIssueSheet({ open, assignment, onClose, busy, onSubmit }: QuickIssueSheetProps) {
  const [issueType, setIssueType] = useState<(typeof ISSUE_TYPE_VALUES)[number]>('OTHER')
  const [severity, setSeverity] = useState<(typeof ISSUE_SEVERITY_VALUES)[number]>('MEDIUM')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [productionBlocked, setProductionBlocked] = useState(false)

  useEffect(() => {
    if (!open) return
    setIssueType('OTHER')
    setSeverity('MEDIUM')
    setTitle('')
    setDescription('')
    setProductionBlocked(false)
  }, [open])

  const canSubmit = title.trim().length > 0 && !busy

  const submit = async () => {
    if (!assignment || !canSubmit) return
    await onSubmit({
      productionOrderId: assignment.productionOrderId,
      stageId: assignment.stageId,
      operationId: assignment.operationId ?? undefined,
      assignmentId: assignment.id,
      workCentreId: assignment.workCentreId ?? undefined,
      machineId: assignment.machineId ?? undefined,
      issueType,
      severity,
      title: title.trim(),
      description: description.trim() || undefined,
      productionBlocked,
      startDowntime: true,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('issue.quickTitle')}
      closeDisabled={busy}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={operatorBtnSecondary} onClick={onClose} disabled={busy}>
            {t('completion.cancel')}
          </button>
          <button type="button" className={operatorBtnPrimary} onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? '…' : t('issue.submit')}
          </button>
        </div>
      }
    >
      <div className="grid gap-3">
        <FormField label={t('issue.type')} required>
          <Select value={issueType} onChange={(e) => setIssueType(e.target.value as typeof issueType)} className="min-h-12">
            {ISSUE_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {ISSUE_TYPE_LABELS[v]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('issue.severity')}>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="min-h-12">
            {ISSUE_SEVERITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('issue.title')} required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-12" />
        </FormField>
        <FormField label={t('issue.description')}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </FormField>
        <label className="flex min-h-12 items-center gap-2 text-[13px] font-medium text-erp-text">
          <input type="checkbox" checked={productionBlocked} onChange={(e) => setProductionBlocked(e.target.checked)} />
          {t('issue.blockProduction')}
        </label>
      </div>
    </Modal>
  )
}
