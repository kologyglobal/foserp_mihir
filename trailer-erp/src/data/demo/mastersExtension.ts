import type { Customer, ItemVendorMap, Vendor, Product } from '../../types/master'
import { demoExtensionProducts } from './productsExtension'
import { demoExtensionItems } from './itemsExtension'
import { vasantPortfolioFgItems, vasantPortfolioProducts } from './vasantPortfolioSeed'
import type { MasterPersistSlice } from '../../utils/persistMigration'

const DEMO_RELEASED_BOM = 'bom-bulker-a'
const DEMO_RELEASED_ROUTING = 'rtg-bulker-a'

/** Ensure scenario anchor products have released BOM/routing for MRP → WO creation. */
function patchReleasedEngineering(products: Product[]): Product[] {
  const releaseIds = new Set(['prod-iso', 'prod-sidewall', 'prod-lowbed'])
  return products.map((p) => {
    if (!releaseIds.has(p.id)) return p
    return {
      ...p,
      manufacturing: {
        ...p.manufacturing,
        releasedBomHeaderId: DEMO_RELEASED_BOM,
        releasedRoutingHeaderId: DEMO_RELEASED_ROUTING,
      },
    }
  })
}

const now = () => new Date().toISOString()

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const map = new Map(base.map((r) => [r.id, r]))
  for (const row of extra) map.set(row.id, row)
  return [...map.values()]
}

