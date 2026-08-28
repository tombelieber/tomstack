import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

const validator = resolve(fileURLToPath(new URL('../scripts/validate_receipt.py', import.meta.url)))
const contractSha = execFileSync('python3', [validator, '--contract-sha256'], {encoding: 'utf8'}).trim()
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const mergeSha = 'c'.repeat(40)
const notesUrl = 'https://github.com/owner/repo/releases/tag/v1'
const releaseMessage = `### Release

**v1** — Released

- User-visible change: Replies now reach the intended provider target.
- Verification: A production canary returned the provider reply identifier.
- Distribution: GitHub Release complete.
- Release notes: [v1](${notesUrl})`

function receipt(state = 'pr_ready') {
  const released = state === 'released'
  const merged = state === 'merged_main' || released
  const value = {
    schema_version: 7,
    mode: merged ? 'release' : 'pr',
    terminal_state: state,
    plan: {source: 'docs/plan.md', approved: true},
    summary: 'Implemented and verified the approved plan.',
    git: {base_branch: 'main', delivery_branch: 'feature/test', commits: [headSha]},
    criteria: [{id: 'AC-1', status: 'passed', evidence: 'The exact acceptance path reached its expected terminal state'}],
    checks: [{name: released ? 'post-release E2E' : 'test', status: 'passed', evidence: 'Exact candidate command and bounded artifact reference'}],
    pull_request: {url: 'https://github.com/owner/repo/pull/1', status: merged ? 'merged' : 'open', merged, merge_sha: merged ? mergeSha : null},
    release: released
      ? {status: 'passed', url: notesUrl, notes_url: notesUrl, message: releaseMessage, evidence: 'Production deployment and post-release E2E passed'}
      : merged
        ? {status: 'no_mechanism', url: null, notes_url: null, message: null, evidence: 'Repository has no deployment mechanism'}
        : {status: 'not_requested', url: null, notes_url: null, message: null, evidence: 'PR stage; production was not changed'},
    blockers: [],
  }
  if (merged) {
    value.promotion = {
      source: 'pr_ready_receipt',
      source_receipt: '__SOURCE_RECEIPT__',
      candidate_base_sha: baseSha,
      candidate_head_sha: headSha,
      authority_evidence: 'Explicit current invocation: $auto-pilot release PR #1',
    }
    value.checks.push({
      name: 'release-contract-binding',
      status: 'passed',
      contract_sha256: contractSha,
      source_receipt_sha256: '__SOURCE_SHA__',
      candidate_head_sha: headSha,
      single_use: true,
      evidence: 'Recomputed before mutation from the installed contract and exact source receipt',
    })
    value.checks.push({
      name: 'release-control-budget',
      status: 'passed',
      budget_seconds: 600,
      live_pr_bound_at: '2026-08-28T09:00:00+08:00',
      ended_at: '2026-08-28T09:08:30+08:00',
      end_kind: 'terminal',
      elapsed_seconds: 510,
      outcome: 'passed',
      evidence: 'Measured from live PR binding through the complete release task',
    })
    value.cleanup = {
      status: 'passed',
      worktree: 'removed',
      local_branch: 'deleted',
      remote_branch: 'deleted',
      evidence: 'Clean merged task worktree removed; metadata pruned; branches absent',
    }
  }
  if (released) {
    value.capability_reachability = {
      deployed_candidate_sha: mergeSha,
      scope_evidence: 'Repository release impact selected only the changed reply capability.',
      cases: [{
        id: 'reply-comment',
        actor: 'authenticated external caller',
        credential_class: 'personal access token',
        resource_scope: 'runtime-supplied canary workspace and connected account',
        entrypoint: 'public reply apply endpoint',
        runtime_principal: 'production edge runtime database role',
        representative_data_case: 'legacy blank author identity and valid provider reply target',
        expected_terminal_outcome: 'provider reply identifier observed',
        deterministic: {status: 'passed', evidence: 'Isolated API-to-worker-to-fake-provider E2E passed'},
        production: {status: 'passed', evidence: 'Bounded canary reached the terminal provider reply'},
        authorization_changed: true,
        authorized: {status: 'passed', decision: 'allowed', effective_binding_count: 1, evidence: 'Scoped runtime credential was allowed'},
        unauthorized: {status: 'passed', decision: 'denied', effective_binding_count: 0, evidence: 'Out-of-scope credential was denied'},
      }],
    }
  }
  return value
}

