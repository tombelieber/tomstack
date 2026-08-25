---
name: impact-aware-qa
description: Select and run the smallest sufficient repository verification for a code, configuration, schema, documentation, or test change without losing correctness. Use when implementing or reviewing changes, choosing tests, validating before commit or push, reducing slow CI, deciding whether an untouched frontend or other detached surface needs checking, or preparing exact-candidate pre-merge evidence. Escalate unknown and safety-critical impact; never grant deployment authority.
---

# Impact-Aware QA

Prove the change, not the whole repository by habit. Reuse the repository's
existing commands and widen verification only when the actual impact or
promotion lane requires it.

Read [repo contract template](references/repo-contract-template.md) when
adopting this skill or when repository ownership is unclear. Read
[evidence model](references/evidence-and-receipt-model.md) before reusing old
results or issuing a machine-readable receipt.

The repository owns its classifier, dependency graph, commands, and QA runner.
Integrate this decision model through that existing owner; do not install a
second public QA skill or copy repository-specific path maps into this portable
skill.

## Select the proof

1. Read the applicable agent instructions, repository QA contract, package or
   task graph, CI configuration, and release boundaries.
2. Inspect the complete candidate change: committed range plus relevant staged,
   unstaged, renamed, deleted, and untracked files. Do not classify from the
   user's summary alone.
3. Mark each affected surface as active, detached/deprecated, shared, or
   unknown. Trace declared dependents and obvious runtime or data contracts.
4. Choose the cheapest repository-defined checks that can falsify the changed
   behavior. Prefer changed-file static checks, targeted typechecks, related
   unit tests, and narrow contract tests before broad suites.
5. Run the selected checks locally. Use the repository's affected gate when it
   exists; do not recreate its classifier in prose or ad hoc shell commands.
6. Report what passed, what was skipped and why, and what remains unproved.

When adopting or changing selection logic, run representative candidates in
shadow mode: execute both the selected proof and the established full relevant
proof, then measure misses and time saved. A pre-existing red baseline remains
red; classify it as known versus candidate-new, attach its reference, and do
not convert it into a passing outcome.

## Escalate without guessing

Widen to the repository's full relevant local gate when any of these apply:

- the path, dependency edge, generated artifact, or classifier result is
  unknown, stale, or contradictory;
- shared contracts, authentication, authorization, money, persisted data,
  migrations, release tooling, or cross-runtime boundaries changed;
- a required tool or test prerequisite is missing; or
- selected evidence fails outside a clearly isolated defect.

Fail closed means wider evidence or an honest blocked result. It never means
silently selecting zero checks.

## Keep detached surfaces detached

Do not validate a deprecated, read-only, experimental, or independently
maintained surface merely because another surface changed. Include it only when
the diff touches it, a declared dependency reaches it, or the repository's
promotion contract explicitly requires it. State the skip reason.

## Respect promotion lanes

- **Edit:** fastest relevant feedback for the working change.
- **Commit/push:** repository-defined staged or affected policy.
- **Pre-merge:** fresh proof for the exact prospective candidate; use the
  repository's complete relevant local gate when required.
- **GitHub CI:** independent clean-environment confirmation, preferably light
  when heavy local proof is the repository contract.
- **Release:** separate explicit authority. QA selection never authorizes a
  deploy, migration, publish, external message, or production mutation.

Do not run pre-merge, browser, database, production probes, or release harnesses
on every small edit unless the repository contract explicitly makes them the
minimum evidence for that change.

## Return an evidence summary

Use this compact shape:

```text
Impact: <classes and affected active surfaces>
Selected: <checks and reasons>
Skipped: <surfaces/checks and reasons>
Result: <passed, failed, or blocked>
Unproved: <production, detached surfaces, stale evidence, or none>
```

Bind reusable evidence to the candidate identity, relevant inputs, toolchain,
gate version, environment class, and time. A cache hit is computation reuse,
not automatically fresh qualification.
