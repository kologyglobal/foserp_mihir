import type { ReactNode } from 'react'
import {
  EnterpriseWorkspace,
  type EnterpriseAiInsight,
  type EnterpriseCompletionItem,
  type EnterpriseFinancialLine,
  type EnterpriseRelatedRecord,
  type EnterpriseTimelineEvent,
  type EnterpriseValidationItem,
  type EnterpriseWorkspaceProps,
} from '@/design-system/workspace'

type CrmCardFormShellProps = Omit<
  EnterpriseWorkspaceProps,
  'badge'
> & {
  badge?: string
  footer?: ReactNode
}

/** CRM & Sales domain wrapper over the universal Enterprise Workspace layout */
export function CrmCardFormShell({
  badge = 'CRM',
  ...props
}: CrmCardFormShellProps) {
  return <EnterpriseWorkspace badge={badge} {...props} />
}

export type {
  EnterpriseAiInsight,
  EnterpriseCompletionItem,
  EnterpriseFinancialLine,
  EnterpriseRelatedRecord,
  EnterpriseTimelineEvent,
  EnterpriseValidationItem,
}

export {
  ENTERPRISE_FORM_CLASS,
  ENTERPRISE_DETAIL_CLASS,
  ENTERPRISE_FORM_DETAIL_CLASS,
} from '@/design-system/workspace'
