/**
 * Gatekeeper Mode shell (/gate/operator) — deliberately renders WITHOUT the
 * standard ERP sidebar/suite bar. Security guards get a focused, touch-first
 * screen; supervisors keep the full /gate workspace (linked from the header
 * only when the session role has approval/settings rights).
 */

import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { getSessionUser } from '@/utils/permissions'
import { useGatePermissions } from '@/utils/permissions/gate'
import { ToastHost } from '@/components/ui/ToastHost'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

export function GateOperatorLayout() {
  const user = getSessionUser()
  const perms = useGatePermissions()
  const now = useClock()
  const showFullWorkspaceLink = perms.canActionApprovals || perms.canManageSettings

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <Link to="/gate/operator" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight">Gate Security</span>
              <span className="block truncate text-xs text-slate-300">{user.name}</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-lg font-bold tabular-nums">
                {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs text-slate-300">
                {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {showFullWorkspaceLink && (
              <Link
                to="/gate"
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Full workspace
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
      <ToastHost />
    </div>
  )
}
