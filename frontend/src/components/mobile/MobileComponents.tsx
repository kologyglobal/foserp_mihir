import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, ListTodo, ScanLine, LayoutGrid, User, Wifi, WifiOff } from 'lucide-react'
import { getExperienceRole, getExperienceRoleLabel } from '../../utils/permissions'
import { EXPERIENCE_ROLE_LABELS } from '../../types/roleExperience'
import { useMobileDraftStore } from '../../store/mobileDraftStore'
import { mobileTaskCount } from '../../utils/mobileTasks'
import { useEffect } from 'react'

const SHIFT_LABELS = ['Shift A', 'Shift B', 'Shift C'] as const

function currentShift() {
  const h = new Date().getHours()
  if (h >= 6 && h < 14) return SHIFT_LABELS[0]
  if (h >= 14 && h < 22) return SHIFT_LABELS[1]
  return SHIFT_LABELS[2]
}

export function MobileAppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isOnline = useMobileDraftStore((s) => s.isOnline)
  const syncCount = useMobileDraftStore((s) => s.syncQueue.length)
  const setOnline = useMobileDraftStore((s) => s.setOnline)
  const role = getExperienceRole()
  const taskBadge = mobileTaskCount(role)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    setOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [setOnline])

  const nav = [
    { path: '/m/home', label: 'Home', icon: Home },
    { path: '/m/tasks', label: 'Tasks', icon: ListTodo, badge: taskBadge },
    { path: '/m/scan', label: 'Scan', icon: ScanLine, primary: true },
    { path: '/m/modules', label: 'Modules', icon: LayoutGrid },
    { path: '/m/profile', label: 'Profile', icon: User },
  ]

  return (
    <div className="mob-app">
      {!isOnline && (
        <div className="mob-offline-banner">
          <WifiOff className="inline h-4 w-4 mr-1" />
          Offline — drafts saved locally. Posting requires network.
        </div>
      )}
      <header className="mob-header">
        <div>
          <div className="mob-header-title">FOS ERP</div>
          <div className="mob-header-sub">
            Plant: Pune · {currentShift()} · {EXPERIENCE_ROLE_LABELS[role] ?? getExperienceRoleLabel()}
            {isOnline ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Live
              </span>
            ) : (
              <span className="ml-2">Offline</span>
            )}
          </div>
        </div>
        <button type="button" className="mob-header-scan" onClick={() => navigate('/m/scan')} aria-label="Scan">
          <ScanLine className="h-5 w-5" />
        </button>
      </header>
      <main className="mob-main">{children}</main>
      <nav className="mob-bottom-nav" aria-label="Mobile navigation">
        {nav.map(({ path, label, icon: Icon, badge, primary }) => {
          const active = location.pathname === path || (path !== '/m/home' && location.pathname.startsWith(path))
          return (
            <Link key={path} to={path} className={`mob-nav-item${active ? ' active' : ''}${primary ? ' font-semibold' : ''}`}>
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
              {badge != null && badge > 0 && path === '/m/tasks' && (
                <span className="mob-nav-badge">{badge > 99 ? '99+' : badge}</span>
              )}
              {syncCount > 0 && path === '/m/profile' && (
                <span className="mob-nav-badge">{syncCount}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function MobilePageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-lg font-semibold text-[#242424]">{title}</h1>
      {subtitle && <p className="text-sm text-[#605e5c] mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function MobileStatusChip({ label, tone = 'gray' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'gray' }) {
  return <span className={`mob-chip mob-chip-${tone}`}>{label}</span>
}

export function MobileTaskCard({
  title,
  subtitle,
  count,
  priority,
  dueLabel,
  actionLabel,
  onAction,
}: {
  title: string
  subtitle: string
  count?: number
  priority?: 'high' | 'medium' | 'low'
  dueLabel?: string
  actionLabel: string
  onAction: () => void
}) {
  const tone = priority === 'high' ? 'red' : priority === 'medium' ? 'amber' : 'gray'
  return (
    <div className="mob-card">
      <div className="mob-task-card-header">
        <div>
          <div className="mob-task-title">{title}</div>
          <div className="mob-task-meta">{subtitle}</div>
          {dueLabel && <div className="mob-task-meta mt-1">Due: {dueLabel}</div>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {count != null && count > 0 && (
            <span className="text-xl font-bold text-[#0078d4]">{count}</span>
          )}
          <MobileStatusChip label={priority ?? 'normal'} tone={tone} />
        </div>
      </div>
      <button type="button" className="mob-btn mob-btn-primary" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  )
}

export function MobileScanButton({ onClick, label = 'Scan QR / Barcode' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="mob-btn mob-btn-primary flex items-center justify-center gap-2" onClick={onClick}>
      <ScanLine className="h-5 w-5" />
      {label}
    </button>
  )
}

export function MobileEntityPreviewCard({
  typeLabel,
  documentNo,
  status,
  subtitle,
  actions,
}: {
  typeLabel: string
  documentNo: string
  status: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mob-card">
      <MobileStatusChip label={typeLabel} tone="blue" />
      <div className="mt-2 text-xl font-bold">{documentNo}</div>
      {subtitle && <div className="text-sm text-[#605e5c]">{subtitle}</div>}
      <div className="mt-2">
        <MobileStatusChip label={status} tone="gray" />
      </div>
      {actions && <div className="mt-3 space-y-2">{actions}</div>}
    </div>
  )
}

export function MobileStepperInput({ value, onChange, min = 0, max = 9999 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="mob-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">
        −
      </button>
      <div className="mob-stepper-value">{value}</div>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Increase">
        +
      </button>
    </div>
  )
}

export function MobileStickyActionBar({ children }: { children: ReactNode }) {
  return <div className="mob-sticky-bar">{children}</div>
}

export function MobilePhotoCapture({ label, onCapture }: { label: string; onCapture: (dataUrl: string) => void }) {
  return (
    <label className="mob-btn mob-btn-secondary cursor-pointer">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => onCapture(String(reader.result))
          reader.readAsDataURL(file)
        }}
      />
      {label}
    </label>
  )
}

export function MobileOfflineBanner() {
  const isOnline = useMobileDraftStore((s) => s.isOnline)
  if (isOnline) return null
  return (
    <div className="mob-offline-banner mb-3 rounded-lg">
      Offline mode — inventory posting blocked until online
    </div>
  )
}

export function MobileConfirmSheet({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40" onClick={onCancel}>
      <div className="w-full rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-[#605e5c] mt-2">{message}</p>
        <div className="mt-4 space-y-2">
          <button type="button" className="mob-btn mob-btn-primary" onClick={onConfirm}>
            Confirm
          </button>
          <button type="button" className="mob-btn mob-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function MobileQuantityEntry({
  label,
  value,
  onChange,
  uom,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  uom?: string
}) {
  return (
    <div className="mob-field mb-4">
      <label>{label}{uom ? ` (${uom})` : ''}</label>
      <MobileStepperInput value={value} onChange={onChange} min={0} />
    </div>
  )
}

export function MobileApprovalCard({
  title,
  docNo,
  requestedBy,
  reason,
  onApprove,
  onReject,
  canAct,
}: {
  title: string
  docNo: string
  requestedBy: string
  reason?: string
  onApprove: () => void
  onReject: (remarks: string) => void
  canAct: boolean
}) {
  return (
    <div className="mob-card">
      <MobileStatusChip label={title} tone="amber" />
      <div className="mt-2 font-semibold">{docNo}</div>
      <div className="text-sm text-[#605e5c]">By {requestedBy}</div>
      {reason && <div className="text-sm mt-1">{reason}</div>}
      {canAct && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="mob-btn mob-btn-primary" onClick={onApprove}>
            Approve
          </button>
          <button
            type="button"
            className="mob-btn mob-btn-danger"
            onClick={() => {
              const remarks = window.prompt('Rejection remarks (required):')
              if (remarks?.trim()) onReject(remarks.trim())
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export function MobileJobCardTimer({ status }: { status: string }) {
  const tone = status === 'in_progress' ? 'green' : status === 'qc_hold' ? 'red' : 'amber'
  return <MobileStatusChip label={status.replace('_', ' ')} tone={tone} />
}

export function MobileSyncQueue() {
  const queue = useMobileDraftStore((s) => s.syncQueue)
  if (queue.length === 0) return null
  return (
    <div className="mob-card">
      <div className="font-semibold">Sync Queue ({queue.length})</div>
      <ul className="mt-2 text-sm space-y-1">
        {queue.map((d) => (
          <li key={d.id} className="text-[#605e5c]">
            {d.title} — {d.kind}
          </li>
        ))}
      </ul>
    </div>
  )
}
