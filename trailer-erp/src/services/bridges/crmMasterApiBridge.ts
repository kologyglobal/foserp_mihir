import type { CrmMasterDto } from '../api/crmApi'
import { formatApiError } from '../api/apiErrors'
import * as api from '../api/crmApi'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import type { CrmMasterEntry, CrmMasterKind } from '../../types/crmMasters'
import type { StoreActionResult } from '../../store/storeAction'
import { isApiMode } from '../../config/apiConfig'

function fail(err: unknown): StoreActionResult {
  return { ok: false, error: formatApiError(err) }
}

function mapDto(row: CrmMasterDto): CrmMasterEntry {
  return {
    id: row.id,
    kind: row.kind as CrmMasterKind,
    code: row.code,
    name: row.name,
    status: row.status as 'active' | 'inactive',
    sortOrder: row.sortOrder,
    description: row.description,
    attributes: row.attributes ?? {},
    systemControlled: row.systemControlled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    modifiedBy: row.modifiedBy,
    createdByName: row.createdByName,
    modifiedByName: row.modifiedByName,
  }
}

function upsertEntry(entry: CrmMasterEntry): void {
  useCrmMasterStore.setState((s) => ({
    entries: [entry, ...s.entries.filter((e) => e.id !== entry.id)],
  }))
}

function removeEntry(id: string): void {
  useCrmMasterStore.setState((s) => ({
    entries: s.entries.filter((e) => e.id !== id),
  }))
}

async function refreshKind(kind: CrmMasterKind): Promise<void> {
  const res = await api.fetchCrmMasterLookup(kind)
  const mapped = res.data.map(mapDto)
  useCrmMasterStore.setState((s) => ({
    entries: [...s.entries.filter((e) => e.kind !== kind), ...mapped],
  }))
}

export interface CrmMasterWriteInput {
  kind: CrmMasterKind
  code: string
  name: string
  status?: 'active' | 'inactive'
  sortOrder?: number
  description?: string
  notes?: string
  attributes?: Record<string, string | number | boolean | null>
}

function toApiPayload(input: CrmMasterWriteInput): Record<string, unknown> {
  const attributes = { ...(input.attributes ?? {}) }
  if (input.notes) attributes.notes = input.notes
  return {
    code: input.code,
    name: input.name,
    status: input.status ?? 'active',
    sortOrder: input.sortOrder,
    description: input.description,
    attributes,
  }
}

export async function writeCrmMasterEntry(
  input: CrmMasterWriteInput,
  id?: string,
): Promise<StoreActionResult & { id?: string }> {
  if (!isApiMode()) return { ok: false, error: 'API mode required' }
  try {
    const payload = toApiPayload(input)
    if (id) {
      const res = await api.updateCrmMasterApi(input.kind, id, payload)
      upsertEntry(mapDto(res.data))
      return { ok: true, id }
    }
    const res = await api.createCrmMasterApi(input.kind, payload)
    upsertEntry(mapDto(res.data))
    return { ok: true, id: res.data.id }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteCrmMasterEntryApi(kind: CrmMasterKind, id: string): Promise<StoreActionResult> {
  if (!isApiMode()) return { ok: false, error: 'API mode required' }
  try {
    await api.deleteCrmMasterApi(kind, id)
    removeEntry(id)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function activateCrmMasterEntryApi(kind: CrmMasterKind, id: string): Promise<StoreActionResult> {
  if (!isApiMode()) return { ok: false, error: 'API mode required' }
  try {
    const res = await api.activateCrmMasterApi(kind, id)
    upsertEntry(mapDto(res.data))
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deactivateCrmMasterEntryApi(kind: CrmMasterKind, id: string): Promise<StoreActionResult> {
  if (!isApiMode()) return { ok: false, error: 'API mode required' }
  try {
    const res = await api.deactivateCrmMasterApi(kind, id)
    upsertEntry(mapDto(res.data))
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function refreshCrmMasterKindApi(kind: CrmMasterKind): Promise<void> {
  if (!isApiMode()) return
  await refreshKind(kind)
}

export function resolveCrmMasterWrite(
  demoFn: () => StoreActionResult & { id?: string },
  apiFn: () => Promise<StoreActionResult & { id?: string }>,
): Promise<StoreActionResult & { id?: string }> | StoreActionResult & { id?: string } {
  return isApiMode() ? apiFn() : demoFn()
}

export function resolveCrmMasterDelete(
  kind: CrmMasterKind,
  id: string,
  demoFn: () => StoreActionResult,
): Promise<StoreActionResult> | StoreActionResult {
  return isApiMode() ? deleteCrmMasterEntryApi(kind, id) : demoFn()
}

export function resolveCrmMasterActivate(
  kind: CrmMasterKind,
  id: string,
  demoFn: () => StoreActionResult,
): Promise<StoreActionResult> | StoreActionResult {
  return isApiMode() ? activateCrmMasterEntryApi(kind, id) : demoFn()
}

export function resolveCrmMasterDeactivate(
  kind: CrmMasterKind,
  id: string,
  demoFn: () => StoreActionResult,
): Promise<StoreActionResult> | StoreActionResult {
  return isApiMode() ? deactivateCrmMasterEntryApi(kind, id) : demoFn()
}
