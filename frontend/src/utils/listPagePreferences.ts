const STORAGE_KEY = 'vasant-erp-list-preferences'

export type ListPagePreference = {
  sortBy?: string
  activeView?: string
}

type Store = Record<string, ListPagePreference>

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(next: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

export function loadListPagePreference(pageId: string): ListPagePreference | null {
  const hit = readStore()[pageId]
  return hit ?? null
}

export function saveListPagePreference(pageId: string, patch: ListPagePreference): void {
  const store = readStore()
  store[pageId] = { ...store[pageId], ...patch }
  writeStore(store)
}
