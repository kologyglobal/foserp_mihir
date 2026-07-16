import type { CustomerContact, Transporter } from '../../types/master'

const now = () => new Date().toISOString()

export const seedTransporters: Transporter[] = [
  {
    id: 'trans-vrl',
    transporterName: 'VRL Logistics',
    contactPerson: 'Dispatch Desk',
    mobile: '+91 98220 10001',
    vehicleType: 'Trailer',
    gstin: '27AABCV1234A1Z1',
    city: 'Pune',
    isActive: true,
    createdAt: now(),
  },
  {
    id: 'trans-patel',
    transporterName: 'Patel Logistics',
    contactPerson: 'Ravi Patel',
    mobile: '+91 98250 20002',
    vehicleType: 'Flatbed',
    gstin: '24AABCP5678B1Z2',
    city: 'Vapi',
    isActive: true,
    createdAt: now(),
  },
]

export const seedCustomerContacts: CustomerContact[] = []
