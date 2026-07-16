# Master Data Module Structure

Centralized Master Data Management module for FOS ERP — SAP Fiori / Microsoft Business Central style organization.

## Folder hierarchy

```
src/
├── config/
│   ├── masterModuleStructure.ts    # Canonical groups, routes, permissions, relationships
│   ├── mastersSetupCatalog.ts        # Hub cards + breadcrumbs (derived from structure)
│   ├── navigation.ts                 # Master Data module nav (via buildMasterNavItems)
│   └── permissionMatrix.ts           # Route-level RBAC for /masters/*
├── modules/masters/
│   ├── MastersHomePage.tsx           # /masters dashboard
│   ├── shared/
│   │   ├── EnterpriseMasterShell.tsx # Common BC-style form layout
│   │   └── MasterPlaceholderPage.tsx # Pending master shell
│   ├── administration/               # (via settings + code-series)
│   ├── customer/                     # Company / customer pages
│   ├── vendor/
│   ├── item/
│   ├── item-category/
│   ├── uom/
│   ├── hsn/
│   ├── gst-group/
│   ├── gst-rate/
│   ├── warehouse/
│   ├── bom/
│   ├── routing/
│   ├── work-center/
│   └── code-series/
├── utils/
│   ├── masterNavigation.ts           # Breadcrumb builders
│   ├── masterRegisterScope.ts        # CRM register scope under /masters
│   └── masterDashboard.ts            # Hub metrics, search, pinned masters
└── routes/index.tsx                  # Master route tree + legacy redirects
```

## Navigation

**Left icon rail:** `Masters` → `/masters`

**Module sub-nav:** Master Data Hub only (individual registers discovered via hub — avoids 30+ tabs).

**Hub categories (scroll pills):**

| Group | Masters |
|-------|---------|
| Administration | Company, Users, Roles, Permissions, Role Mapping, Code Series |
| Customer & Vendor | Customer, Vendor, Contact |
| Inventory | Item, Item Category, UOM, Warehouse |
| Tax | HSN, GST Group, GST Rate |
| Manufacturing | BOM, Routing, Work Center, Quality Test Group |
| Organization | Department, Territory, Industry |
| Configuration | Payment Terms, Price List, Approval Workflow |
| Extended Registers | Location, Payment Method, Banks, Product, Serial, Documents, Barcode |

## Routes

| Master | Route | Status |
|--------|-------|--------|
| Master Data Hub | `/masters` | Implemented |
| Company Master | `/masters/companies` | Implemented (alias → customer register) |
| CRM User / Employee | `/masters/users` | Implemented |
| Role Master | `/masters/roles` | Implemented |
| Permission Master | `/masters/permissions` | Implemented |
| Role Permission Mapping | `/masters/role-permissions` | Implemented |
| Code / Number Series | `/masters/code-series` | Implemented |
| Customer Master | `/masters/customers` | Implemented |
| Vendor Master | `/masters/vendors` | Implemented |
| Contact Master | `/masters/contacts` | Implemented (linked CRM register) |
| Item Master | `/masters/items` | Implemented |
| Item Category | `/masters/item-categories` | Implemented |
| UOM Master | `/masters/uom` | Implemented |
| Warehouse Master | `/masters/warehouses` | Implemented |
| HSN Master | `/masters/hsn` | Implemented |
| GST Group Code | `/masters/gst-groups` | Implemented |
| GST Rate Master | `/masters/gst-rates` | Implemented |
| BOM Master | `/masters/bom` | Implemented |
| Routing Master | `/masters/routing` | Implemented |
| Work Center Master | `/masters/work-centers` | Implemented |
| Quality Test Group | `/masters/quality-test-groups` | Placeholder |
| Department Master | `/masters/departments` | Placeholder |
| Territory Master | `/masters/territories` | Implemented (CRM register under MDM) |
| Industry Master | `/masters/industries` | Implemented (CRM register under MDM) |
| Payment Terms | `/masters/payment-terms` | Implemented (CRM register under MDM) |
| Price List | `/masters/price-lists` | Placeholder |
| Approval Workflow | `/masters/approval-workflows` | Implemented |

### Legacy redirects (preserved)

| Legacy | Redirects to |
|--------|----------------|
| `/settings/roles` | `/masters/roles` |
| `/settings/permissions` | `/masters/permissions` |
| `/settings/approval-matrix` | `/masters/approval-workflows` |
| `/masters/approval-matrix` | `/masters/approval-workflows` |
| `/crm/masters/owners` | `/masters/users` |

## Implemented masters

- Company / Customer, Vendor, Contact, Item, Item Category, UOM, Warehouse
- HSN, GST Group, GST Rate
- BOM, Routing, Work Center
- Users, Roles, Permissions, Role Permission Mapping, Code Series
- Territory, Industry, Payment Terms (CRM registers hosted under `/masters`)
- Extended: Location, Payment Method, Order Address, Bank Account, Bank, Product, Product Interest, Serial Numbers

## Pending masters

- Department Master (`/masters/departments`)
- Quality Test Group Master (`/masters/quality-test-groups`)
- Price List (`/masters/price-lists`)

Placeholder pages use the standard Object Page shell with command bar (New / Import / Export disabled until backend phase).

## Relationships

| From | To | Link |
|------|-----|------|
| Item | HSN | HSN code |
| Item | GST Group | GST classification |
| Item | UOM | Base unit |
| Item | Item Category | Classification |
| Company | Contact | People |
| Company | Opportunity / Sales Order | CRM & sales |
| Employee | Role / Permission | Security |
| GST Rate | GST Group | Rate slab |
| HSN | GST Group | Default group |

## Permissions

Each master supports (documented in `masterModuleStructure.ts`):

`view` · `create` · `edit` · `delete` · `import` · `export` · `approve` · `history` · `audit`

Route gate: `/masters/*` → `masters.view` (administration security pages → `settings.view`).

Permission keys follow `{permissionKey}.{action}` e.g. `masters.items.view`.

## Master home dashboard (`/masters`)

- **Header:** Master Data, global search, Quick Create, Import, Export
- **Summary cards:** Companies, Customers, Vendors, Items, Employees, Tax masters, Work centers, BOMs
- **Recently modified / created** from store timestamps
- **Favorites** from UI store
- **Pinned masters** (localStorage)
- **Recently opened** master routes
- **Category card grid** with pin-to-quick-link

## Global master search

Indexed in `globalSearchIndex.ts` — results grouped by type:

Company · Customer · Vendor · Item · Employee · HSN · GST · UOM · Role · Permission · Code Series · Contact · BOM · Routing · Work Center

## Common master layout

All implemented masters use:

- `EnterpriseMasterWorkspace` / `MasterListShell`
- Object header, breadcrumbs, command bar, Smart Table, pagination
- Detail: tabs (General, Configuration, Related Records, History, Audit)
- Sticky footer: Cancel · Save · Save & Close · Save & New
- Insight sidebar: summary, status, audit fields

## Source of truth

Update **`src/config/masterModuleStructure.ts`** when adding or moving masters — navigation, hub, breadcrumbs, and documentation derive from it.
