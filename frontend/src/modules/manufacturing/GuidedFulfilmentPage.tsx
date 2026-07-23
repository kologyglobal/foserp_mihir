/**
 * Guided Fulfilment hub — Produce → Quality → Stock → Dispatch.
 * Resume via URL (`?step=&woId=&salesOrderId=`), same pattern as CRM Guided Deal.
 */
import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ClipboardCheck,
  Factory,
  Package,
  Route,
  Truck,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { Button } from '@/components/ui/Button'
import {
  FulfilmentJourneyStrip,
  type FulfilmentJourneyStep,
  type FulfilmentJourneyStepId,
  type FulfilmentStepVisual,
} from '@/modules/manufacturing/ui/FulfilmentJourneyStrip'
import { fulfilmentJourneyPath } from '@/modules/manufacturing/ui/fulfilmentJourneyUrl'
import { useFulfilmentJourneyStep } from '@/modules/manufacturing/ui/useFulfilmentJourneyStep'
import { cn } from '@/utils/cn'

const STEP_COPY: Record<
  FulfilmentJourneyStepId,
  { title: string; body: string; primaryLabel: string; primaryTo: (ctx: Ctx) => string }
> = {
  produce: {
    title: 'Produce',
    body: 'Execute the work order stages (Complete Stage). Flexible mode warns on materials/QC instead of hard-blocking.',
    primaryLabel: 'Open Work Orders',
    primaryTo: (ctx) =>
      ctx.woId ? `/manufacturing/work-orders/${ctx.woId}?step=produce` : '/manufacturing/work-orders',
  },
  quality: {
    title: 'Quality',
    body: 'Clear QC pending / issues on the WO, then continue. Quality gates warn under flexible execution.',
    primaryLabel: 'Open QC / issues',
    primaryTo: (ctx) =>
      ctx.woId
        ? `/manufacturing/work-orders/${ctx.woId}?step=quality`
        : '/manufacturing/issues',
  },
  stock: {
    title: 'Stock (FG)',
    body: 'Post finished goods receipt on the completed WO, then sync sales-order dispatch requirements.',
    primaryLabel: 'Store workbench (FG)',
    primaryTo: (ctx) =>
      ctx.woId
        ? `/manufacturing/work-orders/${ctx.woId}?step=stock`
        : '/manufacturing/store-workbench',
  },
  dispatch: {
    title: 'Dispatch',
    body: 'Reserve → Pick → Pack → Issue challan → Post Dispatch (7C5). Auto Mode opens the next screen after each success.',
    primaryLabel: 'Dispatch workbench',
    primaryTo: (ctx) =>
      ctx.salesOrderId
        ? `/dispatch/workbench?salesOrderId=${encodeURIComponent(ctx.salesOrderId)}`
        : '/dispatch/workbench',
  },
}

type Ctx = { woId: string; salesOrderId: string }

function stepVisual(
  id: FulfilmentJourneyStepId,
  active: FulfilmentJourneyStepId,
): FulfilmentStepVisual {
  const order: FulfilmentJourneyStepId[] = ['produce', 'quality', 'stock', 'dispatch']
  const ai = order.indexOf(active)
  const ii = order.indexOf(id)
  if (ii < ai) return 'done'
  if (ii === ai) return 'current'
  return 'upcoming'
}

