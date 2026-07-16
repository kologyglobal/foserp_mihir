import type { Inquiry, Lead, Quotation } from '../../types/sales'
import { stampCreated } from '../../utils/audit'

const audit = stampCreated()

export const seedLeads: Lead[] = [
  {
    id: 'lead-001',
    leadNo: 'LEAD-0001',
    source: 'existing_customer',
    industry: 'Cement',
    customerId: 'cust-abc',
    prospectName: 'ABC Cement Ltd',
    salesOwner: 'Rajesh Kumar',
    leadOwnerId: 'user-rajesh',
    leadOwnerName: 'Rajesh Kumar',
    expectedValue: 6500000,
    probability: 70,
    stage: 'qualified',
    remarks: 'Repeat bulker order enquiry',
    priority: 'high',
    createdDate: audit.createdAt.slice(0, 10),
    activityStatus: 'active',
    inactiveReason: null,
    lifecycleStatus: 'qualified',
    closedDate: null,
    closedReason: null,
    notQualifiedReason: null,
    opportunityId: null,
    productRequirement: '45 M3 bulker trailer repeat order',
    expectedQty: 2,
    expectedCloseDate: '2026-08-15',
    contactPerson: 'Mr. Sharma',
    contactId: null,
    mobile: '9876543210',
    email: 'sharma@abccement.com',
    nextFollowUpDate: null,
    followUpType: null,
    followUpNotes: null,
    locationId: null,
    ...audit,
  },
]

export const seedInquiries: Inquiry[] = [
  {
    id: 'inq-001',
    inquiryNo: 'INQ-0001',
    leadId: 'lead-001',
    customerId: 'cust-abc',
    productId: 'prod-45m3',
    qty: 2,
    deliveryExpectation: '2026-08-15',
    notes: '2× 45 M3 bulker for western region plant',
    attachments: [{ id: 'att-1', name: 'RFQ-Spec.pdf', uploadedAt: audit.createdAt }],
    status: 'quoting',
    ...audit,
  },
]

export const seedQuotations: Quotation[] = []
