import { CrmDocumentLink } from './CommercialBadges'
import { AccountingStatusBadge } from './CommercialBadges'
import type { CrmSourceDocumentModel } from '@/types/commercialCommitments'
import { crmSalesOrderPath } from '@/utils/crmSalesOrderNavigation'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-erp-border/60 py-1.5 text-[12px] last:border-0">
      <dt className="text-erp-muted">{label}</dt>
      <dd className="min-w-0 text-erp-text">{children}</dd>
    </div>
  )
}

/** CRM commercial chain — links use /crm routes only. */
export function CrmSourceDocumentPanel({
  source,
  title = 'CRM Source',
}: {
  source: CrmSourceDocumentModel
  title?: string
}) {
  const accounting = source.accountingStatus ?? 'not_posted'
  return (
    <section className="rounded border border-erp-border bg-white p-3">
      <h3 className="mb-2 text-[13px] font-semibold text-erp-text">{title}</h3>
      <dl>
        {source.customerName ? (
          <Row label="Customer">
            <CrmDocumentLink
              to={source.customerId ? `/crm/customers` : null}
              label={source.customerName}
              permission="crm.company.view"
            />
          </Row>
        ) : null}
        {source.leadNo ? (
          <Row label="Lead">
            <CrmDocumentLink
              to={source.leadId ? `/crm/leads/${source.leadId}` : null}
              label={source.leadNo}
              permission="crm.lead.view"
            />
          </Row>
        ) : null}
        {source.opportunityNo || source.opportunityId ? (
          <Row label="Opportunity">
            <CrmDocumentLink
              to={source.opportunityId ? `/crm/opportunities/${source.opportunityId}` : null}
              label={[source.opportunityNo ?? source.opportunityId, source.opportunityStage]
                .filter(Boolean)
                .join(' · ')}
              permission="crm.opportunity.view"
            />
          </Row>
        ) : null}
        {source.quotationNo ? (
          <Row label="Quotation">
            <CrmDocumentLink
              to={source.quotationId ? `/crm/quotations/${source.quotationId}` : null}
              label={[
                source.quotationNo,
                source.quotationRevision != null ? `Revision ${source.quotationRevision}` : null,
                source.quotationHeaderStatus,
              ]
                .filter(Boolean)
                .join(' · ')}
              permission="crm.quotation.view"
            />
          </Row>
        ) : null}
        {source.customerApprovalStatus ? (
          <Row label="Customer Approval">{source.customerApprovalStatus}</Row>
        ) : null}
        {source.salesOrderNo ? (
          <Row label="Sales Order">
            <CrmDocumentLink
              to={source.salesOrderId ? crmSalesOrderPath(source.salesOrderId) : null}
              label={[source.salesOrderNo, source.salesOrderStatus].filter(Boolean).join(' · ')}
              permission="crm.sales_order.view"
            />
          </Row>
        ) : null}
        {source.directSalesOrderReason ? (
          <Row label="Direct SO reason">{source.directSalesOrderReason}</Row>
        ) : null}
        {source.ownerName ? <Row label="CRM owner">{source.ownerName}</Row> : null}
        <Row label="Accounting Status">
          <AccountingStatusBadge status={accounting === 'posted' ? 'posted' : accounting} />
        </Row>
      </dl>
    </section>
  )
}
