import { useCallback, useEffect, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import {
  createEntityNoteApi,
  deleteEntityNoteApi,
  fetchEntityNotesApi,
  updateEntityNoteApi,
  type CreateEntityNoteInput,
  type CrmEntityNoteDto,
  type FetchEntityNotesParams,
} from '../services/api/crmApi'
import { formatApiError } from '../services/api/apiErrors'
import type { CrmEntityTypeApi } from '../types/crmEntity'

export function useEntityNotes(
  entityType: CrmEntityTypeApi,
  entityId: string | undefined,
  listFilters?: FetchEntityNotesParams,
) {
  const [notes, setNotes] = useState<CrmEntityNoteDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const refresh = useCallback(async () => {
    if (!isApiMode() || !entityId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchEntityNotesApi(entityType, entityId, listFilters)
      setNotes(res.data)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, listFilters?.stageCode, listFilters?.noteType])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createNote = useCallback(
    async (input: string | CreateEntityNoteInput) => {
      if (!entityId) return { ok: false as const, error: 'Entity not found' }
      setPending(true)
      setError(null)
      try {
        const res = await createEntityNoteApi(entityType, entityId, input)
        setNotes((prev) => [res.data, ...prev])
        return { ok: true as const }
      } catch (err) {
        const message = formatApiError(err)
        setError(message)
        return { ok: false as const, error: message }
      } finally {
        setPending(false)
      }
    },
    [entityType, entityId],
  )

  const updateNote = useCallback(async (noteId: string, content: string) => {
    setPending(true)
    setError(null)
    try {
      const res = await updateEntityNoteApi(noteId, content)
      const updated = res.data
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      return { ok: true as const }
    } catch (err) {
      const message = formatApiError(err)
      setError(message)
      return { ok: false as const, error: message }
    } finally {
      setPending(false)
    }
  }, [])

  const deleteNote = useCallback(async (noteId: string) => {
    setPending(true)
    setError(null)
    try {
      await deleteEntityNoteApi(noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      return { ok: true as const }
    } catch (err) {
      const message = formatApiError(err)
      setError(message)
      return { ok: false as const, error: message }
    } finally {
      setPending(false)
    }
  }, [])

  return {
    notes,
    loading,
    error,
    pending,
    refresh,
    createNote,
    updateNote,
    deleteNote,
    isApiBacked: isApiMode(),
  }
}
