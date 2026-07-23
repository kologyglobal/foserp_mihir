/**
 * Gatekeeper flow: Vehicle Exit — pick from vehicles inside, confirm a quick
 * check, and let the vehicle out.
 */

import { useEffect, useMemo, useState } from 'react'
import { gateService } from '../api/gateService'
import { durationSince } from '../utils/gateStatus'
import type { GateVehicle } from '../types/gate.types'
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

const INSIDE_STATUSES = ['allowed_inside', 'loading', 'unloading', 'ready_exit']

export function OperatorVehicleExitPage() {
  const [step, setStep] = useState<OperatorStep>(1)
  const [loading, setLoading] = useState(true)
  const [insideVehicles, setInsideVehicles] = useState<GateVehicle[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<GateVehicle | null>(null)
  const [vehicleChecked, setVehicleChecked] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<GateVehicle | null>(null)

  async function loadInside() {
    setLoading(true)
    try {
      const all = await gateService.getVehicles()
      setInsideVehicles(all.filter((v) => INSIDE_STATUSES.includes(v.status)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load vehicles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInside()
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return insideVehicles
    return insideVehicles.filter((v) =>
      [v.vehicleNumber, v.driverName, v.companyName, v.entryNumber].some((f) =>
        f?.toLowerCase().includes(term),
      ),
    )
  }, [insideVehicles, query])

  function resetAll() {
    setStep(1)
    setSelected(null)
    setVehicleChecked(false)
    setRemarks('')
    setError(null)
    setCompleted(null)
    setQuery('')
    loadInside()
  }

  async function letVehicleOut() {
    if (!selected) return
    if (!vehicleChecked) {
      setError('Check the vehicle before letting it out, then tick the box.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (selected.status !== 'ready_exit') {
        await gateService.markVehicleReadyForExit(selected.id)
      }
      const updated = await gateService.recordVehicleExit(selected.id, remarks.trim() || undefined)
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
      <OperatorStepShell title="Vehicle Exit" step={3}>
        <OperatorComplete
          title="Vehicle is out"
          rows={[
            { label: 'Vehicle', value: completed.vehicleNumber },
            { label: 'Driver', value: completed.driverName },
            { label: 'Entry number', value: completed.entryNumber },
          ]}
          nextLabel="Next vehicle"
          onNext={resetAll}
        />
      </OperatorStepShell>
    )
  }

  if (step === 2 && selected) {
    return (
      <OperatorStepShell title="Vehicle Exit" step={2} onBack={() => setStep(1)}>
        <OperatorSummaryCard
          rows={[
            { label: 'Vehicle', value: selected.vehicleNumber },
            { label: 'Driver', value: selected.driverName },
            { label: 'Company', value: selected.companyName },
            { label: 'Now at', value: selected.currentLocation },
            { label: 'Inside for', value: durationSince(selected.entryTime) },
          ]}
        />
        <OperatorToggle
          label="I checked the vehicle and the driver's papers"
          checked={vehicleChecked}
          onChange={setVehicleChecked}
        />
        <OperatorField label="Note (only if something is unusual)">
          <OperatorInput
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional"
          />
        </OperatorField>
        {error && <OperatorStatusBanner tone="red" title={error} />}
        <OperatorBigButton
          label="Let Vehicle Out"
          tone="success"
          onClick={letVehicleOut}
          loading={saving}
        />
      </OperatorStepShell>
    )
  }

  return (
    <OperatorStepShell title="Vehicle Exit" step={1}>
      <OperatorField label="Find the vehicle">
        <OperatorInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Vehicle number or driver name"
          autoFocus
        />
      </OperatorField>

      <OperatorSectionLabel>Inside now ({filtered.length})</OperatorSectionLabel>

      {loading ? (
        <OperatorEmptyResult message="Loading…" />
      ) : filtered.length === 0 ? (
        <OperatorEmptyResult
          message={query ? 'No vehicle matches' : 'No vehicles are inside right now'}
          hint={query ? 'Check the vehicle number.' : undefined}
        />
      ) : (
        filtered.map((v) => (
          <OperatorResultCard
            key={v.id}
            title={v.vehicleNumber}
            lines={[
              `${v.driverName}${v.companyName ? ` · ${v.companyName}` : ''}`,
              `${v.currentLocation ?? 'Inside'} · in for ${durationSince(v.entryTime)}`,
            ]}
            badge={
              v.status === 'ready_exit'
                ? { label: 'Ready to leave', tone: 'green' }
                : { label: 'Inside', tone: 'blue' }
            }
            onClick={() => {
              setSelected(v)
              setVehicleChecked(false)
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
