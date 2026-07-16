import { EnterpriseWorkspace, type EnterpriseWorkspaceProps } from '../../design-system/workspace'

export {
  ENTERPRISE_FORM_CLASS,
  ENTERPRISE_DETAIL_CLASS,
  ENTERPRISE_FORM_DETAIL_CLASS,
} from '../../design-system/workspace'

type SalesCardFormShellProps = Omit<EnterpriseWorkspaceProps, 'badge'> & {
  badge?: string
}

/** Sales domain wrapper over the universal Enterprise Workspace layout */
export function SalesCardFormShell({ badge = 'Sales', ...props }: SalesCardFormShellProps) {
  return <EnterpriseWorkspace badge={badge} {...props} />
}
