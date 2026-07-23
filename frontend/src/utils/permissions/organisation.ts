import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { hasWorkspaceAdminRole } from '@/utils/permissions/workspaceAdmin'

function sessionPerms(): string[] {
  if (isApiMode()) return getStoredSession()?.user.permissions ?? []
  return []
}

export function useOrganisationPermissions() {
  return useMemo(() => {
    const perms = sessionPerms()
    const admin = hasWorkspaceAdminRole()
    const has = (p: string) => admin || perms.includes(p)
    return {
      canView: has('organisation.view') || has('finance.legal_entity.view') || has('finance.view'),
      canCreate: has('organisation.create') || has('finance.legal_entity.manage'),
      canUpdate: has('organisation.update') || has('finance.legal_entity.manage'),
      canViewCoa: has('finance.chart_accounts.view') || has('finance.coa.view'),
      canCreateCoa: has('finance.chart_accounts.create') || has('finance.coa.manage'),
      canManageMapping: has('finance.account_mapping.manage') || has('finance.default_mapping.manage'),
      canManageFy: has('finance.fiscal_year.manage') || has('finance.financial_year.manage'),
      canManagePeriods: has('finance.posting_period.manage') || has('finance.period.manage'),
    }
  }, [])
}
