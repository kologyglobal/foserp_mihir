# Full System Defect Log

**Date:** 2026-06-25

| Defect ID | Module | Screen | Test Case | Severity | Priority | Description | Expected | Actual | Root Cause | Fix Applied | Retest | Final Status |
|-----------|--------|--------|-----------|----------|----------|-------------|----------|--------|------------|-------------|--------|--------------|
| FSUAT-001 | Role Dashboards | /home | FSUAT-ROLE-001 | Medium | P2 | Role home missing NextActionPanel and erpAnalyticsService wiring | Role dashboard uses analytics + next actions | SaaSCommandDashboard only; EETA check failed | Role home delegated all sections to SaaSCommandDashboard without explicit hooks | Added useErpExecutiveAnalytics, NextActionPanel, SaaSActivityFeed; showNextActions prop on SaaSCommandDashboard | Pass | Fixed |
| FSUAT-002 | Executive Dashboard | /executive | FSUAT-EXEC-001 | Low | P3 | EETA CEO section check pointed at thin wrapper page | CEO sections validated on Dynamics executive dashboard | Test read ExecutiveDashboardPage only | Dashboard logic moved to DynamicsExecutiveDashboard component | Updated test:eeta-100 to validate DynamicsExecutiveDashboard + SaaSActivityFeed | Pass | Fixed |

**Open Critical:** 0 | **Open High:** 0 | **Open Medium:** 0 | **Open Low:** 0 | **Fixed:** 2
