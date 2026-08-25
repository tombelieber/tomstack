# Repository QA contract template

Use this template when a repository does not already document equivalent facts.
Keep exact commands and ownership in the repository, not in the portable skill.
Delete sections that do not apply.

## Repository truth

- Default base branch:
- Package/task graph source:
- Complete diff command or affected classifier:
- Local evidence directory:
- Release owner workflow:

## Surface status

| Surface | Status | Owners or dependents | Notes |
|---|---|---|---|
| Backend/API | active | | |
| Database | active | | |
| Web/frontend | active, detached, or deprecated | | |
| Mobile/desktop | active, detached, or deprecated | | |
| Shared contracts | active/shared | | |
| Documentation | active | | |

Status rules:

- `active`: select evidence when touched or reached by a dependency.
- `detached`: maintained independently; do not select for unrelated changes.
- `deprecated`: not maintained by default; select only when touched, reached by
  a declared dependency, or explicitly requested.
- `shared`: changes may affect several active surfaces and normally escalate.

## Change-to-evidence map

| Change class | Minimum local evidence | Escalation condition |
|---|---|---|
| Docs-only | | Unknown generated or policy impact |
| Isolated backend | | Shared/auth/data boundary reached |
| Isolated frontend | | Shared contract or runtime boundary reached |
| Test-only | | Test helper or shared fixture changed |
| Shared contract | | Full relevant consumer proof |
| Migration/schema | | Compatibility or replay evidence missing |
| Lockfile/toolchain | | Dependency graph cannot be resolved |
| Unknown path | Full relevant gate | Always fail closed |

Commands must name existing repository scripts. Do not create a second runner
when an affected command already owns selection.

## Promotion lanes

| Lane | Command | Trigger | Freshness requirement |
|---|---|---|---|
| Edit | | Working change | Current diff |
| Commit | | Staged change | Current index |
| Affected/push | | Candidate range | Current base and head |
| Pre-merge | | Ready candidate | Exact prospective merge |
| CI lite | | Pull request | Clean environment |
| Release | | Explicit authorization only | Exact release candidate |

## Critical escalation boundaries

List repository-specific paths and semantics for:

- authentication and authorization;
- payments, billing, balances, or quotas;
- migrations and persisted production data;
- public API or generated contracts;
- shared runtime, build, and release configuration;
- secrets, permissions, and supply-chain inputs.

Unknown impact at one of these boundaries cannot pass on an AI confidence claim.

## Evidence and reuse

- Candidate identity fields:
- Dependency/config hashes:
- Toolchain and environment class:
- Gate version:
- Receipt location and retention:
- When cache may be reused:
- Which promotion lane must run fresh:

## Shadow adoption

Before trusting selection to skip an established check:

1. Define representative change scenarios and expected minimum evidence.
2. Run selected checks and the established full local proof on the same
   candidates.
3. Record misses, false escalation, wall time, and flaky ownership.
4. Promote selection only after there are no unexplained false negatives.
5. Keep periodic or sampled shadow runs and fail closed when the contract drifts.

Include at least docs-only, isolated leaf, graph-gap fallback, shared contract,
dynamic/native discovery, authentication or persisted-data boundary,
cross-runtime consumer, unknown path, and pre-existing red-baseline scenarios.
Store expected selection in the repository's executable harness rather than in
agent prose. Summarize v2 receipts to compare selected and full wall time; do not
claim savings from scenarios that did not run a comparable full proof.
