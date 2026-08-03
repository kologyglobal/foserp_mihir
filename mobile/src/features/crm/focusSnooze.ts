/**
 * Local "today's focus" snooze — hides an opportunity from the focus deck
 * until the snooze expires (default: end of next calendar day boundary = 24h).
 * Device-local only; not a CRM server field.
 */
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system'

const WEB_KEY = 'fos_crm_focus_snooze_v1'
const FILE_NAME = 'fos_crm_focus_snooze.json'

type SnoozeMap = Record<string, number> // opportunityId -> expiresAt epoch ms

function filePath(): string {
  const dir = FileSystem.documentDirectory
  if (!dir) throw new Error('FileSystem unavailable')
  return `${dir}${FILE_NAME}`
}

async function readMap(): Promise<SnoozeMap> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return {}
      const raw = localStorage.getItem(WEB_KEY)
      if (!raw) return {}
      return (JSON.parse(raw) as SnoozeMap) ?? {}
    }
    const path = filePath()
    const info = await FileSystem.getInfoAsync(path)
    if (!info.exists) return {}
    const raw = await FileSystem.readAsStringAsync(path)
    return (JSON.parse(raw) as SnoozeMap) ?? {}
  } catch {
    return {}
  }
}

async function writeMap(map: SnoozeMap): Promise<void> {
  const pruned = pruneExpired(map)
  const json = JSON.stringify(pruned)
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(WEB_KEY, json)
    return
  }
  if (!FileSystem.documentDirectory) return
  await FileSystem.writeAsStringAsync(filePath(), json)
}

function pruneExpired(map: SnoozeMap, now = Date.now()): SnoozeMap {
  const next: SnoozeMap = {}
  for (const [id, until] of Object.entries(map)) {
    if (typeof until === 'number' && until > now) next[id] = until
  }
  return next
}

/** Ids still snoozed right now. */
export async function getActiveSnoozedOpportunityIds(): Promise<Set<string>> {
  const map = pruneExpired(await readMap())
  await writeMap(map)
  return new Set(Object.keys(map))
}

/**
 * Snooze an opportunity out of today's focus.
 * @param hours How long to hide (default 24h ~ until tomorrow same time).
 */
export async function snoozeOpportunityFocus(
  opportunityId: string,
  hours = 24,
): Promise<void> {
  if (!opportunityId) return
  const map = await readMap()
  map[opportunityId] = Date.now() + Math.max(1, hours) * 3_600_000
  await writeMap(map)
}

export async function clearOpportunityFocusSnooze(opportunityId: string): Promise<void> {
  const map = await readMap()
  delete map[opportunityId]
  await writeMap(map)
}
