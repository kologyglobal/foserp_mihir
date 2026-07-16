# UAT-04 — Activities & Follow-ups

**Date:** 2026-07-11
**Overall:** ✅ PASS (75/75)

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-04.1.1 | Structure | CRM routes register activities + follow-ups | PASS |  |
| UAT-04.1.2 | Structure | Pipeline page supports follow-ups + activities views | PASS |  |
| UAT-04.1.3 | Structure | Engagement panels export follow-ups + activities | PASS |  |
| UAT-04.1.4 | Structure | Quick follow-up drawer wired | PASS |  |
| UAT-04.1.5 | Structure | Log activity drawer wired | PASS |  |
| UAT-04.1.6 | Structure | Timeline components present | PASS |  |
| UAT-04.1.7 | Structure | Lead 360 references engagement | PASS |  |
| UAT-04.1.8 | Structure | Dashboard enriches follow-up status | PASS |  |
| UAT-04.1.9 | Structure | Follow-ups panel enriches status before filter | PASS |  |
| UAT-04.2.1 | Activity types | Frontend defines call + meeting activity types | PASS |  |
| UAT-04.2.2 | Activity types | Backend supports CALL, MEETING, TASK | PASS |  |
| UAT-04.2.3 | Activity types | Backend maps TASK to frontend task | PASS |  |
| UAT-04.2.4 | Activity types | Log activity fallback includes call + meeting | PASS |  |
| UAT-04.2.5 | Activity types | Quick follow-up fallback includes call + meeting | PASS |  |
| UAT-04.2.6 | Activity types | CRM masters seed call + meeting for activity + follow-up | PASS |  |
| UAT-04.2.7 | Activity types | Engagement utils distinguish manual activities vs follow-up types | PASS |  |
| UAT-04.2.8 | Activity types | Master data exposes call + meeting for logging | PASS |  |
| UAT-04.2.9 | Activity types | Master data exposes call + meeting for follow-ups | PASS |  |
| UAT-04.3.1 | API | Activity routes: list/create/update/complete/delete | PASS |  |
| UAT-04.3.2 | API | Follow-up routes: list/create/complete/reschedule/snooze | PASS |  |
| UAT-04.3.3 | API | Activity validation accepts leadId + opportunityId | PASS |  |
| UAT-04.3.4 | API | Follow-up validation accepts leadId + opportunityId | PASS |  |
| UAT-04.3.5 | API | deriveFollowUpStatus marks past-due as overdue | PASS |  |
| UAT-04.3.6 | API bridge | crmApiBridge hydrates activities + follow-ups | PASS |  |
| UAT-04.3.7 | API bridge | Bridge create/complete/reschedule follow-up | PASS |  |
| UAT-04.3.8 | API bridge | Bridge create/complete activity | PASS |  |
| UAT-04.3.9 | API client | updateActivityApi + updateFollowUpApi defined | PASS |  |
| UAT-04.4.1 | Create | Create call activity on lead | PASS |  |
| UAT-04.4.2 | Create | Create meeting activity on opportunity | PASS |  |
| UAT-04.4.3 | Create | Create task-like activity (note proxy in demo) | PASS | Backend TASK type available; demo uses note proxy |
| UAT-04.4.4 | Create | Create call follow-up on lead | PASS |  |
| UAT-04.4.5 | Create | Create meeting follow-up on opportunity | PASS |  |
| UAT-04.4.6 | Create | Follow-up on opportunity updates nextFollowUpDate | PASS |  |
| UAT-04.4.7 | Complete | Complete follow-up sets status completed | PASS |  |
| UAT-04.4.8 | Complete | Follow-up completion logs activity | PASS |  |
| UAT-04.4.9 | Complete | Complete activity stores outcome | PASS |  |
| UAT-04.4.10 | Reschedule | Reschedule follow-up updates due date/time | PASS |  |
| UAT-04.4.11 | Create | Activities count increased | PASS |  |
| UAT-04.4.12 | Create | Follow-ups count increased | PASS |  |
| UAT-04.5.1 | Overdue | enrichFollowUpStatus marks past-due pending as overdue | PASS |  |
| UAT-04.5.2 | Overdue | deriveFollowUpStatus logic matches frontend enrich | PASS | raw=pending |
| UAT-04.5.3 | Overdue | sortFollowUpsByUrgency prioritizes overdue | PASS | first=overdue |
| UAT-04.6.1 | Linkage | Activities linked to lead | PASS |  |
| UAT-04.6.2 | Linkage | Activities linked to opportunity | PASS |  |
| UAT-04.6.3 | Linkage | Follow-ups linked to lead | PASS |  |
| UAT-04.6.4 | Linkage | Follow-ups linked to opportunity | PASS |  |
| UAT-04.6.5 | Linkage | Store createFollowUp accepts leadId + opportunityId FKs | PASS |  |
| UAT-04.7.1 | Timeline | buildLeadEngagementTimeline merges activities + follow-ups | PASS |  |
| UAT-04.7.2 | Timeline | Timeline sorted newest first | PASS |  |
| UAT-04.7.3 | Timeline | leadEngagementSummary counts activities | PASS |  |
| UAT-04.7.4 | Timeline | Engagement panel uses ActivityTimeline | PASS |  |
| UAT-04.7.5 | Timeline | Sales activity report has rows | PASS |  |
| UAT-04.8.1 | Dashboard | Dashboard metrics include followUpsDueToday | PASS |  |
| UAT-04.8.2 | Dashboard | Dashboard metrics include recentActivities | PASS |  |
| UAT-04.8.3 | Dashboard | sortedFollowUps uses urgency sort | PASS |  |
| UAT-04.8.4 | Dashboard | Engagement panel exposes overdue counter | PASS |  |
| UAT-04.8.5 | Dashboard | Sidebar CRM badge counts open follow-ups | PASS |  |
| UAT-04.9.1 | Persistence | Created records remain in store after subsequent reads | PASS |  |
| UAT-04.9.2 | Persistence | CRM store uses zustand persist | PASS |  |
| UAT-04.9.3 | Orphans | No orphan activities/follow-ups in demo data | PASS | clean |
| UAT-04.9.4 | Persistence | UAT records survive JSON round-trip (refresh simulation) | PASS |  |
| UAT-04.10.1 | Edit | Backend PATCH route for activities | PASS |  |
| UAT-04.10.2 | Edit | Backend PATCH route for follow-ups | PASS |  |
| UAT-04.10.3 | Edit | Demo store completeActivity updates outcome (partial edit) | PASS |  |
| UAT-04.10.4 | Edit | Engagement panel reschedule acts as date edit | PASS |  |
| UAT-04.11.1 | Live API | Create call activity | PASS | Activity created |
| UAT-04.11.2 | Live API | Edit activity via PATCH | PASS | HTTP 200 |
| UAT-04.11.3 | Live API | Complete activity | PASS | HTTP 200 |
| UAT-04.11.4 | Live API | Create task activity type | PASS | HTTP 201 |
| UAT-04.11.5 | Live API | Create meeting follow-up | PASS | Follow-up created |
| UAT-04.11.6 | Live API | Reschedule follow-up | PASS | HTTP 200 |
| UAT-04.11.7 | Live API | Complete follow-up | PASS | HTTP 200 |
| UAT-04.11.8 | Live API | Dashboard metrics endpoint responds | PASS |  |
| UAT-04.11.9 | Live API | List activities | PASS | HTTP 200 |
| UAT-04.11.10 | Live API | List follow-ups | PASS | HTTP 200 |

