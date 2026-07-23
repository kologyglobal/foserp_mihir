import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Hand, Search, ShieldOff, Truck } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService, type OutwardDocumentSearchResult } from '../../api/gateService'
import type { GateSettings, MaterialOutwardEntry, OutwardChecklistKey } from '../../types/gate.types'
import {
  GateBoundaryBanner,
  GateDataStates,
  GateStatusBadge,
  VerificationChecklist,
} from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

export function MaterialOutwardVerifyPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OutwardDocumentSearchResult[]>([])
  const [entry, setEntry] = useState<MaterialOutwardEntry | null>(null)
  const [settings, setSettings] = useState<GateSettings | null>(null)
  const [state, setState] = useState<GateLoadState>('ready')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [sealNumber, setSealNumber] = useState('')
  const [packagesVerified, setPackagesVerified] = useState('')

  useEffect(() => {
    void gateService.getGateSettings().then(setSettings).catch(() => undefined)
  }, [])

  const loadEntry = useCallback(async (id: string) => {
    setState('loading')
    setError('')
    try {
      const record = await gateService.getMaterialOutwardById(id)
      setEntry(record)
      setVehicleNumber(record.vehicleNumber ?? '')
      setDriverName(record.driverName ?? '')
      setSealNumber(record.sealNumber ?? '')
      setPackagesVerified(record.packagesVerified != null ? String(record.packagesVerified) : String(record.packagesExpected))
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load outward entry')
      setState('error')
    }
  }, [])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) void loadEntry(id)
  }, [searchParams, loadEntry])

  const search = async () => {
    if (!query.trim()) {
      notify.warning('Enter a gate pass, Delivery Challan, dispatch number or vehicle number.')
      return
    }
    setState('loading')
    try {
      const rows = await gateService.searchOutwardDocuments(query.trim())
      setResults(rows)
      setState(rows.length === 0 ? 'empty' : 'ready')
      if (rows.length === 1 && rows[0].existingOutwardId) void loadEntry(rows[0].existingOutwardId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setState('error')
    }
  }

  const toggleCheck = async (key: OutwardChecklistKey, next: boolean) => {
    if (!entry || ['released', 'rejected', 'cancelled'].includes(entry.status)) return
    try {
      const updated = await gateService.verifyMaterialOutward(entry.id, {
        checklist: { [key]: next },
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        sealNumber: sealNumber || undefined,
        packagesVerified: packagesVerified ? Number(packagesVerified) : undefined,
      })
      setEntry(updated)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not update checklist')
    }
  }

  const saveHeader = async () => {
    if (!entry) return
    try {
      setEntry(await gateService.verifyMaterialOutward(entry.id, {
        checklist: {},
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        sealNumber: sealNumber || undefined,
        packagesVerified: packagesVerified ? Number(packagesVerified) : undefined,
      }))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not save verification details')
    }
  }

  const release = async () => {
    if (!entry || busy) return
    await saveHeader()
    setBusy(true)
    try {
      const updated = await gateService.releaseMaterialOutward(entry.id)
      setEntry(updated)
      notify.success(`Vehicle released — ${updated.documentNumber}.`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Release blocked')
    } finally {
      setBusy(false)
    }
  }

  const remarkAction = async (
    title: string,
    action: (remarks: string) => Promise<MaterialOutwardEntry>,
    success: string,
  ) => {
    if (!entry || busy) return
    const remarks = await appPromptNote({
      title,
      description: 'Remarks are mandatory for this action.',
      confirmLabel: 'Confirm',
      tone: 'danger',
      note: { required: true, label: 'Remarks' },
    })
    if (remarks == null) return
    setBusy(true)
    try {
      setEntry(await action(remarks))
      notify.success(success)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const checklistComplete = entry ? Object.values(entry.checklist).every(Boolean) : false
  const requireChecklist = settings?.material.releaseChecklistRequired ?? true
  const canRelease =
    perms.canReleaseOutward &&
    entry &&
    !['released', 'rejected', 'cancelled'].includes(entry.status) &&
    entry.documentApproved &&
    entry.approvalStatus === 'approved' &&
    (!requireChecklist || checklistComplete)

  const isReadOnly = entry ? ['released', 'rejected', 'cancelled'].includes(entry.status) : false

  if (!perms.canVerifyOutward && !perms.canViewOutward) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Verify Material Outward" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to verify outward material." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security" title="Verify Material Outward"
      description="Search an approved document, complete the checklist, then release the vehicle."
      showDescription autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Material Outward', to: '/gate/material-outward' }, { label: 'Verify' }]}
      backLink={{ to: '/gate/material-outward', label: 'Back to Material Outward' }}
    >
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
        <GateBoundaryBanner message="Security verifies and releases approved outward material. Stock and accounting posting remain in their respective modules." />

        {!entry ? (
          <section className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-1 text-[14px] font-semibold text-erp-text">Search gate pass, Delivery Challan, dispatch number, return document or vehicle number</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SearchInput value={query} onChange={setQuery} placeholder="e.g. DC-2026-0188 or MH 12 AB 3344" className="w-80" aria-label="Search outward documents" />
              <ErpButton icon={Search} onClick={() => void search()}>Search</ErpButton>
            </div>
            <GateDataStates state={state} error={error} onRetry={() => void search()} emptyTitle="No matching outward documents" emptyDescription="Try a different document or vehicle number.">
              {results.length > 0 ? (
                <ul className="mt-3 divide-y divide-erp-border rounded-md border border-erp-border">
                  {results.map((r) => (
                    <li key={`${r.documentNumber}-${r.existingOutwardId}`}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-erp-primary-soft/40"
                        onClick={() => r.existingOutwardId && void loadEntry(r.existingOutwardId)}
                      >
                        <span className="flex items-center gap-2 text-[13px] font-semibold text-erp-text">
                          {r.documentType} {r.documentNumber}
                          {r.approved ? <GateStatusBadge status="approved" /> : <GateStatusBadge status="pending" />}
                        </span>
                        <span className="text-[12px] text-erp-muted">{r.partyName ?? '—'} · {r.materialSummary} · {r.packagesExpected} pkgs</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </GateDataStates>
          </section>
        ) : (
          <>
            <section className="rounded-lg border border-erp-border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-erp-text">{entry.entryNumber}</h3>
                  <GateStatusBadge status={entry.status} />
                  {isReadOnly ? <span className="text-[11.5px] font-medium text-erp-muted">Read-only</span> : null}
                </div>
                <ErpButton size="sm" variant="ghost" onClick={() => { setEntry(null); setResults([]) }}>Change document</ErpButton>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-erp-border bg-erp-surface-alt/40 p-3">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Expected</p>
                  <dl className="space-y-1.5 text-[13px]">
                    <div className="flex justify-between gap-2"><dt className="text-erp-muted">Document</dt><dd className="font-medium">{entry.documentType} {entry.documentNumber}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-erp-muted">Party</dt><dd className="font-medium">{entry.partyName ?? '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-erp-muted">Material</dt><dd className="max-w-[220px] truncate font-medium">{entry.materialSummary}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-erp-muted">Packages</dt><dd className="font-medium tabular-nums">{entry.packagesExpected}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-erp-muted">Approved</dt><dd className="font-medium">{entry.documentApproved && entry.approvalStatus === 'approved' ? 'Yes' : 'No'}</dd></div>
                  </dl>
                </div>
                <div className="rounded-md border border-erp-border p-3">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Verified at gate</p>
                  <div className="grid gap-2">
                    <FormField label="Vehicle number"><Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} disabled={isReadOnly} /></FormField>
                    <FormField label="Driver"><Input value={driverName} onChange={(e) => setDriverName(e.target.value)} disabled={isReadOnly} /></FormField>
                    <FormField label="Seal"><Input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} disabled={isReadOnly} /></FormField>
                    <FormField label="Packages verified"><Input type="number" min={0} value={packagesVerified} onChange={(e) => setPackagesVerified(e.target.value)} disabled={isReadOnly} /></FormField>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-4">
              <VerificationChecklist values={entry.checklist} onToggle={(k, n) => void toggleCheck(k, n)} disabled={isReadOnly || !perms.canVerifyOutward} />
              {requireChecklist && !checklistComplete && !isReadOnly ? (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Complete every checklist item before release.
                </p>
              ) : null}
            </section>

            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-erp-border bg-white px-4 py-3">
              <ErpButton icon={Truck} onClick={() => void release()} loading={busy} disabled={busy || !canRelease} disabledReason={!canRelease ? 'Checklist incomplete or source not approved' : undefined}>
                Release Vehicle
              </ErpButton>
              <ErpButton variant="secondary" icon={Hand} disabled={busy || isReadOnly || !perms.canVerifyOutward} onClick={() => void remarkAction('Hold at gate', (r) => gateService.holdMaterialOutward(entry.id, r), 'Held at gate.')}>
                Hold at Gate
              </ErpButton>
              <ErpButton variant="secondary" icon={AlertTriangle} disabled={busy || isReadOnly || !perms.canVerifyOutward} onClick={() => void remarkAction('Report mismatch', (r) => gateService.reportMaterialMismatch(entry.id, r), 'Mismatch reported.')}>
                Report Mismatch
              </ErpButton>
              <ErpButton variant="danger" disabled={busy || isReadOnly || !perms.canVerifyOutward} onClick={() => void remarkAction('Reject exit', (r) => gateService.rejectMaterialOutward(entry.id, r), 'Exit rejected.')}>
                Reject Exit
              </ErpButton>
              <ErpButton variant="ghost" onClick={() => navigate(`/gate/material-outward/${entry.id}`)}>Open Detail</ErpButton>
            </div>
            {entry.holdRemarks || entry.mismatchRemarks || entry.rejectRemarks ? (
              <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                {entry.holdRemarks ? <p><strong>Hold:</strong> {entry.holdRemarks}</p> : null}
                {entry.mismatchRemarks ? <p><strong>Mismatch:</strong> {entry.mismatchRemarks}</p> : null}
                {entry.rejectRemarks ? <p><strong>Rejected:</strong> {entry.rejectRemarks}</p> : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </OperationalPageShell>
  )
}
