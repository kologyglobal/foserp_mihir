import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Smartphone } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  acceptAssignment,
  completeAssignment,
  getMyWork,
  getWorkOrder,
  pauseAssignment,
  reportIssue,
  resumeAssignment,
  startAssignment,
} from '@/services/api/manufacturingApi'
import type { ProductionAssignment } from '@/types/manufacturingPhase2b'
import { useSetupLookup } from '../setup/useSetupLookups'
import { useManufacturingPhase2bPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { t } from '../i18n/operatorStrings'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'
import { OperatorTaskCard } from './OperatorTaskCard'
import { ProductionCompletionSheet } from './ProductionCompletionSheet'
import { QuickIssueSheet } from './QuickIssueSheet'

/** Operator My Work — mobile-first assignment queue (API mode only). */
export function MyWorkPage() {
  const perms = useManufacturingPhase2bPermissions()
  const { options: items } = useSetupLookup('items')
  const [assignments, setAssignments] = useState<ProductionAssignment[]>([])
  const [productByWo, setProductByWo] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<ProductionAssignment | null>(null)
  const [issueTarget, setIssueTarget] = useState<ProductionAssignment | null>(null)

  const itemLabel = useCallback(
    (itemId: string) => items.find((i) => i.id === itemId)?.label ?? 'Product',
    [items],
  )

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getMyWork({ limit: 50 })
      const rows = res.data
      setAssignments(rows)
      const woIds = [...new Set(rows.map((r) => r.productionOrderId))]
      const pairs = await Promise.all(
        woIds.map(async (id) => {
          try {
            const wo = await getWorkOrder(id)
            return [id, itemLabel(wo.data.productItemId)] as const
          } catch {
            return [id, 'Product'] as const
          }
        }),
      )
      setProductByWo(Object.fromEntries(pairs))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load my work')
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [itemLabel])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      setBusy(true)
      try {
        await fn()
        notify.success(okMsg)
        await load()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  const activeCards = useMemo(
    () => assignments.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED'),
    [assignments],
  )

  if (!isApiMode()) {
    return (
      <ProductionPageHeader title={t('myWork.title')} description="Your assigned production tasks">
        <EmptyState icon={Smartphone} title={t('myWork.title')} description={t('myWork.apiRequired')} />
      </ProductionPageHeader>
    )
  }

  if (!perms.canMyWork) {
    return (
      <ProductionPageHeader title={t('myWork.title')} description="Your assigned production tasks">
        <EmptyState icon={Smartphone} title="Access denied" description="Missing operator my-work permission." />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title={t('myWork.title')}
      description="Your assigned production tasks — start, pause, complete, or report problems."
      favoritePath="/manufacturing/my-work"
      secondaryActions={[{ id: 'refresh', label: t('myWork.refresh'), icon: RefreshCw, onClick: () => void load() }]}
    >
      {loading ? <LoadingState variant="card" rows={3} /> : null}
      {!loading && activeCards.length === 0 ? (
        <ProductionEmptyState icon={Smartphone} title={t('myWork.title')} description={t('myWork.empty')} />
      ) : null}
      {!loading && activeCards.length > 0 ? (
        <div className="mx-auto flex max-w-xl flex-col gap-3 pb-8">
          {activeCards.map((assignment) => (
            <OperatorTaskCard
              key={assignment.id}
              assignment={assignment}
              productLabel={productByWo[assignment.productionOrderId] ?? '—'}
              busy={busy}
              onAccept={() => void runAction(() => acceptAssignment(assignment.id), 'Assignment accepted')}
              onStart={() => void runAction(() => startAssignment(assignment.id), 'Work started')}
              onPause={() => void runAction(() => pauseAssignment(assignment.id, { startDowntime: true }), 'Work paused')}
              onResume={() => void runAction(() => resumeAssignment(assignment.id), 'Work resumed')}
              onComplete={() => setCompleteTarget(assignment)}
              onReportProblem={() => setIssueTarget(assignment)}
            />
          ))}
        </div>
      ) : null}

      <ProductionCompletionSheet
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        busy={busy}
        onSubmit={async (payload) => {
          if (!completeTarget) return
          await runAction(() => completeAssignment(completeTarget.id, payload), 'Assignment completed')
          setCompleteTarget(null)
        }}
      />

      <QuickIssueSheet
        open={Boolean(issueTarget)}
        assignment={issueTarget}
        onClose={() => setIssueTarget(null)}
        busy={busy}
        onSubmit={async (payload) => {
          await runAction(() => reportIssue(payload), 'Issue reported')
          setIssueTarget(null)
        }}
      />
    </ProductionPageHeader>
  )
}
