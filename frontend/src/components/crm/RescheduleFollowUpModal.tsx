import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { ErpButton } from '../erp/ErpButton'
import { FormField } from '../forms/FormField'
import { Input, Textarea } from '../forms/Inputs'
import {
  getDateInputMin,
  getTimeInputMin,
  validateFollowUpAt,
} from '../../utils/validation/crmDatePolicy'
import { CrmDrawerShell } from './CrmDrawerShell'

/** Product default: reschedule reason is optional. Set true to require it. */
export const RESCHEDULE_FOLLOW_UP_REASON_REQUIRED = false

export type RescheduleFollowUpValues = {
  dueDate: string
  dueTime: string
  reason: string
}

export type RescheduleFollowUpTarget = {
  id: string
  dueDate: string
  dueTime?: string | null
  label?: string
}

interface RescheduleFollowUpModalProps {
  open: boolean
  followUp: RescheduleFollowUpTarget | null
  onClose: () => void
  onReschedule: (values: RescheduleFollowUpValues) => void | Promise<void>
}

/** @deprecated Prefer getDateInputMin from crmDatePolicy */
export function localDateString(d = new Date()): string {
  return getDateInputMin(d)
}

/** Local time HH:mm */
export function localTimeString(d = new Date()): string {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatDisplayDateTime(date: string, time?: string | null): string {
  const t = (time ?? '10:00').slice(0, 5)
  try {
    const parsed = new Date(`${date}T${t}:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  } catch {
    /* fall through */
  }
  return `${date} · ${t}`
}

/** Prefer validateFollowUpAt from crmDatePolicy. */
export function isFollowUpDateTimeFuture(dueDate: string, dueTime: string): boolean {
  return validateFollowUpAt({ dueDate, dueTime }) === null
}

export function RescheduleFollowUpModal({
  open,
  followUp,
  onClose,
  onReschedule,
}: RescheduleFollowUpModalProps) {
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('10:00')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const dateMin = getDateInputMin()
  const timeMin = getTimeInputMin(dueDate)

  useEffect(() => {
    if (!open || !followUp) return
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDueDate(followUp.dueDate || getDateInputMin(tomorrow))
    setDueTime((followUp.dueTime ?? '10:00').slice(0, 5))
    setReason('')
    setError(null)
    setSubmitting(false)
  }, [open, followUp])

  async function handleSubmit() {
    if (!followUp) return
    if (RESCHEDULE_FOLLOW_UP_REASON_REQUIRED && !reason.trim()) {
      setError('Reason is required')
      return
    }
    if (!dueDate) {
      setError('New date is required')
      return
    }
    if (!dueTime) {
      setError('New time is required')
      return
    }
    const dueError = validateFollowUpAt({ dueDate, dueTime })
    if (dueError) {
      setError(dueError)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onReschedule({
        dueDate,
        dueTime: dueTime.slice(0, 5),
        reason: reason.trim(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reschedule')
      setSubmitting(false)
    }
  }

  return (
    <CrmDrawerShell
      open={open && Boolean(followUp)}
      placement="modal"
      size="sm"
      icon={CalendarClock}
      accent="warning"
      title="Reschedule Follow-up"
      subtitle={followUp?.label ?? 'Pick a new date and time'}
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <div className="crm-popup-footer__actions">
          <ErpButton type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </ErpButton>
          <ErpButton type="button" variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Rescheduling…' : 'Reschedule'}
          </ErpButton>
        </div>
      }
    >
      {followUp ? (
        <div className="crm-popup-form">
          <FormField label="Current Date & Time">
            <Input
              readOnly
              value={formatDisplayDateTime(followUp.dueDate, followUp.dueTime)}
              className="bg-erp-surface-muted"
            />
          </FormField>

          <div className="crm-popup-field-pair">
            <FormField label="New Date" required error={error && !dueDate ? error : undefined}>
              <Input
                type="date"
                data-field="dueDate"
                value={dueDate}
                min={dateMin}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  if (error) setError(null)
                }}
                disabled={submitting}
              />
            </FormField>
            <FormField label="New Time" required>
              <Input
                type="time"
                data-field="dueTime"
                value={dueTime}
                min={timeMin}
                onChange={(e) => {
                  setDueTime(e.target.value)
                  if (error) setError(null)
                }}
                disabled={submitting}
              />
            </FormField>
          </div>

          <FormField
            label="Reason"
            required={RESCHEDULE_FOLLOW_UP_REASON_REQUIRED}
            hint={RESCHEDULE_FOLLOW_UP_REASON_REQUIRED ? undefined : 'Optional'}
          >
            <Textarea
              rows={3}
              value={reason}
              placeholder="Why is this being rescheduled?"
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError(null)
              }}
              disabled={submitting}
            />
          </FormField>

          {error ? (
            <p className="crm-popup-alert" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </CrmDrawerShell>
  )
}
