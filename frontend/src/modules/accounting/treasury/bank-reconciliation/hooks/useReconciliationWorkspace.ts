import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import {
  fetchExceptionsForStatement,
  fetchSuggestionsForStatement,
  fetchSummary,
  fetchWorkspace,
} from '../api/bank-reconciliation.api'
import type { ExceptionDto, ReconciliationWorkspaceDto, SessionSummaryDto, SuggestionDto } from '../api/bank-reconciliation.types'

export interface ReconciliationWorkspaceState {
  workspace: ReconciliationWorkspaceDto | null
  summary: SessionSummaryDto | null
  suggestions: SuggestionDto[]
  exceptions: ExceptionDto[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/** Loads the statement-scoped reconciliation workspace + summary + pending suggestions + exceptions together. */
export function useReconciliationWorkspace(statementId: string | undefined, enabled: boolean): ReconciliationWorkspaceState {
  const [workspace, setWorkspace] = useState<ReconciliationWorkspaceDto | null>(null)
  const [summary, setSummary] = useState<SessionSummaryDto | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionDto[]>([])
  const [exceptions, setExceptions] = useState<ExceptionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!statementId || !enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [ws, sum, sugg, exc] = await Promise.all([
        fetchWorkspace(statementId),
        fetchSummary(statementId),
        fetchSuggestionsForStatement(statementId),
        fetchExceptionsForStatement(statementId),
      ])
      setWorkspace(ws)
      setSummary(sum)
      setSuggestions(sugg)
      setExceptions(exc)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load reconciliation workspace'
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
  }, [statementId, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { workspace, summary, suggestions, exceptions, loading, error, reload }
}
