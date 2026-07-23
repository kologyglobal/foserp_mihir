/**
 * Gatekeeper flow: Vehicle Entry — find an expected vehicle by number (or
 * register a new one), confirm, and let it in.
 */

import { useEffect, useMemo, useState } from 'react'
import { gateService } from '../api/gateService'
import type { GateLocation, GateSettings, GateVehicle } from '../types/gate.types'
import {
  CallSupervisorButton,
  OperatorBigButton,
  OperatorComplete,
  OperatorEmptyResult,
  OperatorField,
  OperatorInput,
  OperatorResultCard,
  OperatorSearchBox,
  OperatorSecondaryButton,
  OperatorSectionLabel,
  OperatorSelect,
  OperatorStatusBanner,
  OperatorStepShell,
  OperatorSummaryCard,
  OperatorToggle,
  type OperatorStep,
} from './GateOperatorKit'

const VEHICLE_PURPOSES = [
  'Material delivery',
  'Material pickup',
  'Service / repair visit',
  'Customer / vendor visit',
  'Other',
]

interface VehicleFormState {
  vehicleNumber: string
  driverName: string
  vehicleType: string
  purpose: string
  companyName: string
  gate: string
  licenceChecked: boolean
}

const EMPTY_FORM: VehicleFormState = {
  vehicleNumber: '',
  driverName: '',
  vehicleType: '',
  purpose: '',
  companyName: '',
  gate: '',
  licenceChecked: false,
}

