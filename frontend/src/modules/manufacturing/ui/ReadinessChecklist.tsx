/**
 * FORM-A — readiness checklist, validation summary, and next-best-action banner.
 * Server-derived readiness only; the frontend never computes authoritative state.
 */
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Info, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

export type ReadinessState = 'ready' | 'missing' | 'warning' | 'recommended' | 'overridden' | 'pending'

export interface ReadinessItem {
  id: string
  label: string
  state: ReadinessState
  /** Short human explanation — "Recommended from Manufacturing Profile", "No active BOM version". */
  detail?: string
}

const READINESS_META: Record<ReadinessState, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  ready: { label: 'Ready', className: 'text-emerald-700', Icon: CheckCircle2 },
  missing: { label: 'Missing', className: 'text-rose-700', Icon: XCircle },
  warning: { label: 'Attention', className: 'text-amber-700', Icon: AlertTriangle },
  recommended: { label: 'Recommended', className: 'text-sky-700', Icon: Info },
  overridden: { label: 'Overridden', className: 'text-slate-600', Icon: Info },
  pending: { label: 'Pending', className: 'text-slate-500', Icon: CircleDashed },
}

/** Compact readiness checklist for context panels (Profile / BOM / Routing / Materials / …). */
export function ReadinessChecklist({ title, items }: { title?: string; items: ReadinessItem[] }) {
  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      {title ? <h3 className="mb-2 text-[13px] font-semibold text-erp-text">{title}</h3> : null}
      <ul className="space-y-2">
        {items.map((item) => {
          const meta = READINESS_META[item.state]
          const Icon = meta.Icon
          return (
            <li key={item.id} className="flex items-start gap-2 text-[12px]">
              <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', meta.className)} aria-hidden />
              <div className="min-w-0">
                <span className="font-medium text-erp-text">{item.label}</span>
                <span className={cn('ml-1.5 text-[11px] font-semibold', meta.className)}>{meta.label}</span>
                {item.detail ? <p className="text-[11px] text-erp-muted">{item.detail}</p> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Compact validation summary shown before major lifecycle actions. */
export function ValidationSummary({
  blockers,
  warnings,
  className,
}: {
  blockers: string[]
  warnings: string[]
  className?: string
}) {
  if (blockers.length === 0 && warnings.length === 0) return null
  return (
    <div className={cn('space-y-2', className)} role="alert">
      {blockers.length > 0 ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-rose-900">
            {blockers.length} blocker{blockers.length === 1 ? '' : 's'} must be resolved
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[12px] text-rose-900">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-amber-900">
            {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[12px] text-amber-900">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export interface NextBestAction {
  label: string
  description?: string
  action?: { label: string; onClick: () => void; disabled?: boolean }
  tone?: 'info' | 'warning' | 'danger' | 'success'
}

/** C. Alert and guidance area — one clear next action, human language. */
export function NextBestActionBanner({ nba }: { nba: NextBestAction }) {
  const tone = nba.tone ?? 'info'
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-sky-200 bg-sky-50 text-sky-900'
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2', toneClass)}>
      <div className="flex items-start gap-2">
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <div>
          <p className="text-[12px] font-semibold">{nba.label}</p>
          {nba.description ? <p className="text-[12px]">{nba.description}</p> : null}
        </div>
      </div>
      {nba.action ? (
        <Button size="sm" variant="secondary" onClick={nba.action.onClick} disabled={nba.action.disabled}>
          {nba.action.label}
        </Button>
      ) : null}
    </div>
  )
}

/** Posting-impact panel for explicit Inventory posting actions. */
export function PostingImpactPanel({
  title = 'Impact preview',
  rows,
  warning,
  children,
}: {
  title?: string
  rows: Array<{ label: string; value: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }>
  /** e.g. "This action posts an Inventory transaction and cannot be directly edited." */
  warning?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{title}</p>
      <dl className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-[12px]">
            <dt className="text-erp-muted">{row.label}</dt>
            <dd
              className={cn(
                'font-semibold tabular-nums',
                row.tone === 'danger'
                  ? 'text-rose-700'
                  : row.tone === 'warning'
                    ? 'text-amber-700'
                    : row.tone === 'success'
                      ? 'text-emerald-700'
                      : 'text-erp-text',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {children}
      {warning ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {warning}
        </p>
      ) : null}
    </div>
  )
}
