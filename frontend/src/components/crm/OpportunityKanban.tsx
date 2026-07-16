import { useMemo, useState } from 'react'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import type { Opportunity, OpportunityStage } from '../../types/crm'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { CLOSED_STAGES, resolveStageTheme } from '../../utils/crmStageTheme'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { useResolvedOpportunityStages } from '../../hooks/useCrmMasters'
import { OpportunityCard } from './OpportunityCard'
import { QuickFollowUpDrawer } from './QuickFollowUpDrawer'
import { LostDealFields } from './LostDealFields'
import { cn } from '../../utils/cn'

interface OpportunityKanbanProps {
  opportunities?: Opportunity[]
  showClosed?: boolean
}

export function OpportunityKanban({ opportunities: opportunitiesProp, showClosed = false }: OpportunityKanbanProps) {
  const storeOpportunities = useCrmStore((s) => s.opportunities)
  const opportunities = opportunitiesProp ?? storeOpportunities
  const moveOpportunityStage = useCrmStore((s) => s.moveOpportunityStage)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<OpportunityStage | null>(null)
  const [followUpOpp, setFollowUpOpp] = useState<Opportunity | null>(null)
  const [moveOpp, setMoveOpp] = useState<Opportunity | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [targetStage, setTargetStage] = useState<OpportunityStage>('qualified')
  const [manualWon, setManualWon] = useState(false)

  const stageOptions = useResolvedOpportunityStages()

  const visibleStages = useMemo(
    () => stageOptions.filter((s) => showClosed || !CLOSED_STAGES.has(s.id)),
    [showClosed, stageOptions],
  )

  const byStage = useMemo(() => {
    const map = new Map<OpportunityStage, Opportunity[]>()
    for (const stage of stageOptions) map.set(stage.id, [])
    for (const opp of opportunities) {
      if (opp.status === 'open' || opp.stage === 'won' || opp.stage === 'lost') {
        const list = map.get(opp.stage) ?? []
        list.push(opp)
        map.set(opp.stage, list)
      }
    }
    return map
  }, [opportunities, stageOptions])

  const handleDrop = (stage: OpportunityStage) => {
    setDragOverStage(null)
    if (!dragId) return
    const opp = opportunities.find((o) => o.id === dragId)
    if (!opp) return
    if (opp.stage === stage) {
      setDragId(null)
      return
    }
    if (stage === 'lost') {
      setMoveOpp(opp)
      setTargetStage('lost')
      setDragId(null)
      return
    }
    if (stage === 'won') {
      setMoveOpp(opp)
      setTargetStage('won')
      setDragId(null)
      return
    }
    const opportunityId = dragId
    setDragId(null)
    void (async () => {
      const r = await resolveStoreAction(moveOpportunityStage({ opportunityId, stage }))
      if (r.ok) {
        notify.success(`Moved to ${opportunityStageLabel(stage)}`)
      } else {
        notify.failed(r.error ?? 'Could not move opportunity')
      }
    })()
  }

  const confirmMove = () => {
    if (!moveOpp) return
    const opportunityId = moveOpp.id
    const stage = targetStage
    const reason = targetStage === 'lost' ? lostReason : undefined
    const manualWonApproval = targetStage === 'won' ? manualWon : undefined
    void (async () => {
      const r = await resolveStoreAction(
        moveOpportunityStage({
          opportunityId,
          stage,
          lostReason: reason,
          manualWonApproval,
        }),
      )
      if (r.ok) {
        notify.success(`Moved to ${opportunityStageLabel(stage)}`)
        setMoveOpp(null)
        setLostReason('')
        setManualWon(false)
      } else {
        notify.failed(r.error ?? 'Could not move opportunity')
      }
    })()
  }

  return (
    <div className="crm-opp-kanban">
      <div className="crm-opp-kanban__board">
        {visibleStages.map((stage) => {
          const cards = byStage.get(stage.id) ?? []
          const value = cards.reduce((s, c) => s + c.value, 0)
          const weighted = cards.reduce((s, c) => s + c.value * (c.probability / 100), 0)
          const theme = resolveStageTheme(stage.id)
          const isDropTarget = dragOverStage === stage.id

          return (
            <div
              key={stage.id}
              className={cn(
                'crm-opp-kanban__column',
                isDropTarget && 'crm-opp-kanban__column--drop',
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverStage(stage.id)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null)
              }}
              onDrop={() => handleDrop(stage.id)}
            >
              <header className={cn('crm-opp-kanban__column-head', theme.header)}>
                <div className={cn('crm-opp-kanban__column-accent', theme.accent)} />
                <div className="crm-opp-kanban__column-head-inner">
                  <div className="min-w-0">
                    <h3 className="crm-opp-kanban__column-title">{stage.label}</h3>
                    <p className="crm-opp-kanban__column-metrics">
                      {formatCrmCurrency(value)}
                      {cards.length > 0 ? (
                        <span className="crm-opp-kanban__column-weighted">· wt {formatCrmCurrency(weighted)}</span>
                      ) : null}
                    </p>
                  </div>
                  <span className={cn('crm-opp-kanban__column-count', theme.pill)}>{cards.length}</span>
                </div>
              </header>

              <div className="crm-opp-kanban__column-body">
                {cards.length === 0 ? (
                  <div className={cn('crm-opp-kanban__empty', isDropTarget && 'crm-opp-kanban__empty--active')}>
                    <p>Drop deals here</p>
                  </div>
                ) : (
                  cards.map((opp) => (
                    <OpportunityCard
                      key={opp.id}
                      opportunity={opp}
                      draggable
                      variant="kanban"
                      onDragStart={(_, id) => setDragId(id)}
                      onQuickFollowUp={setFollowUpOpp}
                      onMoveStage={(o) => {
                        setMoveOpp(o)
                        setTargetStage(o.stage)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <QuickFollowUpDrawer
        open={!!followUpOpp}
        onClose={() => setFollowUpOpp(null)}
        context={
          followUpOpp
            ? {
                customerId: followUpOpp.customerId,
                contactId: followUpOpp.contactId,
                opportunityId: followUpOpp.id,
                assignedTo: followUpOpp.ownerId,
                assignedToName: followUpOpp.ownerName,
              }
            : undefined
        }
      />

      {moveOpp ? (
        <div className="crm-opp-move-modal">
          <div className="crm-opp-move-modal__panel">
            <h3 className="crm-opp-move-modal__title">Move deal</h3>
            <p className="crm-opp-move-modal__deal">{moveOpp.opportunityName}</p>
            <label className="block text-sm">
              <span className="font-medium text-erp-text">Stage</span>
              <select
                className="erp-input mt-1 w-full"
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value as OpportunityStage)}
              >
                {stageOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            {targetStage === 'lost' ? (
              <LostDealFields className="mt-3" value={lostReason} onChange={setLostReason} />
            ) : null}
            {targetStage === 'won' ? (
              <label className="flex items-center gap-2 text-sm text-erp-text">
                <input type="checkbox" checked={manualWon} onChange={(e) => setManualWon(e.target.checked)} />
                Manual approval (no approved quotation)
              </label>
            ) : null}
            <div className="crm-opp-move-modal__actions">
              <button type="button" className="crm-opp-move-modal__btn" onClick={() => setMoveOpp(null)}>
                Cancel
              </button>
              <button type="button" className="crm-opp-move-modal__btn crm-opp-move-modal__btn--primary" onClick={confirmMove}>
                Confirm move
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
