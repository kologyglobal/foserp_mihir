import type { Product } from '@/types/erp'

export const products: Product[] = [
  {
    code: '45M3-BULKER',
    name: '45 M3 Bulker Trailer',
    category: 'Bulk Cement Transport',
    capacity: '45 m³',
    axleConfig: '3-Axle Air Suspension',
    basePrice: 2850000,
    leadTimeDays: 45,
  },
  {
    code: 'ISO-TANK',
    name: 'ISO Tank',
    category: 'Liquid Bulk Transport',
    capacity: '24,000 L',
    axleConfig: '2-Axle BPW',
    basePrice: 4200000,
    leadTimeDays: 60,
  },
  {
    code: 'CEMENT-BULKER',
    name: 'Cement Bulker',
    category: 'Pneumatic Discharge',
    capacity: '35 m³',
    axleConfig: '2-Axle Rigid',
    basePrice: 2450000,
    leadTimeDays: 40,
  },
  {
    code: 'SIDE-WALL',
    name: 'Side Wall Trailer',
    category: 'General Cargo',
    capacity: '32 MT Payload',
    axleConfig: '3-Axle Semi',
    basePrice: 1950000,
    leadTimeDays: 35,
  },
]

export const productMap = Object.fromEntries(
  products.map((p) => [p.code, p]),
) as Record<string, Product>
