import { useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { Checkbox } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getFinanceSettings, saveFinanceSettings } from '@/services/bridges/financeApiBridge'
import type { FinanceSettings } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'

export function FeaturesPage() {
  const perms = useFinancePermissions()
  const [settings, setSettings] = useState<FinanceSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSettings(await getFinanceSettings())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const save = async () => {
    if (!settings) return
    try {
      await saveFinanceSettings({ ...settings })
      notify.success('Finance settings saved.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Features & Controls"
      actions={
        perms.canManage ? (
          <ErpButton size="sm" onClick={() => void save()}>
            <Save className="mr-1 h-3.5 w-3.5" />
            Save
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && settings && perms.canView ? (
        <div className="max-w-xl space-y-4">
          <section className="rounded border border-erp-border p-4">
            <h2 className="text-[13px] font-semibold text-erp-text">Posting controls</h2>
            <div className="mt-3 space-y-3">
              <Checkbox
                label="Allow backdated posting"
                checked={settings.allowBackdatedPosting ?? false}
                onChange={(e) => setSettings((s) => s && ({ ...s, allowBackdatedPosting: e.target.checked }))}
                disabled={!perms.canManage}
              />
              {settings.allowBackdatedPosting ? (
                <FormField label="Backdated days limit">
                  <Input
                    type="number"
                    min={0}
                    value={settings.backdatedDaysLimit ?? 0}
                    onChange={(e) => setSettings((s) => s && ({ ...s, backdatedDaysLimit: Number(e.target.value) }))}
                    disabled={!perms.canManage}
                  />
                </FormField>
              ) : null}
              <Checkbox
                label="Allow manual posting to control accounts"
                checked={settings.allowManualControlAccountPosting ?? false}
                onChange={(e) => setSettings((s) => s && ({ ...s, allowManualControlAccountPosting: e.target.checked }))}
                disabled={!perms.canManage}
              />
            </div>
          </section>
          <details className="rounded border border-erp-border p-4">
            <summary className="cursor-pointer text-[13px] font-semibold text-erp-text">Advanced limits</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <FormField label="Receipt approval limit">
                <Input type="number" value={settings.receiptApprovalLimit ?? ''} onChange={(e) => setSettings((s) => s && ({ ...s, receiptApprovalLimit: Number(e.target.value) }))} disabled={!perms.canManage} />
              </FormField>
              <FormField label="Payment approval limit">
                <Input type="number" value={settings.paymentApprovalLimit ?? ''} onChange={(e) => setSettings((s) => s && ({ ...s, paymentApprovalLimit: Number(e.target.value) }))} disabled={!perms.canManage} />
              </FormField>
              <FormField label="Journal approval limit">
                <Input type="number" value={settings.journalApprovalLimit ?? ''} onChange={(e) => setSettings((s) => s && ({ ...s, journalApprovalLimit: Number(e.target.value) }))} disabled={!perms.canManage} />
              </FormField>
              <FormField label="Write-off tolerance">
                <Input type="number" value={settings.writeOffTolerance ?? ''} onChange={(e) => setSettings((s) => s && ({ ...s, writeOffTolerance: Number(e.target.value) }))} disabled={!perms.canManage} />
              </FormField>
            </div>
          </details>
        </div>
      ) : null}
    </FinanceSettingsShell>
  )
}
