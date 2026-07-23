/**
 * Gatekeeper flow: Visitor Entry — Search → Confirm → Complete.
 * Finds expected visitors, repeat visitors and already-registered visits by
 * mobile / name / pass number, prefills everything it can, and keeps approval
 * states in plain language.
 */

import { useEffect, useMemo, useState } from 'react'
import { gateService } from '../api/gateService'
import { GATE_HOSTS } from '../gateUi'
import type {
  ExpectedVisitor,
  GateLocation,
  GateSettings,
  Visitor,
  VisitorVisit,
} from '../types/gate.types'
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

interface VisitorFormState {
  visitorName: string
  mobile: string
  company: string
  hostName: string
  purpose: string
  gate: string
  vehicleNumber: string
  safetyAccepted: boolean
  expectedVisitorId?: string
}

const EMPTY_FORM: VisitorFormState = {
  visitorName: '',
  mobile: '',
  company: '',
  hostName: '',
  purpose: '',
  gate: '',
  vehicleNumber: '',
  safetyAccepted: false,
}

type CompleteState =
  | { kind: 'inside'; visit: VisitorVisit }
  | { kind: 'waiting'; visit: VisitorVisit }

export function OperatorVisitorEntryPage() {
  const [step, setStep] = useState<OperatorStep>(1)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expectedResults, setExpectedResults] = useState<ExpectedVisitor[]>([])
  const [visitResults, setVisitResults] = useState<VisitorVisit[]>([])
  const [profileResult, setProfileResult] = useState<Visitor | null>(null)

  const [existingVisit, setExistingVisit] = useState<VisitorVisit | null>(null)
  const [form, setForm] = useState<VisitorFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState<CompleteState | null>(null)

  const [locations, setLocations] = useState<GateLocation[]>([])
  const [settings, setSettings] = useState<GateSettings | null>(null)

  useEffect(() => {
    gateService.getGateLocations().then(setLocations).catch(() => {})
    gateService.getGateSettings().then(setSettings).catch(() => {})
  }, [])

  const visitorGates = useMemo(
    () => locations.filter((l) => l.isActive && l.entryTypesAllowed.includes('visitor')).map((l) => l.name),
    [locations],
  )
  const purposes = settings?.masters.visitPurposes ?? ['Meeting', 'Delivery', 'Interview', 'Service visit']
  const hostNames = GATE_HOSTS.map((h) => h.name)

  function resetAll() {
    setStep(1)
    setSearched(false)
    setExpectedResults([])
    setVisitResults([])
    setProfileResult(null)
    setExistingVisit(null)
    setForm(EMPTY_FORM)
    setBlockedReason(null)
    setError(null)
    setComplete(null)
  }

  async function runSearch(query: string) {
    setSearching(true)
    setSearched(false)
    setBlockedReason(null)
    setError(null)
    try {
      const [expected, visits, profile] = await Promise.all([
        gateService.getExpectedVisitors({ search: query }),
        gateService.getVisitors({ search: query }),
        /\d{4,}/.test(query.replace(/\D/g, ''))
          ? gateService.searchVisitorByMobile(query)
          : Promise.resolve(null),
      ])
      setExpectedResults(expected.filter((e) => e.status === 'expected'))
      setVisitResults(
        visits.filter((v) => ['arrived', 'waiting_approval', 'approved', 'expected'].includes(v.status)),
      )
      setProfileResult(profile)
      setSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  function pickExpected(e: ExpectedVisitor) {
    setExistingVisit(null)
    setForm({
      visitorName: e.visitorName,
      mobile: e.mobile,
      company: e.company ?? '',
      hostName: e.hostName,
      purpose: e.purpose,
      gate: e.gate,
      vehicleNumber: e.vehicleNumber ?? '',
      safetyAccepted: false,
      expectedVisitorId: e.id,
    })
    setStep(2)
  }

  function pickProfile(p: Visitor) {
    if (p.isBlacklisted) {
      setBlockedReason(
        `${p.name} is blacklisted${p.blacklistReason ? ` — ${p.blacklistReason}` : ''}. Do not allow entry.`,
      )
      return
    }
    setExistingVisit(null)
    setForm({
      ...EMPTY_FORM,
      visitorName: p.name,
      mobile: p.mobile,
      company: p.company ?? '',
      hostName: p.lastHost ?? '',
      vehicleNumber: p.lastVehicleNumber ?? '',
    })
    setStep(2)
  }

  function pickVisit(v: VisitorVisit) {
    setExistingVisit(v)
    setStep(2)
  }

  function startNewVisitor() {
    setExistingVisit(null)
    setForm(EMPTY_FORM)
    setStep(2)
  }

  async function allowExistingVisitIn() {
    if (!existingVisit) return
    setSaving(true)
    setError(null)
    try {
      const updated = await gateService.recordVisitorEntry(existingVisit.id)
      setComplete({ kind: 'inside', visit: updated })
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record entry')
    } finally {
      setSaving(false)
    }
  }

  async function submitNewEntry() {
    setError(null)
    if (!form.visitorName.trim() || !form.mobile.trim()) {
      setError('Visitor name and mobile number are needed.')
      return
    }
    if (!form.hostName || !form.purpose || !form.gate) {
      setError('Pick who they are meeting, why, and which gate.')
      return
    }
    if (!form.safetyAccepted) {
      setError('Read the safety rules to the visitor and tick the box.')
      return
    }
    setSaving(true)
    try {
      const host = GATE_HOSTS.find((h) => h.name === form.hostName)
      const created = await gateService.createVisitorEntry({
        visitorName: form.visitorName.trim(),
        mobile: form.mobile.trim(),
        company: form.company.trim() || undefined,
        visitorType: 'other',
        visitorCount: 1,
        hostName: form.hostName,
        department: host?.department ?? 'Administration',
        purpose: form.purpose,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
        laptopCarried: false,
        equipmentCarried: false,
        bagCount: 0,
        safetyDeclarationAccepted: true,
        ppeRequired: false,
        ndaRequired: false,
        hostApprovalRequired: false,
        gate: form.gate,
        mode: form.expectedVisitorId ? 'expected' : 'walk_in',
        expectedVisitorId: form.expectedVisitorId,
      })
      if (created.approvalStatus === 'pending') {
        setComplete({ kind: 'waiting', visit: created })
        setStep(3)
      } else {
        const inside = await gateService.recordVisitorEntry(created.id)
        setComplete({ kind: 'inside', visit: inside })
        setStep(3)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not register the visitor'
      if (message.toLowerCase().includes('blacklist')) {
        setBlockedReason(message)
        setStep(1)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Step 3 ──────────────────────────────────────────────────────────────────
  if (step === 3 && complete) {
    const v = complete.visit
    const rows = [
      { label: 'Pass number', value: v.entryNumber },
      { label: 'Visitor', value: v.visitorName },
      { label: 'Meeting', value: v.hostName },
      { label: 'Gate', value: v.gate },
    ]
    return (
      <OperatorStepShell title="Visitor Entry" step={3}>
        {complete.kind === 'inside' ? (
          <OperatorComplete
            title="Visitor is in"
            message="Give the visitor a badge and tell them where to go."
            rows={rows}
            nextLabel="Next visitor"
            onNext={resetAll}
          />
        ) : (
          <OperatorComplete
            tone="amber"
            title="Waiting for approval"
            message={`${v.hostName} must approve this visit first. Ask the visitor to wait at the gate.`}
            rows={rows}
            nextLabel="Next visitor"
            onNext={resetAll}
          />
        )}
      </OperatorStepShell>
    )
  }

  // ── Step 2 ──────────────────────────────────────────────────────────────────
  if (step === 2) {
    if (existingVisit) {
      const v = existingVisit
      const canEnter =
        v.approvalStatus === 'approved' || v.approvalStatus === 'not_required'
      return (
        <OperatorStepShell title="Visitor Entry" step={2} onBack={() => setStep(1)}>
          <OperatorSummaryCard
            rows={[
              { label: 'Pass number', value: v.entryNumber },
              { label: 'Visitor', value: v.visitorName },
              { label: 'Mobile', value: v.mobile },
              { label: 'Company', value: v.company },
              { label: 'Meeting', value: v.hostName },
              { label: 'Reason', value: v.purpose },
              { label: 'Gate', value: v.gate },
            ]}
          />
          {canEnter ? (
            <>
              <OperatorStatusBanner tone="green" title="Approved — you can let this visitor in" />
              <OperatorBigButton label="Allow In" tone="success" onClick={allowExistingVisitIn} loading={saving} />
            </>
          ) : v.approvalStatus === 'rejected' ? (
            <>
              <OperatorStatusBanner
                tone="red"
                title="Entry rejected"
                message={v.approvalRemarks || 'Do not allow this visitor in.'}
              />
              <CallSupervisorButton reason={`Visitor ${v.visitorName} was rejected`} />
            </>
          ) : (
            <>
              <OperatorStatusBanner
                tone="amber"
                title="Still waiting for approval"
                message={`${v.hostName} has not approved this visit yet. Ask the visitor to wait.`}
              />
              <CallSupervisorButton reason={`Approval pending for visitor ${v.visitorName}`} />
            </>
          )}
          {error && <OperatorStatusBanner tone="red" title={error} />}
        </OperatorStepShell>
      )
    }

    return (
      <OperatorStepShell title="Visitor Entry" step={2} onBack={() => setStep(1)}>
        <OperatorField label="Visitor name" required>
          <OperatorInput
            value={form.visitorName}
            onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))}
            placeholder="Full name"
          />
        </OperatorField>
        <OperatorField label="Mobile number" required>
          <OperatorInput
            value={form.mobile}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            placeholder="10-digit mobile"
            inputMode="tel"
          />
        </OperatorField>
        <OperatorField label="Company (if any)">
          <OperatorInput
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Company name"
          />
        </OperatorField>
        <OperatorField label="Meeting whom" required>
          <OperatorSelect
            value={form.hostName}
            onChange={(hostName) => setForm((f) => ({ ...f, hostName }))}
            options={hostNames}
          />
        </OperatorField>
        <OperatorField label="Reason for visit" required>
          <OperatorSelect
            value={form.purpose}
            onChange={(purpose) => setForm((f) => ({ ...f, purpose }))}
            options={purposes}
          />
        </OperatorField>
        <OperatorField label="Gate" required>
          <OperatorSelect
            value={form.gate}
            onChange={(gate) => setForm((f) => ({ ...f, gate }))}
            options={visitorGates}
          />
        </OperatorField>
        <OperatorField label="Vehicle number (if any)">
          <OperatorInput
            value={form.vehicleNumber}
            onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))}
            placeholder="TN 01 AB 1234"
          />
        </OperatorField>
        <OperatorToggle
          label="I read the safety rules to the visitor"
          checked={form.safetyAccepted}
          onChange={(safetyAccepted) => setForm((f) => ({ ...f, safetyAccepted }))}
        />
        {error && <OperatorStatusBanner tone="red" title={error} />}
        <OperatorBigButton label="Allow In" tone="success" onClick={submitNewEntry} loading={saving} />
      </OperatorStepShell>
    )
  }

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  return (
    <OperatorStepShell title="Visitor Entry" step={1}>
      <OperatorSearchBox
        placeholder="Mobile number, name or pass number"
        onSearch={runSearch}
        searching={searching}
      />

      {blockedReason && (
        <>
          <OperatorStatusBanner tone="red" title="Do not allow entry" message={blockedReason} />
          <CallSupervisorButton reason={blockedReason} />
        </>
      )}
      {error && <OperatorStatusBanner tone="red" title={error} />}

      {searched && (
        <>
          {visitResults.length > 0 && (
            <>
              <OperatorSectionLabel>Already registered</OperatorSectionLabel>
              {visitResults.map((v) => (
                <OperatorResultCard
                  key={v.id}
                  title={v.visitorName}
                  lines={[v.company ?? '', `Meeting ${v.hostName} · ${v.entryNumber}`]}
                  badge={
                    v.approvalStatus === 'approved' || v.approvalStatus === 'not_required'
                      ? { label: 'Approved — allow in', tone: 'green' }
                      : v.approvalStatus === 'rejected'
                        ? { label: 'Rejected', tone: 'red' }
                        : { label: 'Waiting approval', tone: 'amber' }
                  }
                  onClick={() => pickVisit(v)}
                />
              ))}
            </>
          )}

          {expectedResults.length > 0 && (
            <>
              <OperatorSectionLabel>Expected today</OperatorSectionLabel>
              {expectedResults.map((e) => (
                <OperatorResultCard
                  key={e.id}
                  title={e.visitorName}
                  lines={[e.company ?? '', `Meeting ${e.hostName} · around ${e.expectedArrival}`]}
                  badge={{ label: 'Expected', tone: 'blue' }}
                  onClick={() => pickExpected(e)}
                />
              ))}
            </>
          )}

          {profileResult && (
            <>
              <OperatorSectionLabel>Visited before</OperatorSectionLabel>
              <OperatorResultCard
                title={profileResult.name}
                lines={[
                  profileResult.company ?? '',
                  `${profileResult.totalVisits} earlier visit${profileResult.totalVisits === 1 ? '' : 's'}`,
                ]}
                badge={
                  profileResult.isBlacklisted
                    ? { label: 'Blacklisted — do not allow', tone: 'red' }
                    : { label: 'Known visitor', tone: 'slate' }
                }
                onClick={() => pickProfile(profileResult)}
              />
            </>
          )}

          {visitResults.length === 0 && expectedResults.length === 0 && !profileResult && (
            <OperatorEmptyResult
              message="No one found"
              hint="Check the number, or register them as a new visitor below."
            />
          )}
        </>
      )}

      <OperatorSecondaryButton label="New visitor (not in the list)" onClick={startNewVisitor} />
    </OperatorStepShell>
  )
}
