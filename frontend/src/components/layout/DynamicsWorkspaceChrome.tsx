import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getModuleFromPath, getPageTitle } from '../../utils/moduleContext'
import { getModuleSubNavForPath, subNavItemIsActive } from '../../config/moduleWorkspaceNav'
import { useUIStore } from '../../store/uiStore'
import { DynamicsTabs } from '../dynamics/DynamicsTabs'
import { shouldNavigate } from '../../utils/safeState'
import { cn } from '../../utils/cn'
import { CrmPageTip } from '../crm/CrmPageTip'
import { WorkspacePageHeaderProvider, useWorkspacePageHeader } from '../../context/WorkspacePageHeaderContext'
import { WorkspaceUnifiedHeader } from '../../context/WorkspaceUnifiedHeader'
import { isCrmPath } from '../../utils/crmPageTipStorage'

function isTabActive(pathname: string, tabPath: string) {
  if (pathname === tabPath) return true
  if (tabPath === '/home' && (pathname === '/' || pathname === '')) return true
  return pathname.startsWith(`${tabPath}/`)
}

const UUID_TAB_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUsableWorkspaceTab(label: string, path: string): boolean {
  const trimmed = label.trim()
  if (!trimmed || UUID_TAB_RE.test(trimmed)) return false
  const last = path.split('/').filter(Boolean).pop() ?? ''
  if (UUID_TAB_RE.test(last) && (trimmed === 'Edit' || trimmed === 'New' || trimmed === 'Record')) return false
  return true
}

function DynamicsWorkspaceChromeInner({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pageTitle = getPageTitle(pathname)
  const { module } = getModuleFromPath(pathname)
  const recentPages = useUIStore((s) => s.recentPages)
  const moduleSubNav = useMemo(() => getModuleSubNavForPath(pathname), [pathname])
  const { meta: mergedMeta, commandBar, actions } = useWorkspacePageHeader() ?? {
    meta: null,
    commandBar: null,
    actions: null,
  }

  const workspaceTabs = useMemo(() => {
    if (moduleSubNav && moduleSubNav.items.length > 1) {
      return moduleSubNav.items.map((item) => ({
        path: item.path,
        label: item.label,
        visitedAt: '',
      }))
    }
    // Prefer clean module nav over visit-history tabs (avoids UUID / Edit noise).
    const tabs = recentPages
      .filter((t) => isUsableWorkspaceTab(t.label, t.path))
      .slice(0, 6)
    if (tabs.length === 0) {
      return [{ path: pathname, label: pageTitle || 'Page', visitedAt: new Date().toISOString() }]
    }
    return tabs
  }, [recentPages, pathname, pageTitle, moduleSubNav])

  const useModuleTabs = Boolean(moduleSubNav && moduleSubNav.items.length > 1)
  const activeTabLabel = workspaceTabs.find((t) => isTabActive(pathname, t.path))?.label ?? ''
  const showLegacyContextHead = Boolean(!mergedMeta && pageTitle && pageTitle !== activeTabLabel)

  const tabsNode = workspaceTabs.length > 0 ? (
    <DynamicsTabs
      items={workspaceTabs.map((t) => ({ label: t.label, path: t.path }))}
      activePath={
        useModuleTabs
          ? (moduleSubNav!.items.find((item) => subNavItemIsActive(pathname, item))?.path ?? pathname)
          : (workspaceTabs.find((t) => isTabActive(pathname, t.path))?.path ?? pathname)
      }
      onChange={(path) => {
        if (shouldNavigate(pathname, path)) navigate(path)
      }}
    />
  ) : null

  return (
    <div className="d365-workspace">
      <div className="d365-workspace-sticky">
        {mergedMeta ? (
          <WorkspaceUnifiedHeader
            meta={mergedMeta}
            commandBar={commandBar}
            actions={actions}
            tabs={tabsNode}
          />
        ) : (
          <>
            {showLegacyContextHead && (
              <div className="d365-workspace-context">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="d365-workspace-context-title">{pageTitle}</h1>
                    {isCrmPath(pathname) ? <CrmPageTip /> : null}
                  </div>
                  <p className="d365-workspace-context-sub">{module}</p>
                </div>
              </div>
            )}
            {tabsNode}
          </>
        )}

        {!mergedMeta && !useModuleTabs && moduleSubNav && moduleSubNav.items.length > 1 && (
          <nav className="d365-subnav dyn-subnav-secondary" aria-label={`${moduleSubNav.categoryTitle} navigation`}>
            {moduleSubNav.items.map((item) => (
              <button
                key={`${item.path}-${item.label}`}
                type="button"
                className={cn(
                  'd365-subnav-link',
                  subNavItemIsActive(pathname, item) && 'd365-subnav-link-active',
                )}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="d365-workspace-content">{children}</div>
    </div>
  )
}

/** Dynamics workspace chrome — module tabs + optional merged page header */
export function DynamicsWorkspaceChrome({ children }: { children: ReactNode }) {
  return (
    <WorkspacePageHeaderProvider>
      <DynamicsWorkspaceChromeInner>{children}</DynamicsWorkspaceChromeInner>
    </WorkspacePageHeaderProvider>
  )
}
