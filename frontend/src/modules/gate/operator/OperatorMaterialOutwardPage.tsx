/**
 * Gatekeeper flow: Material Outward — find the outgoing document, run the
 * plain-language check, and release the vehicle. Documents that are not
 * approved cannot be released; the guard is told to call the supervisor.
 */

import { useState } from 'react'
import { gateService } from '../api/gateService'
import type { OutwardDocumentSearchResult } from '../api/gateServiceContract'
import type { MaterialOutwardEntry, OutwardChecklistKey } from '../types/gate.types'
import {
  CallSupervisorButton,
  OperatorBigButton,
  OperatorComplete,
  OperatorEmptyResult,
  OperatorField,
  OperatorInput,
  OperatorResultCard,
  OperatorSearchBox,
  OperatorSectionLabel,
  OperatorStatusBanner,
  OperatorStepShell,
  OperatorSummaryCard,
  OperatorToggle,
  type OperatorStep,
} from './GateOperatorKit'

/** Plain-language checklist copy for gatekeepers */
const CHECKLIST_LABELS: Record<OutwardChecklistKey, string> = {
  sourceApproved: 'The paper is approved',
  vehicleMatches: 'Vehicle number matches the paper',
  driverVerified: 'Driver name checked',
  packageCountMatches: 'Package count matches the paper',
  materialMatches: 'Material matches the paper',
  documentAvailable: 'Papers are with the driver',
  sealRecorded: 'Seal number noted',
  securityCheckDone: 'Security check done',
}

const CHECKLIST_KEYS = Object.keys(CHECKLIST_LABELS) as OutwardChecklistKey[]

type CompleteState =
  | { kind: 'released'; entry: MaterialOutwardEntry }
  | { kind: 'problem'; entry: MaterialOutwardEntry; note: string }