export function GuidedFulfilmentPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const woId = searchParams.get('woId') ?? ''
  const salesOrderId = searchParams.get('salesOrderId') ?? ''
  const { step, setStep } = useFulfilmentJourneyStep('produce')

  /** Ensure hub always has ?step= so refresh resumes (Guided Deal style). */
  useEffect(() => {
    if (searchParams.get('step')) return
    const next = new URLSearchParams(searchParams)
    next.set('step', 'produce')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const ctx: Ctx = useMemo(() => ({ woId, salesOrderId }), [woId, salesOrderId])

  const steps: FulfilmentJourneyStep[] = useMemo(
    () =>
      (['produce', 'quality', 'stock', 'dispatch'] as FulfilmentJourneyStepId[]).map((id) => ({
        id,
        label: STEP_COPY[id].title,
        state: stepVisual(id, step),
        detail: STEP_COPY[id].body.slice(0, 72) + (STEP_COPY[id].body.length > 72 ? '…' : ''),
        onSelect: () => setStep(id),
      })),
    [step, setStep],
  )

  const copy = STEP_COPY[step]

  function clearContext(key: 'woId' | 'salesOrderId') {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    setSearchParams(next, { replace: true })
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Guided Fulfilment"
      description="Produce → Quality → Stock → Dispatch — resume anytime from this URL"
      favoritePath="/manufacturing/guided-fulfilment"
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Guided Fulfilment' },
      ]}
      autoBreadcrumbs={false}
      pageGuide={{
        purpose: 'Same coach strip as Work Order and Sales Order fulfilment. Progress is stored in ?step=.',
        nextStep: 'Pick a step, open the linked screen, then return here or stay on the WO/SO URL.',
      }}
    >
      <FulfilmentJourneyStrip
        activeStep={step}
        steps={steps}
        compactTip="Bookmark this page (or a WO/SO with ?step=) to resume after refresh."
      />

      <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-erp-muted">
        {woId ? (
          <span className="rounded border border-erp-border bg-erp-surface px-2 py-1">
            WO{' '}
            <Link className="font-semibold text-erp-primary hover:underline" to={`/manufacturing/work-orders/${woId}?step=${step}`}>
              {woId.slice(0, 8)}…
            </Link>{' '}
            <button type="button" className="text-erp-muted hover:underline" onClick={() => clearContext('woId')}>
              clear
            </button>
          </span>
        ) : (
          <Link className="rounded border border-erp-border px-2 py-1 font-semibold text-erp-primary hover:bg-erp-surface" to="/manufacturing/work-orders">
            Link a work order
          </Link>
        )}
        {salesOrderId ? (
          <span className="rounded border border-erp-border bg-erp-surface px-2 py-1">
            SO{' '}
            <Link
              className="font-semibold text-erp-primary hover:underline"
              to={`/crm/sales-orders/${salesOrderId}`}
            >
              {salesOrderId.slice(0, 8)}…
            </Link>{' '}
            <button type="button" className="text-erp-muted hover:underline" onClick={() => clearContext('salesOrderId')}>
              clear
            </button>
          </span>
        ) : (
          <Link className="rounded border border-erp-border px-2 py-1 font-semibold text-erp-primary hover:bg-erp-surface" to="/dispatch/workbench">
            Open dispatch workbench
          </Link>
        )}
      </div>

      <section
        className={cn(
          'mt-4 rounded-lg border border-erp-border bg-white p-4 shadow-sm',
        )}
      >
        <div className="flex items-start gap-3">
          {step === 'produce' ? <Factory className="mt-0.5 h-5 w-5 text-erp-primary" /> : null}
          {step === 'quality' ? <ClipboardCheck className="mt-0.5 h-5 w-5 text-erp-primary" /> : null}
          {step === 'stock' ? <Package className="mt-0.5 h-5 w-5 text-erp-primary" /> : null}
          {step === 'dispatch' ? <Truck className="mt-0.5 h-5 w-5 text-erp-primary" /> : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-erp-text">{copy.title}</h2>
            <p className="mt-1 text-[13px] text-erp-muted">{copy.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate(copy.primaryTo(ctx))}>
                {copy.primaryLabel}
              </Button>
              {step !== 'dispatch' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const order: FulfilmentJourneyStepId[] = ['produce', 'quality', 'stock', 'dispatch']
                    const i = order.indexOf(step)
                    if (i < order.length - 1) setStep(order[i + 1]!)
                  }}
                >
                  Continue
                </Button>
              ) : null}
              {woId && step === 'dispatch' && salesOrderId ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/crm/sales-orders/${salesOrderId}`)}
                >
                  Sales Order fulfilment
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-erp-muted">
        <Route className="h-3.5 w-3.5" aria-hidden />
        Example resume URL:{' '}
        <code className="rounded bg-erp-surface px-1.5 py-0.5 text-[11px]">
          {fulfilmentJourneyPath({
            step,
            woId: woId || null,
            salesOrderId: salesOrderId || null,
          })}
        </code>
      </p>
    </OperationalPageShell>
  )
}
