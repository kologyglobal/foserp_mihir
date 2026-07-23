/** Coach-style Auto Mode for Guided Fulfilment (local preference). */
const STORAGE_KEY = 'fos.mfg.fulfilmentAutoMode'

export function getFulfilmentAutoMode(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function setFulfilmentAutoMode(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}
