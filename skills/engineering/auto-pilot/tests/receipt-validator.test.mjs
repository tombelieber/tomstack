import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'

import {
  attemptId, contractSha, goalId, incompleteReceipt, prReadyReceipt,
  shippedReceipt, validateReceipt,
} from './v9-fixture.mjs'

test('prints the current release-contract SHA-256', () => {
  assert.match(contractSha, /^[0-9a-f]{64}$/)
})

for (const [name, fixture] of [['PR_READY', prReadyReceipt], ['SHIPPED', shippedReceipt]]) {
  test(`accepts a complete ${name} receipt`, () => {
    assert.equal(validateReceipt(fixture()).status, 0)
  })
}

test('accepts an incomplete checkpoint without treating it as an achieved end state', () => {
  assert.equal(validateReceipt(incompleteReceipt()).status, 0)
})

for (const [name, mutate] of [
  ['legacy schema', value => { value.schema_version = 8 }],
  ['third goal mode', value => { value.goal_mode = 'release' }],
  ['legacy blocked outcome', value => { value.goal.achieved = 'blocked' }],
  ['legacy released outcome', value => { value.goal.achieved = 'released' }],
  ['lowercase PR outcome', value => { value.goal.achieved = 'pr_ready' }],
  ['target/outcome mismatch', value => { value.goal.target = 'SHIPPED' }],
  ['unknown TODO field', value => { value.todo = ['later'] }],
]) {
  test(`rejects ${name}`, () => {
    const value = prReadyReceipt()
    mutate(value)
    assert.equal(validateReceipt(value).status, 1)
  })
}

test('rejects achieved receipts with any blocker, TODO, or follow-up', () => {
  for (const kind of ['blocker', 'todo', 'follow_up']) {
    const value = shippedReceipt()
    value.open_items = [{id: 'OW-1', kind, phase: 'cleanup', category: 'cleanup', reason: 'Work remains.', evidence: 'Scoped item is unfinished.', next_safe_action: 'Finish it in this task.'}]
    assert.equal(validateReceipt(value).status, 1)
  }
})

test('rejects incomplete checkpoints with no concrete open item', () => {
  const value = incompleteReceipt()
  value.open_items = []
  assert.equal(validateReceipt(value).status, 1)
})

test('rejects post-mutation checkpoints without admitted-candidate reconciliation evidence', () => {
  const value = incompleteReceipt()
  value.open_items[0] = {
    id: 'OW-1', kind: 'blocker', phase: 'post_mutation', category: 'remote_state',
    reason: 'The release command timed out.', evidence: 'Remote state is unknown.',
    next_safe_action: 'Reconcile remote state before any retry.',
  }
  assert.equal(validateReceipt(value).status, 1)
})

for (const [name, mutate] of [
  ['missing exact candidate', value => { value.checks = value.checks.filter(item => item.name !== 'exact-candidate') }],
  ['stale required CI', value => { value.checks.find(item => item.name === 'exact-candidate').required_ci_status = 'failed' }],
  ['missing production path', value => { value.checks.find(item => item.name === 'production-release-ready').production_path_status = 'missing' }],
  ['unready credentials', value => { value.checks.find(item => item.name === 'production-release-ready').credentials_status = 'missing' }],
  ['pending migration decision', value => { value.checks.find(item => item.name === 'production-release-ready').migration_status = 'unknown' }],
]) {
  test(`rejects PR_READY with ${name}`, () => {
    const value = prReadyReceipt()
    mutate(value)
    assert.equal(validateReceipt(value).status, 1)
  })
}

test('rejects merge-only SHIPPED claims', () => {
  const value = shippedReceipt()
  value.release.status = 'not_run'
  value.release.message = null
  assert.equal(validateReceipt(value).status, 1)
})

test('requires every achieved criterion and check to pass', () => {
  const criterion = prReadyReceipt()
  criterion.criteria[0].status = 'not_applicable'
  assert.equal(validateReceipt(criterion).status, 1)

  const check = prReadyReceipt()
  check.checks[0].status = 'not_applicable'
  assert.equal(validateReceipt(check).status, 1)
})

test('requires a release artifact URL for SHIPPED', () => {
  const value = shippedReceipt()
  value.release.url = null
  assert.equal(validateReceipt(value).status, 1)
})

test('rejects SHIPPED without exact production reachability', () => {
  const value = shippedReceipt()
  delete value.capability_reachability
  assert.equal(validateReceipt(value).status, 1)
})

test('rejects production scope and proof-case mismatch', () => {
  const value = shippedReceipt()
  value.completion_scope.production_case_ids = ['another-case']
  assert.equal(validateReceipt(value).status, 1)
})

test('rejects hidden work fields inside nested evidence', () => {
  const value = shippedReceipt()
  value.checks[0].warnings = ['later']
  assert.equal(validateReceipt(value).status, 1)
})

test('rejects missing release artifact, unfinished notes, and unfinished cleanup', () => {
  const noArtifact = shippedReceipt()
  noArtifact.capability_reachability.cases[0].production.artifact_ref = null
  assert.equal(validateReceipt(noArtifact).status, 1)

  const notes = shippedReceipt()
  notes.release_notes.status = 'not_run'
  assert.equal(validateReceipt(notes).status, 1)

  const cleanup = shippedReceipt()
  cleanup.cleanup.status = 'failed'
  cleanup.cleanup.worktree = 'retained'
  cleanup.cleanup.local_branch = 'retained'
  cleanup.cleanup.remote_branch = 'retained'
  assert.equal(validateReceipt(cleanup).status, 1)
})

