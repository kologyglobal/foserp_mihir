import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { ErpCardSection, ErpFieldRow } from '@/components/erp/card-form'
import { Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import {
  createQualityInspection,
  getGRNById,
  PurchaseServiceError,
} from '@/services/purchase'
import {
  listInspectionPlans,
  type QualityInspectionPlan,
} from '@/services/api/qualityApi'
import type { GoodsReceiptNote } from '@/types/purchaseDomain'
import { isApiMode } from '@/config/apiConfig'
import { notify } from '@/store/toastStore'
import { formatDate } from '@/utils/dates/format'

/**
 * Create Purchase QI from GRN with optional Inspection Plan picker.
 * API mode: ACTIVE INCOMING plans listed; auto-suggests item-matched plan.
 * Without a plan, backend still auto-resolves INCOMING plan (item → category → generic).
 * QI lines come from all QC-required GRN lines (same as API create without lines[]).
 */
export function QualityInspectionCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const grnId = searchParams.get('grnId') ?? ''
  const planFromQuery = searchParams.get('inspectionPlanId') ?? ''

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [grn, setGrn] = useState<GoodsReceiptNote | null>(null)
  const [plans, setPlans] = useState<QualityInspectionPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(planFromQuery)
  const [suggestedPlanId, setSuggestedPlanId] = useState<string | null>(null)

  useEffect(() => {
    if (!grnId) {
      setError('Missing goods receipt id (?grnId=).')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const row = await getGRNById(grnId)
        if (cancelled) return
        if (!row) {
          setError('Goods receipt not found.')
          return
        }
        if (!row.inspectionRequired) {
          setError('This GRN does not require quality inspection.')
          return
        }
        if (row.qualityInspectionId) {
          notify.info('Opening existing quality inspection for this GRN')
          navigate(`/purchase/quality-inspections/${row.qualityInspectionId}`, { replace: true })
          return
        }
        if (!row.lines.length) {
          setError('GRN has no lines to inspect.')
          return
        }
        setGrn(row)

        const firstItemId =
          row.lines.find((l) => l.qcRequired && l.itemId)?.itemId ||
          row.lines.find((l) => l.inspectionStatus === 'pending' && l.itemId)?.itemId ||
          row.lines.find((l) => l.itemId)?.itemId ||
          null

        if (isApiMode()) {
          try {
            const res = await listInspectionPlans({
              status: 'ACTIVE',
              category: 'INCOMING',
              limit: 200,
            })
            if (cancelled) return
            const activeIncoming = (res.data ?? []).filter(
              (p) => p.status === 'ACTIVE' && p.category === 'INCOMING',
            )
            setPlans(activeIncoming)

            // Prefer item-specific → category-scoped → fully generic INCOMING plan.
            let suggested: string | null = null
            if (firstItemId) {
              const byItem = activeIncoming.find((p) => p.itemId === firstItemId)
              if (byItem) suggested = byItem.id
            }
            if (!suggested) {
              const byCategoryOnly = activeIncoming.find(
                (p) => !p.itemId && Boolean(p.itemCategoryId),
              )
              const fullyGeneric = activeIncoming.find((p) => !p.itemId && !p.itemCategoryId)
              suggested = fullyGeneric?.id ?? byCategoryOnly?.id ?? activeIncoming[0]?.id ?? null
            }
            setSuggestedPlanId(suggested)
            if (!planFromQuery && suggested) {
              setSelectedPlanId(suggested)
            } else if (planFromQuery) {
              setSelectedPlanId(planFromQuery)
            }
          } catch {
            // Plans optional — backend can still auto-resolve or use defaults.
            setPlans([])
          }
        } else {
          // Demo: no plan master list — create still works with free-text / defaults.
          setPlans([])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof PurchaseServiceError ? err.message : 'Failed to load goods receipt')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [grnId, planFromQuery, navigate])

  const qcLines = useMemo(() => {
    if (!grn) return []
    const pending = grn.lines.filter(
      (l) =>
        l.qcRequired ||
        l.inspectionStatus === 'pending' ||
        Number(l.pendingInspectionQty) > 0,
    )
    return pending.length > 0 ? pending : grn.lines
  }, [grn])

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  const createQi = async () => {
    if (!grn || creating) return
    setCreating(true)
    try {
      // Omit goodsReceiptLineId / sampleQty so backend expands all QC-required GRN lines.
      const qi = await createQualityInspection({
        goodsReceiptId: grn.id,
        inspectionPlanId: selectedPlanId || null,
        inspectionPlan: selectedPlan
          ? `${selectedPlan.planCode} — ${selectedPlan.planName}`
          : undefined,
      })
      notify.success(
        selectedPlan
          ? `Inspection ${qi.documentNumber} created · plan ${selectedPlan.planCode}`
          : `Inspection ${qi.documentNumber} created`,
      )
      navigate(`/purchase/quality-inspections/${qi.id}`, { replace: true })
    } catch (err) {
      if (err instanceof PurchaseServiceError && err.code === 'QI_DUPLICATE_FOR_GRN') {
        const again = await getGRNById(grnId)
        if (again?.qualityInspectionId) {
          notify.info(err.message)
          navigate(`/purchase/quality-inspections/${again.qualityInspectionId}`, { replace: true })
          return
        }
      }
      notify.error(
        err instanceof PurchaseServiceError ? err.message : 'Failed to create inspection',
      )
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <LoadingState variant="form" rows={6} />
  }

  if (error || !grn) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Cannot create inspection"
        description={error ?? 'Unknown error'}
        action={
          <ErpButton variant="secondary" onClick={() => navigate('/purchase/quality-inspections')}>
            Back to register
          </ErpButton>
        }
      />
    )
  }

  return (
    <PurchaseCardFormShell
      title="New Quality Inspection"
      description="Select an inspection plan (template) then create the QI from the goods receipt."
      status="Draft"
      favoritePath="/purchase/quality-inspections/new"
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'Quality Inspections', to: '/purchase/quality-inspections' },
        { label: 'New' },
      ]}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <ErpButton
            variant="secondary"
            onClick={() => navigate(grnId ? `/purchase/grn/${grnId}` : '/purchase/quality-inspections')}
          >
            Cancel
          </ErpButton>
          <ErpButton
            variant="primary"
            disabled={creating}
            onClick={() => void createQi()}
          >
            {creating ? 'Creating…' : 'Create inspection'}
          </ErpButton>
        </div>
      }
    >
      <ErpCardSection title="Goods receipt" collapsible defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ErpFieldRow label="GRN">
            <span className="text-[13px] font-semibold">{grn.documentNumber}</span>
          </ErpFieldRow>
          <ErpFieldRow label="Vendor">
            <span className="text-[13px]">{grn.vendor?.name ?? '—'}</span>
          </ErpFieldRow>
          <ErpFieldRow label="Receipt date">
            <span className="text-[13px]">
              {grn.documentDate ? formatDate(grn.documentDate) : '—'}
            </span>
          </ErpFieldRow>
          <ErpFieldRow label="QC lines">
            <span className="font-mono text-[12px]">
              {qcLines.length > 0
                ? `${qcLines.length} line${qcLines.length === 1 ? '' : 's'} · ${qcLines
                    .slice(0, 3)
                    .map((l) => l.itemCode || '—')
                    .join(', ')}${qcLines.length > 3 ? '…' : ''}`
                : '—'}
            </span>
          </ErpFieldRow>
        </div>
      </ErpCardSection>

      <ErpCardSection title="Inspection plan (QC template)" collapsible defaultOpen>
        <p className="mb-3 text-[12px] text-erp-muted">
          Plans are defined under <strong>Quality → Inspection Plans</strong> (category{' '}
          <span className="font-mono">INCOMING</span>). Parameter lines are snapshotted onto this
          Purchase QI (not live-linked). Leave empty to use backend auto-resolve or default
          checklist.
        </p>
        <ErpFieldRow label="Inspection plan" required={false}>
          <Select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full max-w-xl"
          >
            <option value="">{SELECT_PLACEHOLDER} (auto / default checklist)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.planCode} — {p.planName}
                {p.itemId ? ' · item-specific' : ''}
                {suggestedPlanId === p.id ? ' · suggested' : ''}
                {` (${p.lines?.length ?? 0} params)`}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        {selectedPlan ? (
          <ul className="mt-3 max-w-xl space-y-1 rounded border border-erp-border bg-erp-surface-alt/40 px-3 py-2 text-[12px]">
            <li className="font-semibold text-erp-text">
              Checklist preview ({selectedPlan.lines?.length ?? 0} parameters)
            </li>
            {(selectedPlan.lines ?? []).slice(0, 12).map((line) => (
              <li key={line.id || line.parameterId} className="font-mono text-erp-muted">
                {line.parameter?.parameterCode || line.parameterId}
                {line.parameter?.parameterName
                  ? ` — ${line.parameter.parameterName}`
                  : ''}
              </li>
            ))}
            {(selectedPlan.lines?.length ?? 0) > 12 ? (
              <li className="text-erp-muted">…and more</li>
            ) : null}
          </ul>
        ) : plans.length === 0 && isApiMode() ? (
          <p className="mt-2 text-[12px] text-amber-800">
            No ACTIVE <span className="font-mono">INCOMING</span> plans found. Create one under
            Quality → Inspection Plans, or create this QI without a plan (default parameters).
          </p>
        ) : null}
      </ErpCardSection>
    </PurchaseCardFormShell>
  )
}
