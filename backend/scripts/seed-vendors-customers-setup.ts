/**
 * Seed 10 vendors + 10 customer companies (with contacts) for ERP setup.
 * Idempotent upserts — safe to re-run.
 *
 *   cd backend && npx tsx scripts/seed-vendors-customers-setup.ts
 *   Optional: TENANT_SLUG=vasant-trailers
 *
 * Field mapping notes (schema-backed):
 * - Vendor payment terms → paymentTermsDays; tax rule → gstVendorType; currency → notes
 * - Customer billing → addressLine*; shipping → notes + addressLine2; credit terms → creditDays/creditLimit
 * - Customer tax/payment labels → notes (no dedicated taxRule/currency columns on CrmCompany)
 */
import { prisma } from '../src/config/database.js'
import { nextCode } from '../src/services/codeSeries.service.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

type VendorSeed = {
  code: string
  name: string
  gstin: string
  pan: string
  country: string
  state: string
  city: string
  pincode: string
  address: string
  address2?: string
  paymentTermsDays: number
  taxRule: string
  gstVendorType: 'registered' | 'composite' | 'unregistered' | 'import' | 'exempted' | 'sez'
  defaultCurrency: string
  contactPerson: string
  contactPhone: string
  email: string
  vendorType: 'manufacturer' | 'trader' | 'service'
  defaultLeadTimeDays: number
}

type CustomerSeed = {
  code: string
  name: string
  gstin: string
  pan: string
  country: string
  state: string
  city: string
  pincode: string
  billingAddress: string
  billingAddress2?: string
  shippingAddress: string
  paymentTerms: string
  taxRule: string
  creditDays: number
  creditLimit: number
  contactPerson: string
  contactPhone: string
  contactEmail: string
  contactDesignation: string
  industry: string
}

