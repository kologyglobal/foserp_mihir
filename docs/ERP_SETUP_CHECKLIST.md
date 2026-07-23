# FOS ERP — Full Setup Checklist (Blank → Live)

Use this when the database is empty (or freshly migrated) and you want to stand up the **entire ERP** step by step.

**Mode:** always use **API mode** for real data.

```env
# frontend/.env
VITE_USE_API=true
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_TENANT_SLUG=vasant-trailers
```

**Rule:** Never mix demo (`VITE_USE_API=false`) data with API data.

Mark each box only when verified in the UI (or Prisma Studio).

---

## How to use this guide

| Day | Focus | Outcome |
|-----|--------|---------|
| **Day 0** | Tech bootstrap | Login works against MySQL |
| **Day 1** | Users + core masters | Dropdowns have real data |
| **Day 2** | Warehouses + opening stock | Inventory numbers are real |
| **Day 3** | Buy path | PR → PO → GRN → stock |
| **Day 4** | Make path | BOM/routing/profile → WO → issue → stages |
| **Day 5** | Sell path | Lead → Quotation → SO |
| **Day 6** | QC + close loops | Purchase QI + manufacturing QC |
| **Day 7** | Finance pilot (optional) | CoA / mappings / one posting |

Skip Day 7 if finance is not in scope yet.

---

# Day 0 — Technical bootstrap

## 0.1 Prerequisites

- [ ] Node.js 20+
- [ ] MySQL 8+ running
- [ ] Repo available at project root (`trailer-erp 2`)

## 0.2 Create database

```sql
CREATE DATABASE fos_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- [ ] Database exists

## 0.3 Backend env + install

```bash
cd backend
cp .env.example .env
# Edit DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, JWT secrets
npm install
npm run db:setup
```

`db:setup` = Prisma generate → migrate deploy → seed.

- [ ] Migrations applied
- [ ] Seed completed without error
- [ ] `npm run dev` → `http://localhost:5000/api/v1/health` OK

## 0.4 Frontend env + install

```bash
cd frontend
# Ensure .env has VITE_USE_API=true (see top of this doc)
npm install
npm run dev
```

- [ ] App opens at `http://127.0.0.1:5173` (or Vite port)
- [ ] Login page appears (API mode)

## 0.5 First login (seed credentials)

| Role | Email | Password | Tenant |
|------|--------|----------|--------|
| Tenant Admin | `admin@vasant-trailers.com` | `Admin@123` | `vasant-trailers` |
| Super Admin | `super@fos-erp.com` | `Super@123` | — |

- [ ] Login succeeds
- [ ] Navigation loads (CRM / Purchase / Inventory / Manufacturing visible)
- [ ] No console flood of API 401/404 on home

**Day 0 done when:** You are logged in as Tenant Admin against a seeded MySQL tenant.

---

# Day 1 — Users, roles, and core masters

## 1.1 Users & roles

- [ ] Review seeded roles (Tenant Admin, Purchase Manager, Inventory Manager, Production Manager, Sales Manager, Viewer, …)
- [ ] Create real users for pilot (or rename/use seeded ones)
- [ ] Assign each user one clear role
- [ ] Log out / log in as Purchase user — Purchase menus work
- [ ] Log in as Stores user — Inventory menus work

## 1.2 Geography / commercials (as needed)

- [ ] Countries / states / cities (if forms require them)
- [ ] Payment terms
- [ ] Tax / GST settings used on documents

## 1.3 Units & classification

- [ ] **UOM** — Nos, Kg, Mtr, Ltr (minimum)
- [ ] **Item categories** — RM, BO, FG (or your list)

## 1.4 Parties

**Recommended (10 each):** run from `backend/`:

```bash
npx tsx scripts/seed-vendors-customers-setup.ts
```

- [ ] **Vendors** — at least 10 (`/masters/vendors`) — code, name, GSTIN, PAN, address, payment terms, contact
- [ ] **Companies / customers** — at least 10 (`/masters/companies`) — code, name, GSTIN, billing/shipping, credit terms, contact
- [ ] **Contacts** — primary contact per company
- [ ] Verify vendor dropdown on PO / PR preferred vendor
- [ ] Verify customer dropdown on quotation / sales order

## 1.5 Items & products

- [ ] Create **RM / BO items** (stockable) — start with 5–10
- [ ] Create **FG item(s)** for one sellable product
- [ ] Create **Product** linked to FG item (for CRM / manufacturing profile)
- [ ] Confirm Item ≠ Product (both exist where required)

**Day 1 done when:** New PR/PO/quotation forms show Item, Vendor, Customer, UOM in dropdowns.

