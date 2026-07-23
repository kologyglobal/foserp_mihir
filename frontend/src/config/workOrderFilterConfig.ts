import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import type { WorkOrderHealth, WorkOrderStatus } from '../types/manufacturingProduction'

/** Register view shortcut — maps to list status / health query params. Empty = all. */
export type WorkOrderRegisterView =
  | ''
  | 'DRAFT'
  | 'READY'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'DELAYED'
  | 'COMPLETED'

export interface WorkOrderListFilters {
  search: string
  view: WorkOrderRegisterView
  productItemId: string
}

export const DEFAULT_WORK_ORDER_LIST_FILTERS: WorkOrderListFilters = {
  search: '',
  view: '',
  productItemId: '',
}

export const WORK_ORDER_VIEW_OPTIONS: { value: WorkOrderRegisterView; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'READY', label: 'Ready' },
  { value: 'IN_PROGRESS', label: 'Running' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'COMPLETED', label: 'Completed' },
]

export function buildWorkOrderFilterFields(input: {
  productOptions: { id: string; label: string }[]
}): CrmFilterField[] {
  return [
    {
      type: 'select',
      key: 'view',
      label: 'Status / health',
      options: WORK_ORDER_VIEW_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      type: 'search-select',
      key: 'productItemId',
      label: 'Item',
      options: input.productOptions.map((p) => ({ value: p.id, label: p.label })),
      placeholder: 'Search item…',
    },
  ]
}

export function workOrderFiltersToCrmValues(f: WorkOrderListFilters): CrmFilterValues {
  return {
    search: f.search,
    view: f.view,
    productItemId: f.productItemId,
  }
}

export function crmValuesToWorkOrderFilters(v: CrmFilterValues): WorkOrderListFilters {
  const viewRaw = typeof v.view === 'string' ? v.view : ''
  const view = WORK_ORDER_VIEW_OPTIONS.some((o) => o.value === viewRaw)
    ? (viewRaw as WorkOrderRegisterView)
    : ''
  return {
    search: typeof v.search === 'string' ? v.search : '',
    view,
    productItemId: typeof v.productItemId === 'string' ? v.productItemId : '',
  }
}

export function serializeWorkOrderFilters(f: WorkOrderListFilters): Record<string, string> {
  return {
    search: f.search,
    view: f.view,
    productItemId: f.productItemId,
  }
}

export function workOrderFilterChipLabelResolver(
  key: string,
  value: string,
  productLabel?: (id: string) => string,
): string | undefined {
  if (key === 'view') {
    if (!value) return undefined
    return WORK_ORDER_VIEW_OPTIONS.find((o) => o.value === value)?.label ?? value
  }
  if (key === 'productItemId' && value) {
    return productLabel?.(value) ?? value
  }
  return undefined
}

export function listParamsFromWorkOrderFilters(f: WorkOrderListFilters): {
  search?: string
  status?: WorkOrderStatus
  healthStatus?: WorkOrderHealth
  productItemId?: string
} {
  const listStatus: WorkOrderStatus | undefined =
    !f.view || f.view === 'DELAYED'
      ? undefined
      : f.view === 'COMPLETED'
        ? 'COMPLETED'
        : f.view
  const listHealth: WorkOrderHealth | undefined = f.view === 'DELAYED' ? 'DELAYED' : undefined
  return {
    search: f.search || undefined,
    status: listStatus,
    healthStatus: listHealth,
    productItemId: f.productItemId || undefined,
  }
}
