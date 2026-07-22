import { isApiMode } from '@/config/apiConfig'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'
import { AdjustmentDemoNotice } from '../components/AdjustmentDemoNotice'
import { ApiBankPostingRuleListPage } from './ApiBankPostingRuleListPage'

/** Route entry — API posting-rule list when VITE_USE_API=true. */
export function BankPostingRuleListPage() {
  if (!isApiMode()) {
    return (
      <AdjustmentWorkspaceShell title="Posting Rules">
        <AdjustmentDemoNotice />
      </AdjustmentWorkspaceShell>
    )
  }
  return <ApiBankPostingRuleListPage />
}
