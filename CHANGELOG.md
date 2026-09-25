# tomstack-skills

## 0.3.1

### Patch Changes

- [`b3ec9dd`](https://github.com/tombelieber/tomstack/commit/b3ec9ddda48494c7a08a46d94d2e9d1bb7e6b45a) Thanks [@tombelieber](https://github.com/tombelieber)! - Keep skill discovery descriptions concise and front-load the supported task and decision boundary. Preserve invocation policy and operating contracts.

## 0.3.0

### Minor Changes

- [`1a0fb9b`](https://github.com/tombelieber/tomstack/commit/1a0fb9bdcb6ba9945c16a0adfb9322506889658f) Thanks [@tombelieber](https://github.com/tombelieber)! - Make Auto Pilot self-contained guidance while preserving the same fully verified release-readiness bar for pr and ship. Remove mandatory receipt/configuration/routing bookkeeping from the active skill, retain legacy receipt compatibility outside skill discovery, and include Batch Grill Me for unresolved goal/spec decisions. The Codex marketplace selects standalone Auto Pilot v0.15.0.

## 0.2.4

### Patch Changes

- [#14](https://github.com/tombelieber/tomstack/pull/14) [`6415c8b`](https://github.com/tombelieber/tomstack/commit/6415c8bf47fd4bf150dc65af48e637322cf1e0ee) Thanks [@tombelieber](https://github.com/tombelieber)! - Require Auto Pilot release candidates to preserve existing production behavior,
  valid production data, and gate compatibility, while keeping released schema-v9
  receipts valid under frozen v9 semantics.

## 0.2.3

### Patch Changes

- [#12](https://github.com/tombelieber/tomstack/pull/12) [`51ee06a`](https://github.com/tombelieber/tomstack/commit/51ee06a8871201ff6e4e670f230e496b42c2025f) Thanks [@tombelieber](https://github.com/tombelieber)! - Require production migrations to prove that representative legacy data remains
  operable through the new system, not merely present after a successful job, and
  pin the standalone Auto Pilot distribution to v0.13.2.

## 0.2.2

### Patch Changes

- [#10](https://github.com/tombelieber/tomstack/pull/10) [`72e097b`](https://github.com/tombelieber/tomstack/commit/72e097bcbb234594dffd19ffc6e677803d1d0d8c) Thanks [@tombelieber](https://github.com/tombelieber)! - Align canonical Auto Pilot history metadata with the v0.13.1 marketplace
  distribution and fail the repository contract if these versions drift again.

## 0.2.1

### Patch Changes

- [#8](https://github.com/tombelieber/tomstack/pull/8) [`09c5eae`](https://github.com/tombelieber/tomstack/commit/09c5eaefaea229cede5f9fbc6fcd6543e5695ad9) Thanks [@tombelieber](https://github.com/tombelieber)! - Pin the Auto Pilot marketplace distribution to v0.13.1, which documents and
  proves the actual GitHub install path and supports npm 12 Git admission.

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
