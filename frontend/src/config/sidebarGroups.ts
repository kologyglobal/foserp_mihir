import type { LucideIcon } from 'lucide-react'
import {
  Box,
  Database,
  Factory,
  GitBranch,
  Landmark,
  LayoutGrid,
  QrCode,
  ScanLine,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Tag,
  User,
  Warehouse,
} from 'lucide-react'

/** Icon rail menu — order and short labels matching enterprise sidebar design */
export const SIDEBAR_ICON_MENU: {
  categoryId: string
  label: string
  icon: LucideIcon
}[] = [
  { categoryId: 'executive', label: 'Home', icon: LayoutGrid },
  { categoryId: 'crm', label: 'CRM', icon: User },
  { categoryId: 'sales', label: 'Sales', icon: Tag },
  // Finance + Planning (MRP) hidden from sidebar for now — routes/pages remain reachable by URL
  { categoryId: 'accounting', label: 'Accounting', icon: Landmark },
  { categoryId: 'purchase', label: 'Purchase', icon: ShoppingCart },
  { categoryId: 'production', label: 'Mfg', icon: Factory },
  { categoryId: 'quality', label: 'Quality', icon: ShieldCheck },
  { categoryId: 'inventory', label: 'Inventory & Warehouse', icon: Warehouse },
  { categoryId: 'dispatch', label: 'Logistics', icon: Box },
  { categoryId: 'engineering', label: 'Eng', icon: GitBranch },
  { categoryId: 'masters', label: 'Masters', icon: Database },
  { categoryId: 'traceability', label: 'Trace', icon: QrCode },
  { categoryId: 'traceability-barcode', label: 'Barcode', icon: ScanLine },
  { categoryId: 'admin', label: 'Admin', icon: Settings2 },
]

/** Logical sidebar groupings — Dynamics enterprise navigation */
export const SIDEBAR_GROUPS = [
  {
    id: 'command',
    label: 'Home & Command',
    categoryIds: ['executive'],
  },
  {
    id: 'commercial',
    label: 'Companies & Sales',
    categoryIds: ['crm', 'sales', 'accounting'],
  },
  {
    id: 'operations',
    label: 'Operations',
    categoryIds: ['purchase', 'production', 'quality', 'dispatch', 'inventory'],
  },
  {
    id: 'engineering',
    label: 'Engineering & Masters',
    categoryIds: ['engineering', 'masters', 'traceability', 'traceability-barcode'],
  },
  {
    id: 'analytics',
    label: 'Reports & Analytics',
    categoryIds: ['reports'],
  },
  {
    id: 'administration',
    label: 'Administration',
    categoryIds: ['admin'],
  },
] as const

export type SidebarGroupId = (typeof SIDEBAR_GROUPS)[number]['id']
