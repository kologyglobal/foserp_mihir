import { useCallback, useState, type FormEvent } from 'react'
import { QrCode, Search, ShieldAlert } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getTraceabilityLineage,
  searchTraceability,
  type TraceabilityLineageResult,
  type TraceabilitySearchResult,
} from '@/services/api/opsReportsApi'
import { canViewTraceability } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/dates/format'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

/** Phase 7D — traceability search + vertical lineage timeline (batch/lot/serial genealogy). */
export function TraceabilityPage() {
  const canView = canViewTraceability()

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<TraceabilitySearchResult[]>([])
  const [selected, setSelected] = useState<TraceabilitySearchResult | null>(null)
  const [lineage, setLineage] = useState<TraceabilityLineageResult | null>(null)
  const [loadingLineage, setLoadingLineage] = useState(false)

  const runSearch = useCallback(async (q: string) => {
    if (!isApiMode() || !q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await searchTraceability(q.trim())
      setResults(res.data)
    } catch (error) {
      setResults([])
      notify.error(error instanceof Error ? error.message : 'Traceability search failed')
    } finally {
      setSearching(false)
    }
  }, [])

  const openLineage = useCallback(async (item: TraceabilitySearchResult) => {
    setSelected(item)
    setLoadingLineage(true)
    setLineage(null)
    try {
      const res = await getTraceabilityLineage(item.id, item.type)
      setLineage(res.data)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to load lineage')
    } finally {
      setLoadingLineage(false)
    }
  }, [])

  const onSubmitSearch = (e: FormEvent) => {
    e.preventDefault()
    void runSearch(query)
  }

  if (!canView) {
    return (
      <ProductionPageHeader title="Traceability" favoritePath="/manufacturing/traceability">
        <ProductionEmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="You do not have permission to view manufacturing traceability."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Traceability"
      description="Search a batch, lot, serial, or work order and trace its genealogy."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Traceability' },
      ]}
      favoritePath="/manufacturing/traceability"
    >
      {!isApiMode() ? (
        <>
          <ManufacturingDemoBanner message="Traceability requires API mode — enable VITE_USE_API to search live batch/lot/serial genealogy." />
          <ProductionEmptyState
            icon={QrCode}
            title="Traceability requires API mode"
            description="Turn on VITE_USE_API to search and trace batches, lots, and serials."
          />
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <form onSubmit={onSubmitSearch} className="flex items-center gap-2">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Batch / lot / serial / WO number…"
                className="flex-1"
                aria-label="Traceability search"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-erp-border bg-white px-3 text-[12px] font-medium text-erp-text hover:bg-erp-surface-alt/40"
              >
                <Search className="h-3.5 w-3.5" aria-hidden /> Search
              </button>
            </form>

            {searching ? (
              <LoadingState variant="table" rows={4} />
            ) : results.length === 0 ? (
              <ProductionEmptyState
                icon={QrCode}
                title="No results"
                description="Search a batch, lot, serial, or work order number to begin."
              />
            ) : (
              <ul className="space-y-1.5">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openLineage(item)}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left text-[12px] transition',
                        selected?.id === item.id
                          ? 'border-erp-primary/50 bg-erp-primary/5'
                          : 'border-erp-border bg-white hover:border-erp-primary/30',
                      )}
                    >
                      <span className="block font-semibold text-erp-text">{item.label}</span>
                      <span className="block text-[11px] text-erp-muted">
                        {item.type}
                        {item.code ? ` · ${item.code}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-erp-border bg-white p-4">
            {!selected ? (
              <ProductionEmptyState
                icon={QrCode}
                title="Select a result"
                description="Choose a search result to view its lineage timeline."
              />
            ) : loadingLineage ? (
              <LoadingState variant="table" rows={5} />
            ) : !lineage || lineage.nodes.length === 0 ? (
              <ProductionEmptyState
                icon={QrCode}
                title="No lineage found"
                description="No traceability nodes are linked to this record yet."
              />
            ) : (
              <div>
                <h2 className="mb-3 text-[13px] font-semibold text-erp-text">
                  Lineage — {selected.label}
                </h2>
                <ol className="relative space-y-4 border-l border-erp-border pl-5">
                  {lineage.nodes.map((node) => (
                    <li key={node.id} className="relative">
                      <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-erp-primary ring-2 ring-white" aria-hidden />
                      <div className="rounded-md border border-erp-border bg-erp-surface-alt/30 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-erp-text">{node.label}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-erp-muted">{node.type}</span>
                        </div>
                        {node.status ? <p className="mt-0.5 text-[11px] text-erp-muted">Status: {node.status}</p> : null}
                        {node.timestamp ? (
                          <p className="mt-0.5 text-[11px] text-erp-muted">{formatDateTime(node.timestamp)}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </ProductionPageHeader>
  )
}
