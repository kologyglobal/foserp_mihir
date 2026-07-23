import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { cn } from '@/utils/cn'
import {
  kioskCardClass,
  kioskDangerBtn,
  kioskPrimaryBtn,
  kioskSecondaryBtn,
} from '@/modules/mobile/kiosk/kioskCss'
import type { QualityParameterSnapshot } from '@/services/api/qualityApi'

export type QcParameterDraft = {
  parameterId: string
  measuredValue: string
  measuredNumeric: string
  passed: boolean | null
  remarks: string
}

export function snapshotToParameterDrafts(snapshot: QualityParameterSnapshot[]): QcParameterDraft[] {
  return [...snapshot]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      parameterId: s.parameterId,
      measuredValue: '',
      measuredNumeric: '',
      passed: null,
      remarks: '',
    }))
}

export function draftsToParameterResults(
  drafts: QcParameterDraft[],
  snapshotById: Map<string, QualityParameterSnapshot>,
) {
  return drafts.map((d) => {
    const snap = snapshotById.get(d.parameterId)
    const numeric =
      d.measuredNumeric === ''
        ? null
        : Number.isFinite(Number(d.measuredNumeric))
          ? Number(d.measuredNumeric)
          : null
    return {
      parameterId: d.parameterId,
      measuredValue: d.measuredValue || null,
      measuredNumeric: snap?.parameterType === 'NUMERIC' ? numeric : null,
      passed: d.passed,
      remarks: d.remarks || null,
    }
  })
}

/** Client-side gate before PASS — mirrors backend validatePassAgainstSnapshot for mandatory lines. */
export function validateMandatoryParameterDrafts(
  snapshot: QualityParameterSnapshot[],
  drafts: QcParameterDraft[],
): string | null {
  const byId = new Map(drafts.map((d) => [d.parameterId, d]))
  for (const snap of snapshot) {
    if (!snap.mandatory) continue
    const d = byId.get(snap.parameterId)
    if (!d) return `Enter measurement for ${snap.parameterCode}`
    if (snap.parameterType === 'NUMERIC') {
      if (d.measuredNumeric.trim() === '' || !Number.isFinite(Number(d.measuredNumeric))) {
        return `Enter numeric measurement for ${snap.parameterCode}`
      }
    } else if (snap.parameterType === 'BOOLEAN') {
      if (!d.measuredValue) return `Select result for ${snap.parameterCode}`
    } else if (!d.measuredValue.trim() && snap.passFailRule !== 'MANUAL') {
      return `Enter value for ${snap.parameterCode}`
    }
    if (snap.passFailRule === 'MANUAL' && d.passed == null) {
      return `Mark pass/fail for ${snap.parameterCode}`
    }
  }
  return null
}

type Props = {
  snapshot: QualityParameterSnapshot[]
  drafts: QcParameterDraft[]
  onChange: (next: QcParameterDraft[]) => void
  disabled?: boolean
  compact?: boolean
  /** Large touch targets for shopfloor / Stage QC kiosk popup. */
  variant?: 'default' | 'kiosk'
}

const kioskInputClass =
  'mt-2 w-full min-h-14 rounded-xl border border-[#edebe9] bg-white px-4 text-lg text-[#242424] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/30 disabled:opacity-60'

