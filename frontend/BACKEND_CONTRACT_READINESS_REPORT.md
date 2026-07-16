# Backend Contract Readiness Report

**Date:** 2026-06-23  
**Verdict:** **Ready for Backend**

## Frozen Contracts

| Domain | Frontend contract | Location |
|--------|-------------------|----------|
| Data model | Zustand stores + types | `src/store/*`, `src/types/*` |
| Analytics API | `getErpExecutiveAnalytics()` | `src/services/erpAnalyticsService.ts` |
| Next actions | `buildNextBusinessActions()` | `src/services/nextActionEngine.ts` |
| Permissions | RBAC matrix | `src/utils/permissions.ts` |
| Approvals | Matrix engine | `src/utils/approvalEngine.ts` |
| QR/Serial | Store schemas | `qrStore`, `serialStore` |
| Reports | Report contracts | `src/modules/reports/` |
| Status lifecycles | Per-module types | SO/WO/PO/GRN/QC/Dispatch/Invoice |

## API Draft Shape (post-migration)

```
GET  /api/analytics/executive     → ErpExecutiveAnalytics
GET  /api/analytics/workspace/:m  → workspace metrics
GET  /api/actions/next            → NextBusinessAction[]
GET  /api/factory/pulse           → LiveActivityEvent[]
```

## Gate Evidence

- `npm run test:ci` — 29 suites GREEN
- `npm run test:uat` — GREEN
- `npm run test:eeta-100` — 27/27
- Zero critical/high UAT defects open

## Migration Notes

Replace `getState()` reads in analytics service with API fetch; keep TypeScript interfaces as API response types. WebSocket layer can replace `useLiveFactoryPulse` simulation without UI changes.