---

# Day 2 — Warehouses & opening stock

## 2.1 Warehouses

Create at least:

| Code (example) | Purpose |
|----------------|---------|
| `RM-MAIN` | Raw material / bought-out |
| `WIP` | Shopfloor / WIP (if used) |
| `FG-MAIN` | Finished goods |
| `QC-HOLD` | Quarantine (if Purchase QI used) |

- [ ] Warehouses created and active
- [ ] Locations under warehouses (if your process uses bin/location)

## 2.2 Opening stock

- [ ] Post opening qty for each pilot RM item into `RM-MAIN`
- [ ] Open stock / balances screen — qty > 0
- [ ] Open item ledger — opening movement visible

**Day 2 done when:** Stock position for pilot RM is non-zero in the correct warehouse.

---

# Day 3 — Buy side (Purchase)

## 3.1 Purchase Setup

Route: `/purchase/setup`

- [ ] Open Setup and save defaults
- [ ] Decide which items/categories need GRN inspection
- [ ] Note QC hold warehouse/location

## 3.2 Full buy happy path

```text
PR → (RFQ → Vendor Quote → Compare/Award) → PO → GRN → [Purchase QI] → Stock
```

### Purchase Requisition — `/purchase/requisitions`

- [ ] Create PR (2+ lines, warehouse, required date)
- [ ] Submit / approve

### RFQ path (recommended) — `/purchase/rfqs`, `/purchase/vendor-quotations`, `/purchase/comparison`

- [ ] Create RFQ from PR
- [ ] Capture vendor quotes
- [ ] Compare and award → draft PO

*(Or create PO directly from PR if skipping RFQ for first pilot.)*

### Purchase Order — `/purchase/orders`

- [ ] Review rates, vendor, lines
- [ ] Release / confirm PO so GRN is allowed

### GRN — `/purchase/grn`

- [ ] Create GRN from PO
- [ ] Receive full or partial qty
- [ ] Submit
- [ ] **Without QC:** stock increases in RM warehouse
- [ ] **With QC:** status `QC_PENDING`

### Purchase QI (if inspection required) — `/purchase/quality-inspections` / `/quality/incoming`

- [ ] Complete ACCEPT / REJECT / partial
- [ ] Accepted qty in unrestricted stock
- [ ] Rejected qty handled (return path later)

### Verify

- [ ] Stock balance matches accepted GRN qty
- [ ] PO received qty updated

## 3.3 Optional buy extras

- [ ] Partial second GRN on same PO
- [ ] Purchase Return — `/purchase/returns`
- [ ] Purchase Invoice — `/purchase/invoices` (if AP in scope)

**Day 3 done when:** One PO is received into stock and balances are correct.

---

# Day 4 — Make side (Manufacturing)

## 4.1 Manufacturing setup masters

Suggested order:

1. Work centres (+ machines if used)
2. BOM (version) for FG
3. Routing (stages/ops) — set **`qualityRequired`** where in-process QC is needed
4. Manufacturing profile (product + production warehouse + BOM + routing)

Routes: Manufacturing → Setup

- [ ] Work centre(s) created
- [ ] BOM released/active for pilot FG
- [ ] Routing released/active; QC flags set on stages that need inspection
- [ ] Manufacturing profile links product + warehouses + BOM + routing

## 4.2 Work order execution

```text
Create/Release WO → Start → Reserve/Issue materials
 → Complete stages → (QC_PENDING → Manufacturing QI PASS) → next stage
 → FG receipt → Complete WO
```

- [ ] Create WO for pilot product
- [ ] Release WO (BOM/routing snapshots locked)
- [ ] Start production
- [ ] Materials tab: reserve / issue from `RM-MAIN`
- [ ] If short: create **Shortage PR** from Materials / Issue Stock — PR appears in Purchase
- [ ] Complete first stage
- [ ] If QC required: open `/quality/queue`, decide PASS → next stage unlocks
- [ ] Receive finished goods
- [ ] Complete / close WO

## 4.3 Control Room smoke

- [ ] `/manufacturing` Control Room shows the WO
- [ ] Board/List views load without blank content

**Day 4 done when:** One WO goes from release → issue → stage complete → FG (with QC if configured).

---

# Day 5 — Sell side (CRM → SO)

Canonical funnel:

```text
Lead → Opportunity → Quotation → Approve → Convert to Sales Order → Confirm
```

- [ ] Create Company + Contact
- [ ] Create Lead → qualify
- [ ] Create Opportunity
- [ ] Create Quotation (with product/FG lines) → Approve
- [ ] Convert to Sales Order
- [ ] Confirm SO
- [ ] (Optional) Drive manufacturing demand / WO from SO

