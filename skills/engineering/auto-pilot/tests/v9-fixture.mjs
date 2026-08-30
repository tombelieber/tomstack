import {execFileSync, spawnSync} from 'node:child_process'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

export const validator = resolve(fileURLToPath(new URL('../scripts/validate_receipt.py', import.meta.url)))
export const contractSha = execFileSync('python3', [validator, '--contract-sha256'], {encoding: 'utf8'}).trim()
export const headSha = 'a'.repeat(40)
export const baseSha = 'b'.repeat(40)
export const mergeSha = 'c'.repeat(40)
export const goalId = 'apg_1234567890abcdef'
export const attemptId = 'apa_1234567890abcdef'
export const releaseMessage = '### Release\n\n**v1** — Shipped\n\n- Production verification passed.'

export function prReadyReceipt({goal = goalId, attempt = attemptId} = {}) {
  return {
    schema_version: 9, goal_mode: 'pr', invoked_alias: null,
    goal: {id: goal, target: 'PR_READY', achieved: 'PR_READY'},
    attempt: {id: attempt, result: 'achieved', basis: 'initial', previous_receipt_sha256: null, change_artifact_ref: null, change_evidence: 'Initial bounded attempt.'},
    completion_scope: {criteria_ids: ['AC-1'], production_case_ids: [], release_notes: 'required', artifact_ref: 'impact-scope:test', evidence: 'All scoped work is enumerated and complete.'},
    open_items: [],
    plan: {source: 'docs/plan.md', approved: true},
    summary: 'The exact open candidate is ready for production release.',
    git: {base_branch: 'main', delivery_branch: 'feature/test', commits: [headSha]},
    criteria: [{id: 'AC-1', status: 'passed', evidence: 'Acceptance path passed.'}],
    checks: [
      {name: 'exact-candidate', status: 'passed', candidate_base_sha: baseSha, candidate_head_sha: headSha, pull_request_url: 'https://github.com/owner/repo/pull/1', promotable: true, required_ci_status: 'passed', evidence: 'Live exact candidate passed.'},
      {name: 'production-release-ready', status: 'passed', production_path_status: 'verified', preflight_status: 'passed', credentials_status: 'ready', configuration_status: 'ready', migration_status: 'not_applicable', recovery_status: 'ready', next_action: 'production_release', evidence: 'Only protected merge and production action remain.'},
    ],
    pull_request: {url: 'https://github.com/owner/repo/pull/1', status: 'open', merged: false, merge_sha: null},
    release: {status: 'not_requested', url: null, message: null, evidence: 'Production action intentionally remains.'},
  }
}

export function shippedReceipt(options = {}) {
  const value = prReadyReceipt(options)
  value.goal_mode = 'ship'
  value.goal.target = 'SHIPPED'
  value.goal.achieved = 'SHIPPED'
  value.completion_scope.production_case_ids = ['reply-comment']
  value.pull_request = {url: 'https://github.com/owner/repo/pull/1', status: 'merged', merged: true, merge_sha: mergeSha}
  value.promotion = {source: 'live_candidate', source_receipt: null, candidate_base_sha: baseSha, candidate_head_sha: headSha, authority_evidence: 'Explicit current invocation: $auto-pilot ship docs/plan.md'}
  value.checks.push({name: 'release-contract-binding', status: 'passed', contract_sha256: contractSha, goal_id: value.goal.id, attempt_id: value.attempt.id, candidate_base_sha: baseSha, candidate_head_sha: headSha, pull_request_url: 'https://github.com/owner/repo/pull/1', source_receipt_sha256: null, single_use: true, evidence: 'Immutable only for this attempt.'})
  value.release = {status: 'passed', url: 'https://github.com/owner/repo/releases/tag/v1', message: releaseMessage, evidence: 'Deployed artifact reached production.'}
  value.release_notes = {status: 'passed', artifact_ref: 'https://github.com/owner/repo/releases/tag/v1', evidence: 'Published.'}
  value.cleanup = {status: 'passed', worktree: 'removed', local_branch: 'deleted', remote_branch: 'deleted', evidence: 'All scoped closeout is complete.'}
  value.capability_reachability = {
    deployed_candidate_sha: mergeSha, scope_evidence: 'Impact selected the changed capability.',
    cases: [{
      id: 'reply-comment', actor: 'authenticated caller', credential_class: 'scoped token', resource_scope: 'dedicated production canary', entrypoint: 'public reply endpoint', runtime_principal: 'production runtime role', representative_data_case: 'legacy-shaped valid target', expected_terminal_outcome: 'provider reply identifier observed', observed_terminal_outcome: 'provider reply identifier observed',
      deterministic: {status: 'passed', artifact_ref: 'test:e2e', evidence: 'Deterministic E2E passed.'},
      production: {status: 'passed', artifact_ref: 'prod:canary-1', evidence: 'Production canary passed.'},
      authorization_changed: false,
    }],
  }
  return value
}

export function incompleteReceipt(goalMode = 'ship') {
  const value = {
    schema_version: 9, goal_mode: goalMode, invoked_alias: goalMode === 'ship' ? 'deploy' : null,
    goal: {id: goalId, target: goalMode === 'ship' ? 'SHIPPED' : 'PR_READY', achieved: null},
    attempt: {id: attemptId, result: 'incomplete', basis: 'initial', previous_receipt_sha256: null, change_artifact_ref: null, change_evidence: 'Initial attempt reached a genuine external blocker.'},
    completion_scope: {criteria_ids: ['AC-1'], production_case_ids: [], release_notes: 'required', artifact_ref: 'impact-scope:test', evidence: 'Exact scope inventory.'},
    open_items: [{id: 'OW-1', kind: 'blocker', phase: 'pre_mutation', category: 'credential', reason: 'Credential is unavailable.', evidence: 'Preflight failed before mutation.', next_safe_action: 'Resume this task when the credential is available.'}],
    plan: {source: 'docs/plan.md', approved: true},
    summary: 'The goal remains active and resumable in this task.',
  }
  return value
}

export function validateReceipt(value) {
  const root = mkdtempSync(join(tmpdir(), 'auto-pilot-v9-fixture-'))
  const path = join(root, 'receipt.json')
  try {
    writeFileSync(path, JSON.stringify(value))
    return spawnSync('python3', [validator, path], {encoding: 'utf8'})
  } finally {
    rmSync(root, {recursive: true, force: true})
  }
}
