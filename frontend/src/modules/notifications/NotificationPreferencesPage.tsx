import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiMode } from '@/hooks/useApiMode'
import {
  fetchNotificationPreferences,
  putNotificationPreferences,
  type NotificationPreference,
} from '@/services/api/notificationsApi'
import { ErpButton } from '@/components/erp/ErpButton'
import { notify } from '@/store/toastStore'
import { NOTIFICATION_TYPES_UI } from './notificationTypeLabels'

export function NotificationPreferencesPage() {
  const apiMode = useApiMode()
  const [rows, setRows] = useState<NotificationPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    void fetchNotificationPreferences()
      .then((prefs) => {
        const byType = new Map(prefs.map((p) => [p.notificationType, p]))
        setRows(
          NOTIFICATION_TYPES_UI.map((t) => {
            const existing = byType.get(t.type)
            return (
              existing ?? {
                notificationType: t.type,
                inAppEnabled: true,
                emailEnabled: false,
                mobilePushEnabled: false,
                whatsappEnabled: false,
                dailyDigestEnabled: false,
                reminderMinutesBefore: null,
                escalationEnabled: true,
                muteUntil: null,
                isMandatory: t.mandatory,
              }
            )
          }),
        )
      })
      .finally(() => setLoading(false))
  }, [apiMode])

  if (!apiMode) {
    return (
      <div className="erp-page p-6">
        <p className="text-sm text-erp-muted">Notification preferences require API mode.</p>
      </div>
    )
  }

  return (
    <div className="erp-page mx-auto max-w-3xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Notification preferences</h1>
          <p className="mt-1 text-sm text-erp-muted">
            Critical CRM alerts stay on. Optional types can mute in-app / enable digest channels later.
          </p>
        </div>
        <Link to="/notifications" className="text-sm font-semibold text-erp-primary hover:underline">
          Back
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-erp-muted">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-erp-surface-alt text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">In-app</th>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Digest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const meta = NOTIFICATION_TYPES_UI.find((t) => t.type === row.notificationType)
                return (
                  <tr key={row.notificationType} className="border-b border-erp-border last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-erp-text">{meta?.label ?? row.notificationType}</p>
                      {row.isMandatory || meta?.mandatory ? (
                        <p className="text-[11px] text-erp-muted">Required</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.inAppEnabled}
                        disabled={row.isMandatory || meta?.mandatory}
                        onChange={(e) => {
                          setRows((list) =>
                            list.map((r, i) =>
                              i === idx ? { ...r, inAppEnabled: e.target.checked } : r,
                            ),
                          )
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.emailEnabled}
                        onChange={(e) => {
                          setRows((list) =>
                            list.map((r, i) =>
                              i === idx ? { ...r, emailEnabled: e.target.checked } : r,
                            ),
                          )
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.dailyDigestEnabled}
                        onChange={(e) => {
                          setRows((list) =>
                            list.map((r, i) =>
                              i === idx ? { ...r, dailyDigestEnabled: e.target.checked } : r,
                            ),
                          )
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <ErpButton
          variant="primary"
          disabled={saving || loading}
          onClick={() => {
            setSaving(true)
            void putNotificationPreferences(rows)
              .then((saved) => {
                setRows(saved)
                notify.success('Preferences saved')
              })
              .catch((err) => notify.error((err as Error).message))
              .finally(() => setSaving(false))
          }}
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </ErpButton>
      </div>
    </div>
  )
}
