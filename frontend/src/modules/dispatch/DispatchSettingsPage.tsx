import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Select, Switch } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { hasWorkspaceAdminRole } from '@/utils/permissions/workspaceAdmin'
import { notify } from '@/store/toastStore'
import {
  getDispatchSettings,
  updateDispatchSettings,
  type DispatchCommercialSettings,
  type DispatchInvoiceMode,
} from '@/services/api/dispatchApi'

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

const INVOICE_MODE_OPTIONS: Array<{ value: DispatchInvoiceMode; label: string; hint: string }> = [
  {
    value: 'ONE_PER_DISPATCH',
    label: 'One invoice per dispatch',
    hint: 'Auto DRAFT sales invoice on post (when env auto-SI is on). Manual invoice cannot span multiple dispatches.',
  },
  {
    value: 'CONSOLIDATED',
    label: 'Consolidated invoice',
    hint: 'No auto invoice. Manual Invoice Ready may combine lines across multiple dispatches.',
  },
  {
    value: 'MANUAL_ONLY',
    label: 'Manual invoice only',
    hint: 'No auto invoice. Create invoices only via Money In / Invoice Ready.',
  },
]

export function DispatchSettingsPage() {
  const permissions = getStoredSession()?.user.permissions ?? []
  const isSuperAdmin = hasWorkspaceAdminRole()
  const canManage =
    isSuperAdmin ||
    permissions.includes('dispatch.settings.manage') ||
    permissions.includes('finance.settings.manage') ||
    permissions.includes('tenant.manage')
  const canView =
    canManage ||
    permissions.includes('dispatch.settings.view') ||
    permissions.includes('dispatch.view') ||
    permissions.includes('dispatch.requirement.view')

  const [settings, setSettings] = useState<DispatchCommercialSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const readOnly = !canManage

  useEffect(() => {
    if (!isApiMode()) return
    if (!canView) {
      setLoadError('Missing permission to view dispatch settings')
      return
    }
    void getDispatchSettings()
      .then(setSettings)
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load dispatch settings')
      })
  }, [canView])

  if (!isApiMode()) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Logistics"
        title="Dispatch Settings"
        breadcrumbs={[
          { label: 'Logistics', to: '/dispatch' },
          { label: 'Settings' },
        ]}
        autoBreadcrumbs={false}
      >
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Dispatch commercial policy requires API mode (`VITE_USE_API=true`). Demo mode has no tenant settings store.
        </p>
      </OperationalPageShell>
    )
  }

  if (loadError) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Logistics"
        title="Dispatch Settings"
        breadcrumbs={[
          { label: 'Logistics', to: '/dispatch' },
          { label: 'Settings' },
        ]}
        autoBreadcrumbs={false}
      >
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-900" role="alert">
          {loadError}
        </p>
      </OperationalPageShell>
    )
  }

  if (!settings) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Logistics"
        title="Dispatch Settings"
        breadcrumbs={[
          { label: 'Logistics', to: '/dispatch' },
          { label: 'Settings' },
        ]}
        autoBreadcrumbs={false}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const patch = (partial: Partial<DispatchCommercialSettings>) => {
    setSettings({ ...settings, ...partial })
  }

  const save = async () => {
    if (readOnly) {
      notify.error('No permission to manage dispatch settings')
      return
    }
    setSaving(true)
    try {
      const next = await updateDispatchSettings({
        version: settings.version,
        allowPartialDispatch: settings.allowPartialDispatch,
        allowMultipleDispatches: settings.allowMultipleDispatches,
        allowOverDispatch: settings.allowOverDispatch,
        invoiceMode: settings.invoiceMode,
        requirePodBeforeInvoice: settings.requirePodBeforeInvoice,
      })
      setSettings(next)
      notify.success('Dispatch settings saved')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save dispatch settings')
    } finally {
      setSaving(false)
    }
  }

  const modeHint = INVOICE_MODE_OPTIONS.find((o) => o.value === settings.invoiceMode)?.hint

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Logistics"
      title="Dispatch Settings"
      description="Commercial O2C policy for partial dispatch, multiple dispatches, invoicing, and POD. Live e-Way is not configured here."
      breadcrumbs={[
        { label: 'Logistics', to: '/dispatch' },
        { label: 'Settings' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/dispatch/settings"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canManage
              ? { id: 'save', label: saving ? 'Saving…' : 'Save settings', disabled: saving, onClick: () => void save() }
              : undefined
          }
        />
      )}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {readOnly ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="status">
            View only — you need dispatch.settings.manage to change settings.
          </p>
        ) : null}

        <ErpCardSection title="Dispatch quantity">
          <ToggleRow
            label="Allow partial dispatch"
            description="When off, each draft line must use the full remaining SO quantity."
            checked={settings.allowPartialDispatch}
            disabled={readOnly}
            onChange={(v) => patch({ allowPartialDispatch: v })}
          />
          <ToggleRow
            label="Allow multiple dispatches"
            description="When off, a second open outbound (draft or confirmed) for the same SO line is blocked."
            checked={settings.allowMultipleDispatches}
            disabled={readOnly}
            onChange={(v) => patch({ allowMultipleDispatches: v })}
          />
          <ToggleRow
            label="Allow over-dispatch"
            description="Operational flag for future over-qty gates (default off)."
            checked={settings.allowOverDispatch}
            disabled={readOnly}
            onChange={(v) => patch({ allowOverDispatch: v })}
          />
        </ErpCardSection>

        <ErpCardSection title="Invoicing">
          <FormField label="Invoice mode">
            <Select
              id="dispatch-invoice-mode"
              value={settings.invoiceMode}
              disabled={readOnly}
              onChange={(e) => patch({ invoiceMode: e.target.value as DispatchInvoiceMode })}
            >
              {INVOICE_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          {modeHint ? <p className="mt-2 text-[12px] text-erp-muted">{modeHint}</p> : null}
          <div className="mt-3">
            <ToggleRow
              label="Require POD before invoice"
              description="Auto and manual invoices wait until POD is Delivered or Partially delivered. Env REQUIRE_POD_BEFORE_INVOICE still forces this on."
              checked={settings.requirePodBeforeInvoice || Boolean(settings.effectivePolicy?.requirePodBeforeInvoice)}
              disabled={readOnly}
              onChange={(v) => patch({ requirePodBeforeInvoice: v })}
            />
          </div>
        </ErpCardSection>

        <ErpCardSection title="Sign-off note">
          <p className="text-[13px] text-erp-muted">
            Base flow (Confirmed SO → reserve → pick → pack → challan → post → stock relief → fulfilment → invoice ready)
            must be signed off before enabling live e-Way. This page does not configure e-Way.
          </p>
          <p className="mt-2 flex items-center gap-2 text-[12px] text-erp-muted">
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
            Version {settings.version}
            {settings.updatedAt ? ` · Updated ${new Date(settings.updatedAt).toLocaleString()}` : ''}
          </p>
        </ErpCardSection>
      </div>
    </OperationalPageShell>
  )
}
