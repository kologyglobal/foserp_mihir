/**
 * Demo-only manufacturing UI role (localStorage).
 * Does not call the API — placeholder for future backend RBAC.
 */

import { useSyncExternalStore } from 'react'
import type { ManufacturingUiRole } from '@/types/manufacturingRoles'
import { MANUFACTURING_UI_ROLES } from '@/types/manufacturingRoles'

const STORAGE_KEY = 'fos-mfg-ui-role'
export const MANUFACTURING_UI_ROLE_CHANGE = 'fos-mfg-ui-role-change'

const DEFAULT_ROLE: ManufacturingUiRole = 'production_manager'

function isUiRole(value: string | null): value is ManufacturingUiRole {
  return Boolean(value && (MANUFACTURING_UI_ROLES as readonly string[]).includes(value))
}

export function getManufacturingUiRole(): ManufacturingUiRole {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isUiRole(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_ROLE
}

export function setManufacturingUiRole(role: ManufacturingUiRole) {
  try {
    localStorage.setItem(STORAGE_KEY, role)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(MANUFACTURING_UI_ROLE_CHANGE))
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(MANUFACTURING_UI_ROLE_CHANGE, onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener(MANUFACTURING_UI_ROLE_CHANGE, onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

export function useManufacturingUiRole(): ManufacturingUiRole {
  return useSyncExternalStore(subscribe, getManufacturingUiRole, () => DEFAULT_ROLE)
}
