import { useNavigate } from 'react-router-dom'
import { useCrmQuickCreateStore } from '../../../store/crmQuickCreateStore'
import { NewOpportunityDrawer } from '../CrmQuickCreateDrawers'
import { QuickFollowUpDrawer } from '../QuickFollowUpDrawer'
import { QuickCompanyCreateModal } from '../QuickCompanyCreateModal'
import { QuickLeadDrawer } from './QuickLeadDrawer'
import { QuickQuotationDrawer } from './QuickQuotationDrawer'
import { QuickRfqDrawer } from './QuickRfqDrawer'

/** Mount once in AppShell — hosts all Mode 1 Quick Create surfaces. */
export function CrmQuickCreateHost() {
  const navigate = useNavigate()
  const target = useCrmQuickCreateStore((s) => s.target)
  const context = useCrmQuickCreateStore((s) => s.context)
  const closeQuickCreate = useCrmQuickCreateStore((s) => s.closeQuickCreate)

  return (
    <>
      <QuickLeadDrawer open={target === 'lead'} onClose={closeQuickCreate} />
      <QuickCompanyCreateModal
        open={target === 'customer'}
        onClose={closeQuickCreate}
        onCreated={(result) => {
          closeQuickCreate()
          if (result.id) navigate(`/entity360/customers/${result.id}`)
        }}
      />
      <NewOpportunityDrawer
        open={target === 'opportunity'}
        onClose={closeQuickCreate}
        defaultCustomerId={context.customerId}
      />
      <QuickRfqDrawer open={target === 'rfq'} onClose={closeQuickCreate} />
      <QuickQuotationDrawer open={target === 'quotation'} onClose={closeQuickCreate} />
      <QuickFollowUpDrawer open={target === 'follow_up'} onClose={closeQuickCreate} />
    </>
  )
}