export function OperatorVehicleEntryPage() {
  const [step, setStep] = useState<OperatorStep>(1)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<GateVehicle[]>([])
  const [selected, setSelected] = useState<GateVehicle | null>(null)
  const [form, setForm] = useState<VehicleFormState>(EMPTY_FORM)
  const [isNewVehicle, setIsNewVehicle] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<GateVehicle | null>(null)

  const [locations, setLocations] = useState<GateLocation[]>([])
  const [settings, setSettings] = useState<GateSettings | null>(null)

  useEffect(() => {
    gateService.getGateLocations().then(setLocations).catch(() => {})
    gateService.getGateSettings().then(setSettings).catch(() => {})
  }, [])

  const vehicleGates = useMemo(
    () => locations.filter((l) => l.isActive && l.entryTypesAllowed.includes('vehicle')).map((l) => l.name),
    [locations],
  )
  const vehicleTypes = settings?.masters.vehicleTypes ?? ['Truck', 'Tempo', 'Car', 'Two-wheeler']

  function resetAll() {
    setStep(1)
    setSearched(false)
    setResults([])
    setSelected(null)
    setForm(EMPTY_FORM)
    setIsNewVehicle(false)
    setError(null)
    setCompleted(null)
  }

  async function runSearch(query: string) {
    setSearching(true)
    setSearched(false)
    setError(null)
    try {
      const all = await gateService.getVehicles({ search: query })
      setResults(all.filter((v) => ['expected', 'arrived', 'waiting'].includes(v.status)))
      setSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  async function allowSelectedIn() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      let current = selected
      if (current.status === 'expected') {
        current = await gateService.markVehicleArrived(current.id)
      }
      const inside = await gateService.allowVehicleInside(current.id)
      setCompleted(inside)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not let the vehicle in')
    } finally {
      setSaving(false)
    }
  }

  async function submitNewVehicle() {
    setError(null)
    if (!form.vehicleNumber.trim() || !form.driverName.trim()) {
      setError('Vehicle number and driver name are needed.')
      return
    }
    if (!form.vehicleType || !form.purpose || !form.gate) {
      setError('Pick the vehicle type, reason and gate.')
      return
    }
    setSaving(true)
    try {
      const created = await gateService.createVehicleEntry({
        vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
        vehicleType: form.vehicleType,
        purpose: form.purpose,
        companyName: form.companyName.trim() || undefined,
        driverName: form.driverName.trim(),
        licenceVerified: form.licenceChecked ? 'verified' : 'not_checked',
        gate: form.gate,
        markArrived: true,
      })
      const inside = await gateService.allowVehicleInside(created.id)
      setCompleted(inside)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register the vehicle')
    } finally {
      setSaving(false)
    }
  }

  if (step === 3 && completed) {
    return (
      <OperatorStepShell title="Vehicle Entry" step={3}>
        <OperatorComplete
          title="Vehicle is in"
          message={
            completed.currentLocation
              ? `Send the vehicle to: ${completed.currentLocation}`
              : 'Tell the driver where to go.'
          }
          rows={[
            { label: 'Vehicle', value: completed.vehicleNumber },
            { label: 'Driver', value: completed.driverName },
            { label: 'Entry number', value: completed.entryNumber },
            { label: 'Gate', value: completed.gate },
          ]}
          nextLabel="Next vehicle"
          onNext={resetAll}
        />
      </OperatorStepShell>
    )
  }

  if (step === 2) {
    if (selected && !isNewVehicle) {
      const rejected = selected.status === 'rejected'
      return (
        <OperatorStepShell title="Vehicle Entry" step={2} onBack={() => setStep(1)}>
          <OperatorSummaryCard
            rows={[
              { label: 'Vehicle', value: selected.vehicleNumber },
              { label: 'Driver', value: selected.driverName },
              { label: 'Company', value: selected.companyName },
              { label: 'Reason', value: selected.purpose },
              { label: 'Paper / document', value: selected.relatedDocument },
              { label: 'Gate', value: selected.gate },
            ]}
          />
          {rejected ? (
            <>
              <OperatorStatusBanner tone="red" title="This vehicle was rejected" message="Do not let it in." />
              <CallSupervisorButton reason={`Vehicle ${selected.vehicleNumber} was rejected`} />
            </>
          ) : (
            <>
              <OperatorStatusBanner tone="green" title="You can let this vehicle in" />
              <OperatorBigButton label="Vehicle In" tone="success" onClick={allowSelectedIn} loading={saving} />
            </>
          )}
          {error && <OperatorStatusBanner tone="red" title={error} />}
        </OperatorStepShell>
      )
    }

    return (
      <OperatorStepShell title="Vehicle Entry" step={2} onBack={() => setStep(1)}>
        <OperatorField label="Vehicle number" required>
          <OperatorInput
            value={form.vehicleNumber}
            onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))}
            placeholder="TN 01 AB 1234"
          />
        </OperatorField>
        <OperatorField label="Driver name" required>
          <OperatorInput
            value={form.driverName}
            onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))}
            placeholder="Driver full name"
          />
        </OperatorField>
        <OperatorField label="Vehicle type" required>
          <OperatorSelect
            value={form.vehicleType}
            onChange={(vehicleType) => setForm((f) => ({ ...f, vehicleType }))}
            options={vehicleTypes}
          />
        </OperatorField>
        <OperatorField label="Reason" required>
          <OperatorSelect
            value={form.purpose}
            onChange={(purpose) => setForm((f) => ({ ...f, purpose }))}
            options={VEHICLE_PURPOSES}
          />
        </OperatorField>
        <OperatorField label="Company (if any)">
          <OperatorInput
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            placeholder="Transporter / company"
          />
        </OperatorField>
        <OperatorField label="Gate" required>
          <OperatorSelect
            value={form.gate}
            onChange={(gate) => setForm((f) => ({ ...f, gate }))}
            options={vehicleGates}
          />
        </OperatorField>
        <OperatorToggle
          label="Driver licence checked"
          checked={form.licenceChecked}
          onChange={(licenceChecked) => setForm((f) => ({ ...f, licenceChecked }))}
        />
        {error && <OperatorStatusBanner tone="red" title={error} />}
        <OperatorBigButton label="Vehicle In" tone="success" onClick={submitNewVehicle} loading={saving} />
      </OperatorStepShell>
    )
  }

  return (
    <OperatorStepShell title="Vehicle Entry" step={1}>
      <OperatorSearchBox
        placeholder="Vehicle number or driver name"
        onSearch={runSearch}
        searching={searching}
      />

      {error && <OperatorStatusBanner tone="red" title={error} />}

      {searched && (
        <>
          <OperatorSectionLabel>Matching vehicles</OperatorSectionLabel>
          {results.length === 0 ? (
            <OperatorEmptyResult
              message="No vehicle found"
              hint="Check the number, or register it as a new vehicle below."
            />
          ) : (
            results.map((v) => (
              <OperatorResultCard
                key={v.id}
                title={v.vehicleNumber}
                lines={[
                  `${v.driverName}${v.companyName ? ` · ${v.companyName}` : ''}`,
                  v.purpose,
                ]}
                badge={
                  v.status === 'expected'
                    ? { label: 'Expected', tone: 'blue' }
                    : { label: 'At the gate', tone: 'amber' }
                }
                onClick={() => {
                  setSelected(v)
                  setIsNewVehicle(false)
                  setError(null)
                  setStep(2)
                }}
              />
            ))
          )}
        </>
      )}

      <OperatorSecondaryButton
        label="New vehicle (not in the list)"
        onClick={() => {
          setSelected(null)
          setIsNewVehicle(true)
          setForm(EMPTY_FORM)
          setError(null)
          setStep(2)
        }}
      />
    </OperatorStepShell>
  )
}