test('accepts policy-complete closeout without inventing follow-up work', () => {
  const value = shippedReceipt()
  value.completion_scope.release_notes = 'not_applicable'
  value.release_notes = {status: 'not_applicable', artifact_ref: null, evidence: 'This repository has no release-note channel.'}
  value.cleanup.remote_branch = 'retained_by_policy'
  value.cleanup.remote_branch_policy_ref = 'repository-policy:protected-release-branch'
  value.cleanup.evidence = 'Repository policy requires the protected remote branch to remain; no action is outstanding.'
  assert.equal(validateReceipt(value).status, 0)
})

test('rejects deferred work hidden inside successful notes or cleanup evidence', () => {
  const cleanup = shippedReceipt()
  cleanup.cleanup.remote_branch = 'retained_by_policy'
  cleanup.cleanup.remote_branch_policy_ref = 'repository-policy:protected-release-branch'
  cleanup.cleanup.evidence = 'TODO delete this branch later.'
  assert.equal(validateReceipt(cleanup).status, 1)

  const notes = shippedReceipt()
  notes.completion_scope.release_notes = 'not_applicable'
  notes.release_notes = {status: 'not_applicable', artifact_ref: null, evidence: 'TODO publish release notes later.'}
  assert.equal(validateReceipt(notes).status, 1)
})

test('PR_READY source promotion must bind the exact candidate and PR', () => {
  const root = mkdtempSync(join(tmpdir(), 'auto-pilot-source-receipt-'))
  const path = join(root, 'pr-ready.json')
  const attach = (ship, source) => {
    const bytes = JSON.stringify(source)
    writeFileSync(path, bytes)
    ship.promotion.source = 'pr_ready_receipt'
    ship.promotion.source_receipt = path
    ship.checks.find(item => item.name === 'release-contract-binding').source_receipt_sha256 = createHash('sha256').update(bytes).digest('hex')
  }
  try {
    const matching = shippedReceipt()
    const source = prReadyReceipt({goal: 'apg_sourcegoal123456'})
    attach(matching, source)
    assert.equal(validateReceipt(matching).status, 0)

    const unrelated = shippedReceipt()
    const other = prReadyReceipt({goal: 'apg_othergoal1234567'})
    const otherBase = 'd'.repeat(40)
    const otherHead = 'e'.repeat(40)
    other.git.commits = [otherHead]
    other.checks.find(item => item.name === 'exact-candidate').candidate_base_sha = otherBase
    other.checks.find(item => item.name === 'exact-candidate').candidate_head_sha = otherHead
    other.checks.find(item => item.name === 'exact-candidate').pull_request_url = 'https://github.com/other/repo/pull/99'
    other.pull_request.url = 'https://github.com/other/repo/pull/99'
    attach(unrelated, other)
    assert.equal(validateReceipt(unrelated).status, 1)
  } finally {
    rmSync(root, {recursive: true, force: true})
  }
})

test('requires release-note completion to match the scoped policy', () => {
  const value = shippedReceipt()
  value.release_notes = {status: 'not_applicable', artifact_ref: null, evidence: 'Claimed not applicable.'}
  assert.equal(validateReceipt(value).status, 1)
})

test('accepts production-live cleanup failure only as an incomplete resumable attempt', () => {
  const value = shippedReceipt()
  value.goal.achieved = null
  value.attempt.result = 'incomplete'
  value.cleanup = {status: 'failed', worktree: 'retained', local_branch: 'retained', remote_branch: 'retained', evidence: 'Production is live; closeout failed.'}
  value.open_items = [{id: 'OW-1', kind: 'failure', phase: 'cleanup', category: 'cleanup', reason: 'Cleanup remains.', evidence: 'Closeout command failed.', next_safe_action: 'Repair cleanup in this same task.'}]
  value.checks.push({name: 'remote-state-reconciliation', status: 'passed', artifact_ref: 'reconcile:cleanup-state', evidence: 'Remote state was read back after production mutation.'})
  assert.equal(validateReceipt(value).status, 0)
})

test('binds immutable admission to one goal attempt, not the task', () => {
  const wrongGoal = shippedReceipt()
  wrongGoal.checks.find(item => item.name === 'release-contract-binding').goal_id = `${goalId}_other`
  assert.equal(validateReceipt(wrongGoal).status, 1)

  const wrongAttempt = shippedReceipt()
  wrongAttempt.checks.find(item => item.name === 'release-contract-binding').attempt_id = `${attemptId}_other`
  assert.equal(validateReceipt(wrongAttempt).status, 1)
})

test('requires structural lineage fields before history resolves the real prior receipt', () => {
  const value = shippedReceipt()
  value.attempt = {id: 'apa_fedcba0987654321', result: 'achieved', basis: 'repair', previous_receipt_sha256: 'd'.repeat(64), change_artifact_ref: 'cleanup:repair-2', change_evidence: 'The same task repaired closeout and reconciled production state.'}
  value.checks.find(item => item.name === 'release-contract-binding').attempt_id = value.attempt.id
  assert.equal(validateReceipt(value).status, 0)
  value.attempt.previous_receipt_sha256 = null
  assert.equal(validateReceipt(value).status, 1)
})