function run(value, sourceValue = receipt()) {
  const directory = mkdtempSync(join(tmpdir(), 'receipt-validator-'))
  const file = join(directory, 'receipt.json')
  try {
    if (value.promotion?.source_receipt === '__SOURCE_RECEIPT__') {
      const sourceReceipt = join(directory, 'pr-ready-receipt.json')
      const sourceBytes = JSON.stringify(sourceValue)
      writeFileSync(sourceReceipt, sourceBytes)
      value.promotion.source_receipt = sourceReceipt
      const sourceSha = createHash('sha256').update(sourceBytes).digest('hex')
      const binding = value.checks?.find(check => check.name === 'release-contract-binding')
      if (binding?.source_receipt_sha256 === '__SOURCE_SHA__') binding.source_receipt_sha256 = sourceSha
    }
    writeFileSync(file, JSON.stringify(value))
    return {status: 0, output: execFileSync('python3', [validator, file], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})}
  } catch (error) {
    return {status: error.status, output: `${error.stdout}${error.stderr}`}
  } finally {
    rmSync(directory, {recursive: true, force: true})
  }
}

test('prints the current release-contract SHA-256', () => {
  assert.match(contractSha, /^[0-9a-f]{64}$/)
})

for (const state of ['pr_ready', 'merged_main', 'released']) {
  test(`accepts a valid ${state} receipt without orchestration metadata`, () => {
    const value = receipt(state)
    assert.equal('orchestration' in value, false)
    assert.equal('reviews' in value, false)
    assert.equal(run(value).status, 0)
  })
}

test('accepts a minimal blocked receipt', () => {
  const value = receipt()
  value.terminal_state = 'blocked'
  value.blockers = [{reason: 'credential missing', evidence: 'CLI output'}]
  delete value.git
  delete value.criteria
  delete value.checks
  delete value.pull_request
  delete value.release
  assert.equal(run(value).status, 0)
})

for (const [name, mutate] of [
  ['legacy schema', (value) => { value.schema_version = 3 }],
  ['missing summary', (value) => { value.summary = '' }],
  ['null commit', (value) => { value.git.commits = [null] }],
  ['failed criterion', (value) => { value.criteria[0].status = 'failed' }],
  ['no passed check', (value) => { value.checks[0].status = 'not_applicable' }],
  ['bad PR URL', (value) => { value.pull_request.url = 'github.com/owner/repo' }],
]) {
  test(`rejects ${name}`, () => {
    const value = receipt()
    mutate(value)
    assert.equal(run(value).status, 1)
  })
}

test('rejects production mutation in PR mode receipt', () => {
  const value = receipt()
  value.pull_request = {url: 'https://github.com/owner/repo/pull/1', status: 'merged', merged: true, merge_sha: mergeSha}
  assert.equal(run(value).status, 1)
})

test('rejects release without fresh promotion evidence', () => {
  const value = receipt('released')
  delete value.promotion
  assert.equal(run(value).status, 1)
})

test('rejects successful release sourced only from the live PR', () => {
  const value = receipt('released')
  value.promotion.source = 'live_pr'
  value.promotion.source_receipt = null
  value.checks.find(check => check.name === 'release-contract-binding').source_receipt_sha256 = null
  assert.equal(run(value).status, 1)
})

test('rejects release without the current contract binding', () => {
  const value = receipt('released')
  value.checks = value.checks.filter(check => check.name !== 'release-contract-binding')
  assert.equal(run(value).status, 1)
})

test('rejects a stale installed release-contract fingerprint', () => {
  const value = receipt('released')
  value.checks.find(check => check.name === 'release-contract-binding').contract_sha256 = 'd'.repeat(64)
  assert.equal(run(value).status, 1)
})

test('rejects a source receipt digest mismatch', () => {
  const value = receipt('released')
  value.checks.find(check => check.name === 'release-contract-binding').source_receipt_sha256 = 'd'.repeat(64)
  assert.equal(run(value).status, 1)
})

test('rejects a relative source receipt path', () => {
  const value = receipt('released')
  value.promotion.source_receipt = 'pr-ready-receipt.json'
  value.checks.find(check => check.name === 'release-contract-binding').source_receipt_sha256 = 'd'.repeat(64)
  assert.equal(run(value).status, 1)
})

