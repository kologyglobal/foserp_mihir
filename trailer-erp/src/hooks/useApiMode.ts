import { isApiMode } from '@/config/apiConfig'

/** Reactive API-mode flag for components (static; re-read on mount only). */
export function useApiMode(): boolean {
  return isApiMode()
}

export { isApiMode } from '@/config/apiConfig'
