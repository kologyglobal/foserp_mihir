# UAT Role Permission Matrix

**Date:** 2026-06-24

| Role | ERP Role Key | Allowed Routes (sample) | Blocked Routes (sample) | Approval Responsibilities | Dashboard | Notifications |
|------|--------------|-------------------------|-------------------------|---------------------------|-----------|---------------|
| CEO / Management | `ceo` | /executive, /sales, /mrp, /purchase, /inventory, /production | /settings/roles | engineering.approve; purchase.approve; quality.approve; dispatch.approve; approval.approve | Executive | Inbox when reports.view |
| Sales User | `sales_manager` | /sales, /dispatch, /production, /masters, /documents, /reports | /purchase, /invoice, /settings | sales.approve (quotations) | Sales Workspace | Approval inbox |
| Sales Manager | `sales_manager` | /sales, /dispatch, /production, /masters, /documents, /reports | /purchase, /invoice, /settings | sales.approve | Sales Workspace | Approval inbox |
| Planning Manager | `planning_manager` | /mrp, /production, /work-orders, /inventory, /sales, /purchase | /invoice, /settings | production.submit/release | MRP Planner | MRP alerts |
| Purchase User | `purchase_user` | /purchase, /masters, /inventory, /documents, /reports | /sales, /invoice, /executive | — (cannot approve PO) | Purchase Workspace | PR/PO notifications |
| Purchase Head | `purchase_head` | /purchase, /masters, /inventory, /quality, /documents, /reports | /sales, /executive | purchase.approve | Purchase Workspace | Approval inbox |
| Store User | `store_user` | /inventory, /purchase, /quality, /masters, /production, /traceability | /sales, /invoice, /executive | — | Inventory | GRN alerts |
| Store Manager | `store_manager` | /inventory, /purchase, /quality, /masters, /production, /traceability | /sales, /invoice, /executive | inventory.approve/post | Inventory | GRN/putaway alerts |
| Production Supervisor | `production_supervisor` | /production, /work-orders, /shop-floor, /quality, /inventory, /engineering | /sales, /invoice, /executive | production.submit/release | Production Control Tower | WO/job card alerts |
| Shop Floor Operator | `shop_floor` | /shop-floor, /production, /quality, /traceability, /inventory | /sales, /purchase, /invoice, /executive | — | Shop Floor Queue | Job card queue |
| Quality Inspector | `quality_inspector` | /quality, /production, /masters, /traceability, /reports | /sales, /purchase, /invoice | — | QC Workspace | Inspection queue |
| Quality Head | `quality_head` | /quality, /production, /masters, /dms, /traceability, /reports | /sales, /purchase, /invoice | quality.approve | QC Workspace | NCR/rework approvals |
| Dispatch User | `dispatch_user` | /dispatch, /production, /sales, /masters, /traceability, /dms | /purchase, /invoice, /executive | — | Dispatch Workspace | Dispatch planning |
| Accounts User | `accounts_user` | /invoice, /purchase, /dispatch, /sales, /reports | /production, /quality, /executive | — | Invoice Workspace | Payment reminders |
| Engineering Head | `engineering_head` | /engineering, /masters, /dms, /production, /quality, /approval | /sales, /invoice, /dispatch | engineering.approve/release | Engineering | ECO/ECR approvals |
| Admin | `admin` | All routes | — | All | Executive + Settings | All notifications |

Validated via `npm run test:rbac` (16/16) and `permissionMatrix.ts` route guards.
