# Quality Decision Correction Policy (Phase 5C)

Quality decisions are **immutable**.

Do **not** change PASS → REJECT in place.

Allowed approach:

1. Correction request (`QUALITY_DECISION` / `SUPERSEDE_DECISION`)
2. Approval when required
3. Superseding inspection/decision created in the **Quality** module
4. Original remains visible; new decision becomes current

If downstream WIP/FG already moved: reverse those first, then supersede.

Manufacturing Phase 5C does not implement a second Quality engine.
