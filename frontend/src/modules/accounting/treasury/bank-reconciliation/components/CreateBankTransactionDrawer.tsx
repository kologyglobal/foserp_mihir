import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { classifyStatementLine, createAdjustmentFromStatementLine } from '../../adjustments/api/treasury-adjustment.api'
import type {
  AdjustmentLineInput,
  ClassifyStatementLineResultDto,
  TreasuryAdjustmentType,
} from '../../adjustments/api/treasury-adjustment.types'
import { ADJUSTMENT_TYPE_LABELS } from '../../adjustments/utils/treasuryAdjustmentUi'
import type { StatementLineDto } from '../api/bank-reconciliation.types'
import { parseDecimal } from '../utils/bankReconciliationUi'
import { useIdempotencyKey } from '../utils/idempotency'

export interface CreateBankTransactionDrawerProps {
  open: boolean
  onClose: () => void
  statementId: string
  legalEntityId: string
  line: StatementLineDto | null
  onCreated?: (adjustmentId: string) => void
}

const TYPE_OPTIONS = Object.entries(ADJUSTMENT_TYPE_LABELS) as Array<[TreasuryAdjustmentType, string]>

/**
 * Statement-led treasury adjustment draft creator.
 * Classifies the unmatched line (when rules match), lets the user confirm type/offset,
 * then creates a DRAFT only — never posts.
 */
