import { loadDemoData } from './loadDemoData'

/** Clear localStorage and reload complete demo dataset. */
export function resetDemoData(): { ok: boolean; error?: string } {
  const result = loadDemoData()
  return { ok: result.ok, error: result.error }
}
