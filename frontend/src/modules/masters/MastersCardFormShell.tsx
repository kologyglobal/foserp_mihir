import { EnterpriseWorkspace, type EnterpriseWorkspaceProps } from '../../design-system/workspace'

type MastersCardFormShellProps = Omit<EnterpriseWorkspaceProps, 'badge'> & {
  badge?: string
}

/** Master data domain wrapper — same layout as CRM lead forms. */
export function MastersCardFormShell({ badge = 'Masters', ...props }: MastersCardFormShellProps) {
  return <EnterpriseWorkspace badge={badge} {...props} />
}
