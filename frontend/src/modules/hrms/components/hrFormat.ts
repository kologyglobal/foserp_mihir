/** Shared time/format helpers for attendance, overtime, and roster views. */

/** Minutes → "8h 45m" (or "45m" / "0m"). Never fabricates a value — pass null/undefined through as '-'. */
export function formatHrMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '-'
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`
}

/** ISO datetime → local "HH:mm" punch time. */
export function formatHrTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

/** Date → "Mon, 12 Aug 2026" for register headers. */
export function formatHrDateLong(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function startOfWeekIso(d = new Date()): string {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday.toISOString().slice(0, 10)
}
