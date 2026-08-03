# Period Close — Calendar, Checklist Templates & Reopen Requests

**Phase:** Period Close ops (2026-07-30)  
**Status:** Live API + dual-mode FE. Demo seed retained when `VITE_USE_API=false`.

## Purpose

| Surface | What shipped |
|---------|----------------|
| **Checklist templates** | LE-scoped task definitions; instantiate onto a period |
| **Close calendar** | Due milestones (from checklist + lock), CRUD, auto status from due date |
| **Reopen requests** | Draft → submit → approve (reopens period) / reject; temporary open until `requestedUntil` |

Direct `POST …/periods/:id/reopen` remains for privileged emergency reopen (`finance.period.reopen`).

## APIs

Base: `/api/v1/t/:tenantSlug/accounting/period-close`

### Templates
- `GET/POST /checklist-templates`
- `PUT /checklist-templates/:id`
- `POST /checklist-templates/:id/archive`
- `GET /periods/:periodId/checklist-tasks`
- `POST /periods/:periodId/checklist/instantiate`
- `PATCH /checklist-tasks/:id`

### Calendar
- `GET/POST /periods/:periodId/calendar-events`
- `POST /periods/:periodId/calendar/generate`
- `PUT/DELETE /calendar-events/:id`

### Reopen requests
- `GET/POST /reopen-requests`
- `GET /reopen-requests/:id`
- `POST …/submit|approve|reject|cancel|close`

## Permissions

| Key | Use |
|-----|-----|
| `finance.period.view` | List templates / calendar / requests |
| `finance.period.manage` | Templates + calendar + instantiate |
| `finance.period.reopen_request` | Create / submit / cancel requests |
| `finance.period.reopen_approve` | Approve / reject / close requests (approve may reopen period) |
| `finance.period.reopen` | Direct emergency reopen (Period Locking) |

## Migration

`20260730200000_finance_period_close_calendar_reopen`

```bash
npx tsx scripts/prisma-cli.ts migrate deploy
npm run db:sync-permissions
```

## Frontend

- `/accounting/period-close/calendar` — live events (auto-generates when empty)
- `/accounting/period-close/reopen-requests` — submit / approve / reject
- `/accounting/period-close/setup` — task templates from API
- Demo mode unchanged

## Tests

```bash
npx vitest run tests/finance/finance-period-close-calendar-reopen.test.ts --no-file-parallelism
```

## Still deferred

- FX revaluation wizard
- Treasury FX / intercompany
- Bank hardening (distributed cron, CAMT.052/.054)
- Auto-reclose period when reopen window expires (status expires; period re-close is manual)