test('rejects a source receipt that does not itself validate', () => {
  const value = receipt('released')
  const sourceValue = receipt()
  sourceValue.plan.approved = false
  assert.equal(run(value, sourceValue).status, 1)
})

test('rejects a contract binding for another candidate', () => {
  const value = receipt('released')
  value.checks.find(check => check.name === 'release-contract-binding').candidate_head_sha = 'd'.repeat(40)
  assert.equal(run(value).status, 1)
})

test('rejects a successful release that exceeds its whole-task budget', () => {
  const value = receipt('released')
  const budget = value.checks.find(check => check.name === 'release-control-budget')
  budget.status = 'failed'
  budget.ended_at = '2026-08-28T09:11:00+08:00'
  budget.elapsed_seconds = 660
  budget.outcome = 'exhausted'
  assert.equal(run(value).status, 1)
})

test('accepts an exhausted budget only as a blocked release result', () => {
  const value = receipt('released')
  value.terminal_state = 'blocked'
  value.blockers = [{reason: 'release-control budget exhausted', evidence: 'Reached the repository-defined safe boundary'}]
  const budget = value.checks.find(check => check.name === 'release-control-budget')
  budget.status = 'failed'
  budget.ended_at = '2026-08-28T09:11:00+08:00'
  budget.end_kind = 'safe_boundary'
  budget.elapsed_seconds = 660
  budget.outcome = 'exhausted'
  assert.equal(run(value).status, 0)
})

test('rejects merged completion without automatic worktree cleanup evidence', () => {
  const value = receipt('merged_main')
  delete value.cleanup
  assert.equal(run(value).status, 1)
})

test('rejects released completion with a retained worktree', () => {
  const value = receipt('released')
  value.cleanup.worktree = 'retained'
  assert.equal(run(value).status, 1)
})

test('rejects cleanup evidence in PR mode', () => {
  const value = receipt()
  value.cleanup = receipt('released').cleanup
  assert.equal(run(value).status, 1)
})

test('rejects promotion evidence in PR mode', () => {
  const value = receipt()
  value.promotion = receipt('released').promotion
  assert.equal(run(value).status, 1)
})

test('rejects release candidate not bound to commits', () => {
  const value = receipt('released')
  value.promotion.candidate_head_sha = 'd'.repeat(40)
  assert.equal(run(value).status, 1)
})

test('rejects released state without release URL', () => {
  const value = receipt('released')
  value.release.url = null
  assert.equal(run(value).status, 1)
})

test('rejects released state without canonical release notes', () => {
  const value = receipt('released')
  value.release.notes_url = null
  assert.equal(run(value).status, 1)
})

test('rejects a final release message that does not link canonical notes', () => {
  const value = receipt('released')
  value.release.message = '### Release\n\nReleased without a link.'
  assert.equal(run(value).status, 1)
})

test('rejects a release URL passed off as the final release message', () => {
  const value = receipt('released')
  value.release.message = notesUrl
  assert.equal(run(value).status, 1)
})

test('rejects released state without exact capability reachability', () => {
  const value = receipt('released')
  delete value.capability_reachability
  assert.equal(run(value).status, 1)
})

test('rejects a release proved only by a deterministic fixture', () => {
  const value = receipt('released')
  value.capability_reachability.cases[0].production.status = 'not_run'
  assert.equal(run(value).status, 1)
})

test('rejects an authorized proof with zero effective scope bindings', () => {
  const value = receipt('released')
  value.capability_reachability.cases[0].authorized.effective_binding_count = 0
  assert.equal(run(value).status, 1)
})

test('rejects reachability recorded for a different deployed commit', () => {
  const value = receipt('released')
  value.capability_reachability.deployed_candidate_sha = 'd'.repeat(40)
  assert.equal(run(value).status, 1)
})

test('rejects reachability without the observed runtime principal', () => {
  const value = receipt('released')
  value.capability_reachability.cases[0].runtime_principal = ''
  assert.equal(run(value).status, 1)
})

test('validates included delivery evidence on blocked receipts', () => {
  const value = receipt()
  value.terminal_state = 'blocked'
  value.blockers = [{reason: 'CI unavailable', evidence: 'Provider status'}]
  value.pull_request.url = 'invalid'
  assert.equal(run(value).status, 1)
})
