/**
 * Controlled Emergency Override drawer — used when an authorised user must proceed
 * despite operational blockers (never for integrity / tenant / statutory hard rules).
 */
import { useMemo, useState } from 'react'
import { ManufacturingActionDrawer } from '@/components/manufacturing/ManufacturingActionDrawer'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { Select } from '@/components/forms/Inputs'

export type EmergencyOverrideBlocker = {
  code: string
  message?: string
  severity?: string
}

export type EmergencyOverrideSubmitPayload = {
  businessReason: string
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  riskAcknowledged: true
  approvedByName: string
  approvalReference?: string
  expiresAt: string
  scope: string
  remarks?: string
}

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  documentLabel: string
  blockedAction: string
  blockers: EmergencyOverrideBlocker[]
  neverOverridableBlockers?: EmergencyOverrideBlocker[]
  busy?: boolean
  onSubmit: (payload: EmergencyOverrideSubmitPayload) => void | Promise<void>
}

function defaultExpiryLocal(): string {
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EmergencyOverrideDrawer({
  open,
  onClose,
  title = 'Emergency Override',
  documentLabel,
  blockedAction,
  blockers,
  neverOverridableBlockers = [],
  busy,
  onSubmit,
}: Props) {
  const hardBlocked = neverOverridableBlockers.length > 0
  const primaryCode = blockers[0]?.code ?? '—'

  const [businessReason, setBusinessReason] = useState('')
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | ''>('HIGH')
  const [approvedByName, setApprovedByName] = useState('')
  const [approvalReference, setApprovalReference] = useState('')
  const [expiresLocal, setExpiresLocal] = useState(defaultExpiryLocal)
  const [remarks, setRemarks] = useState('')
  const [riskAck, setRiskAck] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const scope = useMemo(
    () =>
      'Operational document gates only — tenant isolation, permissions, stock policy, serial/lot, posted duplication, closed period, statutory docs, cancelled SO, over-qty, and data integrity remain enforced.',
    [],
  )

  const submit = async () => {
    setFormError(null)
    if (hardBlocked) {
      setFormError('This action cannot be overridden — fix never-overridable blockers first.')
      return
    }
    if (!businessReason.trim() || businessReason.trim().length < 8) {
      setFormError('Enter a business reason (at least 8 characters).')
      return
    }
    if (!approvedByName.trim()) {
      setFormError('Enter who approved this override.')
      return
    }
    if (!urgency) {
      setFormError('Select urgency.')
      return
    }
    if (!riskAck) {
      setFormError('You must acknowledge the risk before granting override.')
      return
    }
    const expiresAt = new Date(expiresLocal).toISOString()
    if (Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= Date.now()) {
      setFormError('Expiry must be a future date/time.')
      return
    }
    await onSubmit({
      businessReason: businessReason.trim(),
      urgency,
      riskAcknowledged: true,
      approvedByName: approvedByName.trim(),
      approvalReference: approvalReference.trim() || undefined,
      expiresAt,
      scope,
      remarks: remarks.trim() || undefined,
    })
  }

  return (
    <ManufacturingActionDrawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Time-bound · single-use · full audit — does not alter posted transactions"
      closeDisabled={busy}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="h-9 rounded border border-erp-border bg-white px-3 text-[13px] font-semibold disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded border border-amber-700 bg-amber-700 px-3 text-[13px] font-semibold text-white disabled:opacity-50"
            onClick={() => void submit()}
            disabled={busy || hardBlocked}
          >
            {busy ? 'Posting…' : 'Grant & retry action'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
          Controlled ERP override. Original blockers are preserved for audit. Stock / accounting integrity
          rules are never bypassed.
        </p>

        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Document</dt>
            <dd className="mt-0.5 font-medium text-erp-text">{documentLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Blocked action</dt>
            <dd className="mt-0.5 font-medium text-erp-text">{blockedAction}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Primary blocker</dt>
            <dd className="mt-0.5 font-mono text-[12px] text-erp-text">{primaryCode}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Blockers</dt>
            <dd className="mt-1 space-y-1">
              {blockers.length === 0 ? (
                <span className="text-erp-muted">—</span>
              ) : (
                blockers.map((b) => (
                  <div key={b.code} className="rounded border border-erp-border/80 bg-erp-surface/50 px-2 py-1">
                    <span className="font-mono text-[11px]">{b.code}</span>
                    {b.message ? <span className="text-erp-muted"> — {b.message}</span> : null}
                  </div>
                ))
              )}
            </dd>
          </div>
        </dl>

        {hardBlocked ? (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
            <p className="font-semibold">Never overridable</p>
            <ul className="mt-1 list-disc pl-5">
              {neverOverridableBlockers.map((b) => (
                <li key={b.code}>
                  <span className="font-mono text-[11px]">{b.code}</span>
                  {b.message ? ` — ${b.message}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Business reason
              </span>
              <textarea
                className="mt-1 w-full rounded border border-erp-border px-2 py-1.5"
                rows={3}
                value={businessReason}
                onChange={(e) => setBusinessReason(e.target.value)}
                placeholder="e.g. Customer plant shutdown risk — temporary ship approval"
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Urgency</span>
              <Select
                className="mt-1"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as typeof urgency)}
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Expiry date/time
              </span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-erp-border px-2 py-1.5"
                value={expiresLocal}
                onChange={(e) => setExpiresLocal(e.target.value)}
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Approved by
              </span>
              <input
                className="mt-1 w-full rounded border border-erp-border px-2 py-1.5"
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                placeholder="Operations Head"
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Approval reference
              </span>
              <input
                className="mt-1 w-full rounded border border-erp-border px-2 py-1.5"
                value={approvalReference}
                onChange={(e) => setApprovalReference(e.target.value)}
                placeholder="APR-0045"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Remarks</span>
              <textarea
                className="mt-1 w-full rounded border border-erp-border px-2 py-1.5"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </label>
            <p className="sm:col-span-2 text-[11px] text-erp-muted">
              <span className="font-semibold text-erp-text">Scope:</span> {scope}
            </p>
            <label className="sm:col-span-2 flex items-start gap-2 rounded border border-erp-border bg-erp-surface/40 px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={riskAck}
                onChange={(e) => setRiskAck(e.target.checked)}
              />
              <span>
                I acknowledge the operational risk and confirm this override is time-bound, document-specific,
                and will be audited. Original blockers remain on record.
              </span>
            </label>
          </div>
        )}

        {formError ? (
          <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{formError}</p>
        ) : null}
      </div>
    </ManufacturingActionDrawer>
  )
}
