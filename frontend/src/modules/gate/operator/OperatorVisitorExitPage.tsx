/**
 * Gatekeeper flow: Visitor Exit — pick from the "inside now" list (or search),
 * confirm badge return, done.
 */

import { useEffect, useMemo, useState } from 'react'
import { gateService } from '../api/gateService'
import { durationSince } from '../utils/gateStatus'
import type { VisitorVisit } from '../types/gate.types'
import {
  OperatorBigButton,
  OperatorComplete,
  OperatorEmptyResult,
  OperatorField,
  OperatorInput,
  OperatorResultCard,
  OperatorSectionLabel,
  OperatorStatusBanner,
  OperatorStepShell,
  OperatorSummaryCard,
  OperatorToggle,
  type OperatorStep,
} from './GateOperatorKit'

export function OperatorVisitorExitPage() {
  const [step, setStep] = useState<OperatorStep>(1)
  const [loading, setLoading] = useState(true)
  const [insideVisitors, setInsideVisitors] = useState<VisitorVisit[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VisitorVisit | null>(null)
  const [badgeReturned, setBadgeReturned] = useState(true)
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<VisitorVisit | null>(null)

  async function loadInside() {
    setLoading(true)
    try {
      const all = await gateService.getVisitors()
      setInsideVisitors(all.filter((v) => ['inside', 'overstayed'].includes(v.status)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load visitors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInside()
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return insideVisitors
    return insideVisitors.filter((v) =>
      [v.visitorName, v.mobile, v.company, v.entryNumber, v.hostName].some((f) =>
        f?.toLowerCase().includes(term),
      ),
    )
  }, [insideVisitors, query])

  function resetAll() {
    setStep(1)
    setSelected(null)
    setBadgeReturned(true)
    setRemarks('')
    setError(null)
    setCompleted(null)
    setQuery('')
    loadInside()
  }

  async function recordExit() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const updated = await gateService.recordVisitorExit(selected.id, {
        badgeReturned,
        exitRemarks: remarks.trim() || undefined,
      })
      setCompleted(updated)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the exit')
    } finally {
      setSaving(false)
    }
  }

  if (step === 3 && completed) {
    return (
      <OperatorStepShell title="Visitor Exit" step={3}>
        <OperatorComplete
          title="Visitor is out"
          message={badgeReturned ? undefined : 'Badge was NOT returned — tell your supervisor.'}
          tone={badgeReturned ? 'green' : 'amber'}
          rows={[
            { label: 'Visitor', value: completed.visitorName },
            { label: 'Pass number', value: completed.entryNumber },
            { label: 'Was meeting', value: completed.hostName },
          ]}
          nextLabel="Next visitor"
          onNext={resetAll}
        />
      </OperatorStepShell>
    )
  }

  if (step === 2 && selected) {
    return (
      <OperatorStepShell title="Visitor Exit" step={2} onBack={() => setStep(1)}>
        <OperatorSummaryCard
          rows={[
            { label: 'Visitor', value: selected.visitorName },
            { label: 'Company', value: selected.company },
            { label: 'Was meeting', value: selected.hostName },
            { label: 'Inside for', value: durationSince(selected.entryTime) },
            { label: 'Gate', value: selected.gate },
          ]}
        />
        <OperatorToggle
          label="Visitor badge is returned"
          checked={badgeReturned}
          onChange={setBadgeReturned}
        />
        <OperatorField label="Note (only if something is unusual)">
          <OperatorInput
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional"
          />
        </OperatorField>
        {error && <OperatorStatusBanner tone="red" title={error} />}
        <OperatorBigButton label="Record Exit" tone="success" onClick={recordExit} loading={saving} />
      </OperatorStepShell>
    )
  }

  return (
    <OperatorStepShell title="Visitor Exit" step={1}>
      <OperatorField label="Find the visitor">
        <OperatorInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, mobile or pass number"
          autoFocus
        />
      </OperatorField>

      <OperatorSectionLabel>
        Inside now ({filtered.length})
      </OperatorSectionLabel>

      {loading ? (
        <OperatorEmptyResult message="Loading…" />
      ) : filtered.length === 0 ? (
        <OperatorEmptyResult
          message={query ? 'No visitor matches' : 'No visitors are inside right now'}
          hint={query ? 'Check the spelling or pass number.' : undefined}
        />
      ) : (
        filtered.map((v) => (
          <OperatorResultCard
            key={v.id}
            title={v.visitorName}
            lines={[v.company ?? '', `Meeting ${v.hostName} · inside for ${durationSince(v.entryTime)}`]}
            badge={
              v.status === 'overstayed'
                ? { label: 'Inside too long', tone: 'amber' }
                : { label: 'Inside', tone: 'green' }
            }
            onClick={() => {
              setSelected(v)
              setBadgeReturned(true)
              setRemarks('')
              setError(null)
              setStep(2)
            }}
          />
        ))
      )}
      {error && <OperatorStatusBanner tone="red" title={error} />}
    </OperatorStepShell>
  )
}
