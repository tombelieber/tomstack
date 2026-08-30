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
  const merged = released
  const value = {
    schema_version: 8,
    mode: merged ? 'release' : 'pr',
    terminal_state: state,
    plan: {source: 'docs/plan.md', approved: true},
    summary: 'Implemented and verified the approved plan.',
    git: {base_branch: 'main', delivery_branch: 'feature/test', commits: [headSha]},
    criteria: [{id: 'AC-1', status: 'passed', evidence: 'The exact acceptance path reached its expected terminal state'}],
    checks: [{
      name: 'exact-candidate',
      status: 'passed',
      candidate_base_sha: baseSha,
      candidate_head_sha: headSha,
      pull_request_url: 'https://github.com/owner/repo/pull/1',
      promotable: true,
      required_ci_status: 'passed',
      evidence: 'Exact live head and base passed the repository admission gate.',
    }],
    pull_request: {url: 'https://github.com/owner/repo/pull/1', status: merged ? 'merged' : 'open', merged, merge_sha: merged ? mergeSha : null},
    release: released
      ? {status: 'passed', url: notesUrl, notes_url: notesUrl, message: releaseMessage, evidence: 'Production deployment and post-release E2E passed'}
      : {status: 'not_requested', url: null, notes_url: null, message: null, evidence: 'PR stage; production was not changed'},
    blockers: [],
  }
  if (released) {
    value.checks.push({
      name: 'post-release E2E', status: 'passed',
      evidence: 'Production canary reached its terminal capability outcome.',
    })
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
      candidate_base_sha: baseSha,
      candidate_head_sha: headSha,
      pull_request_url: 'https://github.com/owner/repo/pull/1',
      single_use: true,
      evidence: 'Recomputed before mutation from the installed contract and exact source receipt',
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
        observed_terminal_outcome: 'provider reply identifier observed',
        deterministic: {status: 'passed', artifact_ref: 'test:provider-e2e#reply-comment', evidence: 'Isolated API-to-worker-to-fake-provider E2E passed'},
        production: {status: 'passed', artifact_ref: 'probe:production/reply-comment/run-123', evidence: 'Bounded canary reached the terminal provider reply'},
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

for (const state of ['pr_ready', 'released']) {
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
  value.blockers = [{phase: 'pre_mutation', category: 'credential', reason: 'credential missing', evidence: 'CLI output'}]
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

test('rejects exact-candidate evidence without the bound base and promotability', () => {
  const value = receipt()
  const exact = value.checks.find(check => check.name === 'exact-candidate')
  delete exact.candidate_base_sha
  delete exact.promotable
  assert.equal(run(value).status, 1)
})

test('rejects a release binding for another candidate base', () => {
  const value = receipt('released')
  value.checks.find(check => check.name === 'release-contract-binding').candidate_base_sha = 'd'.repeat(40)
  assert.equal(run(value).status, 1)
})

test('accepts a long-running release without a wall-clock budget check', () => {
  const value = receipt('released')
  assert.equal(run(value).status, 0)
})

test('rejects merge-only completion as a release result', () => {
  const value = receipt('released')
  value.terminal_state = 'merged_main'
  assert.equal(run(value).status, 1)
})

test('rejects a blocked result when production is already proven live', () => {
  const value = receipt('released')
  value.terminal_state = 'blocked'
  value.cleanup.status = 'failed'
  value.cleanup.worktree = 'retained'
  value.cleanup.local_branch = 'retained'
  value.cleanup.remote_branch = 'retained'
  value.blockers = [{
    phase: 'post_mutation', category: 'other',
    reason: 'local cleanup failed', evidence: 'Production proof passed before local closeout.',
  }]
  assert.equal(run(value).status, 1)
})

test('rejects a post-merge blocker without admission binding', () => {
  const value = receipt('released')
  value.terminal_state = 'blocked'
  value.blockers = [{
    phase: 'post_mutation', category: 'provider',
    reason: 'production rollout failed', evidence: 'The deploy owner returned a terminal failure.',
  }]
  value.release = {status: 'failed', url: null, notes_url: null, message: null, evidence: 'Production rollout failed.'}
  delete value.promotion
  delete value.checks
  delete value.cleanup
  delete value.capability_reachability
  assert.equal(run(value).status, 1)
})

test('rejects incoherent merged PR evidence without a merge SHA', () => {
  const value = receipt('released')
  value.terminal_state = 'blocked'
  value.blockers = [{
    phase: 'post_mutation', category: 'remote_state',
    reason: 'merge identity unavailable', evidence: 'The PR reports merged but no merge SHA.',
  }]
  value.pull_request.merge_sha = null
  assert.equal(run(value).status, 1)
})

test('accepts a proven live release with retained local cleanup', () => {
  const value = receipt('released')
  value.cleanup.status = 'failed'
  value.cleanup.worktree = 'retained'
  value.cleanup.local_branch = 'retained'
  value.cleanup.remote_branch = 'retained'
  value.cleanup.evidence = 'Production is proven live; local closeout was retained for a separate safe cleanup.'
  assert.equal(run(value).status, 0)
})

test('accepts ship as the current release authority', () => {
  const value = receipt('released')
  value.promotion.authority_evidence = 'Explicit current invocation: $auto-pilot ship docs/plan.md'
  assert.equal(run(value).status, 0)
})

test('accepts a release without a separately published notes URL', () => {
  const value = receipt('released')
  value.release.url = null
  value.release.notes_url = null
  value.release.message = '### Release\n\n**v1** — Live in production\n\n- Verification: Exact production capability proof passed.'
  assert.equal(run(value).status, 0)
})

test('accepts a release-mode blocker before candidate binding exists', () => {
  const value = {
    schema_version: 8,
    mode: 'release',
    terminal_state: 'blocked',
    plan: {source: 'docs/plan.md', approved: true},
    summary: 'Production delivery could not start.',
    blockers: [{phase: 'pre_mutation', category: 'release_path', reason: 'no production release path', evidence: 'Repository inventory found no deploy or distribution owner.'}],
  }
  assert.equal(run(value).status, 0)
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

test('rejects capability proof without an observed terminal outcome', () => {
  const value = receipt('released')
  delete value.capability_reachability.cases[0].observed_terminal_outcome
  assert.equal(run(value).status, 1)
})

test('rejects production proof without an artifact reference', () => {
  const value = receipt('released')
  delete value.capability_reachability.cases[0].production.artifact_ref
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
  value.blockers = [{phase: 'qualification', category: 'ci', reason: 'CI unavailable', evidence: 'Provider status'}]
  value.pull_request.url = 'invalid'
  assert.equal(run(value).status, 1)
})
