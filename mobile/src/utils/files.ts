/**
 * Minimal FileSystem helper for Expo SDK 52.
 * Native: expo-file-system documentDirectory.
 * Web: localStorage (documentDirectory is unavailable in browsers).
 */
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system'

const WEB_DRAFTS_STORAGE_KEY = 'fos_crm_offline_drafts_v1'

export function isFileSystemDocumentAvailable(): boolean {
  return Platform.OS !== 'web' && Boolean(FileSystem.documentDirectory)
}

export async function readFileBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Browser blob/file URIs need fetch → data URL; local paths won't work.
    if (uri.startsWith('data:')) {
      const comma = uri.indexOf(',')
      return comma >= 0 ? uri.slice(comma + 1) : uri
    }
    const res = await fetch(uri)
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
      reader.readAsDataURL(blob)
    })
    const comma = dataUrl.indexOf(',')
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: (FileSystem as { EncodingType?: { Base64: string } }).EncodingType?.Base64 ?? 'base64',
  } as FileSystem.ReadingOptions)
}

export function draftsFilePath(): string {
  if (Platform.OS === 'web') {
    return WEB_DRAFTS_STORAGE_KEY
  }
  const dir = FileSystem.documentDirectory
  if (!dir) throw new Error('FileSystem document directory unavailable')
  return `${dir}fos_crm_offline_drafts.json`
}

/** Read offline draft JSON blob (path is FS path or web storage key). */
export async function readDraftsPayload(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return null
      return localStorage.getItem(WEB_DRAFTS_STORAGE_KEY)
    } catch {
      return null
    }
  }
  const path = draftsFilePath()
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return null
  return FileSystem.readAsStringAsync(path)
}

/** Persist offline draft JSON blob. */
export async function writeDraftsPayload(json: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      throw new Error('Web local storage is unavailable for offline drafts.')
    }
    localStorage.setItem(WEB_DRAFTS_STORAGE_KEY, json)
    return
  }
  await FileSystem.writeAsStringAsync(draftsFilePath(), json)
}

/** Soft-delete a local media URI after upload (no-op on web blob URLs). */
export async function deleteLocalFileIfPossible(uri: string | undefined | null): Promise<void> {
  if (!uri || Platform.OS === 'web') return
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) return
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true })
  } catch {
    // ignore
  }
}

/** Remove draft media cache directory when present (native only). */
export async function clearDraftMediaCacheDir(): Promise<void> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return
  try {
    const dir = `${FileSystem.documentDirectory}fos_draft_media/`
    const info = await FileSystem.getInfoAsync(dir)
    if (info.exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true })
    }
  } catch {
    // ignore
  }
}
