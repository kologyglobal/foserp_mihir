import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type WorkspacePageHeaderMeta = {
  breadcrumbs?: { label: string; to?: string }[]
  title: string
  badge?: string
  favoritePath?: string
  /** When true, hide chrome title/badge/fav — page supplies its own sticky record header */
  recordHeader?: boolean
}

export type WorkspacePageHeaderChrome = {
  meta: WorkspacePageHeaderMeta | null
  commandBar: ReactNode
  actions: ReactNode
}

type WorkspacePageHeaderSetters = {
  setHeader: (next: WorkspacePageHeaderChrome) => void
  /** @deprecated use setHeader — kept for transitional call sites */
  setMeta: (meta: WorkspacePageHeaderMeta | null) => void
}

type WorkspacePageHeaderContextValue = WorkspacePageHeaderSetters & {
  meta: WorkspacePageHeaderMeta | null
  commandBar: ReactNode
  actions: ReactNode
}

const WorkspacePageHeaderStateContext = createContext<WorkspacePageHeaderChrome | null>(null)
const WorkspacePageHeaderSettersContext = createContext<WorkspacePageHeaderSetters | null>(null)

function metaEqual(a: WorkspacePageHeaderMeta | null, b: WorkspacePageHeaderMeta | null) {
  if (a === b) return true
  if (!a || !b) return false
  if (
    a.title !== b.title
    || a.badge !== b.badge
    || a.favoritePath !== b.favoritePath
    || a.recordHeader !== b.recordHeader
  ) return false
  const aCrumbs = a.breadcrumbs ?? []
  const bCrumbs = b.breadcrumbs ?? []
  if (aCrumbs.length !== bCrumbs.length) return false
  return aCrumbs.every((c, i) => c.label === bCrumbs[i]?.label && c.to === bCrumbs[i]?.to)
}

function headerEqual(a: WorkspacePageHeaderChrome, b: WorkspacePageHeaderChrome) {
  return (
    metaEqual(a.meta, b.meta)
    && a.commandBar === b.commandBar
    && a.actions === b.actions
  )
}

export function WorkspacePageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<WorkspacePageHeaderChrome>({
    meta: null,
    commandBar: null,
    actions: null,
  })

  const setHeader = useCallback((next: WorkspacePageHeaderChrome) => {
    setHeaderState((prev) => (headerEqual(prev, next) ? prev : next))
  }, [])

  const setMeta = useCallback((meta: WorkspacePageHeaderMeta | null) => {
    setHeaderState((prev) => {
      const next = { ...prev, meta }
      return headerEqual(prev, next) ? prev : next
    })
  }, [])

  const setters = useMemo(
    () => ({ setHeader, setMeta }),
    [setHeader, setMeta],
  )

  return (
    <WorkspacePageHeaderSettersContext.Provider value={setters}>
      <WorkspacePageHeaderStateContext.Provider value={header}>
        {children}
      </WorkspacePageHeaderStateContext.Provider>
    </WorkspacePageHeaderSettersContext.Provider>
  )
}

/**
 * Full header chrome (state + setters). Prefer `useWorkspacePageHeaderSetters` in
 * publishers so publishing does not re-subscribe to every header update.
 */
export function useWorkspacePageHeader(): WorkspacePageHeaderContextValue | null {
  const state = useContext(WorkspacePageHeaderStateContext)
  const setters = useContext(WorkspacePageHeaderSettersContext)
  return useMemo(() => {
    if (!state || !setters) return null
    return {
      meta: state.meta,
      commandBar: state.commandBar,
      actions: state.actions,
      setHeader: setters.setHeader,
      setMeta: setters.setMeta,
    }
  }, [state, setters])
}

/** Stable setters only — safe for page shells that publish into workspace chrome. */
export function useWorkspacePageHeaderSetters(): WorkspacePageHeaderSetters | null {
  return useContext(WorkspacePageHeaderSettersContext)
}

/** @deprecated use WorkspacePageHeaderMeta */
export type WorkspacePageHeaderConfig = WorkspacePageHeaderMeta & {
  commandBar?: ReactNode
  actions?: ReactNode
}
