/**
 * Guided Fulfilment journey — Produce → Quality → Stock → Dispatch.
 * Coach chrome with optional Auto Mode tip (user still confirms each posting step).
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Factory, Package, Truck } from 'lucide-react'
import { cn } from '@/utils/cn'
import { getFulfilmentAutoMode, setFulfilmentAutoMode } from './fulfilmentAutoMode'

export type FulfilmentJourneyStepId = 'produce' | 'quality' | 'stock' | 'dispatch'

export type FulfilmentStepVisual = 'done' | 'current' | 'upcoming' | 'blocked'

export interface FulfilmentJourneyStep {
  id: FulfilmentJourneyStepId
  label: string
  state: FulfilmentStepVisual
  detail?: string
  onSelect?: () => void
}

const STEP_ICONS = {
  produce: Factory,
  quality: ClipboardCheck,
  stock: Package,
  dispatch: Truck,
} as const

export interface DeriveWoJourneyInput {
  status: string
  stages: Array<{ status: string; isOptional?: boolean }>
  qualityBlockerCount: number
  fgReceiptCount: number
  /** True when completed good qty still has FG remaining to receive. */
  fgRemaining: boolean
  salesOrderId: string | null
  salesOrderNo?: string | null
}

/** Derive Produce / Quality / Stock / Dispatch states from a work order snapshot. */
export function deriveWoFulfilmentJourney(input: DeriveWoJourneyInput): {
  activeStep: FulfilmentJourneyStepId
  steps: Omit<FulfilmentJourneyStep, 'onSelect'>[]
} {
  const stages = input.stages ?? []
  const mandatory = stages.filter((s) => !s.isOptional)
  const allProduced =
    input.status === 'COMPLETED' ||
    input.status === 'CLOSED' ||
    (mandatory.length > 0 &&
      mandatory.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'))
  const hasQcPending = stages.some((s) => s.status === 'QC_PENDING')
  const qualityAttention = hasQcPending || input.qualityBlockerCount > 0
  const stockDone =
    input.status === 'COMPLETED' &&
    (input.fgReceiptCount > 0 || !input.fgRemaining)
  const stockCurrent =
    input.status === 'COMPLETED' && input.fgRemaining && !stockDone

  let activeStep: FulfilmentJourneyStepId = 'produce'
  if (!allProduced) {
    activeStep = qualityAttention ? 'quality' : 'produce'
  } else if (qualityAttention && !stockDone) {
    activeStep = 'quality'
  } else if (stockCurrent || (input.status === 'COMPLETED' && !stockDone)) {
    activeStep = 'stock'
  } else if (stockDone) {
    activeStep = 'dispatch'
  }

  const produceState: FulfilmentStepVisual = allProduced
    ? 'done'
    : activeStep === 'produce'
      ? 'current'
      : 'upcoming'
  const qualityState: FulfilmentStepVisual = qualityAttention
    ? 'blocked'
    : allProduced
      ? 'done'
      : activeStep === 'quality'
        ? 'current'
        : 'upcoming'
  const stockState: FulfilmentStepVisual = stockDone
    ? 'done'
    : stockCurrent || activeStep === 'stock'
      ? 'current'
      : 'upcoming'
  const dispatchState: FulfilmentStepVisual = stockDone
    ? input.salesOrderId
      ? 'current'
      : 'upcoming'
    : 'upcoming'

  return {
    activeStep,
    steps: [
      {
        id: 'produce',
        label: 'Produce',
        state: produceState,
        detail: allProduced ? 'Stages complete' : 'Release → Start → Complete stages',
      },
      {
        id: 'quality',
        label: 'Quality',
        state: qualityState,
        detail: qualityAttention
          ? hasQcPending
            ? 'Stage awaiting QC'
            : `${input.qualityBlockerCount} blocker(s)`
          : 'Clear stage QC / holds',
      },
      {
        id: 'stock',
        label: 'Stock',
        state: stockState,
        detail: stockDone
          ? 'FG in inventory'
          : input.status === 'COMPLETED'
            ? 'Receive finished goods'
            : 'Complete WO → FG receipt',
      },
      {
        id: 'dispatch',
        label: 'Dispatch',
        state: dispatchState,
        detail: input.salesOrderId
          ? `SO ${input.salesOrderNo ?? ''} · reserve → pick → pack`.trim()
          : 'Link a sales order to dispatch',
      },
    ],
  }
}

export interface DeriveSoJourneyInput {
  /** Ordered / net remaining from fulfilment summary. */
  remainingQty: number
  reservedQty: number
  pickedQty: number
  packedQty: number
  challanQty: number
  dispatchedQty: number
  /** Production / quality readiness from requirements (optional). */
  waitingProduction?: boolean
  waitingQuality?: boolean
  waitingStock?: boolean
  readyQty?: number
}

/** Derive journey for SO fulfilment panel from dispatch totals. */
export function deriveSoFulfilmentJourney(input: DeriveSoJourneyInput): {
  activeStep: FulfilmentJourneyStepId
  steps: Omit<FulfilmentJourneyStep, 'onSelect'>[]
} {
  const stockReady = (input.readyQty ?? 0) > 0 || (!input.waitingProduction && !input.waitingStock)
  const produceDone = !input.waitingProduction
  const qualityDone = !input.waitingQuality
  const stockDone = produceDone && qualityDone && (stockReady || input.reservedQty > 0 || input.dispatchedQty > 0)
  const dispatchDone = input.remainingQty <= 0 || input.dispatchedQty > 0

  let activeStep: FulfilmentJourneyStepId = 'produce'
  if (!produceDone) activeStep = 'produce'
  else if (!qualityDone) activeStep = 'quality'
  else if (!stockDone) activeStep = 'stock'
  else activeStep = 'dispatch'

  return {
    activeStep,
    steps: [
      {
        id: 'produce',
        label: 'Produce',
        state: produceDone ? 'done' : 'current',
        detail: produceDone ? 'Production ready' : 'Waiting on work orders',
      },
      {
        id: 'quality',
        label: 'Quality',
        state: !produceDone ? 'upcoming' : qualityDone ? 'done' : 'blocked',
        detail: qualityDone ? 'QC clear' : 'Waiting quality release',
      },
      {
        id: 'stock',
        label: 'Stock',
        state: !produceDone || !qualityDone ? 'upcoming' : stockDone ? 'done' : 'current',
        detail: stockDone ? 'FG available' : 'Waiting FG / stock',
      },
      {
        id: 'dispatch',
        label: 'Dispatch',
        state: !stockDone ? 'upcoming' : dispatchDone ? 'done' : 'current',
        detail: dispatchDone
          ? 'Dispatched'
          : `Reserve ${input.reservedQty} · Pick ${input.pickedQty} · Pack ${input.packedQty} · Challan ${input.challanQty}`,
      },
    ],
  }
}

export function FulfilmentJourneyStrip({
  steps,
  activeStep,
  className,
  showAutoMode = true,
  compactTip,
}: {
  steps: FulfilmentJourneyStep[]
  activeStep?: FulfilmentJourneyStepId
  className?: string
  showAutoMode?: boolean
  /** Extra one-line coach tip under the strip. */
  compactTip?: string
}) {
  const [autoMode, setAutoMode] = useState(getFulfilmentAutoMode)

  useEffect(() => {
    setFulfilmentAutoMode(autoMode)
  }, [autoMode])

  return (
    <div className={cn('space-y-2', className)}>
      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Fulfilment journey">
        {steps.map((step, i) => {
          const Icon = STEP_ICONS[step.id]
          const active = activeStep === step.id || step.state === 'current' || step.state === 'blocked'
          const done = step.state === 'done'
          const blocked = step.state === 'blocked'
          const content = (
            <>
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                  active && !blocked
                    ? 'bg-erp-primary text-white'
                    : blocked
                      ? 'bg-amber-600 text-white'
                      : done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-erp-surface-alt text-erp-muted',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[12px] font-semibold text-erp-text">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {step.label}
                </span>
                {step.detail ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-erp-muted">{step.detail}</span>
                ) : null}
              </span>
            </>
          )
          const shellClass = cn(
            'flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
            active && !blocked
              ? 'border-erp-primary bg-erp-primary/5'
              : blocked
                ? 'border-amber-300 bg-amber-50/80'
                : done
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : 'border-erp-border bg-erp-surface',
            step.onSelect ? 'cursor-pointer hover:border-erp-primary/60' : '',
          )
          return (
            <li key={step.id}>
              {step.onSelect ? (
                <button type="button" onClick={step.onSelect} className={shellClass}>
                  {content}
                </button>
              ) : (
                <div className={shellClass}>{content}</div>
              )}
            </li>
          )
        })}
      </ol>

      {showAutoMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-[12px] text-sky-950">
          <p className="min-w-0 flex-1">
            <span className="font-semibold">Auto Mode</span>
            <span className="text-sky-900/80">
              {' '}
              — coach opens the next step after each success (prefill qty, Continue path). You still confirm every
              posting.
            </span>
            {compactTip ? <span className="mt-0.5 block text-sky-900/80">{compactTip}</span> : null}
          </p>
          <label className="inline-flex shrink-0 items-center gap-2 font-medium">
            <input
              type="checkbox"
              className="rounded border-sky-400"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
            />
            On
          </label>
        </div>
      ) : null}
    </div>
  )
}
