import { useEffect, useState } from 'react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getManufacturingSettings, updateManufacturingSettingsDemo } from '@/services/manufacturing'
import type { ManufacturingSettings } from '@/types/manufacturingSettings'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'

const tabs = [
  'General',
  'Number Series',
  'Material Consumption',
  'Operations',
  'Quality',
  'Job Work',
  'Costing',
  'Approvals',
  'Permissions',
  'Advanced',
] as const

type Tab = (typeof tabs)[number]

export function ManufacturingSettingsPage() {
  const perms = useManufacturingPermissions()
  const [settings, setSettings] = useState<ManufacturingSettings | null>(null)
  const [tab, setTab] = useState<Tab>('General')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getManufacturingSettings().then(setSettings)
  }, [])

  if (!settings) return <LoadingState />

  const section: keyof ManufacturingSettings =
    tab === 'General'
      ? 'general'
      : tab === 'Number Series'
        ? 'numberSeries'
        : tab === 'Material Consumption'
          ? 'materialConsumption'
          : tab === 'Operations'
            ? 'operations'
            : tab === 'Quality'
              ? 'quality'
              : tab === 'Job Work'
                ? 'jobWork'
                : tab === 'Costing'
                  ? 'costing'
                  : tab === 'Approvals'
                    ? 'approvals'
                    : 'advanced'

  const fields: Array<[string, string]> =
    tab === 'General'
      ? [
          ['defaultPlantName', 'Default plant'],
          ['bomMandatory', 'BOM mandatory'],
          ['quickModeDefault', 'Quick mode default'],
          ['allowManualWorkOrder', 'Allow manual work orders'],
          ['allowPartialProduction', 'Allow partial production'],
          ['allowOverproduction', 'Allow overproduction'],
          ['requireWorkOrderClosing', 'Require work order closing'],
        ]
      : tab === 'Number Series'
        ? [
            ['workOrderPrefix', 'Work order prefix'],
            ['jobWorkPrefix', 'Job work prefix'],
            ['reworkPrefix', 'Rework prefix'],
          ]
        : tab === 'Material Consumption'
          ? [
              ['automaticConsumption', 'Automatic consumption'],
              ['manualMaterialIssue', 'Manual material issue'],
              ['autoSelectBatch', 'Auto-select batch'],
              ['allowMaterialReturn', 'Allow material return'],
              ['requireReservation', 'Require reservation'],
            ]
          : tab === 'Operations'
            ? [
                ['operationsEnabled', 'Enable operations'],
                ['jobCardsEnabled', 'Enable job cards'],
                ['workstationsEnabled', 'Enable workstations'],
                ['routingMandatory', 'Routing mandatory'],
              ]
            : tab === 'Quality'
              ? [
                  ['qualityInspectionEnabled', 'Enable quality'],
                  ['itemBasedQuality', 'Item-based quality'],
                  ['qualityHoldOnOutput', 'Hold output pending quality'],
                  ['reworkEnabled', 'Rework enabled'],
                ]
              : tab === 'Job Work'
                ? [
                    ['jobWorkEnabled', 'Enable job work'],
                    ['allowPartialDispatch', 'Allow partial dispatch'],
                    ['allowPartialReceipt', 'Allow partial receipt'],
                    ['materialReconciliationRequired', 'Reconciliation required'],
                    ['vendorInvoiceLinkRequiredBeforeClosing', 'Invoice link before closing'],
                  ]
                : tab === 'Costing'
                  ? [
                      ['defaultLabourRate', 'Default labour rate'],
                      ['defaultMachineRate', 'Default machine rate'],
                      ['includeReworkCost', 'Include rework cost'],
                      ['includeJobWorkCost', 'Include job-work cost'],
                    ]
                  : tab === 'Approvals'
                    ? [
                        ['manualWorkOrderWithoutDemand', 'Manual WO without demand'],
                        ['materialShortageOverride', 'Material shortage override'],
                        ['completionWithDifference', 'Completion with difference'],
                        ['jobWorkMaterialDifference', 'Job work material difference'],
                      ]
                    : [
                        ['advancedMrp', 'Advanced MRP'],
                        ['detailedRouting', 'Detailed routing'],
                        ['finiteCapacityScheduling', 'Finite-capacity scheduling'],
                        ['barcodeProduction', 'Barcode production'],
                        ['vendorPortal', 'Vendor portal'],
                      ]

  const update = (key: string, value: unknown) => {
    setSettings({
      ...settings,
      [section]: { ...(settings[section] as object), [key]: value },
    } as ManufacturingSettings)
  }

  const save = async () => {
    if (!perms.canManageSettings) return
    setSaving(true)
    const r = await updateManufacturingSettingsDemo(settings)
    setSettings(r.settings)
    setSaving(false)
    notify.success('Manufacturing settings saved')
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Manufacturing Settings"
      description="Recommended defaults keep Quick Mode simple. Advanced capabilities stay off unless enabled."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Settings' },
      ]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canManageSettings
              ? { id: 'save', label: saving ? 'Saving…' : 'Save settings', disabled: saving, onClick: () => void save() }
              : undefined
          }
        />
      )}
    >
      <div className="flex flex-wrap gap-1 border-b border-erp-border pb-2" role="tablist">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={tab === item ? 'erp-btn erp-btn-primary h-8 px-3 text-xs' : 'erp-btn erp-btn-ghost h-8 px-3 text-xs'}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Permissions' ? (
        <p className="mt-4 rounded border border-erp-border p-3 text-sm text-erp-muted">
          Permissions are enforced in the UI and must also be enforced by backend authorization when manufacturing APIs ship.
          Manage role grants under Admin › Roles.
        </p>
      ) : (
        <div className="mt-4 max-w-2xl space-y-3 rounded border border-erp-border p-4">
          {fields.map(([key, label]) => {
            const value = (settings[section] as Record<string, unknown>)[key]
            const advancedLocked = tab === 'Advanced'
            return (
              <label key={key} className="flex items-center justify-between gap-4 text-sm">
                <span>{label}</span>
                {typeof value === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    disabled={!perms.canManageSettings || (advancedLocked && !perms.canManageSettings)}
                    onChange={(e) => update(key, e.target.checked)}
                    aria-label={label}
                  />
                ) : (
                  <Input
                    value={String(value ?? '')}
                    disabled={!perms.canManageSettings}
                    onChange={(e) =>
                      update(key, typeof value === 'number' ? Number(e.target.value) : e.target.value)
                    }
                    aria-label={label}
                    className="w-48"
                  />
                )}
              </label>
            )
          })}
          {tab === 'Advanced' ? (
            <p className="text-[12px] text-erp-muted">
              Advanced features remain disabled by default and do not change the simple Work Order flow when off.
            </p>
          ) : null}
        </div>
      )}
    </OperationalPageShell>
  )
}
