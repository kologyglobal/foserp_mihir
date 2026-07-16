# Frontend Folder Structure

**Target architecture** for FOS ERP (`trailer-erp/src/`), aligned with DhurandharERPUI reference pattern.

---

## Directory tree (target state)

```
src/
├── assets/                 # Static images, fonts
├── bootstrap/              # App startup orchestration
│   ├── appBootstrap.ts
│   ├── apiHydration.ts
│   ├── demoBootstrap.ts
│   ├── permissionBootstrap.ts
│   └── index.ts
├── components/             # Reusable domain UI (NOT route pages)
│   ├── approval/
│   ├── auth/
│   ├── crm/
│   ├── quotations/
│   ├── masters/
│   ├── purchase/
│   ├── inventory/
│   ├── production/
│   ├── quality/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   ├── ui/                 # Primitive controls only
│   └── system/
├── config/
│   ├── appConfig.ts
│   ├── apiConfig.ts
│   ├── featureFlags.ts
│   └── environment.ts
├── data/                   # Static seeds & fixtures (no React)
│   ├── crm/
│   ├── quotations/
│   ├── masters/
│   └── demo/
├── demo/                   # Demo factories & scenario runners
│   ├── seeds/
│   ├── scenarios/
│   └── factories/
├── design-system/          # Business-agnostic enterprise UI
│   ├── components/
│   ├── enterprise/
│   ├── hooks/
│   ├── list-page/
│   ├── theme/
│   ├── workspace/
│   └── workspace360/
├── hooks/                  # Reusable React hooks
├── modules/                # Route-level pages ONLY
│   ├── admin/
│   ├── auth/
│   ├── crm/
│   ├── quotations/
│   ├── masters/
│   ├── sales/
│   ├── purchase/
│   ├── inventory/
│   ├── production/
│   ├── quality/
│   ├── reports/
│   ├── settings/
│   ├── mobile/
│   ├── workspaces/
│   └── entity360/
├── routes/                 # Route definitions (split by module)
├── services/
│   ├── api/                # HTTP resource clients
│   └── bridges/            # DTO ↔ store mapping
├── store/
│   ├── bootstrap/
│   ├── selectors/
│   └── *.ts                # Domain Zustand stores
├── styles/
├── types/                  # Shared TypeScript types
├── utils/                  # Stateless helpers
├── App.tsx
└── main.tsx
```

---

## Current state (2026-07-11)

| Target folder | Current status |
|---------------|----------------|
| `bootstrap/` | Partial — `erpStartup.ts` only |
| `config/` | Missing — uses `services/api/config.ts` |
| `demo/` | Missing — seeds in `data/demo/` |
| `modules/quotations/` | Missing — under `modules/crm/` |
| `modules/auth/` | Missing — `pages/auth/` |
| `services/bridges/` | Missing — bridges in `services/api/` |
| `routes/*.tsx` split | Missing — monolithic `index.tsx` |
| Path aliases | Missing |
| `data/` by domain | Partial (~51 files) |
| `design-system/` | Present (canonical) |
| `components/crm/` | Present (~80 files) |

---

## Import aliases (planned)

```typescript
import { CrmLeadListPage } from '@/modules/crm/CrmLeadListPage'
import { CrmLeadsTable } from '@/components/crm/CrmLeadsTable'
import { appConfig } from '@/config/appConfig'
import { syncAllCrmFromApi } from '@/services/bridges/crmApiBridge'
```

---

## What does NOT belong in frontend src

- Backend Express routes  
- Prisma schema  
- MySQL migrations  
- Server-only secrets  

Backend lives in `backend/` as a separate application.

---

## Related docs

- `FILE_PLACEMENT_RULES.md` — decision tree for new files  
- `ADDING_A_NEW_MODULE.md` — step-by-step for new ERP areas  
- `file-migration-plan.md` — phased move schedule  
- `FRONTEND_BACKEND_INTEGRATION.md` — API/bridge patterns  
