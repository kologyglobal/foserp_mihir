import { EnterpriseWorkspace } from './EnterpriseWorkspace'
import type { EnterpriseWorkspaceProps } from './types'

type EnterpriseCardFormShellProps = EnterpriseWorkspaceProps

/** Module-agnostic wrapper over EnterpriseWorkspace — set `badge` per domain (CRM, Sales, Purchase, etc.). */
export function EnterpriseCardFormShell(props: EnterpriseCardFormShellProps) {
  return <EnterpriseWorkspace {...props} />
}
