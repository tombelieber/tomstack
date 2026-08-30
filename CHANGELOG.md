# tomstack-skills

## 0.2.0

### Minor Changes

- [#4](https://github.com/tombelieber/tomstack/pull/4) [`7783a93`](https://github.com/tombelieber/tomstack/commit/7783a931e2aa0977ded41bb960656e5be1fd5a9c) Thanks [@sing0629](https://github.com/sing0629)! - Add backward-compatible Impact-Aware QA receipt v2 evidence, executable receipt
  evaluation scenarios, and selected-versus-shadow timing summaries.

- [#6](https://github.com/tombelieber/tomstack/pull/6) [`b845265`](https://github.com/tombelieber/tomstack/commit/b845265d9625658c112ef3218e306e974fc1dde1) Thanks [@tombelieber](https://github.com/tombelieber)! - Reduce Auto Pilot to two achieved goal outcomes. `PR_READY` now proves the exact
  open candidate is fully production-release-ready and only the production action
  remains. `SHIPPED` now requires exact production proof plus applicable notes,
  cleanup, and zero scoped leftovers. Release, promote, and deploy normalize to
  ship. Incomplete attempts remain resumable in the invoking task; immutable
  admission binds one attempt and never seals the task, goal, or later turns.

## 0.1.1

### Patch Changes

- [`05179d7`](https://github.com/tombelieber/tomstack/commit/05179d70ce1cb07695afbdbca6d0401c9a127112) Thanks [@tombelieber](https://github.com/tombelieber)! - Align every promoted skill and maintainer install path with the shared Claude
  Code and Codex Agent Skills contracts, and document the canonical migration
  from standalone repositories.

## 0.1.0

- Establish the canonical bucketed skills monorepo.
- Aggregate seven maintained engineering and productivity skills.
- Add the managed Claude plugin and universal Agent Skills install path.
