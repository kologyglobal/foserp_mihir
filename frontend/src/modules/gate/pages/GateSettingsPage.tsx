import { useCallback, useEffect, useState } from 'react'
import { Save, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpButton } from '@/components/erp/ErpButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/forms/FormField'
import { Checkbox, Input, Textarea } from '@/components/forms/Inputs'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../api/gateService'
import type { GateLocation, GateSettings } from '../types/gate.types'
import { GateDataStates } from '../components'
import type { GateLoadState } from '../components'
import { GATE_BREADCRUMB } from '../gateUi'

type MasterKey = keyof GateSettings['masters']

const MASTER_FIELDS: Array<{ key: MasterKey; label: string }> = [
  { key: 'visitorTypes', label: 'Visitor types' },
  { key: 'visitPurposes', label: 'Visit purposes' },
  { key: 'vehicleTypes', label: 'Vehicle types' },
  { key: 'materialMovementTypes', label: 'Material movement types' },
  { key: 'passTypes', label: 'Pass types' },
  { key: 'courierCompanies', label: 'Courier companies' },
  { key: 'rejectionReasons', label: 'Rejection reasons' },
  { key: 'blacklistReasons', label: 'Blacklist reasons' },
]

function listToCsv(values: string[]): string {
  return values.join(', ')
}

