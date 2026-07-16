# Role-Wise UAT and RBAC Report

**Date:** 2026-06-25

| Role | ERP Key | Allowed Routes | Blocked Routes | Approvals | Mobile | Dashboard | Status |
|------|---------|----------------|----------------|-----------|--------|-----------|--------|
| CEO / Management | `ceo` | /home, /executive, /crm, /sales, /mrp | /inventory | engineering.approve; purchase.approve | — | Role home KPIs | ✓ Pass |
| Admin | `admin` | /home, /executive, /crm, /sales, /mrp | — | All | — | Role home KPIs | ✓ Pass |
| Sales User | `sales_manager` | /home, /executive, /crm, /sales, /mrp | /purchase, /inventory, /quality | sales.approve | — | Role home KPIs | ✓ Pass |
| Sales Manager | `sales_manager` | /home, /executive, /crm, /sales, /mrp | /purchase, /inventory, /quality | sales.approve | — | Role home KPIs | ✓ Pass |
| Planning Manager | `planning_manager` | /home, /executive, /crm, /sales, /mrp | /invoice, /documents, /settings | — | — | Role home KPIs | ✓ Pass |
| Purchase User | `purchase_user` | /home, /executive, /purchase, /inventory, /documents | /crm, /sales, /mrp | — | — | Role home KPIs | ✓ Pass |
| Purchase Head | `purchase_head` | /home, /executive, /purchase, /inventory, /quality | /crm, /sales, /mrp | purchase.approve | — | Role home KPIs | ✓ Pass |
| Store User | `store_user` | /mrp, /purchase, /inventory, /production, /work-orders | /home, /executive, /crm | — | ✓ | Role home KPIs | ✓ Pass |
| Store Manager | `store_manager` | /mrp, /purchase, /inventory, /production, /work-orders | /home, /executive, /crm | inventory.approve | — | Role home KPIs | ✓ Pass |
| Production Supervisor | `production_supervisor` | /mrp, /inventory, /production, /work-orders, /shop-floor | /home, /executive, /crm | — | — | Role home KPIs | ✓ Pass |
| Shop Floor Operator | `shop_floor` | /mrp, /inventory, /production, /work-orders, /shop-floor | /home, /executive, /crm | — | ✓ | Role home KPIs | ✓ Pass |
| Quality Inspector | `quality_inspector` | /home, /executive, /mrp, /production, /work-orders | /crm, /sales, /purchase | — | ✓ | Role home KPIs | ✓ Pass |
| Quality Head | `quality_head` | /home, /executive, /mrp, /production, /work-orders | /crm, /sales, /purchase | quality.approve | — | Role home KPIs | ✓ Pass |
| Dispatch User | `dispatch_user` | /crm, /sales, /mrp, /production, /work-orders | /home, /executive, /purchase | — | ✓ | Role home KPIs | ✓ Pass |
| Gate Keeper | `dispatch_user` | /crm, /sales, /mrp, /production, /work-orders | /home, /executive, /purchase | — | ✓ | Role home KPIs | ✓ Pass |
| Accounts User | `accounts_user` | /home, /executive, /crm, /sales, /purchase | /mrp, /inventory, /production | — | — | Role home KPIs | ✓ Pass |
| Engineering Head | `engineering_head` | /home, /executive, /mrp, /production, /work-orders | /crm, /sales, /purchase | engineering.approve | — | Role home KPIs | ✓ Pass |