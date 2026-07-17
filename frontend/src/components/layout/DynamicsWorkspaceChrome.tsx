import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getModuleFromPath, getPageTitle } from '../../utils/moduleContext'
import { buildRouteBreadcrumbs } from '../../utils/pageNavigation'
import { getModuleSubNavForPath, subNavItemIsActive } from '../../config/moduleWorkspaceNav'
import { useUIStore } from '../../store/uiStore'
import { DynamicsTabs } from '../dynamics/DynamicsTabs'
import { shouldNavigate } from '../../utils/safeState'
import { cn } from '../../utils/cn'
import {
  WorkspacePageHeaderProvider,
  useWorkspacePageHeader,
  type WorkspacePageHeaderMeta,
} from '../../context/WorkspacePageHeaderContext'
import { WorkspaceUnifiedHeader } from '../../context/WorkspaceUnifiedHeader'

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

  type WorkspaceTab = { path: string; label: string; group?: string; visitedAt: string }
  const workspaceTabs = useMemo((): WorkspaceTab[] => {
    if (moduleSubNav && moduleSubNav.items.length > 1) {
      return moduleSubNav.items.map((item) => ({
        path: item.path,
        label: item.label,
        group: item.group,
        visitedAt: '',
      }))
    }
    const tabs = recentPages
      .filter((t) => isUsableWorkspaceTab(t.label, t.path))
      .slice(0, 6)
      .map((t): WorkspaceTab => ({ path: t.path, label: t.label, visitedAt: t.visitedAt }))
    if (tabs.length === 0) {
      return [{ path: pathname, label: pageTitle || 'Page', visitedAt: new Date().toISOString() }]
    }
    return tabs
  }, [recentPages, pathname, pageTitle, moduleSubNav])

  const useModuleTabs = Boolean(moduleSubNav && moduleSubNav.items.length > 1)
  const activeTabLabel = workspaceTabs.find((t) => isTabActive(pathname, t.path))?.label ?? ''

  /** Always show Leads-style structured header — never a blank sticky band. */
  const headerMeta: WorkspacePageHeaderMeta = useMemo(() => {
    if (mergedMeta) return mergedMeta
    return {
      title: pageTitle || activeTabLabel || 'Page',
      badge: module || undefined,
      favoritePath: pathname,
      breadcrumbs: buildRouteBreadcrumbs(pathname),
    }
  }, [mergedMeta, pageTitle, activeTabLabel, module, pathname])

  const tabsNode = workspaceTabs.length > 0 ? (
    <DynamicsTabs
      items={workspaceTabs.map((t) => ({
        label: t.label,
        path: t.path,
        group: t.group,
      }))}
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
        <WorkspaceUnifiedHeader
          meta={headerMeta}
          commandBar={commandBar}
          actions={actions}
          tabs={tabsNode}
          pageTitle={pageTitle || activeTabLabel}
          moduleName={module}
        />

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

/** Dynamics workspace chrome — structured page header + module tabs for every route */
export function DynamicsWorkspaceChrome({ children }: { children: ReactNode }) {
  return (
    <WorkspacePageHeaderProvider>
      <DynamicsWorkspaceChromeInner>{children}</DynamicsWorkspaceChromeInner>
    </WorkspacePageHeaderProvider>
  )
}
