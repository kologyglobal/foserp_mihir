# Phase 7C5 — Manual UAT Results

**Status:** Checklist prepared — **awaiting operator sign-off**.

Use scenarios A–H from the Phase 7C5 brief.

| Scenario | Result | Notes |
|----------|--------|-------|
| A Full Dispatch | PENDING | |
| B Gate validation | PARTIAL | Covered by automated 7C5 tests |
| C Partial Dispatch | PENDING | |
| D Duplicate post | PARTIAL | Idempotent re-post covered |
| E Full reversal | PARTIAL | Automated reverse covered |
| F Partial reversal | PARTIAL | Automated partial reverse + approval covered |
| G Downstream block | PASS (automated) | SI posted + COGS posted blockers; auto-invoice creation still N/A |
| H Emergency override | PASS (automated) | `emergency:true` + `dispatch.override`; FE drawer optional |

**Sign-off:** _not signed_
