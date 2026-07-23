import type { LucideIcon } from 'lucide-react'
import {
  Box,
  Database,
  Factory,
  // GitBranch, // Eng — restore with sidebar entry below
  HardHat,
  Landmark,
  LayoutGrid,
  Settings2,
  Shield,
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
  { categoryId: 'accounting', label: 'Accounting', icon: Landmark },
  { categoryId: 'purchase', label: 'Procurement', icon: ShoppingCart },
  { categoryId: 'production', label: 'Manufacturing', icon: Factory },
  { categoryId: 'quality', label: 'Quality', icon: ShieldCheck },
  { categoryId: 'inventory', label: 'Inventory & Warehouse', icon: Warehouse },
  { categoryId: 'dispatch', label: 'Logistics', icon: Box },
  { categoryId: 'gate', label: 'Gate & Security', icon: HardHat },
  // { categoryId: 'engineering', label: 'Eng', icon: GitBranch },
  { categoryId: 'masters', label: 'Masters', icon: Database },
  { categoryId: 'admin', label: 'Admin', icon: Settings2 },
  { categoryId: 'platform', label: 'Platform', icon: Shield },
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
    categoryIds: ['purchase', 'production', 'quality', 'dispatch', 'gate', 'inventory'],
  },
  {
    id: 'engineering',
    label: 'Masters',
    categoryIds: ['masters'],
  },
  {
    id: 'administration',
    label: 'Administration',
    categoryIds: ['admin', 'platform'],
  },
] as const

export type SidebarGroupId = (typeof SIDEBAR_GROUPS)[number]['id']