## Manual sign-off checklist

- [ ] **Call** — Log call on lead 360; appears in timeline
- [ ] **Meeting** — Schedule meeting follow-up on opportunity; shows on pipeline Follow-ups tab
- [ ] **Task** — Create task activity (API mode) or note proxy (demo); verify in Activities list
- [ ] **Follow-up** — Quick follow-up from company/contact row; complete with outcome
- [ ] **Edit** — PATCH activity subject in API mode; reschedule follow-up in demo panel
- [ ] **Complete** — Mark follow-up done; verify `follow_up_completed` activity in timeline
- [ ] **Overdue** — Past-due follow-up shows red badge on dashboard + overdue tab
- [ ] **Lead linkage** — Lead 360 engagement panel shows linked activities/follow-ups
- [ ] **Opportunity linkage** — Opp 360 follow-up cards link to customer + opportunity
- [ ] **Timeline** — Grouped activity timeline on dashboard shows Today/Yesterday groups
- [ ] **Dashboard counters** — Due today / overdue KPIs match follow-up panel counts
- [ ] **Refresh** — Create activity, refresh browser — record persists (demo localStorage / API hydrate)
- [ ] **No orphans** — Navigate away and back; records still linked to valid lead/opp/customer

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`

## Gaps / notes

- Demo `CrmActivityType` has no `task` literal — backend TASK maps to `task`; demo uses `note` proxy in automated test.
- Demo store has no `updateActivity` / `updateFollowUp` — edit flows are API-only (PATCH routes exist).
- Follow-up panel applies `enrichFollowUpStatus` before filtering (aligned with dashboard).
- `/crm/activities` and `/crm/follow-ups` redirect to pipeline views (`?view=activities|follow-ups`).
- Full browser E2E (Playwright) not covered — use manual checklist above.
