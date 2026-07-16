# CRM Report Map

## API endpoint

```
GET /api/v1/t/{tenant}/crm/reports?reportId={id}&page=1&limit=500&from=&to=&ownerId=&stage=&status=&source=
```

Permission: `crm.report.view`

Response: paginated rows matching demo report column shapes.

## Implemented reports (API mode)

| Report ID | Label | Filters | Backend source |
|-----------|-------|---------|----------------|
| `pipeline` | Opportunity Pipeline | owner, dates | Open opportunities + company/stage |
| `stage-wise` | Stage-wise Opportunities | dates | groupBy stageId |
| `follow-up-due` | Follow-up Due | owner | pending/overdue/snoozed follow-ups |
| `sales-activity` | Sales Activity | owner, dates | crm_activities |
| `won-lost` | Won / Lost | dates | status WON/LOST |
| `customer-pipeline` | Customer Pipeline | — | groupBy company |
| `conversion-funnel` | Conversion Funnel | dates | opportunities by stage |
| `lead-register` | Lead Register | owner, stage, source, status, dates | crm_leads |
| `lead-owner` | Lead Owner | filters | aggregate by assignee |
| `lead-priority` | Priority-wise Leads | filters | aggregate by priority |
| `lead-stage` | Lead Stage | filters | aggregate by stage |
| `lead-conversion` | Lead Conversion | filters | computed metrics |
| `closed-leads` | Closed Leads | filters | lifecycleStatus=closed |
| `lead-active-inactive` | Active/Inactive | filters | activityStatus |

## Demo-only reports

| Report ID | Reason |
|-----------|--------|
| `quotation-revision` | No quotation backend |
| `quotation-approval` | No quotation backend |

In API mode these continue to read from `crmStore.quotationDocuments` (demo data).

## Frontend wiring

- `useCrmReportRows(reportId)` — fetches API when `isApiMode()` and report is in `CRM_API_REPORT_IDS`
- `CrmReportPage` — loading/error states for API fetch
- Demo mode unchanged — `CRM_REPORT_GETTERS` from stores

## Export

- DataGrid toolbar export on report page (client-side CSV from loaded rows)
- Server-side export API not yet implemented (`crm.export.execute`)

## Dashboard vs reports

Dashboard metrics (`GET /dashboard/metrics`) provide aggregate KPIs; reports provide tabular detail. No large report should be computed entirely in the frontend when in API mode.

## Date filters

Dashboard: `period=today|week|month|quarter|year|custom` + optional `from`/`to`

Reports: ISO datetime `from`/`to` on createdAt/updatedAt/scheduledAt depending on report.

## Tenant scope

All report queries use `tenantActiveFilter(tenantId)`.
