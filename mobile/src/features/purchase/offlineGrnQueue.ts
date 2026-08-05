/**
 * Offline GRN create queue — survives network loss until flush.
 * Storage: native documentDirectory JSON, web localStorage (shared pattern with CRM drafts).
 */
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system'
import NetInfo from '@react-native-community/netinfo'
import type { CreateGrnInput } from '@/features/purchase/api'
import { createGoodsReceipt, submitGoodsReceipt } from '@/features/purchase/api'

const STORAGE_KEY = 'fos_purchase_offline_grn_v1'
const MAX_QUEUE = 25

export type OfflineGrnJob = {
  localId: string
  createdAt: string
  alsoSubmit: boolean
  label: string
  payload: CreateGrnInput
  lastError?: string
}

function storagePath(): string {
  if (Platform.OS === 'web') return STORAGE_KEY
  const dir = FileSystem.documentDirectory
  if (!dir) throw new Error('FileSystem unavailable for offline GRN queue')
  return `${dir}${STORAGE_KEY}.json`
}

export async function readOfflineGrnQueue(): Promise<OfflineGrnJob[]> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return []
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as OfflineGrnJob[]
      return Array.isArray(parsed) ? parsed : []
    }
    const path = storagePath()
    const info = await FileSystem.getInfoAsync(path)
    if (!info.exists) return []
    const raw = await FileSystem.readAsStringAsync(path)
    const parsed = JSON.parse(raw) as OfflineGrnJob[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeOfflineGrnQueue(jobs: OfflineGrnJob[]): Promise<void> {
  const trimmed = jobs.slice(0, MAX_QUEUE)
  const json = JSON.stringify(trimmed)
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      throw new Error('Cannot store offline GRN on web: localStorage unavailable')
    }
    localStorage.setItem(STORAGE_KEY, json)
    return
  }
  await FileSystem.writeAsStringAsync(storagePath(), json)
}

export async function enqueueOfflineGrn(job: {
  payload: CreateGrnInput
  alsoSubmit: boolean
  label: string
}): Promise<OfflineGrnJob> {
  const queue = await readOfflineGrnQueue()
  const entry: OfflineGrnJob = {
    localId: `ogrn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    alsoSubmit: job.alsoSubmit,
    label: job.label,
    payload: job.payload,
  }
  await writeOfflineGrnQueue([entry, ...queue])
  return entry
}

export async function removeOfflineGrn(localId: string): Promise<void> {
  const queue = await readOfflineGrnQueue()
  await writeOfflineGrnQueue(queue.filter((j) => j.localId !== localId))
}

export async function isNetworkOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    if (state.isConnected === false) return false
    if (state.isInternetReachable === false) return false
    return true
  } catch {
    return true
  }
}

export type FlushResult = {
  posted: number
  failed: number
  errors: string[]
  grnIds: string[]
}

/** Attempt to post all queued GRNs (online only). Failed jobs keep lastError. */
export async function flushOfflineGrnQueue(): Promise<FlushResult> {
  const online = await isNetworkOnline()
  if (!online) {
    return { posted: 0, failed: 0, errors: ['Device is offline'], grnIds: [] }
  }
  const queue = await readOfflineGrnQueue()
  if (!queue.length) return { posted: 0, failed: 0, errors: [], grnIds: [] }

  const remaining: OfflineGrnJob[] = []
  let posted = 0
  let failed = 0
  const errors: string[] = []
  const grnIds: string[] = []

  for (const job of queue) {
    try {
      const created = await createGoodsReceipt(job.payload)
      if (job.alsoSubmit && created.id) {
        try {
          await submitGoodsReceipt(created.id, 'Submitted after offline queue flush')
        } catch {
          // draft is still success for flush purposes
        }
      }
      if (created.id) grnIds.push(created.id)
      posted += 1
    } catch (e) {
      failed += 1
      const msg = e instanceof Error ? e.message : 'Flush failed'
      errors.push(`${job.label}: ${msg}`)
      remaining.push({ ...job, lastError: msg })
    }
  }

  await writeOfflineGrnQueue(remaining)
  return { posted, failed, errors, grnIds }
}
