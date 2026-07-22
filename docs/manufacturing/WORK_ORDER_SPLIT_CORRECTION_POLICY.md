# Work Order Split Correction Policy (Phase 5C)

Work Order **split is not shipped**. Merge remains deferred.

Until split exists, `WORK_ORDER_SPLIT` corrections return a hard blocker.

When split ships, reversal will be allowed only if the child has:

- no progress, issues, WIP, QC, Job Work, FG, assignments, or further splits

Otherwise: block and require controlled quantity/transfer actions — never merge history.
