import { useMasterStore } from '../../store/masterStore'
import { DEMO_VENDOR_NAMES, SATURATION_TARGETS } from './demoSeedCatalog'

/** Top up vendors to 30 with trailer supply-chain names */
export function seedDemoVendors(): void {
  const existing = new Set(useMasterStore.getState().vendors.map((v) => v.vendorName.toLowerCase()))

  for (const name of DEMO_VENDOR_NAMES) {
    if (useMasterStore.getState().vendors.length >= SATURATION_TARGETS.vendors) break
    if (existing.has(name.toLowerCase())) continue
    const idx = useMasterStore.getState().vendors.length + 1
    useMasterStore.getState().addVendor({
      vendorCode: `VEND-SAT-${String(idx).padStart(3, '0')}`,
      vendorName: name,
      vendorType: idx % 4 === 0 ? 'trader' : 'manufacturer',
      city: idx % 2 === 0 ? 'Pune' : 'Chennai',
      state: idx % 2 === 0 ? 'Maharashtra' : 'Tamil Nadu',
      gstin: `27AABCV${String(4000 + idx).slice(-4)}B1Z${idx % 10}`,
      contactPerson: `${name.split(' ')[0]} Rep`,
      contactPhone: `+91 98230 ${String(40000 + idx).slice(-5)}`,
      paymentTermsDays: 21 + (idx % 3) * 7,
      defaultLeadTimeDays: 7 + (idx % 5) * 3,
      suppliedCategories: ['CAT-BO-RUN', 'CAT-RM-CONS'].slice(0, 1 + (idx % 2)),
      rating: 3 + (idx % 3),
      isActive: true,
    })
    existing.add(name.toLowerCase())
  }

  let i = useMasterStore.getState().vendors.length
  while (useMasterStore.getState().vendors.length < SATURATION_TARGETS.vendors) {
    i++
    useMasterStore.getState().addVendor({
      vendorCode: `VEND-SAT-${String(i).padStart(3, '0')}`,
      vendorName: `Industrial Supplier ${i}`,
      vendorType: 'trader',
      city: 'Pune',
      state: 'Maharashtra',
      gstin: `27AABCV${String(5000 + i).slice(-4)}C1Z${i % 10}`,
      contactPerson: `Vendor Contact ${i}`,
      contactPhone: `+91 98240 ${String(50000 + i).slice(-5)}`,
      paymentTermsDays: 30,
      defaultLeadTimeDays: 14,
      suppliedCategories: ['CAT-BO-RUN'],
      rating: 4,
      isActive: true,
    })
  }
}
