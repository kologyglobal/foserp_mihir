import { useMasterStore } from '../../store/masterStore'
import { DEMO_CUSTOMER_NAMES, SATURATION_TARGETS } from './demoSeedCatalog'

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
}

/** Top up customers to 30 with trailer-logistics names; ensure 2 contacts each */
export function seedDemoCustomers(): void {
  const master = useMasterStore.getState()
  const existingNames = new Set(master.customers.map((c) => c.customerName.toLowerCase()))

  for (const name of DEMO_CUSTOMER_NAMES) {
    if (master.customers.length >= SATURATION_TARGETS.customers) break
    if (existingNames.has(name.toLowerCase())) continue
    const idx = master.customers.length + 1
    master.addCustomer({
      customerCode: `CUST-SAT-${String(idx).padStart(3, '0')}`,
      customerName: name,
      customerType: idx % 3 === 0 ? 'dealer' : 'corporate',
      addressLine1: 'Industrial Area',
      city: idx % 2 === 0 ? 'Pune' : 'Ahmedabad',
      state: idx % 2 === 0 ? 'Maharashtra' : 'Gujarat',
      pincode: String(411000 + idx),
      gstin: `27AABCS${String(1000 + idx).slice(-4)}${String.fromCharCode(65 + (idx % 26))}1Z${idx % 10}`,
      contactPerson: `${name.split(' ')[0]} Manager`,
      contactPhone: `+91 98220 ${String(10000 + idx).slice(-5)}`,
      contactEmail: `${slug(name)}@demo.vasant.in`,
      creditDays: 15 + (idx % 4) * 5,
      salesTerritory: idx % 3 === 0 ? 'North' : 'West',
      isActive: true,
    })
    existingNames.add(name.toLowerCase())
  }

  let i = master.customers.length
  while (useMasterStore.getState().customers.length < SATURATION_TARGETS.customers) {
    i++
    useMasterStore.getState().addCustomer({
      customerCode: `CUST-SAT-${String(i).padStart(3, '0')}`,
      customerName: `Bulk Logistics Partner ${i}`,
      customerType: 'corporate',
      addressLine1: 'MIDC Zone',
      city: 'Nashik',
      state: 'Maharashtra',
      pincode: '422001',
      gstin: `27AABCB${String(3000 + i).slice(-4)}A1Z${i % 10}`,
      contactPerson: `Contact ${i}`,
      contactPhone: `+91 98220 ${String(30000 + i).slice(-5)}`,
      contactEmail: `partner${i}@demo.vasant.in`,
      creditDays: 30,
      salesTerritory: 'West',
      isActive: true,
    })
  }

  const customers = useMasterStore.getState().customers
  for (const cust of customers) {
    const contacts = useMasterStore.getState().getContactsForCustomer(cust.id)
    if (contacts.length >= 2) continue
    if (contacts.length === 0) {
      useMasterStore.getState().addCustomerContact({
        customerId: cust.id,
        contactName: cust.contactPerson,
        designation: 'Purchase Manager',
        mobile: cust.contactPhone,
        email: cust.contactEmail,
        department: 'Procurement',
        isActive: true,
      })
    }
    useMasterStore.getState().addCustomerContact({
      customerId: cust.id,
      contactName: `${cust.customerName.split(' ')[0]} Operations`,
      designation: 'Operations Head',
      mobile: `+91 98765 ${String(parseInt(cust.id.slice(-4), 36) % 100000).padStart(5, '0')}`,
      email: `ops.${slug(cust.customerName)}@demo.vasant.in`,
      department: 'Operations',
      isActive: true,
    })
  }
}
