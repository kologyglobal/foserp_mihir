import type { NavigateFunction } from 'react-router-dom'
import { Copy, Eye, History, Pencil, Trash2, CircleOff } from 'lucide-react'
import type { RowActionItem } from '../../../design-system/enterprise/EnterpriseTablePrimitives'
import type { CrmMasterEntry } from '../../../types/crmMasters'
import { canDeleteMasterEntry } from '../../../utils/crmMasterUtils'
import type { StoreActionResult } from '../../../store/storeAction'

type MasterMutationResult = StoreActionResult & { id?: string }

type MasterRowActionHandlers = {
  basePath: string
  navigate: NavigateFunction
  duplicateEntry: (id: string) => MasterMutationResult
  deactivateEntry: (id: string) => MasterMutationResult | Promise<MasterMutationResult>
  deleteEntry: (id: string) => MasterMutationResult | Promise<MasterMutationResult>
  onFeedback: (message: string, variant?: 'success' | 'error') => void
}

/** Standard CRM master list row ⋯ menu — no extras, no duplicates. */
export function buildCrmMasterRowActions(
  entry: CrmMasterEntry,
  handlers: MasterRowActionHandlers,
): RowActionItem[] {
  const { basePath, navigate, duplicateEntry, deactivateEntry, deleteEntry, onFeedback } = handlers
  const deleteCheck = canDeleteMasterEntry(entry)
  const detailPath = `${basePath}/${entry.id}`
  const editPath = `${detailPath}/edit`

  return [
    { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(detailPath) },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => navigate(editPath),
      disabled: entry.systemControlled,
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => {
        const result = duplicateEntry(entry.id)
        if (result.ok && result.id) navigate(`${basePath}/${result.id}/edit`)
        else onFeedback(result.error ?? 'Duplicate failed', 'error')
      },
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      onClick: () => navigate(`${detailPath}#crm-master-audit`),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      danger: true,
      disabled: !deleteCheck.ok,
      onClick: () => {
        void (async () => {
          const result = await Promise.resolve(deleteEntry(entry.id))
          if (result.ok) onFeedback('Record deleted', 'success')
          else onFeedback(result.error ?? 'Delete blocked', 'error')
        })()
      },
    },
    {
      id: 'deactivate',
      label: 'Deactivate',
      icon: CircleOff,
      disabled: entry.status !== 'active' || entry.systemControlled,
      onClick: () => {
        void (async () => {
          const result = await Promise.resolve(deactivateEntry(entry.id))
          onFeedback(result.ok ? 'Deactivated' : (result.error ?? 'Deactivate failed'), result.ok ? 'success' : 'error')
        })()
      },
    },
  ]
}
