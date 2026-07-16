import { useEffect, useState } from 'react'
import { AlertCircle, Mail } from 'lucide-react'
import { ReceivableDrawerShell } from './ReceivableDrawerShell'
import { notify } from '@/store/toastStore'
import {
  createReminderPreview,
  markReminderDemo,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'

export function ReminderPreviewDrawer({
  open,
  onClose,
  reminderId,
  channel,
  onMarkedSent,
}: {
  open: boolean
  onClose: () => void
  reminderId: string
  channel: 'email' | 'whatsapp' | 'print'
  onMarkedSent?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{
    subject: string
    body: string
    channel: string
    disclaimer: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !reminderId) {
      setPreview(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    void createReminderPreview(reminderId, channel)
      .then(setPreview)
      .catch((e) => {
        setPreview(null)
        setError(e instanceof ReceivablesServiceError ? e.message : 'Failed to load preview.')
      })
      .finally(() => setLoading(false))
  }, [open, reminderId, channel])

  const handleMarkSent = async () => {
    setBusy(true)
    try {
      await markReminderDemo(reminderId)
      notify.success('Reminder marked as sent in demo mode. No message was delivered.')
      onMarkedSent?.()
      onClose()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Failed to mark reminder.')
    } finally {
      setBusy(false)
    }
  }

  const channelLabel =
    channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'WhatsApp' : 'Print'

  return (
    <ReceivableDrawerShell
      open={open}
      onClose={onClose}
      title="Reminder preview"
      subtitle={`${channelLabel} · Demo only`}
      eyebrow="Receivables · Reminders"
      widthClassName="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-primary h-9 px-3 text-[13px] font-semibold"
            onClick={() => void handleMarkSent()}
            disabled={busy || loading || Boolean(error)}
          >
            {busy ? 'Saving…' : 'Mark reminder sent in demo'}
          </button>
        </div>
      }
    >
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Communication integration is not connected. This preview is for review only.</p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">Loading preview…</p>
      ) : error ? (
        <p className="py-8 text-center text-[13px] text-rose-700" role="alert">
          {error}
        </p>
      ) : preview ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[12px] text-erp-muted">
            <Mail className="h-4 w-4" aria-hidden />
            <span>Channel: {channelLabel}</span>
          </div>

          {channel !== 'print' ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Subject</p>
              <p className="mt-1 rounded-md border border-erp-border bg-erp-surface px-3 py-2 text-[13px] text-erp-text">
                {preview.subject}
              </p>
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Message body</p>
            <pre className="mt-1 whitespace-pre-wrap rounded-md border border-erp-border bg-white px-3 py-3 font-sans text-[13px] leading-relaxed text-erp-text">
              {preview.body}
            </pre>
          </div>

          <p className="text-[11px] text-erp-muted">{preview.disclaimer}</p>
        </div>
      ) : (
        <p className="py-8 text-center text-[13px] text-erp-muted">No preview available.</p>
      )}
    </ReceivableDrawerShell>
  )
}