const VENDORS: VendorSeed[] = [
  {
    code: 'VEND-0001',
    name: 'Gujarat Steel Traders',
    gstin: '24AABCG1234A1Z5',
    pan: 'AABCG1234A',
    country: 'India',
    state: 'Gujarat',
    city: 'Ahmedabad',
    pincode: '380015',
    address: 'Plot 12, Odhav GIDC',
    address2: 'Near Ring Road',
    paymentTermsDays: 30,
    taxRule: 'GST 18% (CGST+SGST)',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Ramesh Shah',
    contactPhone: '9876501001',
    email: 'sales@gujaratsteel.example',
    vendorType: 'trader',
    defaultLeadTimeDays: 5,
  },
  {
    code: 'VEND-0002',
    name: 'Bharat Axle Components',
    gstin: '24AABCB5678B1Z2',
    pan: 'AABCB5678B',
    country: 'India',
    state: 'Gujarat',
    city: 'Rajkot',
    pincode: '360002',
    address: 'Metoda GIDC, Phase 2',
    paymentTermsDays: 45,
    taxRule: 'GST 18%',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Priya Mehta',
    contactPhone: '9876501002',
    email: 'orders@bharataxle.example',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 10,
  },
  {
    code: 'VEND-0003',
    name: 'Saurashtra Hydraulics',
    gstin: '24AABCS9012C1Z9',
    pan: 'AABCS9012C',
    country: 'India',
    state: 'Gujarat',
    city: 'Vadodara',
    pincode: '390010',
    address: 'Makarpura Industrial Estate',
    paymentTermsDays: 30,
    taxRule: 'GST 18%',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Amit Patel',
    contactPhone: '9876501003',
    email: 'info@saurashtrahyd.example',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 7,
  },
  {
    code: 'VEND-0004',
    name: 'Metro Fasteners Pvt Ltd',
    gstin: '27AABCM3456D1Z1',
    pan: 'AABCM3456D',
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    pincode: '400013',
    address: 'Andheri East, MIDC Cross Road',
    paymentTermsDays: 21,
    taxRule: 'GST 18% / IGST for interstate',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Suresh Nair',
    contactPhone: '9876501004',
    email: 'sales@metrofast.example',
    vendorType: 'trader',
    defaultLeadTimeDays: 3,
  },
  {
    code: 'VEND-0005',
    name: 'Western Coatings India',
    gstin: '27AABCW7890E1Z3',
    pan: 'AABCW7890E',
    country: 'India',
    state: 'Maharashtra',
    city: 'Pune',
    pincode: '411019',
    address: 'Chakan Industrial Area, Phase 1',
    paymentTermsDays: 30,
    taxRule: 'GST 18%',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Neha Kulkarni',
    contactPhone: '9876501005',
    email: 'support@westerncoat.example',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 4,
  },
  {
    code: 'VEND-0006',
    name: 'Deccan Tyre & Rubber Co',
    gstin: '36AABCD1122F1Z8',
    pan: 'AABCD1122F',
    country: 'India',
    state: 'Telangana',
    city: 'Hyderabad',
    pincode: '500032',
    address: 'Jeedimetla Industrial Area',
    paymentTermsDays: 45,
    taxRule: 'GST 28% (tyres) / IGST',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Kiran Reddy',
    contactPhone: '9876501006',
    email: 'purchase@deccantyre.example',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 14,
  },
  {
    code: 'VEND-0007',
    name: 'North India Electricals',
    gstin: '07AABCN3344G1Z6',
    pan: 'AABCN3344G',
    country: 'India',
    state: 'Delhi',
    city: 'New Delhi',
    pincode: '110020',
    address: 'Okhla Industrial Area, Phase III',
    paymentTermsDays: 30,
    taxRule: 'GST 18%',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Anil Kapoor',
    contactPhone: '9876501007',
    email: 'sales@nielectricals.example',
    vendorType: 'trader',
    defaultLeadTimeDays: 6,
  },
  {
    code: 'VEND-0008',
    name: 'Coastal Logistics Services',
    gstin: '33AABCL5566H1Z4',
    pan: 'AABCL5566H',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Chennai',
    pincode: '600032',
    address: 'Guindy Industrial Estate',
    paymentTermsDays: 15,
    taxRule: 'GST 18% (services)',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Lakshmi Narayan',
    contactPhone: '9876501008',
    email: 'ops@coastallogistics.example',
    vendorType: 'service',
    defaultLeadTimeDays: 2,
  },
  {
    code: 'VEND-0009',
    name: 'Rajasthan Plate & Sections',
    gstin: '08AABCR7788J1Z0',
    pan: 'AABCR7788J',
    country: 'India',
    state: 'Rajasthan',
    city: 'Jaipur',
    pincode: '302013',
    address: 'Vishwakarma Industrial Area',
    paymentTermsDays: 60,
    taxRule: 'GST 18%',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Vikram Singh',
    contactPhone: '9876501009',
    email: 'desk@rjplates.example',
    vendorType: 'trader',
    defaultLeadTimeDays: 8,
  },
  {
    code: 'VEND-0010',
    name: 'Karnataka Precision Castings',
    gstin: '29AABCK9900K1Z7',
    pan: 'AABCK9900K',
    country: 'India',
    state: 'Karnataka',
    city: 'Bengaluru',
    pincode: '560058',
    address: 'Peenya Industrial Area, 2nd Stage',
    paymentTermsDays: 30,
    taxRule: 'GST 18%',
    gstVendorType: 'registered',
    defaultCurrency: 'INR',
    contactPerson: 'Deepa Rao',
    contactPhone: '9876501010',
    email: 'quotes@kpc.example',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 12,
  },
]

