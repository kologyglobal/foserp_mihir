import type { NavigateFunction } from 'react-router-dom'
import { Copy, Eye, History, Pencil, Trash2, CircleOff, CircleCheck } from 'lucide-react'
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
  activateEntry?: (id: string) => MasterMutationResult | Promise<MasterMutationResult>
  deleteEntry: (id: string) => MasterMutationResult | Promise<MasterMutationResult>
  /** When set, Edit opens drawer/custom UI instead of navigating to the form page. */
  onEdit?: (entry: CrmMasterEntry) => void
  onFeedback: (message: string, variant?: 'success' | 'error') => void
}

/** Standard CRM master list row ⋯ menu — no extras, no duplicates. */
export function buildCrmMasterRowActions(
  entry: CrmMasterEntry,
  handlers: MasterRowActionHandlers,
): RowActionItem[] {
  const {
    basePath,
    navigate,
    duplicateEntry,
    deactivateEntry,
    activateEntry,
    deleteEntry,
    onEdit,
    onFeedback,
  } = handlers
  const deleteCheck = canDeleteMasterEntry(entry)
  const detailPath = `${basePath}/${entry.id}`
  const editPath = `${detailPath}/edit`

  return [
    { id: 'view', label: 'View', icon: Eye, to: detailPath },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      to: entry.systemControlled || onEdit ? undefined : editPath,
      disabled: entry.systemControlled,
      onClick: entry.systemControlled
        ? undefined
        : onEdit
          ? () => onEdit(entry)
          : undefined,
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
      to: `${detailPath}#crm-master-audit`,
    },
    {
      id: 'activate',
      label: 'Activate',
      icon: CircleCheck,
      disabled: entry.status !== 'inactive' || !activateEntry,
      onClick: () => {
        if (!activateEntry) return
        void (async () => {
          const result = await Promise.resolve(activateEntry(entry.id))
          onFeedback(result.ok ? 'Activated' : (result.error ?? 'Activate failed'), result.ok ? 'success' : 'error')
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
  ]
}
