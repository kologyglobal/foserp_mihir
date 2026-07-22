import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Plus, RefreshCw, Save } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import {
  addDailyProductionLine,
  createDailyProductionBatch,
  getDailyProductionBatch,
  getWorkOrderDetail,
  listDailyProductionBatches,
  listWorkOrders,
  removeDailyProductionLine,
  submitDailyProductionBatch,
  updateDailyProductionLine,
  validateDailyProductionBatch,
} from '@/services/api/manufacturingApi'
import type { ProductionOrder, ProductionOrderStage } from '@/types/manufacturingProduction'
import type { DailyProductionBatch } from '@/types/manufacturingPhase2b'
import { DAILY_BATCH_STATUS_LABELS } from '@/types/manufacturingPhase2b'
import { useManufacturingPhase2bPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { formatDate } from '@/utils/dates/format'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { t } from '../i18n/operatorStrings'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'
import { DailyProductionGrid } from './DailyProductionGrid'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function batchStatusTone(
  status: DailyProductionBatch['status'],
): 'neutral' | 'success' | 'live' | 'warning' | 'critical' | 'info' | 'pending' {
  switch (status) {
    case 'DRAFT':
      return 'neutral'
    case 'SUBMITTED':
      return 'success'
    case 'PARTIALLY_REVERSED':
      return 'warning'
    case 'REVERSED':
      return 'critical'
    default:
      return 'neutral'
  }
}

/** Supervisor daily production update — batch header + line grid (API mode). */
export function DailyUpdatePage() {
  const perms = useManufacturingPhase2bPermissions()
  const [batches, setBatches] = useState<DailyProductionBatch[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [batch, setBatch] = useState<DailyProductionBatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [woId, setWoId] = useState('')
  const [stageId, setStageId] = useState('')
  const [good, setGood] = useState('1')
  const [activeOrders, setActiveOrders] = useState<ProductionOrder[]>([])
  const [woStages, setWoStages] = useState<ProductionOrderStage[]>([])
  const [stagesLoading, setStagesLoading] = useState(false)

  useEffect(() => {
    if (!addOpen || activeOrders.length > 0) return
    listWorkOrders({ status: 'IN_PROGRESS', limit: 100 })
      .then((res) => setActiveOrders(res.data))
      .catch(() => setActiveOrders([]))
  }, [addOpen, activeOrders.length])

  useEffect(() => {
    setStageId('')
    setWoStages([])
    if (!woId) return
    setStagesLoading(true)
    getWorkOrderDetail(woId)
      .then((res) => {
        const stages = res.data.stages
          .filter((s) => ['READY', 'IN_PROGRESS'].includes(s.status))
          .sort((a, b) => a.displayOrder - b.displayOrder)
        setWoStages(stages)
        if (stages.length === 1) setStageId(stages[0].id)
      })
      .catch(() => setWoStages([]))
      .finally(() => setStagesLoading(false))
  }, [woId])

  const loadList = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listDailyProductionBatches({ productionDate: todayIsoDate(), limit: 20 })
      setBatches(res.data)
      if (res.data.length > 0 && !selectedId) setSelectedId(res.data[0].id)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load daily batches')
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  const loadBatch = useCallback(async (id: string) => {
    try {
      const res = await getDailyProductionBatch(id)
      setBatch(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load batch')
      setBatch(null)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedId) void loadBatch(selectedId)
    else setBatch(null)
  }, [loadBatch, selectedId])

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      setBusy(true)
      try {
        await fn()
        notify.success(okMsg)
        await loadList()
        if (selectedId) await loadBatch(selectedId)
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusy(false)
      }
    },
    [loadBatch, loadList, selectedId],
  )

  const saveLines = useCallback(async () => {
    if (!batch || batch.status !== 'DRAFT') return
    await run(async () => {
      for (const line of batch.lines ?? []) {
        await updateDailyProductionLine(batch.id, line.id, {
          productionOrderId: line.productionOrderId,
          stageId: line.stageId,
          operationId: line.operationId ?? undefined,
          assignmentId: line.assignmentId ?? undefined,
          goodQuantity: Number(line.goodQuantity) || 0,
          reworkQuantity: Number(line.reworkQuantity) || 0,
          rejectedQuantity: Number(line.rejectedQuantity) || 0,
          scrapQuantity: Number(line.scrapQuantity) || 0,
          remarks: line.remarks ?? undefined,
          idempotencyKey: line.idempotencyKey,
        })
      }
    }, 'Draft saved')
  }, [batch, run])

  const lineTotals = useMemo(() => {
    const lines = batch?.lines ?? []
    return lines.reduce(
      (acc, line) => ({
        good: acc.good + (Number(line.goodQuantity) || 0),
        rework: acc.rework + (Number(line.reworkQuantity) || 0),
        rejected: acc.rejected + (Number(line.rejectedQuantity) || 0),
        scrap: acc.scrap + (Number(line.scrapQuantity) || 0),
        count: acc.count + 1,
      }),
      { good: 0, rework: 0, rejected: 0, scrap: 0, count: 0 },
    )
  }, [batch])

  if (!isApiMode()) {
    return (
      <ProductionPageHeader title={t('dailyUpdate.title')} description="Daily Production Update">
        <EmptyState icon={ClipboardList} title={t('dailyUpdate.title')} description={t('dailyUpdate.apiRequired')} />
      </ProductionPageHeader>
    )
  }

  if (!perms.canViewDailyProduction) {
    return (
      <ProductionPageHeader title={t('dailyUpdate.title')} description="Daily Production Update">
        <EmptyState icon={ClipboardList} title="Access denied" description="Missing daily production view permission." />
      </ProductionPageHeader>
    )
  }

  const readOnly = batch?.status !== 'DRAFT'
  const canSubmit = Boolean(perms.canSubmitDailyProduction && batch?.status === 'DRAFT')

  return (
    <ProductionPageHeader
      title="Daily Production Update"
      description="Capture end-of-shift output — save draft, validate, then submit to post progress."
      favoritePath="/manufacturing/daily-update"
      primaryAction={
        perms.canCreateDailyProduction
          ? {
              id: 'new-batch',
              label: t('dailyUpdate.createBatch'),
              icon: ClipboardList,
              onClick: () =>
                void run(async () => {
                  const res = await createDailyProductionBatch({ productionDate: todayIsoDate() })
                  setSelectedId(res.data.id)
                }, 'Daily batch created'),
            }
          : undefined
      }
      secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void loadList() }]}
    >
      {loading ? <LoadingState variant="card" rows={4} /> : null}

      {!loading && batches.length === 0 ? (
        <ProductionEmptyState
          icon={ClipboardList}
          title="No batch for today"
          description="Create a daily production batch to record shift output."
        />
      ) : null}

      {!loading && batches.length > 0 ? (
        <div className="space-y-4 pb-24">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-erp-border bg-white px-4 py-3">
            <FormField label="Today's batches" className="min-w-[16rem] flex-1">
              <Select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value || null)}>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} · {formatDate(b.productionDate)} · {DAILY_BATCH_STATUS_LABELS[b.status]}
                  </option>
                ))}
              </Select>
            </FormField>
            {batch ? (
              <DynamicsStatusChip label={DAILY_BATCH_STATUS_LABELS[batch.status]} tone={batchStatusTone(batch.status)} />
            ) : null}
            {perms.canCreateDailyProduction && batch && !readOnly ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAddOpen(true)} className="mb-0.5">
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t('dailyUpdate.addLine')}
              </Button>
            ) : null}
          </div>

          {batch ? (
            <DailyProductionGrid
              batch={batch}
              readOnly={readOnly}
              busy={busy}
              onLineChange={(lineId, patch) => {
                if (!batch || readOnly) return
                setBatch({
                  ...batch,
                  lines: (batch.lines ?? []).map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
                })
              }}
              onRemoveLine={(lineId) => void run(() => removeDailyProductionLine(batch.id, lineId), 'Line removed')}
            />
          ) : null}

          {batch ? (
            <div
              className="sticky bottom-0 z-20 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-erp-border bg-erp-surface px-3 py-2 shadow-[var(--erp-shadow-card)]"
              role="toolbar"
              aria-label="Daily update actions"
            >
              <span className="text-[12px] tabular-nums text-erp-muted">
                {lineTotals.count} line{lineTotals.count === 1 ? '' : 's'} · Good {lineTotals.good} · Rework{' '}
                {lineTotals.rework} · Rejected {lineTotals.rejected} · Scrap {lineTotals.scrap}
              </span>
              {!readOnly ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]"
                    disabled={busy}
                    onClick={() => void saveLines()}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Save Draft
                  </button>
                  {canSubmit ? (
                    <>
                      <button
                        type="button"
                        className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]"
                        disabled={busy}
                        onClick={() => void run(() => validateDailyProductionBatch(batch.id), 'Validation complete')}
                      >
                        {t('dailyUpdate.validate')}
                      </button>
                      <button
                        type="button"
                        className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                        disabled={busy}
                        onClick={() =>
                          void (async () => {
                            const ok = await appConfirm({
                              title: 'Submit Production Update',
                              description: 'Progress will be posted to work orders. The submitted batch becomes read-only.',
                              detail: `${lineTotals.count} line${lineTotals.count === 1 ? '' : 's'} · Good ${lineTotals.good} · Rework ${lineTotals.rework} · Rejected ${lineTotals.rejected} · Scrap ${lineTotals.scrap}`,
                              confirmLabel: 'Submit Production Update',
                            })
                            if (!ok) return
                            await run(() => submitDailyProductionBatch(batch.id), 'Batch submitted')
                          })()
                        }
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        {t('dailyUpdate.submit')}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <span className="text-[12px] text-erp-muted">Batch is read-only</span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('dailyUpdate.addLine')}
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || !batch || !woId.trim() || !stageId.trim()}
              onClick={() => {
                if (!batch) return
                void run(async () => {
                  await addDailyProductionLine(batch.id, {
                    productionOrderId: woId.trim(),
                    stageId: stageId.trim(),
                    goodQuantity: Number(good) || 0,
                    reworkQuantity: 0,
                    rejectedQuantity: 0,
                    scrapQuantity: 0,
                    idempotencyKey: crypto.randomUUID(),
                  })
                  setAddOpen(false)
                  setWoId('')
                  setStageId('')
                  setGood('1')
                }, 'Line added')
              }}
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField
            label="Work Order"
            required
            hint={activeOrders.length === 0 ? 'No running work orders found.' : undefined}
          >
            <Select value={woId} onChange={(e) => setWoId(e.target.value)}>
              <option value="">Select running work order…</option>
              {activeOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.workOrderNo} · planned {order.plannedQuantity}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Stage"
            required
            hint={
              woId && !stagesLoading && woStages.length === 0
                ? 'No stage on this work order is ready for progress.'
                : undefined
            }
          >
            <Select value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={!woId || stagesLoading}>
              <option value="">{stagesLoading ? 'Loading stages…' : 'Select stage…'}</option>
              {woStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · planned {s.plannedQuantity} · good {s.goodQuantity}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Good Quantity">
            <Input type="number" min={0} value={good} onChange={(e) => setGood(e.target.value)} />
          </FormField>
        </div>
      </Modal>
    </ProductionPageHeader>
  )
}
