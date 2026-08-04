# Role Templates

Seeded role packs (backend `ROLE_PERMISSIONS`) plus workspace templates:

| Template | Recommended scope | Hints |
|----------|-------------------|--------|
| Lead User | OWN | crm.lead |
| Sales Executive | OWN | lead, opportunity, quotation |
| Sales Manager | TEAM | crm.* |
| Purchase Executive / Manager | BRANCH | purchase.* |
| Storekeeper | WAREHOUSE | inventory.* |
| Inventory Manager | LEGAL_ENTITY | inventory.* |
| Gate Security | BRANCH | gate.* |
| Accountant / Finance Manager | LE / ALL | finance/accounting |
| CEO Viewer | ALL | dashboard view |
| Administrator | ALL | user/role/tenant |

**UI:** Role list/create continues to use existing Role form + permission matrix. **Clone:** `POST /roles/:id/clone`. Permission Matrix page designs packs before saving a role.

See `frontend/src/config/adminAccessWorkspace.ts` → `ROLE_TEMPLATES`.
