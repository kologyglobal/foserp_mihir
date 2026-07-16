# CRM Follow-up Architecture Decision

**Date:** 2026-07-10

## Decision

Follow-ups are stored in a **dedicated `crm_follow_ups` table**, not as a filtered subset of `crm_activities`.

## Rationale

The frontend models follow-ups and activities as **distinct entities**:

| Aspect | Follow-up (`FollowUp`) | Activity (`CrmActivity`) |
|--------|------------------------|---------------------------|
| Purpose | Scheduled future action with due date/time | Logged engagement / history |
| Key fields | `dueDate`, `dueTime`, `status`, snooze/reschedule | `activityDate`, `type`, `outcome` |
| Lifecycle | pending → overdue → completed / snoozed / cancelled | planned → completed (audit trail) |
| UI | Follow-up panel, today/overdue/upcoming views | Activity timeline |
| Operations | Complete, reschedule, snooze, cancel, delete | Complete, delete (audit) |

Activities represent **what happened**. Follow-ups represent **what should happen next**. Merging them would:

- Complicate overdue/today/upcoming queries
- Blur audit history with open tasks
- Force activity types to stand in for scheduling semantics

When a follow-up is completed, the frontend may still log a `follow_up_completed` activity for timeline visibility — that remains an activity record, separate from the follow-up row.

## API

Tenant-scoped routes under `/api/v1/t/:tenantSlug/crm/follow-ups`:

- CRUD + `complete`, `reschedule`, `snooze`, `cancel`
- List filters: `view=today|overdue|upcoming|completed|mine|team`

## Permissions

- `crm.follow_up.view|create|update|delete`

## Frontend integration

- API mode: `crmStore` follow-up methods delegate to `crmApiBridge`
- Demo mode: existing localStorage behaviour unchanged
- `syncAllCrmFromApi()` loads follow-ups with other CRM slices
