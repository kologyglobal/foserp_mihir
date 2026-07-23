import type { ComponentType } from 'react'
import {
  Bookmark,
  Box,
  Building2,
  CreditCard,
  Factory,
  FolderOpen,
  FolderTree,
  GitBranch,
  Globe,
  Handshake,
  Hash,
  Landmark,
  Layers,
  LayoutGrid,
  MapPin,
  Package,
  Percent,
  Ruler,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import type { MasterSetupLink } from '../config/mastersSetupCatalog'

const CRM_LINK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  companies: Building2,
  contacts: Users,
  users: Users,
  'product-interests': Bookmark,
  'lead-sources': Factory,
  industries: Building2,
  territories: MapPin,
  'lead-stages': GitBranch,
  'lead-reasons': ShieldCheck,
  'opportunity-stages': Handshake,
  'opportunity-priorities': Bookmark,
  'activity-types': Users,
  'lost-reasons': ShieldCheck,
  'quotation-templates': Bookmark,
  'commercial-terms': FolderOpen,
  'payment-terms': CreditCard,
  'delivery-terms': Truck,
  'warranty-terms': ShieldCheck,
  'approval-rules': ShieldCheck,
  'document-types': FolderOpen,
  'freight-terms': Truck,
  buyers: Users,
  'qc-rules': ShieldCheck,
  'grn-tolerance': Percent,
  'return-reasons': Truck,
  'bin-codes': MapPin,
  'qc-parameters': ShieldCheck,
  'inspection-plans': ShieldCheck,
}

const LINK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  '/masters/companies': Building2,
  '/masters/customers': Building2,
  '/masters/contacts': Users,
  '/masters/roles': ShieldCheck,
  '/masters/permissions': ShieldCheck,
  '/masters/role-permissions': ShieldCheck,
  '/masters/code-series': Hash,
  '/masters/item-categories': FolderTree,
  '/masters/product-interests': Bookmark,
  '/crm/masters': Handshake,
  '/masters/vendors': Truck,
  '/masters/payment-methods': CreditCard,
  '/masters/payment-terms': CreditCard,
  '/masters/order-addresses': MapPin,
  '/masters/bank-accounts': Landmark,
  '/masters/banks': Building2,
  '/masters/items': Package,
  '/masters/uom': Ruler,
  '/masters/hsn': Hash,
  '/masters/gst-groups': Percent,
  '/masters/gst-rates': Percent,
  '/masters/locations': MapPin,
  '/masters/warehouses': Warehouse,
  '/masters/work-centers': Factory,
  '/masters/routing': GitBranch,
  '/masters/products': Box,
  '/manufacturing/setup/boms': Layers,
  '/masters/users': Users,
  '/masters/territories': MapPin,
  '/masters/industries': Building2,
  '/masters/countries': Globe,
  '/masters/states': MapPin,
  '/masters/cities': Building2,
}

export function resolveMasterLinkIcon(link: Pick<MasterSetupLink, 'path' | 'slug'>): ComponentType<{ className?: string }> {
  if (LINK_ICONS[link.path]) return LINK_ICONS[link.path]
  if (link.slug && CRM_LINK_ICONS[link.slug]) return CRM_LINK_ICONS[link.slug]
  const slug =
    link.slug ??
    link.path.match(/\/(?:crm\/masters|masters|purchase\/masters)\/([^/]+)/)?.[1]
  if (slug && CRM_LINK_ICONS[slug]) return CRM_LINK_ICONS[slug]
  return LayoutGrid
}

export function resolveMasterLinkIconByPath(path: string, slug?: string) {
  return resolveMasterLinkIcon({ path, slug })
}

export const MASTER_GROUP_ACCENT_CLASS: Record<string, { tile: string; icon: string; chip: string; heading: string }> = {
  blue: {
    tile: 'masters-accent-blue',
    icon: 'bg-blue-500/10 text-blue-700',
    chip: 'bg-blue-500/10 text-blue-800 ring-blue-500/20',
    heading: 'border-blue-500/30',
  },
  green: {
    tile: 'masters-accent-green',
    icon: 'bg-emerald-500/10 text-emerald-700',
    chip: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20',
    heading: 'border-emerald-500/30',
  },
  amber: {
    tile: 'masters-accent-amber',
    icon: 'bg-amber-500/10 text-amber-800',
    chip: 'bg-amber-500/10 text-amber-900 ring-amber-500/20',
    heading: 'border-amber-500/30',
  },
  cyan: {
    tile: 'masters-accent-cyan',
    icon: 'bg-cyan-500/10 text-cyan-800',
    chip: 'bg-cyan-500/10 text-cyan-900 ring-cyan-500/20',
    heading: 'border-cyan-500/30',
  },
  indigo: {
    tile: 'masters-accent-indigo',
    icon: 'bg-indigo-500/10 text-indigo-800',
    chip: 'bg-indigo-500/10 text-indigo-900 ring-indigo-500/20',
    heading: 'border-indigo-500/30',
  },
  purple: {
    tile: 'masters-accent-purple',
    icon: 'bg-violet-500/10 text-violet-800',
    chip: 'bg-violet-500/10 text-violet-900 ring-violet-500/20',
    heading: 'border-violet-500/30',
  },
  rose: {
    tile: 'masters-accent-rose',
    icon: 'bg-rose-500/10 text-rose-800',
    chip: 'bg-rose-500/10 text-rose-900 ring-rose-500/20',
    heading: 'border-rose-500/30',
  },
  slate: {
    tile: 'masters-accent-slate',
    icon: 'bg-slate-500/10 text-slate-700',
    chip: 'bg-slate-500/10 text-slate-800 ring-slate-500/20',
    heading: 'border-slate-500/30',
  },
}