function csvToList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function GateSettingsPage() {
  const perms = useGatePermissions()
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [settings, setSettings] = useState<GateSettings | null>(null)
  const [masterDraft, setMasterDraft] = useState<Record<MasterKey, string>>({
    visitorTypes: '',
    visitPurposes: '',
    vehicleTypes: '',
    materialMovementTypes: '',
    passTypes: '',
    courierCompanies: '',
    rejectionReasons: '',
    blacklistReasons: '',
  })
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const [locs, cfg] = await Promise.all([gateService.getGateLocations(), gateService.getGateSettings()])
      setLocations(locs)
      setSettings(cfg)
      setMasterDraft({
        visitorTypes: listToCsv(cfg.masters.visitorTypes),
        visitPurposes: listToCsv(cfg.masters.visitPurposes),
        vehicleTypes: listToCsv(cfg.masters.vehicleTypes),
        materialMovementTypes: listToCsv(cfg.masters.materialMovementTypes),
        passTypes: listToCsv(cfg.masters.passTypes),
        courierCompanies: listToCsv(cfg.masters.courierCompanies),
        rejectionReasons: listToCsv(cfg.masters.rejectionReasons),
        blacklistReasons: listToCsv(cfg.masters.blacklistReasons),
      })
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gate settings')
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const canEdit = perms.canManageSettings

  const patchSettings = (patch: Partial<GateSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...patch })
  }

  const save = async () => {
    if (!settings || !canEdit || busy) return
    setBusy(true)
    try {
      const next: GateSettings = {
        ...settings,
        masters: {
          visitorTypes: csvToList(masterDraft.visitorTypes),
          visitPurposes: csvToList(masterDraft.visitPurposes),
          vehicleTypes: csvToList(masterDraft.vehicleTypes),
          materialMovementTypes: csvToList(masterDraft.materialMovementTypes),
          passTypes: csvToList(masterDraft.passTypes),
          courierCompanies: csvToList(masterDraft.courierCompanies),
          rejectionReasons: csvToList(masterDraft.rejectionReasons),
          blacklistReasons: csvToList(masterDraft.blacklistReasons),
        },
      }
      setSettings(await gateService.updateGateSettings(next))
      notify.success('Gate settings saved.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not save settings')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canViewDashboard && !perms.canManageSettings) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Settings" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view gate settings." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Gate Settings"
      description={canEdit ? 'Configure visitor, material and pass behaviour plus gate master lists.' : 'Read-only view of gate configuration.'}
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Settings' }]}
      favoritePath="/gate/settings"
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
          {settings ? (
            <>
              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h3 className="mb-1 text-[14px] font-semibold text-erp-text">Gate locations</h3>
                <p className="mb-3 text-[12px] text-erp-muted">Read-only — managed in tenant master data.</p>
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12.5px]">
                    <thead>
                      <tr>
                        <th>Gate</th>
                        <th>Plant</th>
                        <th>Entry types allowed</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((l) => (
                        <tr key={l.id}>
                          <td className="font-medium">{l.name}</td>
                          <td>{l.plant}</td>
                          <td>{l.entryTypesAllowed.join(', ')}</td>
                          <td>{l.isActive ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Visitor settings</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Checkbox
                    label="Host approval required for walk-ins"
                    checked={settings.visitor.hostApprovalRequired}
                    onChange={(e) => patchSettings({ visitor: { ...settings.visitor, hostApprovalRequired: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="Photo capture required"
                    checked={settings.visitor.photoCaptureRequired}
                    onChange={(e) => patchSettings({ visitor: { ...settings.visitor, photoCaptureRequired: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="Masked ID enabled"
                    checked={settings.visitor.maskedIdEnabled}
                    onChange={(e) => patchSettings({ visitor: { ...settings.visitor, maskedIdEnabled: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="QR pass enabled"
                    checked={settings.visitor.qrEnabled}
                    onChange={(e) => patchSettings({ visitor: { ...settings.visitor, qrEnabled: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <FormField label="Default visit duration (minutes)">
                    <Input
                      type="number"
                      min={0}
                      value={settings.visitor.defaultVisitDurationMinutes}
                      onChange={(e) => patchSettings({ visitor: { ...settings.visitor, defaultVisitDurationMinutes: Number(e.target.value) } })}
                      disabled={!canEdit}
                    />
                  </FormField>
                  <FormField label="Overstay threshold (minutes)">
                    <Input
                      type="number"
                      min={0}
                      value={settings.visitor.overstayThresholdMinutes}
                      onChange={(e) => patchSettings({ visitor: { ...settings.visitor, overstayThresholdMinutes: Number(e.target.value) } })}
                      disabled={!canEdit}
                    />
                  </FormField>
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Material settings</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Checkbox
                    label="Allow inward without PO"
                    checked={settings.material.allowInwardWithoutPo}
                    onChange={(e) => patchSettings({ material: { ...settings.material, allowInwardWithoutPo: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="Vehicle number required on inward"
                    checked={settings.material.vehicleNumberRequired}
                    onChange={(e) => patchSettings({ material: { ...settings.material, vehicleNumberRequired: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="Document photo required"
                    checked={settings.material.documentPhotoRequired}
                    onChange={(e) => patchSettings({ material: { ...settings.material, documentPhotoRequired: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="Outward approval required"
                    checked={settings.material.outwardApprovalRequired}
                    onChange={(e) => patchSettings({ material: { ...settings.material, outwardApprovalRequired: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="Release checklist required"
                    checked={settings.material.releaseChecklistRequired}
                    onChange={(e) => patchSettings({ material: { ...settings.material, releaseChecklistRequired: e.target.checked } })}
                    disabled={!canEdit}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Pass settings</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Number format">
                    <Input
                      value={settings.pass.numberFormat}
                      onChange={(e) => patchSettings({ pass: { ...settings.pass, numberFormat: e.target.value } })}
                      disabled={!canEdit}
                    />
                  </FormField>
                  <FormField label="Return reminder (days)">
                    <Input
                      type="number"
                      min={0}
                      value={settings.pass.returnReminderDays}
                      onChange={(e) => patchSettings({ pass: { ...settings.pass, returnReminderDays: Number(e.target.value) } })}
                      disabled={!canEdit}
                    />
                  </FormField>
                  <Checkbox
                    label="Approval required"
                    checked={settings.pass.approvalRequired}
                    onChange={(e) => patchSettings({ pass: { ...settings.pass, approvalRequired: e.target.checked } })}
                    disabled={!canEdit}
                  />
                  <Checkbox
                    label="Partial return allowed"
                    checked={settings.pass.partialReturnAllowed}
                    onChange={(e) => patchSettings({ pass: { ...settings.pass, partialReturnAllowed: e.target.checked } })}
                    disabled={!canEdit}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h3 className="mb-1 text-[14px] font-semibold text-erp-text">Masters</h3>
                <p className="mb-3 text-[12px] text-erp-muted">Comma-separated values used in gate dropdowns and reason lists.</p>
                <div className="grid gap-3">
                  {MASTER_FIELDS.map(({ key, label }) => (
                    <FormField key={key} label={label}>
                      <Textarea
                        rows={2}
                        value={masterDraft[key]}
                        onChange={(e) => setMasterDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                        disabled={!canEdit}
                        placeholder="Comma-separated values…"
                      />
                    </FormField>
                  ))}
                </div>
              </section>

              {canEdit ? (
                <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-erp-border bg-white px-4 py-3">
                  <ErpButton icon={Save} onClick={() => void save()} loading={busy} disabled={busy}>
                    Save Settings
                  </ErpButton>
                </div>
              ) : (
                <p className="text-[12px] text-erp-muted">You have view-only access. Contact a gate supervisor to change settings.</p>
              )}
            </>
          ) : null}
        </GateDataStates>
      </div>
    </OperationalPageShell>
  )
}