**Day 5 done when:** One quotation becomes a confirmed SO visible in CRM/Sales.

---

# Day 6 — Quality & closed loops

Remember: **Purchase QI ≠ Manufacturing QI**.

| Track | Trigger | Where |
|-------|---------|--------|
| Inbound | GRN inspection required | Purchase QI / `/quality/incoming` |
| In-process | Stage `qualityRequired` | `/quality/queue` / WO stage |

- [ ] One inbound QI completed (from Day 3 or new GRN)
- [ ] One manufacturing inspection PASS on a QC stage
- [ ] Shortage PR from WO/Issue Stock creates Purchase PR (buy ↔ make loop)
- [ ] Issued materials reduce stock; GRN increases stock — ledger consistent

**Day 6 done when:** Both QC tracks demonstrated once, and buy↔make shortage loop works.

---

# Day 7 — Finance pilot (optional)

Only after stock/documents are stable.

- [ ] Legal entity exists / active
- [ ] Chart of accounts
- [ ] Default account mappings (purchase, inventory, manufacturing keys as needed)
- [ ] Fiscal periods open
- [ ] One AP-related document path (invoice) if live
- [ ] One AR path if live (invoice/receipt)
- [ ] Manufacturing accounting feature flag left **OFF** until mappings verified

**Day 7 done when:** Finance smoke (or explicitly deferred with N/A).

---

# Master data minimum pack (print this)

Create and keep this fixed pilot set:

| # | Record | Qty |
|---|--------|-----|
| 1 | Warehouses | RM, WIP, FG (+ QC-HOLD) |
| 2 | UOMs | ≥ 3 |
| 3 | Vendors | ≥ 2 |
| 4 | Customers | ≥ 2 |
| 5 | RM items | ≥ 5 with opening stock |
| 6 | FG item + Product | ≥ 1 |
| 7 | Work centre | ≥ 1 |
| 8 | BOM + Routing + Profile | 1 product |
| 9 | Users | Admin + Purchase + Stores + Production |

---

# End-to-end proof scenarios

Run these after Days 0–6:

| ID | Scenario | Pass |
|----|----------|------|
| E2E-01 | Login API mode | ☐ |
| E2E-02 | Masters usable in forms | ☐ |
| E2E-03 | Opening stock visible | ☐ |
| E2E-04 | PR → PO → GRN → stock | ☐ |
| E2E-05 | GRN → Purchase QI → stock | ☐ |
| E2E-06 | WO release → issue → stage → FG | ☐ |
| E2E-07 | Stage QC gate PASS | ☐ |
| E2E-08 | Shortage PR from WO/store | ☐ |
| E2E-09 | Quotation → SO | ☐ |
| E2E-10 | Control Room shows live WO | ☐ |

---

# Sign-off

| Role | Name | Date | Verdict |
|------|------|------|---------|
| Implementation lead | | | ☐ Ready for pilot ☐ Ready with conditions ☐ Not ready |
| Stores | | | ☐ |
| Purchase | | | ☐ |
| Production | | | ☐ |
| Sales / CRM | | | ☐ |
| Finance (if in scope) | | | ☐ / N/A |

---

# Common blockers

| Symptom | Fix |
|---------|-----|
| Login fails / empty app | Backend down; wrong `VITE_API_BASE_URL`; seed not run |
| Demo data appears | Set `VITE_USE_API=true` and hard-refresh |
| Empty dropdowns | Day 1 masters missing or wrong tenant slug |
| Always shortage / qty 0 | Day 2 opening stock missing / wrong warehouse |
| Can’t GRN | PO not in receivable status |
| Stuck `QC_PENDING` | Complete Purchase QI or Manufacturing inspection |
| WO won’t promote next stage | Manufacturing QC not PASS / gate not bypassed |
| Shortage PR button missing | Need `manufacturing.materials.create_requirement` |

---

# Quick command cheat sheet

```bash
# Backend
cd backend
npm run db:setup          # first time: migrate + seed
npm run db:seed           # re-seed permissions/roles/baseline if needed
npm run dev               # :5000

# Frontend
cd frontend
# VITE_USE_API=true in .env
npm run dev               # :5173
```

Swagger (dev): `http://localhost:5000/api/docs`

---

# Related docs

- `docs/MASTER_REGISTRY.md` — canonical masters
- `docs/CRM_WORKFLOW.md` — lead → SO
- `docs/implementation/PHASE8B_DATA_TEMPLATES_README.md` — CSV load order
- `backend/README.md` — seed credentials & API layout
