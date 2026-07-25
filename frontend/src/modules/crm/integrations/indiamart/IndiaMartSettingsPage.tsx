import { useEffect, useState } from 'react'
import {
  disableIndiaMartWebhook,
  enableIndiaMartWebhook,
  fetchIndiaMartSettings,
  rotateIndiaMartWebhook,
  syncIndiaMart,
  testIndiaMartConnection,
  updateIndiaMartSettings,
  type IndiaMartSettings,
} from '@/services/api/indiaMartApi'
import { canCrmPermission } from '@/utils/permissions'
import { notify } from '@/store/toastStore'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { Select } from '@/components/forms/Inputs'

export function IndiaMartSettingsPage() {
  const canManage = canCrmPermission('crm.indiamart.settings.manage')
  const canCreds = canCrmPermission('crm.indiamart.credentials.manage')
  const canSync = canCrmPermission('crm.indiamart.sync.run')

  const [settings, setSettings] = useState<IndiaMartSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [accountName, setAccountName] = useState('')
  const [registeredMobile, setRegisteredMobile] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('https://mapi.indiamart.com')
  const [leadFetchEndpoint, setLeadFetchEndpoint] = useState('/wservce/crm/crmListing/v2/')
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [autoCreateLead, setAutoCreateLead] = useState(true)
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(15)
  const [initialLookbackDays, setInitialLookbackDays] = useState(7)
  const [duplicateBehaviour, setDuplicateBehaviour] = useState('CREATE_ACTIVITY_ON_EXISTING_LEAD')
  const [assignmentMode, setAssignmentMode] = useState('DEFAULT_OWNER')
  const [autoCreateFollowUp, setAutoCreateFollowUp] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lookbackDays, setLookbackDays] = useState(7)
  const [webhookReveal, setWebhookReveal] = useState<{ url: string; token: string } | null>(null)
  const [webhookBusy, setWebhookBusy] = useState(false)

  async function load() {
    const res = await fetchIndiaMartSettings()
    const s = res.data
    setSettings(s)
    setAccountName(s.accountName ?? '')
    setApiBaseUrl(s.apiBaseUrl)
    setLeadFetchEndpoint(s.leadFetchEndpoint)
    setSyncEnabled(s.syncEnabled)
    setAutoCreateLead(s.autoCreateLead)
    setSyncIntervalMinutes(s.syncIntervalMinutes)
    setInitialLookbackDays(s.initialLookbackDays)
    setDuplicateBehaviour(s.duplicateBehaviour ?? 'CREATE_ACTIVITY_ON_EXISTING_LEAD')
    setAssignmentMode(s.assignmentMode ?? 'DEFAULT_OWNER')
    const cfg = s.configurationJson ?? {}
    setAutoCreateFollowUp(cfg.autoCreateFollowUp === true)
  }

  useEffect(() => {
    void load().catch((err) => notify.error((err as Error).message ))
  }, [])

  async function onSave() {
    if (!canManage) return
    setSaving(true)
    try {
      await updateIndiaMartSettings({
        accountName: accountName || null,
        registeredMobile: registeredMobile || null,
        registeredEmail: registeredEmail || null,
        apiBaseUrl,
        leadFetchEndpoint,
        ...(apiKey ? { apiKey } : {}),
        syncEnabled,
        autoCreateLead,
        syncIntervalMinutes,
        initialLookbackDays,
        duplicateBehaviour,
        assignmentMode,
        configurationJson: {
          ...(settings?.configurationJson ?? {}),
          autoCreateFollowUp,
          followUpActivityType: 'Call',
          followUpDueMinutes: 30,
          followUpSubject: 'Contact IndiaMART enquiry',
          followUpPriority: 'high',
          firstResponseSlaMinutes: 30,
          escalationSlaMinutes: 120,
          overlapMinutes: 5,
        },
      })
      setApiKey('')
      notify.success('Settings saved' )
      await load()
    } catch (err) {
      notify.error((err as Error).message )
    } finally {
      setSaving(false)
    }
  }

  async function onTest() {
    try {
      const res = await testIndiaMartConnection()
      if (res.data.ok) notify.success(res.data.message)
      else notify.error(res.data.message)
      await load()
    } catch (err) {
      notify.error((err as Error).message )
    }
  }

  async function onSync(initial = false) {
    try {
      const res = await syncIndiaMart(
        initial
          ? { triggerType: 'INITIAL_IMPORT', lookbackDays }
          : { triggerType: 'MANUAL' },
      )
      notify.success(`Sync completed (${String(res.data.status ?? 'ok')})`)
      await load()
    } catch (err) {
      notify.error((err as Error).message )
    }
  }

  async function onEnableWebhook() {
    if (!canCreds) return
    setWebhookBusy(true)
    try {
      const res = await enableIndiaMartWebhook()
      setWebhookReveal({ url: res.data.webhookUrl, token: res.data.webhookToken })
      notify.success('Push webhook enabled — copy the URL now; the token is shown once')
      await load()
    } catch (err) {
      notify.error((err as Error).message)
    } finally {
      setWebhookBusy(false)
    }
  }

  async function onRotateWebhook() {
    if (!canCreds) return
    setWebhookBusy(true)
    try {
      const res = await rotateIndiaMartWebhook()
      setWebhookReveal({ url: res.data.webhookUrl, token: res.data.webhookToken })
      notify.success('Webhook token rotated — update IndiaMART with the new URL')
      await load()
    } catch (err) {
      notify.error((err as Error).message)
    } finally {
      setWebhookBusy(false)
    }
  }

  async function onDisableWebhook() {
    if (!canCreds) return
    setWebhookBusy(true)
    try {
      await disableIndiaMartWebhook()
      setWebhookReveal(null)
      notify.success('Push webhook disabled')
      await load()
    } catch (err) {
      notify.error((err as Error).message)
    } finally {
      setWebhookBusy(false)
    }
  }

  if (!settings) {
    return <div className="text-sm text-erp-muted">Loading settings…</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-erp-border bg-white p-4 space-y-3">
        <h3 className="font-semibold text-erp-text">Connection</h3>
        <p className="text-xs text-erp-muted">
          Uses IndiaMART Lead Manager Pull API v2 (`glusr_crm_key`). Generate the key at seller.indiamart.com → Lead Manager → Pull API.
          Credentials are encrypted at rest and never returned in plaintext.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Account name
            <input className="mt-1 w-full rounded border px-2 py-1.5" value={accountName} onChange={(e) => setAccountName(e.target.value)} disabled={!canManage} />
          </label>
          <label className="text-sm">
            Status
            <div className="mt-1 rounded border bg-erp-surface px-2 py-1.5">{settings.status}</div>
          </label>
          <label className="text-sm">
            Registered mobile
            <input className="mt-1 w-full rounded border px-2 py-1.5" value={registeredMobile} onChange={(e) => setRegisteredMobile(e.target.value)} placeholder={settings.registeredMobileMasked ?? ''} disabled={!canCreds} />
          </label>
          <label className="text-sm">
            Registered email
            <input className="mt-1 w-full rounded border px-2 py-1.5" value={registeredEmail} onChange={(e) => setRegisteredEmail(e.target.value)} placeholder={settings.registeredEmailMasked ?? ''} disabled={!canCreds} />
          </label>
          <label className="text-sm md:col-span-2">
            Pull API key {settings.apiKeyMasked ? `(saved: ${settings.apiKeyMasked})` : ''}
            <input
              type="password"
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.hasCredentials ? 'Leave blank to keep existing key' : 'Paste glusr_crm_key'}
              disabled={!canCreds}
              autoComplete="new-password"
            />
          </label>
          <label className="text-sm">
            API base URL
            <input className="mt-1 w-full rounded border px-2 py-1.5" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} disabled={!canManage} />
          </label>
          <label className="text-sm">
            Lead fetch endpoint
            <input className="mt-1 w-full rounded border px-2 py-1.5" value={leadFetchEndpoint} onChange={(e) => setLeadFetchEndpoint(e.target.value)} disabled={!canManage} />
          </label>
        </div>
        {!settings.fieldEncryptionConfigured && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            FIELD_ENCRYPTION_KEY is not configured on the server. Credentials cannot be stored until it is set.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <button type="button" className="rounded bg-erp-primary px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={saving} onClick={() => void onSave()}>
              Save settings
            </button>
          )}
          {canCreds && (
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void onTest()}>
              Test connection
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-erp-border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Synchronization</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} disabled={!canManage} />
          Enable scheduled sync (min interval 5 minutes; IndiaMART recommends 10–15)
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Interval (minutes)
            <input type="number" min={5} className="mt-1 w-full rounded border px-2 py-1.5" value={syncIntervalMinutes} onChange={(e) => setSyncIntervalMinutes(Number(e.target.value))} disabled={!canManage} />
          </label>
          <label className="text-sm">
            Initial lookback (days)
            <input type="number" min={1} max={30} className="mt-1 w-full rounded border px-2 py-1.5" value={initialLookbackDays} onChange={(e) => setInitialLookbackDays(Number(e.target.value))} disabled={!canManage} />
          </label>
          <div className="text-sm">
            <div className="text-erp-muted">Last successful sync</div>
            <div>{settings.lastSuccessfulSyncAt ? new Date(settings.lastSuccessfulSyncAt).toLocaleString() : '—'}</div>
            <div className="mt-1 text-erp-muted">Next scheduled</div>
            <div>{settings.nextScheduledSyncAt ? new Date(settings.nextScheduledSyncAt).toLocaleString() : '—'}</div>
          </div>
        </div>
        {canSync && (
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void onSync(false)}>
              Sync now
            </button>
            <label className="text-sm">
              Initial import lookback
              <Select value={String(lookbackDays)} onChange={(e) => setLookbackDays(Number(e.target.value))}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {[1, 3, 7, 15, 30].map((d) => (
                  <option key={d} value={d}>
                    {d} day{d > 1 ? 's' : ''}
                  </option>
                ))}
              </Select>
            </label>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void onSync(true)}>
              Initial import
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-erp-border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Push API webhook</h3>
        <p className="text-xs text-erp-muted">
          Optional real-time ingest alongside Pull sync. Register the webhook URL in IndiaMART Lead Manager → Push API.
          FOS stores only a hashed token; the full URL/token is shown once on enable or rotate. The endpoint returns HTTP 200
          on accept so IndiaMART does not deactivate Push after ~48h of failures.
        </p>
        <div className="text-sm">
          Status:{' '}
          <span className="font-medium">
            {settings.pushWebhookEnabled
              ? `Enabled (token ${settings.pushWebhookTokenPrefix ?? '••••'}…)`
              : 'Disabled'}
          </span>
        </div>
        {webhookReveal && (
          <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="font-medium text-amber-950">Copy now — not shown again</div>
            <label className="block text-xs">
              Webhook URL
              <input className="mt-1 w-full rounded border bg-white px-2 py-1.5 font-mono text-xs" readOnly value={webhookReveal.url} onFocus={(e) => e.target.select()} />
            </label>
            <label className="block text-xs">
              Token (path segment)
              <input className="mt-1 w-full rounded border bg-white px-2 py-1.5 font-mono text-xs" readOnly value={webhookReveal.token} onFocus={(e) => e.target.select()} />
            </label>
            <button type="button" className="text-xs underline" onClick={() => setWebhookReveal(null)}>
              Hide
            </button>
          </div>
        )}
        {canCreds && (
          <div className="flex flex-wrap gap-2">
            {!settings.pushWebhookEnabled ? (
              <button
                type="button"
                className="rounded bg-erp-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={webhookBusy}
                onClick={() => void onEnableWebhook()}
              >
                Enable Push webhook
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                  disabled={webhookBusy}
                  onClick={() => void onRotateWebhook()}
                >
                  Rotate token
                </button>
                <button
                  type="button"
                  className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                  disabled={webhookBusy}
                  onClick={() => void onDisableWebhook()}
                >
                  Disable
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-erp-border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Lead creation</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoCreateLead} onChange={(e) => setAutoCreateLead(e.target.checked)} disabled={!canManage} />
          Automatically create CRM leads after sync
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoCreateFollowUp} onChange={(e) => setAutoCreateFollowUp(e.target.checked)} disabled={!canManage} />
          Automatically create first follow-up (Call / 30 min / High)
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Duplicate behaviour
            <Select value={duplicateBehaviour} onChange={(e) => setDuplicateBehaviour(e.target.value)} disabled={!canManage}>
              <option value="CREATE_ACTIVITY_ON_EXISTING_LEAD">Create activity on existing lead</option>
              <option value="CREATE_NEW_LEAD">Create new lead</option>
              <option value="UPDATE_EXISTING_LEAD">Update existing lead</option>
              <option value="SEND_TO_REVIEW">Send to review</option>
            </Select>
          </label>
          <label className="text-sm">
            Assignment mode
            <Select value={assignmentMode} onChange={(e) => setAssignmentMode(e.target.value)} disabled={!canManage}>
              <option value="DEFAULT_OWNER">Default owner</option>
              <option value="ROUND_ROBIN">Round robin</option>
              <option value="TERRITORY_BASED">Territory based</option>
              <option value="CITY_STATE_BASED">City / state based</option>
              <option value="MANUAL">Manual</option>
            </Select>
          </label>
        </div>
      </section>
    </div>
  )
}
