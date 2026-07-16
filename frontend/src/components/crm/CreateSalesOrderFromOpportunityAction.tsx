import { useMemo } from 'react'

import { useLocation, useNavigate } from 'react-router-dom'

import { ShoppingCart, ExternalLink } from 'lucide-react'

import { useCrmStore } from '../../store/crmStore'

import { ErpButton } from '../erp/ErpButton'

import {

  buildSalesOrderNewUrl,

  resolveOpportunityCreateSalesOrderGate,

  resolveOpportunitySalesOrderPrefill,

} from '../../utils/opportunitySalesOrderDraft'

import { isCrmPath, resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'



interface CreateSalesOrderFromOpportunityActionProps {

  opportunityId: string

  quotationDocumentId?: string | null

  className?: string

  size?: 'sm' | 'md'

  showHint?: boolean

}



/** Navigate to new SO form with opportunity data — or view existing linked SO. */

export function CreateSalesOrderFromOpportunityAction({

  opportunityId,

  quotationDocumentId,

  className,

  size = 'md',

  showHint = false,

}: CreateSalesOrderFromOpportunityActionProps) {

  const navigate = useNavigate()

  const { pathname } = useLocation()

  const fromCrm = isCrmPath(pathname)

  const opportunity = useCrmStore((s) => s.opportunities.find((o) => o.id === opportunityId))



  const prefill = useMemo(

    () => resolveOpportunitySalesOrderPrefill(opportunityId, quotationDocumentId),

    [opportunityId, quotationDocumentId],

  )

  const gate = useMemo(

    () => resolveOpportunityCreateSalesOrderGate(opportunityId, quotationDocumentId),

    [opportunityId, quotationDocumentId],

  )



  if (!opportunity || !prefill) return null



  if (prefill.salesOrderId) {

    return (

      <ErpButton

        variant="primary"

        size={size}

        icon={ExternalLink}

        className={className}

        onClick={() => navigate(resolveSalesOrderDetailPath(prefill.salesOrderId!, fromCrm))}

      >

        View Sales Order

      </ErpButton>

    )

  }



  return (

    <>

      {showHint ? (

        <p className={cnHint(gate.enabled)}>

          {gate.enabled

            ? 'Approved quotation ready — review details on the sales order form.'

            : (gate.disabledReason ?? 'Available after quotation approval.')}

        </p>

      ) : null}

      <ErpButton

        variant="primary"

        size={size}

        icon={ShoppingCart}

        className={className}

        disabled={!gate.enabled}

        disabledReason={gate.disabledReason ?? undefined}

        onClick={() => {

          if (!gate.enabled) return

          navigate(

            buildSalesOrderNewUrl(opportunityId, quotationDocumentId ?? prefill.quotationDocumentId, {

              fromCrm,

            }),

          )

        }}

      >

        Create Sales Order

      </ErpButton>

    </>

  )

}



function cnHint(enabled: boolean): string {

  return enabled

    ? 'mb-2 text-[12px] text-emerald-700'

    : 'mb-2 text-[12px] text-erp-muted'

}

