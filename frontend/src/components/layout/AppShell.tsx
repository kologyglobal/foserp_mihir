import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { DynamicsSuiteBar } from './DynamicsSuiteBar'
import { DynamicsWorkspaceChrome } from './DynamicsWorkspaceChrome'
import { PageTracker } from './PageTracker'
import { KeyboardShortcuts } from './KeyboardShortcuts'
import { GlobalSearch } from '../design-system/GlobalSearch'
import { NotificationPanel } from '../design-system/NotificationPanel'
import { RecordDetailPanel } from '../design-system/RecordDetailPanel'
import { RightDrawer } from '../design-system/RightDrawer'
import { CrmQuickCreateHost } from '../crm/quick-create/CrmQuickCreateHost'
import { AppErrorBoundary } from '../system/AppErrorBoundary'
import { ScrollToTop } from '../routing/ScrollToTop'
import { BackToTopButton } from './BackToTopButton'
import { ProtectedOutlet } from '../auth/ProtectedRoute'
import { useUIStore } from '../../store/uiStore'
import { DensityProvider } from '../../design-system/enterprise/DensityProvider'
import { useCrmApiSync } from '../../hooks/useCrmApiSync'
import { useMasterApiSync } from '../../hooks/useMasterApiSync'
import { isApiMode } from '@/config/apiConfig'
import { runDemoCrmBootstrap } from '@/bootstrap/demoBootstrap'
import { cn } from '../../utils/cn'

export function AppShell() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen)
  const closeMobileNav = useUIStore((s) => s.closeMobileNav)
  const { status: apiSyncStatus, error: apiSyncError } = useCrmApiSync()
  const { status: masterSyncStatus, error: masterSyncError } = useMasterApiSync()

  useEffect(() => {
    if (!mobileNavOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  useEffect(() => {
    if (isApiMode()) return
    runDemoCrmBootstrap()
  }, [])

  if (isApiMode() && (apiSyncStatus === 'loading' || masterSyncStatus === 'loading')) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-erp-muted">
        Loading data from server…
      </div>
    )
  }

  if (isApiMode() && (apiSyncStatus === 'error' || masterSyncStatus === 'error')) {
    const detail = apiSyncError ?? masterSyncError ?? 'Unknown error'
    const looksLikeOffline =
      /failed to fetch|networkerror|load failed/i.test(detail) ||
      /not routing \/api|backend running|expected json/i.test(detail)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center">
          <p className="font-medium text-erp-text">Could not load application data</p>
          <p className="mt-2 text-sm text-erp-muted">{detail}</p>
          {looksLikeOffline ? (
            <p className="mt-3 text-left text-xs text-erp-muted">
              API mode needs the backend. Locally run <code className="rounded bg-slate-100 px-1">npm run dev</code> in{' '}
              <code className="rounded bg-slate-100 px-1">backend/</code> (port 5000). On production, confirm{' '}
              <code className="rounded bg-slate-100 px-1">/api/v1/health</code> returns JSON, not the SPA HTML.
            </p>
          ) : null}
          <button
            type="button"
            className="erp-btn erp-btn--primary mt-4 text-[13px]"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="d365-app">
      <ScrollToTop />
      <BackToTopButton />
      <PageTracker />
      <KeyboardShortcuts />
      <DynamicsSuiteBar />

      {mobileNavOpen && (
        <button
          type="button"
          className="d365-nav-backdrop"
          onClick={closeMobileNav}
          aria-label="Close navigation menu"
        />
      )}
      <div className="d365-body">
        <Sidebar />
        <main
          className={cn(
            'd365-main erp-main transition-all duration-200',
            sidebarCollapsed
              ? 'md:pl-[var(--erp-sidebar-collapsed)]'
              : 'md:pl-[var(--erp-sidebar-width)]',
          )}
        >
          <DynamicsWorkspaceChrome>
            <DensityProvider>
              <AppErrorBoundary>
                <ProtectedOutlet>
                  <Outlet />
                </ProtectedOutlet>
              </AppErrorBoundary>
            </DensityProvider>
          </DynamicsWorkspaceChrome>
        </main>
      </div>
      <GlobalSearch />
      <NotificationPanel />
      <RecordDetailPanel />
      <RightDrawer />
      <CrmQuickCreateHost />
    </div>
  )
}

/** @deprecated Use AppShell — kept for route compatibility */
export const ERPLayout = AppShell
