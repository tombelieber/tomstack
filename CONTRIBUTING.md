# Contributing

Read `AGENTS.md` and `docs/SOURCES.md` before changing a skill. Reusable decision
logic belongs here; product repositories retain their runtime implementation,
classifiers, and compatibility snapshots.

For a promoted behavioral skill change:

1. Update the skill entrypoint and only the references or scripts the behavior
   needs.
2. Add observable tests for deterministic helpers. Prefer scenario outcomes
   over assertions that merely match documentation wording.
3. Add a Changeset and run `npm run check`.
4. Run `claude plugin validate . --strict` when the Claude CLI is available;
   report it as unavailable rather than silently skipping or installing a new
   global tool.

Keep existing invocation policy and public skill names stable unless the change
explicitly requires a migration. Never copy a repository-specific QA map into a
portable skill.
