-- Phase 15 — Compliance ops multi-period cockpit surface.
-- Tables `gst_compliance_notices` + `gst_compliance_audit_packs` created in Phase 13
-- (`20260805250000_gst_phase13_compliance_hardening`). Phase 14 owns GSTR-9/9C worksheets.
-- No new tables — avoids colliding CREATE on Phase 13 objects.
-- Phase 15 ships API/util for multi-period health roll-up + ops routes reusing Phase 13 engines.

SELECT 1;