export function OperatorMaterialOutwardPage() {
  const [step, setStep] = useState<OperatorStep>(1)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<OutwardDocumentSearchResult[]>([])
  const [entry, setEntry] = useState<MaterialOutwardEntry | null>(null)
  const [checklist, setChecklist] = useState<Partial<Record<OutwardChecklistKey, boolean>>>({})
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [packagesVerified, setPackagesVerified] = useState('')
  const [problemNote, setProblemNote] = useState('')
  const [showProblemBox, setShowProblemBox] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState<CompleteState | null>(null)

  function resetAll() {
    setStep(1)
    setSearched(false)
    setResults([])
    setEntry(null)
    setChecklist({})
    setVehicleNumber('')
    setPackagesVerified('')
    setProblemNote('')
    setShowProblemBox(false)
    setError(null)
    setComplete(null)
  }

  async function runSearch(query: string) {
    setSearching(true)
    setSearched(false)
    setError(null)
    try {
      setResults(await gateService.searchOutwardDocuments(query))
      setSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  async function pickDocument(result: OutwardDocumentSearchResult) {
    if (!result.existingOutwardId) return
    setError(null)
    try {
      const loaded = await gateService.getMaterialOutwardById(result.existingOutwardId)
      setEntry(loaded)
      setChecklist({ ...loaded.checklist })
      setVehicleNumber(loaded.vehicleNumber ?? '')
      setPackagesVerified(
        loaded.packagesVerified != null ? String(loaded.packagesVerified) : String(loaded.packagesExpected),
      )
      setShowProblemBox(false)
      setProblemNote('')
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the document')
    }
  }

  async function releaseVehicle() {
    if (!entry) return
    setError(null)
    const unchecked = CHECKLIST_KEYS.filter((k) => !checklist[k])
    if (unchecked.length > 0) {
      setError(`Finish the check first — ${unchecked.length} item${unchecked.length === 1 ? '' : 's'} left.`)
      return
    }
    setSaving(true)
    try {
      await gateService.verifyMaterialOutward(entry.id, {
        checklist,
        vehicleNumber: vehicleNumber.trim() || undefined,
        packagesVerified: Number(packagesVerified) || undefined,
      })
      const released = await gateService.releaseMaterialOutward(entry.id)
      setComplete({ kind: 'released', entry: released })
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not release the vehicle')
    } finally {
      setSaving(false)
    }
  }

  async function reportProblem() {
    if (!entry) return
    if (!problemNote.trim()) {
      setError('Write what is wrong before sending.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await gateService.reportMaterialMismatch(entry.id, problemNote.trim())
      setComplete({ kind: 'problem', entry: updated, note: problemNote.trim() })
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not report the problem')
    } finally {
      setSaving(false)
    }
  }

  if (step === 3 && complete) {
    const e = complete.entry
    if (complete.kind === 'released') {
      return (
        <OperatorStepShell title="Material Outward" step={3}>
          <OperatorComplete
            title="Vehicle released"
            message="The material can leave. Give the papers back to the driver."
            rows={[
              { label: 'Document', value: e.documentNumber },
              { label: 'Party', value: e.partyName },
              { label: 'Vehicle', value: e.vehicleNumber },
              { label: 'Packages', value: String(e.packagesVerified ?? e.packagesExpected) },
            ]}
            nextLabel="Next document"
            onNext={resetAll}
          />
        </OperatorStepShell>
      )
    }
    return (
      <OperatorStepShell title="Material Outward" step={3}>
        <OperatorComplete
          tone="red"
          title="Problem reported — vehicle held"
          message={`Do not let the vehicle leave. Your note: "${complete.note}". A supervisor will check it.`}
          rows={[
            { label: 'Document', value: e.documentNumber },
            { label: 'Vehicle', value: e.vehicleNumber },
          ]}
          nextLabel="Next document"
          onNext={resetAll}
        />
      </OperatorStepShell>
    )
  }

  if (step === 2 && entry) {
    const approved = entry.documentApproved && entry.approvalStatus === 'approved'
    return (
      <OperatorStepShell title="Material Outward" step={2} onBack={() => setStep(1)}>
        <OperatorSummaryCard
          rows={[
            { label: 'Document', value: `${entry.documentType} ${entry.documentNumber}` },
            { label: 'Party', value: entry.partyName },
            { label: 'Material', value: entry.materialSummary },
            { label: 'Packages on paper', value: String(entry.packagesExpected) },
            { label: 'Driver', value: entry.driverName },
          ]}
        />

        {!approved ? (
          <>
            <OperatorStatusBanner
              tone="red"
              title="This paper is NOT approved"
              message="Do not release the vehicle. Call the supervisor."
            />
            <CallSupervisorButton reason={`Outward document ${entry.documentNumber} is not approved`} />
          </>
        ) : (
          <>
            <OperatorStatusBanner tone="green" title="Paper is approved" message="Now check each point below." />

            <OperatorSectionLabel>Check before release</OperatorSectionLabel>
            {CHECKLIST_KEYS.map((key) => (
              <OperatorToggle
                key={key}
                label={CHECKLIST_LABELS[key]}
                checked={Boolean(checklist[key])}
                onChange={(checked) => setChecklist((c) => ({ ...c, [key]: checked }))}
              />
            ))}

            <OperatorField label="Vehicle number">
              <OperatorInput
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="TN 01 AB 1234"
              />
            </OperatorField>
            <OperatorField label="Packages you counted">
              <OperatorInput
                value={packagesVerified}
                onChange={(e) => setPackagesVerified(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
              />
            </OperatorField>

            {error && <OperatorStatusBanner tone="red" title={error} />}

            <OperatorBigButton label="Release Vehicle" tone="success" onClick={releaseVehicle} loading={saving} />

            {!showProblemBox ? (
              <button
                type="button"
                onClick={() => setShowProblemBox(true)}
                className="w-full py-2 text-center text-base font-semibold text-red-600 underline"
              >
                Something is wrong — report it
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
                <OperatorField label="What is wrong?" required>
                  <OperatorInput
                    value={problemNote}
                    onChange={(e) => setProblemNote(e.target.value)}
                    placeholder="e.g. Only 8 packages, paper says 10"
                  />
                </OperatorField>
                <OperatorBigButton label="Hold Vehicle & Report" tone="danger" onClick={reportProblem} loading={saving} />
                <CallSupervisorButton reason={`Problem with outward document ${entry.documentNumber}`} />
              </div>
            )}
          </>
        )}
        {!approved && error && <OperatorStatusBanner tone="red" title={error} />}
      </OperatorStepShell>
    )
  }

  return (
    <OperatorStepShell title="Material Outward" step={1}>
      <OperatorStatusBanner
        tone="amber"
        title="Release only with an approved paper"
        message="Every outgoing material needs an approved document. No paper — no release."
      />
      <OperatorSearchBox
        placeholder="Document number, party or vehicle"
        hint="Take the paper from the driver. Scan or type the document number."
        onSearch={runSearch}
        searching={searching}
      />

      {error && <OperatorStatusBanner tone="red" title={error} />}

      {searched && (
        <>
          <OperatorSectionLabel>Matching documents</OperatorSectionLabel>
          {results.length === 0 ? (
            <OperatorEmptyResult
              message="No document found"
              hint="Check the number on the paper. If it is still not found, call the supervisor."
            />
          ) : (
            results.map((r) => (
              <OperatorResultCard
                key={`${r.documentNumber}-${r.existingOutwardId ?? ''}`}
                title={r.documentNumber}
                lines={[r.partyName ?? '', `${r.materialSummary} · ${r.packagesExpected} packages`]}
                badge={
                  r.approved
                    ? { label: 'Approved', tone: 'green' }
                    : { label: 'Not approved — do not release', tone: 'red' }
                }
                onClick={() => pickDocument(r)}
              />
            ))
          )}
          {searched && results.length === 0 && <CallSupervisorButton reason="Outward document not found in the system" />}
        </>
      )}
    </OperatorStepShell>
  )
}
