# Route versioning

1. Certified V1 cannot be edited.
2. **Create New Version** copies operations, work centres, machines, times, and QC flags into V2 DRAFT.
3. `revisionNotes` (revision reason) is required.
4. V1 stays ACTIVE until V2 is certified (then V1 → SUPERSEDED).
5. Released work orders keep their routing snapshot; they never follow V2 automatically.
6. Manufacturing Profiles keep `defaultRoutingVersionId` until an engineer points them at the new certified version.
