import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Smartphone } from 'lucide-react'
import { MobilePageTitle } from '@/components/mobile'
import { isApiMode } from '@/config/apiConfig'
import {
  acceptAssignment,
  completeAssignment,
  getShopfloorKioskMyWork,
  pauseAssignment,
  reportIssue,
  resumeAssignment,
  startAssignment,
  type ShopfloorKioskCard,
} from '@/services/api/manufacturingApi'
import type { ProductionAssignment } from '@/types/manufacturingPhase2b'
import { useManufacturingPhase2bPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { t } from '@/modules/manufacturing/i18n/operatorStrings'
import { OperatorTaskCard } from '@/modules/manufacturing/operator/OperatorTaskCard'
import { ProductionCompletionSheet } from '@/modules/manufacturing/operator/ProductionCompletionSheet'
import { QuickIssueSheet } from '@/modules/manufacturing/operator/QuickIssueSheet'
import { kioskPrimaryBtn, kioskSecondaryBtn } from './kioskCss'

function toAssignment(card: ShopfloorKioskCard): ProductionAssignment {
  return {
    id: card.id,
    tenantId: '',
    productionOrderId: card.productionOrderId,
    stageId: card.stageId,
    operationId: card.operationId,
    userId: null,
    employeeId: null,
    machineId: null,
    workCentreId: null,
    assignmentDate: card.assignmentDate ?? '',
    plannedStartAt: null,
    plannedEndAt: null,
    shiftCode: null,
    shiftLabel: null,
    assignedQuantity: card.assignedQuantity,
    completedQuantity: card.completedQuantity,
    status: card.status as ProductionAssignment['status'],
    assignedBy: null,
    acceptedAt: null,
    startedAt: card.startedAt,
    pausedAt: card.pausedAt,
    completedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    notes: null,
    workInstruction: card.workInstruction,
    reassignedFromId: null,
    createdAt: '',
    updatedAt: '',
    stage: card.stageName
      ? { id: card.stageId, code: card.stageCode ?? '', name: card.stageName }
      : undefined,
    operation: card.operationId
      ? { id: card.operationId, code: card.operationCode ?? '', name: card.operationName ?? '' }
      : undefined,
    machine: card.machineLabel ? { id: '', code: '', name: card.machineLabel } : undefined,
    workCentre: card.workCentreLabel ? { id: '', code: '', name: card.workCentreLabel } : undefined,
    productionOrder: {
      id: card.productionOrderId,
      orderNumber: card.workOrderNo,
      status: '',
      productItemId: card.productItemId,
      productItem: card.productItemId
        ? { id: card.productItemId, code: card.productCode ?? '', name: card.productName ?? card.productLabel }
        : null,
    },
    allowedActions: card.allowedActions,
  }
}

/** Live shopfloor kiosk — assignment start / hold / resume / complete via kiosk API. */
export function MobileShopfloorKioskPage() {
  const perms = useManufacturingPhase2bPermissions()
  const [cards, setCards] = useState<ShopfloorKioskCard[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<ProductionAssignment | null>(null)
  const [issueTarget, setIssueTarget] = useState<ProductionAssignment | null>(null)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getShopfloorKioskMyWork({ limit: 50 })
      setCards(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load shopfloor work')
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [])

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

  const activeAssignments = useMemo(
    () =>
      cards
        .filter((c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED')
        .map(toAssignment),
    [cards],
  )

  if (!isApiMode()) {
    return (
      <div className="mob-kiosk">
        <MobilePageTitle title="Shopfloor Kiosk" subtitle="API required" />
        <div className="mob-card text-center">
          <Smartphone className="mx-auto mb-2 h-8 w-8 text-[#605e5c]" aria-hidden />
          <p className="font-semibold">{t('myWork.apiRequired')}</p>
          <p className="mt-2 text-sm text-[#605e5c]">Set VITE_USE_API=true and sign in as an operator with assignments.</p>
          <Link to="/m/kiosk" className={`${kioskSecondaryBtn} mt-4`}>
            Back to kiosk
          </Link>
        </div>
      </div>
    )
  }

  if (!perms.canMyWork) {
    return (
      <div className="mob-kiosk">
        <MobilePageTitle title="Shopfloor Kiosk" subtitle="Access denied" />
        <div className="mob-card text-sm text-[#605e5c]">
          Missing permission <code>manufacturing.operator.my_work</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="mob-kiosk space-y-3">
      <div className="flex items-start justify-between gap-2">
        <MobilePageTitle title="My Shopfloor Work" subtitle="Start · Hold · Complete" />
        <button
          type="button"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[#edebe9] bg-white"
          onClick={() => void load()}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        </button>
      </div>

      <Link to="/m/kiosk" className="text-sm font-semibold text-[#0078d4]">
        ← Kiosk home
      </Link>
      <Link to="/m/qc" className={kioskSecondaryBtn}>
        Open Quality / QC
      </Link>

      {loading ? <div className="mob-card text-center text-[#605e5c]">Loading assignments…</div> : null}

      {!loading && activeAssignments.length === 0 ? (
        <div className="mob-card text-center">
          <p className="font-semibold">{t('myWork.empty')}</p>
          <p className="mt-1 text-sm text-[#605e5c]">Ask a supervisor to assign a stage/operation to you.</p>
          <button type="button" className={`${kioskPrimaryBtn} mt-4`} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      ) : null}

      {!loading &&
        activeAssignments.map((assignment) => (
          <OperatorTaskCard
            key={assignment.id}
            assignment={assignment}
            productLabel={
              assignment.productionOrder?.productItem
                ? `${assignment.productionOrder.productItem.code} · ${assignment.productionOrder.productItem.name}`
                : cards.find((c) => c.id === assignment.id)?.productLabel ?? '—'
            }
            busy={busy}
            onAccept={() => void runAction(() => acceptAssignment(assignment.id), 'Accepted')}
            onStart={() => void runAction(() => startAssignment(assignment.id), 'Started')}
            onPause={() => void runAction(() => pauseAssignment(assignment.id, { startDowntime: true }), 'On hold')}
            onResume={() => void runAction(() => resumeAssignment(assignment.id), 'Resumed')}
            onComplete={() => setCompleteTarget(assignment)}
            onReportProblem={() => setIssueTarget(assignment)}
          />
        ))}

      <ProductionCompletionSheet
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        busy={busy}
        onSubmit={async (payload) => {
          if (!completeTarget) return
          await runAction(() => completeAssignment(completeTarget.id, payload), 'Completed')
          setCompleteTarget(null)
        }}
      />

      <QuickIssueSheet
        open={Boolean(issueTarget)}
        assignment={issueTarget}
        onClose={() => setIssueTarget(null)}
        busy={busy}
        onSubmit={async (payload) => {
          await runAction(() => reportIssue(payload), 'Problem reported')
          setIssueTarget(null)
        }}
      />
    </div>
  )
}
