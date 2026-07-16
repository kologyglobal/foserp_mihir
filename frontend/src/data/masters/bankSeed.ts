import type { Bank } from '../../types/bankMaster'

const now = () => new Date().toISOString()

export const seedBanks: Bank[] = [
  { id: 'bank-hdfc', code: 'HDFC', name: 'HDFC Bank Ltd.', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'bank-icici', code: 'ICICI', name: 'ICICI Bank Ltd.', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'bank-sbi', code: 'SBI', name: 'State Bank of India', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'bank-axis', code: 'AXIS', name: 'Axis Bank Ltd.', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'bank-kotak', code: 'KOTAK', name: 'Kotak Mahindra Bank Ltd.', isActive: true, createdAt: now(), updatedAt: now() },
]
