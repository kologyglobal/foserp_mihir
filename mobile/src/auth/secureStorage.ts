import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import type { SecureSession } from '@/types/api'

/**
 * Secure token + session storage.
 * Native (iOS/Android): Expo SecureStore (Keychain / Keystore).
 * Web: sessionStorage for tokens (no SecureStore native module);
 *       localStorage only for non-secret remember-login prefs.
 */

const SESSION_KEY = 'fos_mobile_session_v1'
const REMEMBER_KEY = 'fos_mobile_remember_v1'
const BIOMETRIC_READY_KEY = 'fos_mobile_biometric_ready_v1'

export type RememberPrefs = {
  tenantSlug: string
  email?: string
  rememberLogin: boolean
}

function isWebPlatform(): boolean {
  return Platform.OS === 'web'
}

function webSessionGet(key: string): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function webSessionSet(key: string, value: string): void {
  if (typeof sessionStorage === 'undefined') {
    throw new Error('Web session storage is unavailable.')
  }
  sessionStorage.setItem(key, value)
}

function webSessionRemove(key: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function webLocalGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function webLocalSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') {
    throw new Error('Web local storage is unavailable.')
  }
  localStorage.setItem(key, value)
}

function webLocalRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

async function useNativeSecureStore(): Promise<boolean> {
  if (isWebPlatform()) return false
  try {
    return await SecureStore.isAvailableAsync()
  } catch {
    return false
  }
}

async function kvSet(key: string, value: string, options?: { webPersist?: boolean }): Promise<void> {
  if (await useNativeSecureStore()) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
    return
  }
  if (isWebPlatform()) {
    if (options?.webPersist) webLocalSet(key, value)
    else webSessionSet(key, value)
    return
  }
  throw new Error('Secure storage is not available on this platform.')
}

async function kvGet(key: string, options?: { webPersist?: boolean }): Promise<string | null> {
  if (await useNativeSecureStore()) {
    return SecureStore.getItemAsync(key)
  }
  if (isWebPlatform()) {
    return options?.webPersist ? webLocalGet(key) : webSessionGet(key)
  }
  return null
}

async function kvDelete(key: string, options?: { webPersist?: boolean }): Promise<void> {
  if (await useNativeSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      // ignore
    }
    return
  }
  if (isWebPlatform()) {
    if (options?.webPersist) webLocalRemove(key)
    else webSessionRemove(key)
  }
}

export async function saveSecureSession(session: SecureSession): Promise<void> {
  if (!session.accessToken || !session.refreshToken) {
    throw new Error('Refusing to persist incomplete session tokens.')
  }
  await kvSet(SESSION_KEY, JSON.stringify(session))
  if (session.rememberLogin) {
    await saveRememberPrefs({
      tenantSlug: session.tenantSlug,
      email: session.rememberedEmail,
      rememberLogin: true,
    })
  }
}

export async function loadSecureSession(): Promise<SecureSession | null> {
  try {
    const raw = await kvGet(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SecureSession
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.tenantSlug) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function clearSecureSession(): Promise<void> {
  await kvDelete(SESSION_KEY)
}

export async function saveRememberPrefs(prefs: RememberPrefs): Promise<void> {
  await kvSet(REMEMBER_KEY, JSON.stringify(prefs), { webPersist: true })
}

export async function loadRememberPrefs(): Promise<RememberPrefs | null> {
  try {
    const raw = await kvGet(REMEMBER_KEY, { webPersist: true })
    if (!raw) return null
    return JSON.parse(raw) as RememberPrefs
  } catch {
    return null
  }
}

export async function clearRememberPrefs(): Promise<void> {
  await kvDelete(REMEMBER_KEY, { webPersist: true })
}

/** Architecture hook for future biometric unlock — preference only in M1. */
export async function setBiometricUnlockReady(ready: boolean): Promise<void> {
  if (ready) {
    await kvSet(BIOMETRIC_READY_KEY, '1')
  } else {
    await kvDelete(BIOMETRIC_READY_KEY)
  }
}

export async function isBiometricUnlockReady(): Promise<boolean> {
  try {
    const v = await kvGet(BIOMETRIC_READY_KEY)
    return v === '1'
  } catch {
    return false
  }
}

/** Wipe tokens (+ biometric flag). Optionally keep remember prefs. */
export async function clearAllSecureKeys(options?: { keepRemember?: boolean }): Promise<void> {
  await clearSecureSession()
  await setBiometricUnlockReady(false)
  if (!options?.keepRemember) {
    await clearRememberPrefs()
  }
}
