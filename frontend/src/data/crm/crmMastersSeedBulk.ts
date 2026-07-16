import type { CrmMasterEntry, CrmMasterKind } from '../../types/crmMasters'

const NOW = '2026-01-15T10:00:00.000Z'

function entry(
  kind: CrmMasterKind,
  code: string,
  name: string,
  sortOrder: number,
  attributes: Record<string, string | number | boolean | null> = {},
  extra?: Partial<Pick<CrmMasterEntry, 'description' | 'systemControlled' | 'status' | 'id' | 'notes'>>,
): CrmMasterEntry {
  return {
    id: extra?.id ?? `${kind}-bulk-${code}`,
    kind,
    code,
    name,
    status: extra?.status ?? 'active',
    sortOrder,
    description: extra?.description,
    notes: extra?.notes,
    attributes,
    systemControlled: extra?.systemControlled,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'Demo User',
    modifiedBy: 'Demo User',
    auditHistory: [{ action: 'created', at: NOW, by: 'Demo User', detail: 'Bulk seed' }],
  }
}

const EXTRA_INDUSTRIES = [
  ['steel', 'Steel & Metals'], ['automotive_oem', 'Automotive OEM'], ['fertilizer', 'Fertilizer & Agrochemicals'],
  ['power', 'Power & Energy'], ['ports', 'Ports & Maritime'], ['railways', 'Railways & Metro'],
  ['defence', 'Defence & Aerospace'], ['food_beverage', 'Food & Beverage'], ['pharma', 'Pharmaceuticals'],
  ['paper', 'Paper & Pulp'], ['textiles', 'Textiles'], ['plastic', 'Plastics & Polymers'],
  ['waste_mgmt', 'Waste Management'], ['renewable', 'Renewable Energy'],
].map(([code, name], i) => entry('industries', code, name, 20 + i, { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' }))

const EXTRA_TERRITORIES = [
  ['karnataka', 'Karnataka', 'South', 'Karnataka'], ['tamil_nadu', 'Tamil Nadu', 'South', 'Tamil Nadu'],
  ['kerala', 'Kerala', 'South', 'Kerala'], ['andhra', 'Andhra Pradesh', 'South', 'Andhra Pradesh'],
  ['telangana', 'Telangana', 'South', 'Telangana'], ['mp', 'Madhya Pradesh', 'Central', 'Madhya Pradesh'],
  ['up', 'Uttar Pradesh', 'North', 'Uttar Pradesh'], ['punjab', 'Punjab', 'North', 'Punjab'],
  ['haryana', 'Haryana', 'North', 'Haryana'], ['bihar', 'Bihar', 'East', 'Bihar'], ['odisha', 'Odisha', 'East', 'Odisha'],
].map(([code, name, region, state], i) => entry('territories', code, name, 20 + i, { region, state, country: 'India', manager: 'Regional Sales Manager' }))

const LEAD_SOURCE_TYPES = ['Digital', 'Outbound', 'Event', 'Channel', 'Account', 'Marketing', 'Referral']
const EXTRA_LEAD_SOURCES = [
  'LinkedIn Campaign', 'Google Ads', 'Exhibition — Bauma CONEXPO', 'Dealer Network — West',
  'OEM Referral Program', 'Government Tender Portal', 'Field Sales Visit', 'Customer Referral — Cement',
  'IndiaMART Premium Lead', 'JustDial Enquiry', 'Website Chatbot', 'Email Newsletter',
  'YouTube Product Video', 'Technical Webinar', 'Plant Visit Request', 'Service Contract Renewal',
  'Aftermarket Spares Enquiry', 'Fleet Replacement Program', 'Export Agent — Middle East',
  'Export Agent — Africa', 'Channel Partner — South', 'Distributor Lead — Maharashtra',
  'Cold Email Campaign', 'WhatsApp Business', 'SMS Campaign', 'Industry Association',
  'Cement Manufacturers Association', 'Logistics Summit 2025', 'Mining Expo Hyderabad',
  'Construction World Magazine', 'Fleet Owner Meet', 'Dealer Open House', 'Product Launch Event',
  'Technical Seminar — ISO Tank', 'Bulker Trailer Demo Day', 'RTO Consultant Referral',
  'Banking Partner Referral', 'Insurance Broker Referral', 'Fleet Management Software Integration',
].map((name, i) => entry('lead-sources', `src_${i + 20}`, name, 20 + i, {
  sourceType: LEAD_SOURCE_TYPES[i % LEAD_SOURCE_TYPES.length],
  priority: i % 3 === 0 ? 'High' : 'Medium',
  cost: (i + 1) * 2500,
}))

const LOST_REASONS_EXTRA = [
  ['spec_mismatch', 'Specification Mismatch', 'Technical'], ['warranty_terms', 'Warranty Terms Unacceptable', 'Commercial'],
  ['after_sales', 'After-Sales Concern', 'Service'], ['incumbent_vendor', 'Incumbent Vendor Retained', 'Competitive'],
  ['tender_cancelled', 'Tender Cancelled', 'Engagement'], ['project_delayed', 'Project Delayed', 'Commercial'],
  ['management_change', 'Management Change', 'Relationship'], ['credit_limit', 'Credit Limit Issue', 'Commercial'],
  ['gst_compliance', 'GST / Compliance Issue', 'Commercial'], ['freight_cost', 'Freight Cost Too High', 'Operations'],
  ['lead_time', 'Lead Time Too Long', 'Operations'], ['quality_concern', 'Quality Concern Raised', 'Technical'],
  ['reference_failed', 'Reference Check Failed', 'Relationship'], ['demo_unsatisfactory', 'Demo Unsatisfactory', 'Technical'],
  ['financing_issue', 'Customer Financing Issue', 'Commercial'], ['scope_reduction', 'Scope Reduction', 'Technical'],
  ['vendor_consolidation', 'Vendor Consolidation', 'Competitive'], ['price_match_failed', 'Could Not Match Price', 'Commercial'],
  ['regulatory_block', 'Regulatory Block', 'Commercial'], ['internal_priority_shift', 'Internal Priority Shift', 'Engagement'],
  ['competitor_bundle', 'Competitor Bundle Offer', 'Competitive'],
].map(([code, name, category], i) => entry('lost-reasons', code, name, 20 + i, {
  category,
  closePipeline: true,
}))

const ACTIVITY_EXTRA = [
  'Plant Audit', 'Technical Presentation', 'Price Negotiation', 'Management Meeting',
  'Factory Tour', 'Sample Review', 'Drawing Approval', 'Specification Workshop',
  'Tender Clarification', 'Pre-bid Meeting', 'Post-award Kickoff', 'Installation Planning',
  'Commissioning Visit', 'Warranty Claim Review', 'Annual Review Meeting', 'Competitor Analysis',
  'Credit Assessment', 'Legal Review', 'Contract Signing', 'Dispatch Coordination',
  'Payment Follow-up', 'Service Complaint', 'Spare Parts Discussion', 'Fleet Survey',
  'Route Planning Session',
].map((name, i) => entry('activity-types', `act_${i + 20}`, name, 20 + i, {
  icon: 'activity',
  color: '#605E5C',
  systemGenerated: false,
  useInActivity: true,
  useInFollowUp: true,
  editable: true,
}))

const PAYMENT_EXTRA = [
  ['adv_20', '20% Advance, Balance Before Dispatch', 20, 0], ['adv_40', '40% Advance, 60% Before Dispatch', 40, 0],
  ['credit_45', 'Credit 45 Days', 0, 45], ['credit_60', 'Credit 60 Days', 0, 60], ['credit_90', 'Credit 90 Days', 0, 90],
  ['lc_sight', 'LC at Sight', 0, 0], ['lc_30', 'LC 30 Days', 0, 30], ['lc_60', 'LC 60 Days', 0, 60],
  ['against_delivery', 'Payment Against Delivery', 0, 0], ['against_proforma', 'Against Proforma Invoice', 30, 0],
  ['milestone_3', '3 Milestone Payment', 33, 0], ['milestone_4', '4 Milestone Payment', 25, 0],
  ['retention_10', '10% Retention for 12 Months', 90, 0], ['pdc_30', 'PDC 30 Days', 0, 30],
  ['pdc_60', 'PDC 60 Days', 0, 60],
].map(([code, name, adv, days], i) => entry('payment-terms', code as string, name as string, 10 + i, {
  advancePct: adv as number,
  creditDays: days as number,
  approvalRequired: (days as number) > 30,
}))

const DELIVERY_EXTRA = [
  ['fob_mumbai', 'FOB Mumbai Port', '3-4 weeks'], ['cif_dubai', 'CIF Dubai', '8-10 weeks'],
  ['exw_factory', 'EXW Factory', '4 weeks'], ['dap_site', 'DAP Customer Site', '8-12 weeks'],
  ['ddp_site', 'DDP Customer Site', '10-14 weeks'], ['cpt_destination', 'CPT Destination', '6-8 weeks'],
  ['fca_plant', 'FCA Plant', '4-5 weeks'], ['for_plant', 'FOR Plant', '5-6 weeks'],
  ['partial_dispatch', 'Partial Dispatch Allowed', 'As per schedule'], ['phased_delivery', 'Phased Delivery', 'Per milestone'],
].map(([code, name, time], i) => entry('delivery-terms', code as string, name as string, 10 + i, {
  defaultDeliveryTime: time as string,
  approvalRequired: String(code).includes('ddp'),
}))

const WARRANTY_EXTRA = [
  ['std_24m', '24 months manufacturing defect', '24 months'], ['std_6m_hydraulic', '6 months on hydraulics', '6 months'],
  ['std_36m_structure', '36 months on main structure', '36 months'], ['roadside_12m', '12 months roadside assistance', '12 months'],
  ['paint_12m', '12 months on paint and corrosion', '12 months'], ['axle_oem', 'Axle warranty per OEM', 'As per OEM'],
  ['tyre_excluded', 'Tyres excluded from warranty', '12 months other parts'], ['labour_included', 'Labour included 12 months', '12 months'],
  ['extended_24m', 'Extended warranty 24 months (paid)', '24 months'], ['commissioning_3m', '3 months post-commissioning', '3 months'],
  ['wear_parts_excluded', 'Wear parts excluded', '12 months'], ['corrosion_18m', '18 months anti-corrosion', '18 months'],
].map(([code, name, dur], i) => entry('warranty-terms', code as string, name as string, 10 + i, {
  warrantyDuration: dur as string,
  coverage: name as string,
  approvalRequired: String(code).includes('extended'),
}))

const APPROVAL_EXTRA = [
  ['quo_value_1cr', 'Quotation above ₹1 Cr', 'Quotation', 'grandTotal', '> 10000000', 'CEO'],
  ['quo_value_25l', 'Quotation above ₹25L', 'Quotation', 'grandTotal', '> 2500000', 'Sales Manager'],
  ['discount_15', 'Discount above 15%', 'Quotation', 'discountPct', '> 15', 'Sales Manager'],
  ['discount_20', 'Discount above 20%', 'Quotation', 'discountPct', '> 20', 'CEO'],
  ['credit_60', 'Credit terms 60+ days', 'Quotation', 'paymentTerms', 'credit >= 60', 'Finance Head'],
  ['custom_warranty', 'Non-standard warranty', 'Quotation', 'warrantyTerms', 'non-standard', 'Service Head'],
  ['export_deal', 'Export deal approval', 'Quotation', 'territory', 'export', 'Export Head'],
  ['so_value_50l', 'Sales Order above ₹50L', 'Sales Order', 'grandTotal', '> 5000000', 'Sales Manager'],
  ['so_value_2cr', 'Sales Order above ₹2 Cr', 'Sales Order', 'grandTotal', '> 20000000', 'CEO'],
  ['margin_below_12', 'Margin below 12%', 'Quotation', 'marginPct', '< 12', 'CEO'],
  ['margin_below_8', 'Margin below 8%', 'Quotation', 'marginPct', '< 8', 'Board'],
  ['deviation_delivery', 'Delivery deviation', 'Quotation', 'deliveryTerms', 'deviation', 'Operations Head'],
  ['deviation_payment', 'Payment deviation', 'Quotation', 'paymentTerms', 'deviation', 'Finance Head'],
  ['technical_exception', 'Technical exception approval', 'Quotation', 'technicalNotes', 'exception', 'Engineering Head'],
  ['competitor_match', 'Competitor price match', 'Quotation', 'discountPct', 'match request', 'Sales Manager'],
  ['repeat_customer_discount', 'Repeat customer extra discount', 'Quotation', 'discountPct', 'repeat > 5%', 'Sales Manager'],
].map(([code, name, mod, field, cond, role], i) => entry('approval-rules', code as string, name as string, 10 + i, {
  module: mod as string,
  triggerField: field as string,
  condition: cond as string,
  approvalRole: role as string,
  autoApprove: false,
  escalation: '24 hours',
}))

export const CRM_MASTERS_BULK_SEED: CrmMasterEntry[] = [
  ...EXTRA_INDUSTRIES,
  ...EXTRA_TERRITORIES,
  ...EXTRA_LEAD_SOURCES,
  ...LOST_REASONS_EXTRA,
  ...ACTIVITY_EXTRA,
  ...PAYMENT_EXTRA,
  ...DELIVERY_EXTRA,
  ...WARRANTY_EXTRA,
  ...APPROVAL_EXTRA,
]
