/**
 * Gatekeeper Mode UI kit — large touch-first primitives shared by the six
 * operator flows (/gate/operator/*). Deliberately plain-language and
 * one-dominant-action-per-screen; no ERP chrome, no complex tables.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Phone,
  QrCode,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { cn } from '@/utils/cn'

// ─── Demo supervisor directory (frontend-only; API mode should source this
//     from gate settings / users API when the gate backend ships) ────────────
export const GATE_SUPERVISOR_CONTACTS = [
  { name: 'Suresh Nair', role: 'Security Supervisor', phone: '+91 98400 11223' },
  { name: 'Lakshmi Narayan', role: 'Admin Office', phone: '+91 98400 44556' },
] as const

// ─── Step header ─────────────────────────────────────────────────────────────

export type OperatorStep = 1 | 2 | 3

const STEP_LABELS: Record<OperatorStep, string> = { 1: 'Search', 2: 'Confirm', 3: 'Done' }

export function OperatorStepShell({
  title,
  step,
  onBack,
  children,
}: {
  title: string
  step: OperatorStep
  /** Back inside the flow (step > 1). Falsy = back to operator home. */
  onBack?: () => void
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate('/gate/operator'))}
          className="flex h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 shadow-sm active:scale-[0.98]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <CallSupervisorButton compact />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>

      <div className="mt-3 flex items-center gap-2">
        {([1, 2, 3] as OperatorStep[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                s < step && 'bg-emerald-600 text-white',
                s === step && 'bg-blue-600 text-white',
                s > step && 'bg-slate-200 text-slate-500',
              )}
            >
              {s < step ? '✓' : s}
            </span>
            <span
              className={cn(
                'text-sm font-semibold',
                s === step ? 'text-slate-900' : 'text-slate-400',
              )}
            >
              {STEP_LABELS[s]}
            </span>
            {s < 3 && <span className="mx-1 h-px w-6 bg-slate-300" />}
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-4">{children}</div>
    </div>
  )
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

export function OperatorBigButton({
  label,
  onClick,
  tone = 'primary',
  loading,
  disabled,
  type = 'button',
}: {
  label: string
  onClick?: () => void
  tone?: 'primary' | 'success' | 'danger' | 'warning'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const tones: Record<string, string> = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    success: 'bg-emerald-600 hover:bg-emerald-700',
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-500 hover:bg-amber-600',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold text-white shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        tones[tone],
      )}
    >
      {loading && <Loader2 className="h-6 w-6 animate-spin" />}
      {label}
    </button>
  )
}

export function OperatorSecondaryButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-lg font-semibold text-slate-700 shadow-sm transition active:scale-[0.99] disabled:opacity-50"
    >
      {label}
    </button>
  )
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function OperatorSearchBox({
  placeholder,
  hint = 'Scan the QR code, or type and press Search',
  onSearch,
  searching,
  autoFocus = true,
}: {
  placeholder: string
  hint?: string
  onSearch: (query: string) => void
  searching?: boolean
  autoFocus?: boolean
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSearch(value.trim())
      }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-4 shadow-sm focus-within:border-blue-500">
        <QrCode className="h-6 w-6 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-16 w-full bg-transparent text-lg font-medium text-slate-900 outline-none placeholder:text-slate-400"
          inputMode="search"
        />
        {value && (
          <button type="button" onClick={() => setValue('')} aria-label="Clear">
            <X className="h-6 w-6 text-slate-400" />
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500">{hint}</p>
      <OperatorBigButton
        type="submit"
        label={searching ? 'Searching…' : 'Search'}
        loading={searching}
        disabled={!value.trim()}
      />
    </form>
  )
}

// ─── Result / summary cards ──────────────────────────────────────────────────

export function OperatorResultCard({
  title,
  lines,
  badge,
  onClick,
}: {
  title: string
  lines: string[]
  badge?: { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'slate' }
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold text-slate-900">{title}</p>
        {lines.filter(Boolean).map((line, i) => (
          <p key={i} className="truncate text-sm text-slate-600">
            {line}
          </p>
        ))}
        {badge && <span className="mt-1 inline-block"><OperatorBadge label={badge.label} tone={badge.tone} /></span>}
      </div>
      <ChevronRight className="h-6 w-6 shrink-0 text-slate-400" />
    </button>
  )
}

export function OperatorBadge({
  label,
  tone,
}: {
  label: string
  tone: 'green' | 'amber' | 'red' | 'blue' | 'slate'
}) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <span className={cn('rounded-full px-3 py-1 text-sm font-bold', tones[tone])}>{label}</span>
  )
}

