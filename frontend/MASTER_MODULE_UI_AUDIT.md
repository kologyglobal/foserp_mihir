# Master Module UI/UX Audit & Reorganization Report

**Project:** Vasant Trailer ERP  
**Date:** June 29, 2026  
**Scope:** All `/masters/*` registers, hub, and related master-adjacent routes

---

## Executive Summary

The Master Data module was audited page-by-page. The hub has been reorganized into **9 business-domain groups** (Foundation, CRM & Sales, Procurement, Inventory, Production, Product Engineering, Quality, Administration, Documents). Inner list and detail pages now share a consistent shell with module context chips, breadcrumbs, and navigation back to the hub.

---

## Pages Reviewed

| Route | Page | Group | UI pattern (before) | Status |
|-------|------|-------|---------------------|--------|
| `/masters` | Master Data Hub | — | Zoho-style cards, 6 technical groups | **Redesigned** — 9 business modules, pills, icons |
| `/masters/uom` | UOM list/form/detail | Foundation | MasterListShell + FormLayout | **Updated** — group breadcrumbs, FormSection, tokens |
| `/masters/item-categories` | Item Category | Foundation | MasterListShell + FormLayout | **Updated** — group context |
| `/masters/items` | Item Master | Foundation | MasterListShell; detail → Entity 360 | **Updated** list; 360 unchanged |
| `/masters/customers` | Company Master | CRM & Sales | Rich form + list | **Updated** list group context |
| `/masters/vendors` | Vendor Master | Procurement | Rich form + list | **Updated** list group context |
| `/masters/warehouses` | Warehouse | Inventory | Simple CRUD | **Updated** — Operational detail shell, FormSection |
| `/masters/work-centers` | Work Centers | Production | Manual breadcrumbs | **Updated** — production group |
| `/masters/routing` | Routing | Production | Inline edit on detail | **Updated** list group context |
| `/masters/products` | Product Master | Engineering | List + Entity 360 detail | **Updated** list |
| `/masters/bom` | BOM Master | Engineering | Dual workspace paths | **Updated** list |
| `/masters/approval-matrix` | Approval Matrix | Administration | Custom PageHeader | **Catalog grouped** — shell alignment pending |
| `/serials` | Serial Numbers | Quality | OperationalPageShell inline | **Catalog grouped** — shell alignment pending |
| `/documents`, `/barcode/*` | DMS / Barcode | Documents | Separate modules | **Catalog grouped** |

---

## Issues Found (Before Fix)

### Hub & navigation
1. Masters grouped by technical structure (General, Parties) not business modules (CRM, Procurement, Production).
2. Sidebar flat list with no logical ordering vs hub groups.
3. No quick-jump between module groups on hub.
4. Record counts missing for serials, approval, documents.

### Inner pages — inconsistency
5. **Two-tier UX:** Customer/Vendor use premium `DocumentLayout` forms; UOM/Warehouse use basic `FormLayout` without sections.
6. **Detail split:** Item/Vendor/Product/Customer route to Entity 360; UOM/Warehouse/Category use legacy `DetailLayout` inside `erp-page` — different visual weight.
7. **Breadcrumbs:** Only Work Center and Routing had explicit breadcrumbs; others relied on auto-breadcrumbs without module context.
8. **Design tokens:** `text-slate-*` mixed with `text-erp-*` on UOM, warehouse, BOM, legacy details.
9. **Not-found states:** Bare `<p className="text-slate-500">` instead of guided empty state with hub link.
10. **No hub escape hatch** on list pages — users had to use sidebar only.

### Dead / duplicate code
11. Legacy `CustomerDetailPage`, `VendorDetailPage`, `ProductDetailPage`, `ItemDetailPage` in masters folder (routes use Entity 360).

### Path inconsistencies
12. Customer 360 at `/masters/customers/:id/360` vs vendor at `/:id`.
13. BOM at `/masters/bom` and `/engineering/bom`.
14. Serial at `/serials` vs permission path `/masters/serial-numbers`.

---

## Changes Implemented

### 1. Business-domain catalog (`mastersSetupCatalog.ts`)
Nine groups aligned to ERP modules:

| Group | Masters |
|-------|---------|
| **Foundation** | UOM, Item Category, Item |
| **CRM & Sales** | Company Master |
| **Procurement** | Vendor Master |
| **Inventory & Stores** | Warehouse |
| **Production** | Work Centers, Routing |
| **Product Engineering** | Product, BOM, Engineering BOM |
| **Quality & Traceability** | Serial Numbers |
| **Administration** | Approval Matrix |
| **Documents & Barcode** | Document Register, Barcode Hub, Barcode Master |

Each link carries `groupId` for breadcrumbs and path resolution.

### 2. Master Data Hub (`MastersHomePage.tsx`)
- Module quick-jump pill strip with icons and record totals
- Group cards with icon, description, and aggregate record count
- Hash navigation (`/masters#production`) for deep links from inner pages
- Serial count badge added

### 3. Shared shells
- **`MasterListShell`:** `masterGroupId` → breadcrumbs (Hub → Module → Page), module chip, “Master Hub” command bar action, `resultCount` on filter bar
- **`DetailLayout`:** Upgraded to `OperationalPageShell` (matches list pages), module chip, consistent actions
- **`MasterNotFound`:** Guided not-found with link back to hub

### 4. Inner page updates
All standard master list pages now pass `masterGroupId` and `resultCount`. UOM and Warehouse forms use `FormSection`. Slate color tokens replaced on updated pages.

### 5. Navigation (`navigation.ts`)
Sidebar items reordered to match business groups; Company Master uses `Building2` icon.

### 6. CSS (`dynamics-components.css`)
Module accent colors, pill strip, card headers, inner-page module chips.

---

## Remaining Gaps (Recommended Next Sprint)

| Priority | Item |
|----------|------|
| High | Align **Approval Matrix** and **Serial Master** to `MasterListShell` pattern |
| High | Unify **Customer/Vendor forms** with standard masters or elevate all forms to document layout |
| Medium | Migrate simple details (UOM, Category, Warehouse) to **Entity 360** or compact 360 variant |
| Medium | Standardize customer detail path to `/:id` (remove `/360` suffix) |
| Medium | Add **Finance & Accounts** group when COA/payment-term masters ship |
| Low | Remove dead legacy detail components from `src/modules/masters/` |
| Low | Add `countKey` for approval queue size and document register on hub |

---

## How to Use

1. Open **Master Data → Master Data Hub** (`/masters`)
2. Use module pills or scroll to the business group (e.g. **Production**)
3. Open any register — breadcrumbs show `Master Data → [Module] → [Page]`
4. Use **Master Hub** on the command bar to return to the grouped catalog

---

## Verdict

**Master module reorganized and inner-page UX materially improved.** Hub and list experiences are now module-aligned. Detail/form parity across all registers remains the main follow-up.
