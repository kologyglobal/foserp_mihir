import { useCallback, useEffect, useState } from 'react'
import { fetchLookup } from '@/services/api/masterApi'
import { isApiMode } from '@/config/apiConfig'

export interface LookupOption {
  id: string
  label: string
}

/** Fetches a `/lookups/:resource` list (items, uom, warehouses) for select inputs. Falls back to [] on error. */
export function useSetupLookup(resource: string): { options: LookupOption[]; reload: () => void } {
  const [options, setOptions] = useState<LookupOption[]>([])

  const load = useCallback(() => {
    if (!isApiMode()) return
    void fetchLookup(resource)
      .then((res) => {
        setOptions(res.data.map((row) => ({ id: row.id, label: row.code ? `${row.code} — ${row.name}` : row.name })))
      })
      .catch(() => setOptions([]))
  }, [resource])

  useEffect(() => {
    load()
  }, [load])

  return { options, reload: load }
}
