import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { useTreasuryStatementPermissions } from '@/utils/permissions/treasuryStatement'
import {
  activateTemplate,
  deactivateTemplate,
  fetchAllMappingTemplates,
} from '../api/bank-statement-import.api'
import type { MappingTemplateDto } from '../api/bank-statement.types'
import { BankStatementWorkspaceShell } from '../components/BankStatementWorkspaceShell'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'

export function BankStatementMappingTemplatesPage() {
  const perms = useTreasuryStatementPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const [rows, setRows] = useState<MappingTemplateDto[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAllMappingTemplates(legalEntityId)
      setRows(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load mapping templates')
    } finally {
      setLoading(false)
    }
  }, [legalEntityId])

  useEffect(() => {
    if (perms.canViewMapping) void load()
  }, [load, perms.canViewMapping])

  const toggleActive = async (row: MappingTemplateDto) => {
    if (!perms.canManageMapping) return
    try {
      if (row.isActive) {
        await deactivateTemplate(row.id, row.updatedAt)
      } else {
        await activateTemplate(row.id, row.updatedAt)
      }
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  if (!perms.canViewMapping) {
    return (
      <BankStatementWorkspaceShell title="Mapping Templates">
        <p className="text-[13px] text-erp-muted">You do not have permission to view mapping templates.</p>
      </BankStatementWorkspaceShell>
    )
  }

  return (
    <BankStatementWorkspaceShell title="Mapping Templates">
      <PageBackLink to="/accounting/bank-cash/statements" label="Back to statements" className="mb-3" />

      {loading ? <LoadingState variant="table" rows={6} /> : null}

      {!loading && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center text-[13px] text-erp-muted">
          No mapping templates configured. Templates can be assigned during import or managed via API.
        </p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-auto rounded-lg border border-erp-border bg-white">
          <table className="w-full min-w-[40rem] text-[12px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                <th className="px-2 py-1.5">Name</th>
                <th className="px-2 py-1.5">Format</th>
                <th className="px-2 py-1.5">Default</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Updated</th>
                {perms.canManageMapping ? <th className="px-2 py-1.5" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border">
                  <td className="px-2 py-1.5 font-semibold">{row.name}</td>
                  <td className="px-2 py-1.5">{row.importFormat}</td>
                  <td className="px-2 py-1.5">{row.isDefault ? 'Yes' : '—'}</td>
                  <td className="px-2 py-1.5">
                    <ErpStatusChip tone={row.isActive ? 'success' : 'neutral'} label={row.isActive ? 'Active' : 'Inactive'} />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatDateTime(row.updatedAt)}</td>
                  {perms.canManageMapping ? (
                    <td className="px-2 py-1.5">
                      <ErpButton variant="secondary" onClick={() => void toggleActive(row)}>
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </ErpButton>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BankStatementWorkspaceShell>
  )
}
