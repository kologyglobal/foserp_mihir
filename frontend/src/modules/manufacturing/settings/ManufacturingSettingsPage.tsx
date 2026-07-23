import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Switch } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { getManufacturingSettings, updateManufacturingSettings } from '@/services/manufacturing'
import type { ManufacturingSettings } from '@/types/manufacturingSettings'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const WAREHOUSES = [
  { id: 'wh-rm', name: 'RM Stores' },
  { id: 'wh-fg', name: 'FG Stores' },
  { id: 'wh-wip', name: 'WIP Stores' },
  { id: 'wh-scrap', name: 'Scrap Yard' },
]

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-erp-border/70 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-erp-text">{label}</p>
        {description ? <p className="mt-0.5 text-[12px] text-erp-muted">{description}</p> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

export function ManufacturingSettingsPage() {
  const perms = useManufacturingPermissions()
  const [settings, setSettings] = useState<ManufacturingSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const readOnly = !perms.canManageSettings

  useEffect(() => {
    void getManufacturingSettings().then(setSettings)
  }, [])

  if (!settings) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="Manufacturing Settings"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Settings' },
        ]}
        autoBreadcrumbs={false}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const patchGeneral = (partial: Partial<ManufacturingSettings['general']>) => {
    setSettings({ ...settings, general: { ...settings.general, ...partial } })
  }
  const patchSeries = (partial: Partial<ManufacturingSettings['numberSeries']>) => {
    setSettings({ ...settings, numberSeries: { ...settings.numberSeries, ...partial } })
  }
  const patchMaterial = (partial: Partial<ManufacturingSettings['materialConsumption']>) => {
    setSettings({ ...settings, materialConsumption: { ...settings.materialConsumption, ...partial } })
  }
  const patchQuality = (partial: Partial<ManufacturingSettings['quality']>) => {
    setSettings({ ...settings, quality: { ...settings.quality, ...partial } })
  }
  const patchJobWork = (partial: Partial<ManufacturingSettings['jobWork']>) => {
    setSettings({ ...settings, jobWork: { ...settings.jobWork, ...partial } })
  }
  const patchAdvanced = (partial: Partial<ManufacturingSettings['advanced']>) => {
    setSettings({ ...settings, advanced: { ...settings.advanced, ...partial } })
  }
  const patchOperations = (partial: Partial<ManufacturingSettings['operations']>) => {
    setSettings({ ...settings, operations: { ...settings.operations, ...partial } })
  }
  const patchCosting = (partial: Partial<ManufacturingSettings['costing']>) => {
    setSettings({ ...settings, costing: { ...settings.costing, ...partial } })
  }

  const save = async () => {
    if (readOnly) {
      notify.error('No permission to manage settings')
      return
    }
    setSaving(true)
    try {
      const r = await updateManufacturingSettings(settings)
      setSettings(r.settings)
      notify.success('Manufacturing settings saved')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Manufacturing Settings"
      description="Controls complexity for the command center. Keep Advanced collapsed for simple Work Order flow."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Settings' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/settings"
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
      <div className="mx-auto max-w-3xl space-y-4">
        <ManufacturingDemoBanner message="Settings control complexity — Quick Mode and Auto Consumption keep Work Orders simple. Leave Advanced off." />

        {readOnly ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="status">
            View only — you need manufacturing.settings.manage to change settings.
          </p>
        ) : null}

        {/* 1. General */}
        <ErpCardSection title="1. General Settings">
          <ToggleRow
            label="Quick Mode"
            description="Minimal create fields; system fills BOM, warehouses, and QC defaults."
            checked={settings.general.quickModeDefault}
            disabled={readOnly}
            onChange={(v) => patchGeneral({ quickModeDefault: v })}
          />
          <ToggleRow
            label="Auto BOM Fill"
            description="Pick finished item → attach active BOM automatically."
            checked={settings.general.autoBomFill}
            disabled={readOnly}
            onChange={(v) => patchGeneral({ autoBomFill: v })}
          />
          <ToggleRow
            label="Auto Warehouse Fill"
            description="Use default raw material and FG warehouses on new work orders."
            checked={settings.general.autoWarehouseFill}
            disabled={readOnly}
            onChange={(v) => patchGeneral({ autoWarehouseFill: v })}
          />
          <ToggleRow
            label="Auto Consumption"
            description="Backflush BOM materials when good quantity is booked."
            checked={settings.materialConsumption.automaticConsumption}
            disabled={readOnly}
            onChange={(v) => patchMaterial({ automaticConsumption: v })}
          />
          <ToggleRow
            label="Auto QC Detection"
            description="Set QC required from the finished item master."
            checked={settings.general.autoQcDetection}
            disabled={readOnly}
            onChange={(v) => {
              patchGeneral({ autoQcDetection: v })
              patchQuality({ itemBasedQuality: v })
            }}
          />
        </ErpCardSection>

        {/* 2. Work Order */}
        <ErpCardSection title="2. Work Order Settings">
          <FormField label="Default WO numbering series" className="mb-3">
            <Input
              value={settings.numberSeries.workOrderPrefix}
              disabled={readOnly}
              onChange={(e) => patchSeries({ workOrderPrefix: e.target.value })}
              placeholder="WO-MFG-"
            />
          </FormField>
          <ToggleRow
            label="Allow manual WO creation"
            description="Create work orders without a production plan."
            checked={settings.general.allowManualWorkOrder}
            disabled={readOnly}
            onChange={(v) => patchGeneral({ allowManualWorkOrder: v })}
          />
          <ToggleRow
            label="Flexible Work Order execution"
            description="Inventory, QC, and purchase do not hard-block production. Warnings only — complete stages and WO without other modules."
            checked={settings.general.flexibleExecution}
            disabled={readOnly}
            onChange={(v) =>
              patchGeneral({
                flexibleExecution: v,
                ...(v ? { allowCloseWithoutQc: true, allowUnderCompletion: true } : {}),
              })
            }
          />
          <ToggleRow
            label="Allow WO close without QC"
            description="When off (and flexible execution off), quality blockers prevent WO complete."
            checked={settings.general.allowCloseWithoutQc}
            disabled={readOnly}
            onChange={(v) => patchGeneral({ allowCloseWithoutQc: v })}
          />
          <ToggleRow
            label="Allow under-completion"
            description="Complete a stage when good qty is below planned (warns on activity)."
            checked={settings.general.allowUnderCompletion}
            disabled={readOnly}
            onChange={(v) => patchGeneral({ allowUnderCompletion: v })}
          />
          <div className="flex items-start justify-between gap-4 border-b border-erp-border/70 py-3">
            <div>
              <p className="text-[13px] font-medium text-erp-text">Allow over-production %</p>
              <p className="mt-0.5 text-[12px] text-erp-muted">
                Tolerance above planned. With flexible execution, exceeding tolerance still records with a warning.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.general.allowOverproduction}
                disabled={readOnly}
                onChange={(v) => patchGeneral({ allowOverproduction: v })}
              />
              <Input
                type="number"
                min={0}
                max={100}
                className="w-20"
                disabled={readOnly || !settings.general.allowOverproduction}
                value={settings.general.overproductionTolerancePercent}
                onChange={(e) => patchGeneral({ overproductionTolerancePercent: Number(e.target.value) })}
                aria-label="Over-production percent"
              />
              <span className="text-[12px] text-erp-muted">%</span>
            </div>
          </div>
          <ToggleRow
            label="Allow partial completion"
            description="Book good quantity in parts before the WO is fully done."
            checked={settings.general.allowPartialProduction}
            disabled={readOnly}
            onChange={(v) => patchGeneral({ allowPartialProduction: v })}
          />
        </ErpCardSection>

        {/* 3. Material */}
        <ErpCardSection title="3. Material Settings">
          <ToggleRow
            label="Reserve material before start"
            description="Require reservation before production can start."
            checked={settings.materialConsumption.requireReservation}
            disabled={readOnly}
            onChange={(v) => patchMaterial({ requireReservation: v })}
          />
          <ToggleRow
            label="Allow production without full material"
            description="Start even when some BOM lines are short (with warnings)."
            checked={settings.materialConsumption.allowProductionWithoutFullMaterial}
            disabled={readOnly}
            onChange={(v) => patchMaterial({
              allowProductionWithoutFullMaterial: v,
              blockStartOnShortage: !v,
            })}
          />
          <ToggleRow
            label="Allow negative stock warning"
            description="Warn on potential negative stock; do not hard-block by default."
            checked={settings.materialConsumption.allowNegativeStockWarning}
            disabled={readOnly}
            onChange={(v) => patchMaterial({ allowNegativeStockWarning: v })}
          />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <FormField label="Default raw material warehouse">
              <Select
                disabled={readOnly}
                value={settings.general.defaultMaterialWarehouseId}
                onChange={(e) => {
                  const wh = WAREHOUSES.find((w) => w.id === e.target.value)
                  patchGeneral({
                    defaultMaterialWarehouseId: e.target.value,
                    defaultMaterialWarehouseName: wh?.name ?? e.target.value,
                  })
                }}
              >
                {WAREHOUSES.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Default FG warehouse">
              <Select
                disabled={readOnly}
                value={settings.general.defaultFgWarehouseId}
                onChange={(e) => {
                  const wh = WAREHOUSES.find((w) => w.id === e.target.value)
                  patchGeneral({
                    defaultFgWarehouseId: e.target.value,
                    defaultFgWarehouseName: wh?.name ?? e.target.value,
                  })
                }}
              >
                {WAREHOUSES.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </ErpCardSection>

        {/* 4. Quality */}
        <ErpCardSection title="4. Quality Settings">
          <ToggleRow
            label="QC required based on item master"
            description="Finished items flagged for inspection create a QC hold on output."
            checked={settings.quality.itemBasedQuality}
            disabled={readOnly}
            onChange={(v) => patchQuality({ itemBasedQuality: v })}
          />
          <ToggleRow
            label="QC before WO close"
            description="Block close while quality review is pending."
            checked={settings.quality.requireQcBeforeClose}
            disabled={readOnly}
            onChange={(v) => patchQuality({ requireQcBeforeClose: v, qualityHoldOnOutput: v })}
          />
          <ToggleRow
            label="Allow rework"
            description="QC / production can send quantity to rework."
            checked={settings.quality.reworkEnabled}
            disabled={readOnly}
            onChange={(v) => patchQuality({ reworkEnabled: v })}
          />
          <ToggleRow
            label="Allow reject"
            description="QC can reject quantity from the work order."
            checked={settings.quality.allowReject}
            disabled={readOnly}
            onChange={(v) => patchQuality({ allowReject: v })}
          />
        </ErpCardSection>

        {/* 5. Job Work */}
        <ErpCardSection title="5. Job Work Settings">
          <ToggleRow
            label="Enable Job Work"
            description="Show Job Work nav and allow outside processing linked to WOs."
            checked={settings.jobWork.jobWorkEnabled}
            disabled={readOnly}
            onChange={(v) => patchJobWork({ jobWorkEnabled: v })}
          />
          <ToggleRow
            label="Require material reconciliation"
            description="Reconcile vendor material balance before close."
            checked={settings.jobWork.materialReconciliationRequired}
            disabled={readOnly}
            onChange={(v) => patchJobWork({ materialReconciliationRequired: v })}
          />
          <ToggleRow
            label="Vendor invoice placeholder"
            description="Allow linking a vendor invoice reference (no AP / GST posting)."
            checked={settings.jobWork.vendorInvoicePlaceholderEnabled}
            disabled={readOnly}
            onChange={(v) => patchJobWork({ vendorInvoicePlaceholderEnabled: v })}
          />
        </ErpCardSection>

        {/* 6. Advanced — collapsed */}
        <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
          >
            <div>
              <p className="text-[13px] font-semibold text-erp-text">6. Advanced Settings</p>
              <p className="text-[12px] text-erp-muted">
                Collapsed by default — not for normal users. Leave off unless you need complex manufacturing.
              </p>
            </div>
            {advancedOpen ? <ChevronDown className="h-4 w-4 text-erp-muted" /> : <ChevronRight className="h-4 w-4 text-erp-muted" />}
          </button>
          <div className={cn('border-t border-erp-border px-4 py-2', !advancedOpen && 'hidden')}>
            <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Enabling these does not change the simple Work Order flow until dedicated screens exist. Prefer defaults OFF.
            </p>
            <ToggleRow label="Advanced MRP" checked={settings.advanced.advancedMrp} disabled={readOnly} onChange={(v) => patchAdvanced({ advancedMrp: v })} />
            <ToggleRow label="Detailed routing / operations" checked={settings.operations.operationsEnabled} disabled={readOnly} onChange={(v) => patchOperations({ operationsEnabled: v, routingMandatory: v })} />
            <p className="mb-2 px-1 text-[11px] text-erp-muted">
              When on, Work Orders load an active Route and show the Operations tab. Manage routes at{' '}
              <a href="/manufacturing/routes" className="font-semibold text-erp-primary hover:underline">/manufacturing/routes</a>
              {' '}— folded into WO, not a separate MES.
            </p>
            <ToggleRow label="Job cards (not used — keep off)" checked={settings.operations.jobCardsEnabled} disabled={readOnly} onChange={(v) => patchOperations({ jobCardsEnabled: v })} />
            <ToggleRow label="Finite capacity scheduling" checked={settings.advanced.finiteCapacityScheduling} disabled={readOnly} onChange={(v) => patchAdvanced({ finiteCapacityScheduling: v })} />
            <ToggleRow label="Machine scheduling" checked={settings.advanced.machineScheduling} disabled={readOnly} onChange={(v) => patchAdvanced({ machineScheduling: v })} />
            <ToggleRow label="Operator time booking" checked={settings.advanced.operatorTimeBooking} disabled={readOnly} onChange={(v) => patchAdvanced({ operatorTimeBooking: v })} />
            <ToggleRow label="OEE" checked={settings.advanced.oee} disabled={readOnly} onChange={(v) => patchAdvanced({ oee: v })} />
            <ToggleRow label="IoT integration" checked={settings.advanced.iotIntegration} disabled={readOnly} onChange={(v) => patchAdvanced({ iotIntegration: v })} />
            <ToggleRow label="Barcode production" checked={settings.advanced.barcodeProduction} disabled={readOnly} onChange={(v) => patchAdvanced({ barcodeProduction: v })} />
            <ToggleRow label="Co-products / by-products" checked={settings.advanced.coProducts} disabled={readOnly} onChange={(v) => patchAdvanced({ coProducts: v, byProducts: v })} />
            <ToggleRow label="Vendor portal" checked={settings.advanced.vendorPortal} disabled={readOnly} onChange={(v) => patchAdvanced({ vendorPortal: v })} />
            <ToggleRow label="Show cost by role" checked={settings.costing.costVisibilityByRole} disabled={readOnly} onChange={(v) => patchCosting({ costVisibilityByRole: v })} />
          </div>
        </section>
      </div>
    </OperationalPageShell>
  )
}
