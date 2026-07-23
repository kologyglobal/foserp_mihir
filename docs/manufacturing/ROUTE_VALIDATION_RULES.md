# Route validation rules

## Hard blockers

- Route name missing
- No operation lines
- Duplicate operation number (`sequence`)
- Work Centre missing on any operation
- Machine not belonging to selected Work Centre
- Inactive Work Centre
- QC Required = Yes without QC Test Group
- Invalid QC Test Group (not found in tenant)
- Circular dependency
- Version not DRAFT when validating for certify

## Warnings (non-blocking)

- Machine blank
- Machine `OUT_OF_SERVICE`
- Setup / run time zero
- No QC operation on the route

Certification re-runs authoritative backend validation; frontend alone cannot certify.