export const demoExtensionCustomers: Customer[] = [
  { id: 'cust-ultrabuild', customerCode: 'CUST-UBL-001', customerName: 'UltraBuild Logistics', customerType: 'corporate', addressLine1: 'Logistics Park, Talegaon', city: 'Pune', state: 'Maharashtra', pincode: '410507', gstin: '27AABCU5678C1Z3', contactPerson: 'Vikram Desai', contactPhone: '+91 98230 22001', contactEmail: 'vikram@ultrabuild.in', creditDays: 30, salesTerritory: 'West', isActive: true, createdAt: now() },
  { id: 'cust-shree', customerCode: 'CUST-SCT-001', customerName: 'Shree Cement Transport', customerType: 'corporate', addressLine1: 'RIICO Industrial Area', city: 'Beawar', state: 'Rajasthan', pincode: '305901', gstin: '08AABCS9012D1Z4', contactPerson: 'Ramesh Sharma', contactPhone: '+91 94140 33001', contactEmail: 'ramesh@shreecementtransport.in', creditDays: 30, salesTerritory: 'North', isActive: true, createdAt: now() },
  { id: 'cust-patel', customerCode: 'CUST-PBC-001', customerName: 'Patel Bulk Carriers', customerType: 'dealer', addressLine1: 'NH-48, Vapi', city: 'Vapi', state: 'Gujarat', pincode: '396191', gstin: '24AABCP3456E1Z7', contactPerson: 'Hitesh Patel', contactPhone: '+91 98250 44002', contactEmail: 'hitesh@patelbulk.com', creditDays: 15, salesTerritory: 'West', isActive: true, createdAt: now() },
  { id: 'cust-metro', customerCode: 'CUST-MIL-001', customerName: 'Metro Infra Logistics', customerType: 'corporate', addressLine1: 'Sector 62', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301', gstin: '09AABCM7890F1Z2', contactPerson: 'Anil Verma', contactPhone: '+91 98100 55003', contactEmail: 'anil@metroinfra.in', creditDays: 45, salesTerritory: 'North', isActive: true, createdAt: now() },
  { id: 'cust-national', customerCode: 'CUST-NBM-001', customerName: 'National Bulk Movers', customerType: 'corporate', addressLine1: 'MIDC Bhosari', city: 'Pune', state: 'Maharashtra', pincode: '411026', gstin: '27AABCN2345G1Z8', contactPerson: 'Sunil Kadam', contactPhone: '+91 98220 66004', contactEmail: 'sunil@nationalbulk.in', creditDays: 30, salesTerritory: 'West', isActive: true, createdAt: now() },
  { id: 'cust-western', customerCode: 'CUST-WCC-001', customerName: 'Western Cement Carriers', customerType: 'dealer', addressLine1: 'Ring Road', city: 'Surat', state: 'Gujarat', pincode: '395002', gstin: '24AABCW6789H1Z1', contactPerson: 'Ketan Shah', contactPhone: '+91 98790 77005', contactEmail: 'ketan@westerncarriers.com', creditDays: 20, salesTerritory: 'West', isActive: true, createdAt: now() },
  { id: 'cust-raj', customerCode: 'CUST-RT-001', customerName: 'Raj Transport', customerType: 'dealer', addressLine1: 'Transport Nagar', city: 'Jaipur', state: 'Rajasthan', pincode: '302012', gstin: '08AABCR4567J1Z5', contactPerson: 'Rajesh Singh', contactPhone: '+91 94140 88006', contactEmail: 'raj@rajtransport.in', creditDays: 15, salesTerritory: 'North', isActive: true, createdAt: now() },
  { id: 'cust-sunrise', customerCode: 'CUST-SM-001', customerName: 'Sunrise Minerals', customerType: 'corporate', addressLine1: 'Mining Colony', city: 'Udaipur', state: 'Rajasthan', pincode: '313001', gstin: '08AABCS8901K1Z3', contactPerson: 'Deepak Meena', contactPhone: '+91 98290 99007', contactEmail: 'deepak@sunriseminerals.in', creditDays: 30, salesTerritory: 'North', isActive: true, createdAt: now() },
]

export const demoExtensionVendors: Vendor[] = [
  { id: 'vend-precision-axle', vendorCode: 'VEND-PAW', vendorName: 'Precision Axle Works', vendorType: 'manufacturer', city: 'Pune', state: 'Maharashtra', gstin: '27AABCP1111A1Z1', contactPerson: 'Suresh Jadhav', contactPhone: '+91 98220 11112', paymentTermsDays: 30, defaultLeadTimeDays: 14, suppliedCategories: ['CAT-BO-RUN'], rating: 4, isActive: true, createdAt: now() },
  { id: 'vend-hydraulic', vendorCode: 'VEND-HSI', vendorName: 'Hydraulic Systems India', vendorType: 'manufacturer', city: 'Chennai', state: 'Tamil Nadu', gstin: '33AABCH2222B1Z2', contactPerson: 'Karthik Iyer', contactPhone: '+91 98400 22223', paymentTermsDays: 30, defaultLeadTimeDays: 10, suppliedCategories: ['CAT-BO-PNEU'], rating: 4, isActive: true, createdAt: now() },
  { id: 'vend-pneumatic', vendorCode: 'VEND-PCC', vendorName: 'Pneumatic Components Co', vendorType: 'trader', city: 'Mumbai', state: 'Maharashtra', gstin: '27AABCP3333C1Z3', contactPerson: 'Manish Rao', contactPhone: '+91 98200 33334', paymentTermsDays: 21, defaultLeadTimeDays: 7, suppliedCategories: ['CAT-BO-PNEU'], rating: 4, isActive: true, createdAt: now() },
  { id: 'vend-bharat-paints', vendorCode: 'VEND-BP', vendorName: 'Bharat Paints', vendorType: 'manufacturer', city: 'Pune', state: 'Maharashtra', gstin: '27AABCB4444D1Z4', contactPerson: 'Neha Kulkarni', contactPhone: '+91 98220 44445', paymentTermsDays: 15, defaultLeadTimeDays: 5, suppliedCategories: ['CAT-RM-CONS'], rating: 5, isActive: true, createdAt: now() },
  { id: 'vend-tyres', vendorCode: 'VEND-ITC', vendorName: 'Industrial Tyres Co', vendorType: 'trader', city: 'Nashik', state: 'Maharashtra', gstin: '27AABCI5555E1Z5', contactPerson: 'Amit Deshmukh', contactPhone: '+91 98230 55556', paymentTermsDays: 21, defaultLeadTimeDays: 10, suppliedCategories: ['CAT-BO-WHEEL'], rating: 4, isActive: true, createdAt: now() },
  { id: 'vend-york-te', vendorCode: 'VEND-YTE', vendorName: 'York Transport Equipment', vendorType: 'manufacturer', city: 'Ahmedabad', state: 'Gujarat', gstin: '24AABCY6666F1Z6', contactPerson: 'Harsh Patel', contactPhone: '+91 98250 66667', paymentTermsDays: 30, defaultLeadTimeDays: 12, suppliedCategories: ['CAT-BO-RUN'], rating: 4, isActive: true, createdAt: now() },
  { id: 'vend-jost-india', vendorCode: 'VEND-JOST-IN', vendorName: 'JOST India', vendorType: 'manufacturer', city: 'Pune', state: 'Maharashtra', gstin: '27AABCI7777G1Z7', contactPerson: 'Ravi Menon', contactPhone: '+91 98220 77778', paymentTermsDays: 30, defaultLeadTimeDays: 14, suppliedCategories: ['CAT-BO-RUN'], rating: 5, isActive: true, createdAt: now() },
  { id: 'vend-wabco-india', vendorCode: 'VEND-WABCO-IN', vendorName: 'WABCO India', vendorType: 'manufacturer', city: 'Pune', state: 'Maharashtra', gstin: '27AABCW8888H1Z8', contactPerson: 'Prakash Nair', contactPhone: '+91 98220 88889', paymentTermsDays: 30, defaultLeadTimeDays: 7, suppliedCategories: ['CAT-BO-PNEU'], rating: 5, isActive: true, createdAt: now() },
  { id: 'vend-bpw-india', vendorCode: 'VEND-BPW-IN', vendorName: 'BPW India', vendorType: 'manufacturer', city: 'Chennai', state: 'Tamil Nadu', gstin: '33AABCB9999J1Z9', contactPerson: 'Senthil Kumar', contactPhone: '+91 98400 99990', paymentTermsDays: 45, defaultLeadTimeDays: 21, suppliedCategories: ['CAT-BO-RUN'], rating: 5, isActive: true, createdAt: now() },
]

export const demoExtensionItemVendorMaps: ItemVendorMap[] = [
  { id: 'ivm-demo-1', itemId: 'item-bo-compressor', vendorId: 'vend-wabco-india', isPreferred: true, leadTimeDays: 7, lastRate: 185000 },
  { id: 'ivm-demo-2', itemId: 'item-bo-abs-kit', vendorId: 'vend-wabco-india', isPreferred: true, leadTimeDays: 10, lastRate: 42000 },
  { id: 'ivm-demo-3', itemId: 'item-rm-topcoat', vendorId: 'vend-bharat-paints', isPreferred: true, leadTimeDays: 5, lastRate: 320 },
]

export function applyDemoMasterExtensions(base: MasterPersistSlice): MasterPersistSlice {
  const mergedProducts = patchReleasedEngineering(
    mergeById(mergeById(base.products, demoExtensionProducts), vasantPortfolioProducts),
  )
  return {
    ...base,
    customers: mergeById(base.customers, demoExtensionCustomers),
    vendors: mergeById(base.vendors, demoExtensionVendors),
    items: mergeById(mergeById(base.items, demoExtensionItems), vasantPortfolioFgItems),
    products: mergedProducts,
    itemVendorMaps: mergeById(base.itemVendorMaps, demoExtensionItemVendorMaps),
  }
}
