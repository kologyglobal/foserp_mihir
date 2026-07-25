import { useEffect, useState } from 'react'
import {
  createIndiaMartProductMapping,
  fetchIndiaMartProductMappings,
  suggestIndiaMartProductMappings,
  updateIndiaMartProductMapping,
  type IndiaMartProductMapping,
} from '@/services/api/indiaMartApi'
import { canCrmPermission } from '@/utils/permissions'
import { notify } from '@/store/toastStore'
import { Select } from '@/components/forms/Inputs'

export function IndiaMartProductMappingsPage() {
  const canManage = canCrmPermission('crm.indiamart.product_mapping.manage')
  const [rows, setRows] = useState<IndiaMartProductMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newItemId, setNewItemId] = useState('')
  const [filter, setFilter] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetchIndiaMartProductMappings()
      setRows(res.data ?? [])
    } catch (err) {
      notify.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate() {
    if (!newName.trim()) return
    try {
      await createIndiaMartProductMapping({
        externalProductName: newName.trim(),
        itemId: newItemId.trim() || null,
        mappingStatus: newItemId.trim() ? 'MAPPED' : 'UNMAPPED',
      })
      setNewName('')
      setNewItemId('')
      notify.success('Mapping created')
      await load()
    } catch (err) {
      notify.error((err as Error).message)
    }
  }

  async function onStatusChange(id: string, mappingStatus: string) {
    try {
      await updateIndiaMartProductMapping(id, { mappingStatus })
      await load()
    } catch (err) {
      notify.error((err as Error).message)
    }
  }

  async function onItemChange(id: string, itemId: string) {
    try {
      await updateIndiaMartProductMapping(id, {
        itemId: itemId || null,
        mappingStatus: itemId ? 'MAPPED' : 'UNMAPPED',
      })
      await load()
    } catch (err) {
      notify.error((err as Error).message)
    }
  }

  const filtered = rows.filter((r) => {
    if (!filter) return true
    if (filter === 'UNMAPPED') return r.mappingStatus === 'UNMAPPED' || r.mappingStatus === 'SUGGESTED'
    return r.mappingStatus === filter
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-erp-muted">
        Map IndiaMART product names to FOS items. Missing item mapping never blocks lead creation — this is optional enrichment.
      </p>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-erp-border bg-white p-3">
          <label className="text-sm">
            IndiaMART product name
            <input
              className="mt-1 block w-64 rounded border px-2 py-1.5"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Flour Bulker 42m3"
            />
          </label>
          <label className="text-sm">
            FOS item id (optional UUID)
            <input
              className="mt-1 block w-72 rounded border px-2 py-1.5 font-mono text-xs"
              value={newItemId}
              onChange={(e) => setNewItemId(e.target.value)}
              placeholder="Paste master item UUID"
            />
          </label>
          <button type="button" className="rounded bg-erp-primary px-3 py-1.5 text-sm text-white" onClick={() => void onCreate()}>
            Add mapping
          </button>
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={() =>
              void suggestIndiaMartProductMappings()
                .then((r) => {
                  notify.success(`Suggested ${r.data.suggested} products from enquiries`)
                  return load()
                })
                .catch((err) => notify.error((err as Error).message))
            }
          >
            Suggest from enquiries
          </button>
        </div>
      )}

      <label className="text-sm">
        Status filter
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          <option value="UNMAPPED">Unmapped / suggested</option>
          <option value="MAPPED">Mapped</option>
          <option value="IGNORED">Ignored</option>
        </Select>
      </label>

      <div className="overflow-auto rounded-lg border border-erp-border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
            <tr>
              <th className="px-3 py-2">External product</th>
              <th className="px-3 py-2">Normalized</th>
              <th className="px-3 py-2">Item ID</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-erp-muted">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-erp-muted">
                  No product mappings yet. Use “Suggest from enquiries” or add manually.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-erp-border">
                  <td className="px-3 py-2">{row.externalProductName}</td>
                  <td className="px-3 py-2 text-xs text-erp-muted">{row.normalizedProductName}</td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <input
                        className="w-56 rounded border px-2 py-1 font-mono text-xs"
                        defaultValue={row.itemId ?? ''}
                        placeholder="Item UUID (optional)"
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next !== (row.itemId ?? '')) void onItemChange(row.id, next)
                        }}
                      />
                    ) : (
                      row.itemId ?? '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <Select value={row.mappingStatus} onChange={(e) => void onStatusChange(row.id, e.target.value)}>
                        <option value="UNMAPPED">Unmapped</option>
                        <option value="SUGGESTED">Suggested</option>
                        <option value="MAPPED">Mapped</option>
                        <option value="IGNORED">Ignored</option>
                      </Select>
                    ) : (
                      row.mappingStatus
                    )}
                  </td>
                  <td className="px-3 py-2 text-[12px]">{new Date(row.updatedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