/** Read-only confirm card: label/value rows in large type. */
export function OperatorSummaryCard({
  rows,
  children,
}: {
  rows: Array<{ label: string; value?: string | null }>
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
      <dl className="space-y-2.5">
        {rows
          .filter((r) => r.value)
          .map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-sm font-medium text-slate-500">{r.label}</dt>
              <dd className="text-right text-base font-bold text-slate-900">{r.value}</dd>
            </div>
          ))}
      </dl>
      {children}
    </div>
  )
}

// ─── Status banners (approval states in plain language) ─────────────────────

export function OperatorStatusBanner({
  tone,
  title,
  message,
}: {
  tone: 'green' | 'amber' | 'red'
  title: string
  message?: string
}) {
  const tones: Record<string, string> = {
    green: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-300 bg-amber-50 text-amber-900',
    red: 'border-red-300 bg-red-50 text-red-900',
  }
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'amber' ? AlertTriangle : ShieldAlert
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border-2 p-4', tones[tone])}>
      <Icon className="mt-0.5 h-6 w-6 shrink-0" />
      <div>
        <p className="text-base font-bold">{title}</p>
        {message && <p className="mt-0.5 text-sm">{message}</p>}
      </div>
    </div>
  )
}

// ─── Form controls (large) ───────────────────────────────────────────────────

export function OperatorField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

const operatorInputClass =
  'h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-lg font-medium text-slate-900 outline-none focus:border-blue-500'

export function OperatorInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(operatorInputClass, props.className)} />
}

export function OperatorSelect({
  value,
  onChange,
  options,
  placeholder = SELECT_PLACEHOLDER,
  required,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={cn(operatorInputClass, !value && 'text-slate-400')}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="text-slate-900">
          {opt}
        </option>
      ))}
    </select>
  )
}

/** Large yes/no toggle row — used for checklists and declarations. */
export function OperatorToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99]',
        checked ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white',
      )}
    >
      <span className="text-base font-semibold text-slate-800">{label}</span>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white',
        )}
      >
        {checked && <CheckCircle2 className="h-5 w-5" />}
      </span>
    </button>
  )
}

// ─── Call Supervisor ─────────────────────────────────────────────────────────

export function CallSupervisorButton({
  compact,
  reason,
}: {
  compact?: boolean
  /** Context shown inside the dialog, e.g. "Visitor is blacklisted". */
  reason?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white shadow-sm transition active:scale-[0.98]',
          compact ? 'h-12 px-4 text-sm' : 'h-14 w-full text-lg',
        )}
      >
        <Phone className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        Call Supervisor
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">Call Supervisor</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            {reason && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {reason}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-600">
              Do not allow entry or exit until a supervisor confirms.
            </p>
            <div className="mt-4 space-y-3">
              {GATE_SUPERVISOR_CONTACTS.map((c) => (
                <a
                  key={c.phone}
                  href={`tel:${c.phone.replace(/\s/g, '')}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 p-4 transition hover:border-red-400"
                >
                  <span>
                    <span className="block text-base font-bold text-slate-900">{c.name}</span>
                    <span className="block text-sm text-slate-500">{c.role}</span>
                  </span>
                  <span className="flex items-center gap-2 font-bold text-red-600">
                    <Phone className="h-5 w-5" />
                    {c.phone}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Completion screen (step 3) ──────────────────────────────────────────────

export function OperatorComplete({
  tone = 'green',
  title,
  rows = [],
  message,
  nextLabel,
  onNext,
}: {
  tone?: 'green' | 'amber' | 'red'
  title: string
  rows?: Array<{ label: string; value?: string | null }>
  message?: string
  nextLabel: string
  onNext: () => void
}) {
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'amber' ? AlertTriangle : ShieldAlert
  const iconTone =
    tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-500' : 'text-red-600'
  return (
    <div className="space-y-4 pt-4 text-center">
      <Icon className={cn('mx-auto h-20 w-20', iconTone)} />
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      {message && <p className="text-base text-slate-600">{message}</p>}
      {rows.length > 0 && <OperatorSummaryCard rows={rows} />}
      <div className="space-y-3 pt-2">
        <OperatorBigButton label={nextLabel} tone="primary" onClick={onNext} />
        <Link
          to="/gate/operator"
          className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-lg font-semibold text-slate-700"
        >
          Go to Home
        </Link>
      </div>
      {tone !== 'green' && <CallSupervisorButton reason={message} />}
    </div>
  )
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export function OperatorEmptyResult({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
      <Search className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-2 text-base font-semibold text-slate-700">{message}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  )
}

export function OperatorSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{children}</p>
  )
}
