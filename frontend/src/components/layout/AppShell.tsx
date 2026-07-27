import { useEffect, useState } from 'react'
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
import {
  ApiHydrationErrorBanner,
  ApiHydrationErrorScreen,
} from '../system/ApiHydrationErrorScreen'
import { PermissionDeniedPage } from '../system/PermissionDeniedPage'
import { ScrollToTop } from '../routing/ScrollToTop'
import { BackToTopButton } from './BackToTopButton'
import { ProtectedOutlet } from '../auth/ProtectedRoute'
import { useUIStore } from '../../store/uiStore'
import { DensityProvider } from '../../design-system/enterprise/DensityProvider'
import { useCrmApiSync } from '../../hooks/useCrmApiSync'
import { useMasterApiSync } from '../../hooks/useMasterApiSync'
import { useAdminApiSync } from '../../hooks/useAdminApiSync'
import { isApiMode } from '@/config/apiConfig'
import { runDemoCrmBootstrap } from '@/bootstrap/demoBootstrap'
import { useTenantModulesStore } from '../../store/tenantModulesStore'
import { Loader } from '../ui/Loader'
import { cn } from '../../utils/cn'
import {
  isPermissionDeniedError,
  parseMissingPermissionKey,
} from '@/services/api/apiErrors'

export function AppShell() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen)
  const closeMobileNav = useUIStore((s) => s.closeMobileNav)
  const { status: apiSyncStatus, error: apiSyncError } = useCrmApiSync()
  const { status: masterSyncStatus, error: masterSyncError } = useMasterApiSync()
  const { status: adminSyncStatus, error: adminSyncError } = useAdminApiSync()
  const [continueDespiteSyncError, setContinueDespiteSyncError] = useState(false)
  const [hideSyncErrorBanner, setHideSyncErrorBanner] = useState(false)

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

  useEffect(() => {
    void useTenantModulesStore.getState().hydrate()
  }, [])

  if (isApiMode() && (apiSyncStatus === 'loading' || masterSyncStatus === 'loading' || adminSyncStatus === 'loading')) {
    return <Loader fullScreen size="lg" label="Loading data from server" />
  }

  const syncFailed =
    isApiMode() &&
    (apiSyncStatus === 'error' || masterSyncStatus === 'error' || adminSyncStatus === 'error')
  const syncErrorDetail = apiSyncError ?? masterSyncError ?? adminSyncError ?? 'Unknown error'
  const looksLikeOffline =
    /failed to fetch|networkerror|load failed/i.test(syncErrorDetail) ||
    /not routing \/api|backend running|expected json/i.test(syncErrorDetail)

  if (syncFailed && !continueDespiteSyncError) {
    if (isPermissionDeniedError(syncErrorDetail)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <PermissionDeniedPage
            requiredPermission={parseMissingPermissionKey(syncErrorDetail)}
            pageName="this workspace area"
            onGoHome={() => {
              setContinueDespiteSyncError(true)
              setHideSyncErrorBanner(true)
            }}
          />
        </div>
      )
    }
    return (
      <ApiHydrationErrorScreen
        detail={syncErrorDetail}
        looksLikeOffline={looksLikeOffline}
        onContinueHome={() => {
          setContinueDespiteSyncError(true)
          setHideSyncErrorBanner(false)
        }}
      />
    )
  }

  return (
    <div className={cn('d365-app', sidebarCollapsed && 'erp-sidebar-is-collapsed')}>
      <ScrollToTop />
      <BackToTopButton />
      <PageTracker />
      <KeyboardShortcuts />
      <DynamicsSuiteBar />

      {syncFailed && !hideSyncErrorBanner ? (
        <ApiHydrationErrorBanner
          detail={syncErrorDetail}
          onRetry={() => window.location.reload()}
          onDismiss={() => setHideSyncErrorBanner(true)}
        />
      ) : null}

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
      {!isApiMode() && (
        <div
          className="fixed bottom-3 left-3 z-[60] select-none rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-sm"
          title="VITE_USE_API=false — all data on screen is local demo/sample data, nothing is saved to a server."
        >
          Demo mode — sample data
        </div>
      )}
    </div>
  )
}

/** @deprecated Use AppShell — kept for route compatibility */
export const ERPLayout = AppShell