export function QcParameterMeasurementForm({
  snapshot,
  drafts,
  onChange,
  disabled = false,
  compact = false,
  variant = 'default',
}: Props) {
  const ordered = [...snapshot].sort((a, b) => a.sortOrder - b.sortOrder)
  const kiosk = variant === 'kiosk'

  if (ordered.length === 0) {
    return (
      <p
        className={cn(
          'rounded-xl border border-amber-200 bg-amber-50/70 text-amber-950',
          kiosk ? 'px-4 py-3 text-base' : 'px-3 py-2 text-[12px]',
        )}
      >
        No measurement parameters on this inspection. Link an ACTIVE inspection plan (IN_PROCESS / FINAL)
        to the product or manufacturing profile so QC captures measurements.
      </p>
    )
  }

  const update = (parameterId: string, patch: Partial<QcParameterDraft>) => {
    onChange(drafts.map((r) => (r.parameterId === parameterId ? { ...r, ...patch } : r)))
  }

  if (kiosk) {
    return (
      <div className="grid gap-3">
        <p className="text-sm font-bold uppercase tracking-wide text-[#605e5c]">
          Measurements · {ordered.length} check{ordered.length === 1 ? '' : 's'}
        </p>
        {ordered.map((snap, index) => {
          const d = drafts.find((r) => r.parameterId === snap.parameterId)
          if (!d) return null
          const boolPass = d.measuredValue === 'true' || d.passed === true
          const boolFail = d.measuredValue === 'false' || d.passed === false
          return (
            <div key={snap.parameterId} className={kioskCardClass}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                    Check {index + 1}
                    {snap.mandatory ? ' · Required' : ''}
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#242424]">
                    <span className="font-mono text-[#0078d4]">{snap.parameterCode}</span>
                    <span className="mx-2 text-[#c8c6c4]">·</span>
                    {snap.parameterName}
                  </p>
                  {snap.minValue != null || snap.maxValue != null ? (
                    <p className="mt-1 text-sm text-[#605e5c]">
                      Spec {snap.minValue ?? '—'}–{snap.maxValue ?? '—'}
                      {snap.uomCode ? ` ${snap.uomCode}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              {snap.parameterType === 'BOOLEAN' || snap.passFailRule === 'BOOLEAN_TRUE' || snap.passFailRule === 'BOOLEAN_FALSE' ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={disabled}
                    className={boolPass ? kioskPrimaryBtn : kioskSecondaryBtn}
                    onClick={() =>
                      update(snap.parameterId, {
                        measuredValue: 'true',
                        passed: true,
                      })
                    }
                  >
                    Pass / Yes
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    className={boolFail ? kioskDangerBtn : kioskSecondaryBtn}
                    onClick={() =>
                      update(snap.parameterId, {
                        measuredValue: 'false',
                        passed: false,
                      })
                    }
                  >
                    Fail / No
                  </button>
                </div>
              ) : snap.parameterType === 'NUMERIC' ? (
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-[#242424]">
                    Measured{snap.uomCode ? ` (${snap.uomCode})` : ''}
                    {snap.mandatory ? ' *' : ''}
                  </span>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    disabled={disabled}
                    className={kioskInputClass}
                    value={d.measuredNumeric}
                    onChange={(e) => update(snap.parameterId, { measuredNumeric: e.target.value })}
                    placeholder="Enter measurement"
                  />
                </label>
              ) : snap.parameterType === 'DROPDOWN' && snap.dropdownOptions?.length ? (
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-[#242424]">
                    Value{snap.mandatory ? ' *' : ''}
                  </span>
                  <select
                    disabled={disabled}
                    className={kioskInputClass}
                    value={d.measuredValue}
                    onChange={(e) => update(snap.parameterId, { measuredValue: e.target.value })}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {snap.dropdownOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-[#242424]">
                    Value{snap.mandatory ? ' *' : ''}
                  </span>
                  <input
                    type="text"
                    disabled={disabled}
                    className={kioskInputClass}
                    value={d.measuredValue}
                    onChange={(e) => update(snap.parameterId, { measuredValue: e.target.value })}
                    placeholder="Enter value"
                  />
                </label>
              )}

              {snap.passFailRule === 'MANUAL' && snap.parameterType !== 'BOOLEAN' ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={disabled}
                    className={d.passed === true ? kioskPrimaryBtn : kioskSecondaryBtn}
                    onClick={() => update(snap.parameterId, { passed: true })}
                  >
                    Pass
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    className={d.passed === false ? kioskDangerBtn : kioskSecondaryBtn}
                    onClick={() => update(snap.parameterId, { passed: false })}
                  >
                    Fail
                  </button>
                </div>
              ) : null}

              <label className="mt-3 block">
                <span className="text-sm font-semibold text-[#242424]">
                  Remarks{snap.remarksRequired ? ' *' : ''}
                </span>
                <input
                  type="text"
                  disabled={disabled}
                  className={kioskInputClass}
                  value={d.remarks}
                  onChange={(e) => update(snap.parameterId, { remarks: e.target.value })}
                  placeholder="Optional notes"
                />
              </label>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={compact ? 'grid gap-2' : 'space-y-3'}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
        Measurements ({ordered.length})
      </p>
      {ordered.map((snap) => {
        const d = drafts.find((r) => r.parameterId === snap.parameterId)
        if (!d) return null
        return (
          <div
            key={snap.parameterId}
            className="rounded-md border border-erp-border bg-erp-surface px-3 py-2"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
              <span className="font-semibold text-erp-text">{snap.parameterCode}</span>
              <span className="text-erp-muted">{snap.parameterName}</span>
              {snap.mandatory ? (
                <span className="text-[10px] font-semibold uppercase text-rose-700">Required</span>
              ) : null}
              {snap.minValue != null || snap.maxValue != null ? (
                <span className="text-[11px] text-erp-muted">
                  Spec {snap.minValue ?? '—'}–{snap.maxValue ?? '—'} {snap.uomCode ?? ''}
                </span>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {snap.parameterType === 'NUMERIC' ? (
                <FormField label={`Measured${snap.uomCode ? ` (${snap.uomCode})` : ''}`} required={snap.mandatory}>
                  <Input
                    type="number"
                    step="any"
                    disabled={disabled}
                    value={d.measuredNumeric}
                    onChange={(e) => update(snap.parameterId, { measuredNumeric: e.target.value })}
                  />
                </FormField>
              ) : snap.parameterType === 'BOOLEAN' ? (
                <FormField label="Result" required={snap.mandatory}>
                  <Select
                    value={d.measuredValue}
                    disabled={disabled}
                    onChange={(e) =>
                      update(snap.parameterId, {
                        measuredValue: e.target.value,
                        passed: e.target.value === '' ? null : e.target.value === 'true',
                      })
                    }
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    <option value="true">Pass / Yes</option>
                    <option value="false">Fail / No</option>
                  </Select>
                </FormField>
              ) : snap.parameterType === 'DROPDOWN' && snap.dropdownOptions?.length ? (
                <FormField label="Value" required={snap.mandatory}>
                  <Select
                    value={d.measuredValue}
                    disabled={disabled}
                    onChange={(e) => update(snap.parameterId, { measuredValue: e.target.value })}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {snap.dropdownOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <FormField label="Value" required={snap.mandatory}>
                  <Input
                    disabled={disabled}
                    value={d.measuredValue}
                    onChange={(e) => update(snap.parameterId, { measuredValue: e.target.value })}
                  />
                </FormField>
              )}
              {snap.passFailRule === 'MANUAL' ? (
                <FormField label="Pass / Fail" required={snap.mandatory}>
                  <Select
                    value={d.passed == null ? '' : d.passed ? 'true' : 'false'}
                    disabled={disabled}
                    onChange={(e) =>
                      update(snap.parameterId, {
                        passed: e.target.value === '' ? null : e.target.value === 'true',
                      })
                    }
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    <option value="true">Pass</option>
                    <option value="false">Fail</option>
                  </Select>
                </FormField>
              ) : null}
              <div className="sm:col-span-2">
                <FormField label="Remarks" required={Boolean(snap.remarksRequired)}>
                  {compact ? (
                    <Input
                      disabled={disabled}
                      value={d.remarks}
                      onChange={(e) => update(snap.parameterId, { remarks: e.target.value })}
                    />
                  ) : (
                    <Textarea
                      disabled={disabled}
                      rows={2}
                      value={d.remarks}
                      onChange={(e) => update(snap.parameterId, { remarks: e.target.value })}
                    />
                  )}
                </FormField>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
