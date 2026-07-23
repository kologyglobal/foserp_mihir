/**
 * Gatekeeper flow: Material Inward — enter the PO / paper reference, confirm
 * the minimum details, and register the arrival. Gate inward never posts
 * inventory or creates a GRN — the store team takes over after this.
 */

import { useEffect, useMemo, useState } from 'react'
import { gateService } from '../api/gateService'
import type { GateLocation, MaterialInwardEntry } from '../types/gate.types'
import {
  OperatorBigButton,
  OperatorComplete,
  OperatorField,
  OperatorInput,
  OperatorSearchBox,
  OperatorSecondaryButton,
  OperatorSelect,
  OperatorStatusBanner,
  OperatorStepShell,
  type OperatorStep,
} from './GateOperatorKit'

interface InwardFormState {
  withoutPo: boolean
  poNumber: string
  vendorName: string
  materialSummary: string
  packages: string
  vehicleNumber: string
  driverName: string
  gate: string
}

const EMPTY_FORM: InwardFormState = {
  withoutPo: false,
  poNumber: '',
  vendorName: '',
  materialSummary: '',
  packages: '',
  vehicleNumber: '',
  driverName: '',
  gate: '',
}

export function OperatorMaterialInwardPage() {
  const [step, setStep] = useState<OperatorStep>(1)
  const [form, setForm] = useState<InwardFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<MaterialInwardEntry | null>(null)
  const [locations, setLocations] = useState<GateLocation[]>([])

  useEffect(() => {
    gateService.getGateLocations().then(setLocations).catch(() => {})
  }, [])

  const materialGates = useMemo(
    () =>
      locations
        .filter((l) => l.isActive && l.entryTypesAllowed.includes('material_inward'))
        .map((l) => l.name),
    [locations],
  )

  function resetAll() {
    setStep(1)
    setForm(EMPTY_FORM)
    setError(null)
    setCompleted(null)
  }

  function startWithReference(query: string) {
    const looksLikePo = /po|ord/i.test(query) || /^\d{3,}/.test(query)
    setForm({
      ...EMPTY_FORM,
      withoutPo: false,
      poNumber: looksLikePo ? query : '',
      vendorName: looksLikePo ? '' : query,
    })
    setError(null)
    setStep(2)
  }

  function startWithoutPo() {
    setForm({ ...EMPTY_FORM, withoutPo: true })
    setError(null)
    setStep(2)
  }

  async function registerArrival() {
    setError(null)
    if (!form.vendorName.trim()) {
      setError('Enter who sent the material (vendor / party name).')
      return
    }
    if (!form.withoutPo && !form.poNumber.trim()) {
      setError('Enter the PO number from the papers, or go back and choose "No PO".')
      return
    }
    if (!form.materialSummary.trim()) {
      setError('Write in one line what material has come.')
      return
    }
    const packages = Number(form.packages)
    if (!Number.isFinite(packages) || packages <= 0) {
      setError('Count the packages and enter the number.')
      return
    }
    if (!form.vehicleNumber.trim()) {
      setError('Enter the vehicle number.')
      return
    }
    if (!form.gate) {
      setError('Pick the gate.')
      return
    }
    setSaving(true)
    try {
      const created = await gateService.createMaterialInward({
        inwardType: form.withoutPo ? 'without_po' : 'purchase_order',
        vendorName: form.vendorName.trim(),
        poNumber: form.withoutPo ? undefined : form.poNumber.trim(),
        vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
        driverName: form.driverName.trim() || undefined,
        materialSummary: form.materialSummary.trim(),
        packages,
        gate: form.gate,
      })
      setCompleted(created)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register the arrival')
    } finally {
      setSaving(false)
    }
  }

  if (step === 3 && completed) {
    const withoutPo = completed.inwardType === 'without_po'
    return (
      <OperatorStepShell title="Material Inward" step={3}>
        <OperatorComplete
          tone={withoutPo ? 'amber' : 'green'}
          title="Arrival registered"
          message={
            withoutPo
              ? 'There is no PO, so a supervisor approval request has been sent. Keep the vehicle waiting until it is approved.'
              : 'The store team has been informed. Do not unload until the store team comes.'
          }
          rows={[
            { label: 'Entry number', value: completed.entryNumber },
            { label: 'From', value: completed.vendorName },
            { label: 'Vehicle', value: completed.vehicleNumber },
            { label: 'Packages', value: String(completed.packages) },
          ]}
          nextLabel="Next arrival"
          onNext={resetAll}
        />
      </OperatorStepShell>
    )
  }

  if (step === 2) {
    return (
      <OperatorStepShell title="Material Inward" step={2} onBack={() => setStep(1)}>
        {form.withoutPo && (
          <OperatorStatusBanner
            tone="amber"
            title="No PO"
            message="A supervisor approval request will be sent automatically. The vehicle waits until it is approved."
          />
        )}
        <OperatorField label="Who sent it (vendor / party)" required>
          <OperatorInput
            value={form.vendorName}
            onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
            placeholder="Vendor name from the papers"
          />
        </OperatorField>
        {!form.withoutPo && (
          <OperatorField label="PO number (from the papers)" required>
            <OperatorInput
              value={form.poNumber}
              onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))}
              placeholder="e.g. PO-2026-0142"
            />
          </OperatorField>
        )}
        <OperatorField label="What material has come" required>
          <OperatorInput
            value={form.materialSummary}
            onChange={(e) => setForm((f) => ({ ...f, materialSummary: e.target.value }))}
            placeholder="e.g. Steel sheets, 20 bundles"
          />
        </OperatorField>
        <OperatorField label="Number of packages" required>
          <OperatorInput
            value={form.packages}
            onChange={(e) => setForm((f) => ({ ...f, packages: e.target.value.replace(/[^\d]/g, '') }))}
            placeholder="Count them"
            inputMode="numeric"
          />
        </OperatorField>
        <OperatorField label="Vehicle number" required>
          <OperatorInput
            value={form.vehicleNumber}
            onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))}
            placeholder="TN 01 AB 1234"
          />
        </OperatorField>
        <OperatorField label="Driver name">
          <OperatorInput
            value={form.driverName}
            onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))}
            placeholder="Optional"
          />
        </OperatorField>
        <OperatorField label="Gate" required>
          <OperatorSelect
            value={form.gate}
            onChange={(gate) => setForm((f) => ({ ...f, gate }))}
            options={materialGates}
          />
        </OperatorField>
        {error && <OperatorStatusBanner tone="red" title={error} />}
        <OperatorBigButton
          label="Material Arrived"
          tone="success"
          onClick={registerArrival}
          loading={saving}
        />
      </OperatorStepShell>
    )
  }

  return (
    <OperatorStepShell title="Material Inward" step={1}>
      <OperatorStatusBanner
        tone="amber"
        title="Gate entry only"
        message="You only record that the material arrived. The store team counts and accepts it later."
      />
      <OperatorSearchBox
        placeholder="PO number or vendor name from the papers"
        hint="Look at the delivery papers. Scan or type the PO number, then press Search."
        onSearch={startWithReference}
      />
      <OperatorSecondaryButton label="No PO / no papers" onClick={startWithoutPo} />
    </OperatorStepShell>
  )
}