const CUSTOMERS: CustomerSeed[] = [
  {
    code: 'CUST-0001',
    name: 'Adani Logistics Hub',
    gstin: '24AABCA1111A1Z1',
    pan: 'AABCA1111A',
    country: 'India',
    state: 'Gujarat',
    city: 'Ahmedabad',
    pincode: '382421',
    billingAddress: 'Adani Shantigram, SG Highway',
    billingAddress2: 'Tower B, Floor 4',
    shippingAddress: 'Mundra Port Yard Gate 3, Kutch',
    paymentTerms: 'Net 30',
    taxRule: 'GST 18%',
    creditDays: 30,
    creditLimit: 2500000,
    contactPerson: 'Mehul Desai',
    contactPhone: '9876512001',
    contactEmail: 'mehul.desai@adani-log.example',
    contactDesignation: 'Purchase Head',
    industry: 'Logistics',
  },
  {
    code: 'CUST-0002',
    name: 'Reliance Industrial Fuels',
    gstin: '24AABCR2222B1Z2',
    pan: 'AABCR2222B',
    country: 'India',
    state: 'Gujarat',
    city: 'Jamnagar',
    pincode: '361142',
    billingAddress: 'Refinery Township Admin Block',
    shippingAddress: 'Tank Farm Gate B, Jamnagar Complex',
    paymentTerms: 'Net 45',
    taxRule: 'GST 18%',
    creditDays: 45,
    creditLimit: 5000000,
    contactPerson: 'Sneha Joshi',
    contactPhone: '9876512002',
    contactEmail: 'sneha.joshi@rif.example',
    contactDesignation: 'Fleet Manager',
    industry: 'Oil & Gas',
  },
  {
    code: 'CUST-0003',
    name: 'Tata Projects Mobility',
    gstin: '27AABCT3333C1Z3',
    pan: 'AABCT3333C',
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    pincode: '400001',
    billingAddress: 'Bombay House, 24 Homi Mody Street',
    shippingAddress: 'Pune MIDC Project Yard',
    paymentTerms: 'Net 60',
    taxRule: 'GST 18% / IGST',
    creditDays: 60,
    creditLimit: 7500000,
    contactPerson: 'Rahul Banerjee',
    contactPhone: '9876512003',
    contactEmail: 'rahul.banerjee@tataprojects.example',
    contactDesignation: 'Commercial Manager',
    industry: 'Infrastructure',
  },
  {
    code: 'CUST-0004',
    name: 'Mahindra Logistics Fleet',
    gstin: '27AABCM4444D1Z4',
    pan: 'AABCM4444D',
    country: 'India',
    state: 'Maharashtra',
    city: 'Nashik',
    pincode: '422007',
    billingAddress: 'Satpur MIDC, Plot 88',
    shippingAddress: 'Nashik Depot Bay 12',
    paymentTerms: 'Net 30',
    taxRule: 'GST 18%',
    creditDays: 30,
    creditLimit: 1800000,
    contactPerson: 'Anita Kulkarni',
    contactPhone: '9876512004',
    contactEmail: 'anita.k@mahindralog.example',
    contactDesignation: 'Operations Lead',
    industry: 'Logistics',
  },
  {
    code: 'CUST-0005',
    name: 'Indian Oil Bulk Carriers',
    gstin: '07AABCI5555E1Z5',
    pan: 'AABCI5555E',
    country: 'India',
    state: 'Delhi',
    city: 'New Delhi',
    pincode: '110001',
    billingAddress: 'Scope Complex, Lodhi Road',
    shippingAddress: 'Panipat Terminal Gate',
    paymentTerms: 'Net 45',
    taxRule: 'GST 18%',
    creditDays: 45,
    creditLimit: 4000000,
    contactPerson: 'Vivek Sharma',
    contactPhone: '9876512005',
    contactEmail: 'vivek.sharma@iobc.example',
    contactDesignation: 'Transport Officer',
    industry: 'Oil & Gas',
  },
  {
    code: 'CUST-0006',
    name: 'Larsen Tanker Services',
    gstin: '33AABCL6666F1Z6',
    pan: 'AABCL6666F',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Chennai',
    pincode: '600002',
    billingAddress: 'Mount Road, Anna Salai',
    shippingAddress: 'Ennore Port Staging Yard',
    paymentTerms: 'Net 30',
    taxRule: 'GST 18%',
    creditDays: 30,
    creditLimit: 2200000,
    contactPerson: 'Priya Subramanian',
    contactPhone: '9876512006',
    contactEmail: 'priya.s@lts.example',
    contactDesignation: 'Procurement Executive',
    industry: 'Transport',
  },
  {
    code: 'CUST-0007',
    name: 'JSW Steel Dispatch Cell',
    gstin: '29AABCJ7777G1Z7',
    pan: 'AABCJ7777G',
    country: 'India',
    state: 'Karnataka',
    city: 'Ballari',
    pincode: '583104',
    billingAddress: 'JSW Township Admin',
    shippingAddress: 'Vijayanagar Works Gate 5',
    paymentTerms: 'Net 21',
    taxRule: 'GST 18%',
    creditDays: 21,
    creditLimit: 3200000,
    contactPerson: 'Arjun Hegde',
    contactPhone: '9876512007',
    contactEmail: 'arjun.hegde@jsw.example',
    contactDesignation: 'Dispatch Coordinator',
    industry: 'Steel',
  },
  {
    code: 'CUST-0008',
    name: 'Ultratech Bulk Movers',
    gstin: '08AABCU8888H1Z8',
    pan: 'AABCU8888H',
    country: 'India',
    state: 'Rajasthan',
    city: 'Kota',
    pincode: '324005',
    billingAddress: 'Industrial Area, Road No. 6',
    shippingAddress: 'Plant Silo Loading Bay',
    paymentTerms: 'Net 30',
    taxRule: 'GST 18%',
    creditDays: 30,
    creditLimit: 1500000,
    contactPerson: 'Sunita Agarwal',
    contactPhone: '9876512008',
    contactEmail: 'sunita.a@ubm.example',
    contactDesignation: 'Plant Commercial',
    industry: 'Cement',
  },
  {
    code: 'CUST-0009',
    name: 'HPCL Retail Logistics',
    gstin: '27AABCH9999J1Z9',
    pan: 'AABCH9999J',
    country: 'India',
    state: 'Maharashtra',
    city: 'Navi Mumbai',
    pincode: '400705',
    billingAddress: 'Petroleum House, Vashi',
    shippingAddress: 'Trombay Terminal',
    paymentTerms: 'Net 45',
    taxRule: 'GST 18%',
    creditDays: 45,
    creditLimit: 6000000,
    contactPerson: 'Farhan Qureshi',
    contactPhone: '9876512009',
    contactEmail: 'farhan.q@hpcl.example',
    contactDesignation: 'Vendor Manager',
    industry: 'Oil & Gas',
  },
  {
    code: 'CUST-0010',
    name: 'Ashok Leyland Spares Network',
    gstin: '33AABCA1010K1ZA',
    pan: 'AABCA1010K',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Hosur',
    pincode: '635109',
    billingAddress: 'Plant 1 Admin Block',
    shippingAddress: 'Hosur Spares Warehouse',
    paymentTerms: 'Net 30',
    taxRule: 'GST 18%',
    creditDays: 30,
    creditLimit: 2800000,
    contactPerson: 'Karthik Iyer',
    contactPhone: '9876512010',
    contactEmail: 'karthik.iyer@ashokleyland.example',
    contactDesignation: 'Dealer Development',
    industry: 'Automotive',
  },
]