export function CreateBankTransactionDrawer({
  open,
  onClose,
  statementId,
  legalEntityId,
  line,
  onCreated,
}: CreateBankTransactionDrawerProps) {
  const navigate = useNavigate()
  const resolveKey = useIdempotencyKey(`stmt-adj:${statementId}:${line?.id ?? ''}`)

  const [classifying, setClassifying] = useState(false)
  const [classification, setClassification] = useState<ClassifyStatementLineResultDto | null>(null)
  const [classifyError, setClassifyError] = useState<string | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<TreasuryAdjustmentType>('BANK_CHARGES')
  const [offsetAccountId, setOffsetAccountId] = useState('')
  const [narration, setNarration] = useState('')
  const [postingDate, setPostingDate] = useState('')
  const [saving, setSaving] = useState(false)

  const bankAmount = line ? parseDecimal(line.remainingAmount) : 0
  const directionLabel = line?.direction === 'DEBIT' ? 'Bank Debit (money out)' : 'Bank Credit (money in)'

  useEffect(() => {
    if (!open || !line) return
    setClassification(null)
    setClassifyError(null)
    setOffsetAccountId('')
    setNarration(line.description ?? '')
    setPostingDate(line.transactionDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
    setAdjustmentType(line.direction === 'CREDIT' ? 'BANK_INTEREST_INCOME' : 'BANK_CHARGES')

    setClassifying(true)
    classifyStatementLine(statementId, line.id, { legalEntityId })
      .then((result) => {
        setClassification(result)
        setAdjustmentType(result.adjustmentType)
        if (result.lineTemplate.accountId) setOffsetAccountId(result.lineTemplate.accountId)
        if (result.lineTemplate.narration) setNarration(result.lineTemplate.narration)
      })
      .catch((e) => {
        setClassifyError(e instanceof Error ? e.message : 'No posting rule matched — select type manually')
      })
      .finally(() => setClassifying(false))
  }, [open, line, statementId, legalEntityId])

  const suggestedLine = useMemo((): AdjustmentLineInput | null => {
    if (!line) return null
    const template = classification?.lineTemplate
    const amount = bankAmount.toFixed(2)
    return {
      lineType: template?.lineType ?? (line.direction === 'DEBIT' ? 'EXPENSE' : 'INCOME'),
      accountId: offsetAccountId || template?.accountId || null,
      mappingKey: template?.mappingKey ?? null,
      description: template?.description ?? line.description ?? 'Bank transaction',
      amount,
      gstTreatment: template?.gstTreatment ?? 'GST_NOT_APPLICABLE',
      gstRate: template?.gstRate ?? null,
      gstAccountId: template?.gstAccountId ?? null,
      gstMappingKey: template?.gstMappingKey ?? null,
      tdsTreatment: template?.tdsTreatment ?? 'TDS_NOT_APPLICABLE',
      tdsRate: template?.tdsRate ?? null,
      tdsAccountId: template?.tdsAccountId ?? null,
      tdsMappingKey: template?.tdsMappingKey ?? null,
      narration: narration || template?.narration || null,
    }
  }, [line, classification, offsetAccountId, bankAmount, narration])

  if (!open || !line) return null

  const createDraft = async () => {
    if (!suggestedLine) return
    if (!suggestedLine.accountId && !suggestedLine.mappingKey) {
      notify.error('Offset account is required (or configure a posting rule with a mapping key)')
      return
    }
    setSaving(true)
    try {
      const created = await createAdjustmentFromStatementLine(statementId, line.id, {
        legalEntityId,
        adjustmentType,
        adjustmentDate: postingDate,
        currencyCode: 'INR',
        narration: narration || line.description || null,
        idempotencyKey: resolveKey(),
        lines: [suggestedLine],
      })
      notify.success('Bank transaction draft created — review and post from the adjustment detail')
      onCreated?.(created.id)
      onClose()
      navigate(`/accounting/bank-cash/treasury-adjustments/${created.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create bank transaction draft')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Create Bank Transaction">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-erp-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-erp-text">Create Bank Transaction</h2>
            <p className="text-[12px] text-erp-muted">Creates a draft only — posting and reconciliation stay separate.</p>
          </div>
          <button type="button" className="rounded p-1 text-erp-muted hover:bg-erp-surface" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-[13px]">
          <section className="rounded-lg border border-erp-border bg-erp-surface/40 p-3 space-y-1.5">
            <Row label="Statement date" value={line.transactionDate?.slice(0, 10) ?? '—'} />
            <Row label="Description" value={line.description || '—'} />
            <Row label="Reference" value={line.referenceNumber || '—'} />
            <Row label="Direction" value={directionLabel} />
            <Row label="Unmatched amount" value={formatCurrency(bankAmount)} emphasize />
          </section>

          {classifying ? <LoadingState variant="form" /> : null}

          {classification ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1">
              <p className="text-[12px] font-semibold text-emerald-900">Suggested classification</p>
              <Row label="Rule" value={classification.ruleName} />
              <Row label="Type" value={ADJUSTMENT_TYPE_LABELS[classification.adjustmentType]} />
              <Row label="Keywords" value={classification.matchedKeywords.join(', ') || '—'} />
              <Row label="Candidates" value={String(classification.candidateCount)} />
            </section>
          ) : null}

          {classifyError ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{classifyError}</p>
          ) : null}

          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-erp-muted">Transaction type</span>
            <Select
              className="h-9 w-full text-[13px]"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value as TreasuryAdjustmentType)}
            >
              {TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-erp-muted">Posting date</span>
            <input
              type="date"
              className="h-9 w-full rounded border border-erp-border px-2 text-[13px]"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-erp-muted">Offset account ID</span>
            <input
              type="text"
              className="h-9 w-full rounded border border-erp-border px-2 font-mono text-[12px]"
              value={offsetAccountId}
              onChange={(e) => setOffsetAccountId(e.target.value)}
              placeholder="UUID — or leave blank if rule supplies mappingKey"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-erp-muted">Narration</span>
            <textarea
              className="min-h-[72px] w-full rounded border border-erp-border px-2 py-1.5 text-[13px]"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </label>

          <p className="text-[11px] text-erp-muted">
            Bank amount is read-only from the statement line. Accounting preview and posting happen on the draft detail page.
          </p>
        </div>

        <footer className="border-t border-erp-border px-4 py-3">
          <ErpButtonGroup>
            <ErpButton variant="ghost" onClick={onClose}>
              Cancel
            </ErpButton>
            <ErpButton loading={saving} disabled={classifying} onClick={() => void createDraft()}>
              Create Draft
            </ErpButton>
          </ErpButtonGroup>
        </footer>
      </div>
    </div>
  )
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-erp-muted">{label}</span>
      <span className={emphasize ? 'font-semibold tabular-nums text-erp-text' : 'text-right text-erp-text'}>{value}</span>
    </div>
  )
}