function vendorNotes(v: VendorSeed): string {
  return [`currency:${v.defaultCurrency}`, `taxRule:${v.taxRule}`, `paymentTerms:Net ${v.paymentTermsDays}`].join(' | ')
}

function customerNotes(c: CustomerSeed): string {
  return [
    `paymentTerms:${c.paymentTerms}`,
    `taxRule:${c.taxRule}`,
    `currency:INR`,
    `shippingAddress:${c.shippingAddress}`,
  ].join(' | ')
}

async function main() {
  console.log(`Seeding vendors + customers on tenant slug=${TENANT_SLUG}…`)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}. Run npm run db:setup / db:seed first.`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const actorId = admin?.id ?? null
  const tid = tenant.id

  let vendorUpserts = 0
  for (const v of VENDORS) {
    await prisma.masterVendor.upsert({
      where: { tenantId_code: { tenantId: tid, code: v.code } },
      create: {
        tenantId: tid,
        code: v.code,
        name: v.name,
        searchName: v.name.slice(0, 50),
        address: v.address,
        address2: v.address2 ?? null,
        city: v.city,
        state: v.state,
        pincode: v.pincode,
        country: v.country,
        email: v.email,
        gstin: v.gstin,
        gstVendorType: v.gstVendorType,
        pan: v.pan,
        panStatus: 'pan_applied',
        paymentMethod: v.defaultCurrency,
        vendorType: v.vendorType,
        contactPerson: v.contactPerson,
        contactPhone: v.contactPhone,
        paymentTermsDays: v.paymentTermsDays,
        defaultLeadTimeDays: v.defaultLeadTimeDays,
        suppliedCategories: [],
        rating: 4.2,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
        // currency + tax labels (no dedicated columns)
        bankDetails: vendorNotes(v),
      },
      update: {
        name: v.name,
        searchName: v.name.slice(0, 50),
        address: v.address,
        address2: v.address2 ?? null,
        city: v.city,
        state: v.state,
        pincode: v.pincode,
        country: v.country,
        email: v.email,
        gstin: v.gstin,
        gstVendorType: v.gstVendorType,
        pan: v.pan,
        paymentMethod: v.defaultCurrency,
        vendorType: v.vendorType,
        contactPerson: v.contactPerson,
        contactPhone: v.contactPhone,
        paymentTermsDays: v.paymentTermsDays,
        defaultLeadTimeDays: v.defaultLeadTimeDays,
        bankDetails: vendorNotes(v),
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    vendorUpserts += 1
  }

  let companyUpserts = 0
  let contactUpserts = 0
  for (const c of CUSTOMERS) {
    const company = await prisma.crmCompany.upsert({
      where: { tenantId_companyCode: { tenantId: tid, companyCode: c.code } },
      create: {
        tenantId: tid,
        companyCode: c.code,
        name: c.name,
        customerType: 'corporate',
        industry: c.industry,
        email: c.contactEmail,
        phone: c.contactPhone,
        addressLine1: c.billingAddress,
        addressLine2: c.billingAddress2 ?? c.shippingAddress.slice(0, 500),
        city: c.city,
        state: c.state,
        pincode: c.pincode,
        country: c.country,
        gstin: c.gstin,
        pan: c.pan,
        contactPerson: c.contactPerson,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        creditDays: c.creditDays,
        creditLimit: c.creditLimit,
        status: 'active',
        isActive: true,
        notes: customerNotes(c),
        ownerId: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: c.name,
        industry: c.industry,
        email: c.contactEmail,
        phone: c.contactPhone,
        addressLine1: c.billingAddress,
        addressLine2: c.billingAddress2 ?? c.shippingAddress.slice(0, 500),
        city: c.city,
        state: c.state,
        pincode: c.pincode,
        country: c.country,
        gstin: c.gstin,
        pan: c.pan,
        contactPerson: c.contactPerson,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        creditDays: c.creditDays,
        creditLimit: c.creditLimit,
        notes: customerNotes(c),
        status: 'active',
        isActive: true,
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    companyUpserts += 1

    const existingPrimary = await prisma.crmContact.findFirst({
      where: { tenantId: tid, companyId: company.id, isPrimary: true, deletedAt: null },
    })

    const [firstName, ...rest] = c.contactPerson.trim().split(/\s+/)
    const lastName = rest.join(' ') || ''

    if (existingPrimary) {
      await prisma.crmContact.update({
        where: { id: existingPrimary.id },
        data: {
          firstName: firstName || c.contactPerson,
          lastName,
          designation: c.contactDesignation,
          email: c.contactEmail,
          mobile: c.contactPhone,
          isPrimary: true,
          isActive: true,
          status: 'active',
          deletedAt: null,
          updatedBy: actorId,
        },
      })
    } else {
      const contactCode = await nextCode(tid, 'CONTACT')
      await prisma.crmContact.create({
        data: {
          tenantId: tid,
          contactCode,
          companyId: company.id,
          firstName: firstName || c.contactPerson,
          lastName,
          designation: c.contactDesignation,
          email: c.contactEmail,
          mobile: c.contactPhone,
          isPrimary: true,
          isActive: true,
          status: 'active',
          ownerId: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      })
    }
    contactUpserts += 1
  }

  const vendorCount = await prisma.masterVendor.count({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
  })
  const companyCount = await prisma.crmCompany.count({
    where: { tenantId: tid, deletedAt: null, isActive: true },
  })
  const contactCount = await prisma.crmContact.count({
    where: { tenantId: tid, deletedAt: null, isActive: true },
  })

  console.log('=== Vendors + Customers seed complete ===')
  console.log(`Vendors upserted this run: ${vendorUpserts}`)
  console.log(`Companies upserted this run: ${companyUpserts}`)
  console.log(`Contacts upserted/created this run: ${contactUpserts}`)
  console.log(`Active vendors in tenant: ${vendorCount}`)
  console.log(`Active companies in tenant: ${companyCount}`)
  console.log(`Active contacts in tenant: ${contactCount}`)
  console.log('Hard-refresh the UI so lookups hydrate.')
  console.log('Verify: /masters/vendors, /masters/companies, PO vendor picker, quotation customer picker.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
