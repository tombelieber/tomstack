import assert from 'node:assert/strict'
import {test} from 'node:test'

import {summarizeReceipts} from '../scripts/summarize-receipts.mjs'
import {validateReceipt} from '../scripts/validate-receipt.mjs'

function check(overrides = {}) {
  return {
    id: 'unit',
    command: 'repo test command',
    status: 'passed',
    evidence: 'bounded local log',
    duration_ms: 100,
    attempts: 1,
    freshness: 'executed',
    cache: {status: 'miss', key: null},
    baseline: {classification: 'passed', reference: null},
    ...overrides,
  }
}

function receiptV2() {
  return {
    schema_version: 2,
    lane: 'affected',
    gate: {
      version: 'repo-gate-v3',
      environment: 'local',
      toolchain_digest: 'sha256:toolchain',
    },
    candidate: {
      repository: 'https://example.invalid/owner/repo',
      base: 'base-sha',
      head: 'head-sha',
      tree: 'tree-sha',
      dirty_digest: null,
    },
    impact: {
      classes: ['isolated-leaf'],
      unknown: false,
      reasons: ['one leaf changed'],
    },
    checks: [check()],
    shadow_checks: [check({id: 'full', duration_ms: 300})],
    skipped: [],
    metrics: {
      selected_duration_ms: 100,
      shadow_duration_ms: 300,
      false_negative: false,
      false_escalation: false,
      cache_hits: 0,
      retries: 0,
    },
    release: {authorized: false, performed: false},
    outcome: 'passed',
  }
}

test('schema v1 remains valid for existing repository integrations', () => {
  const receipt = receiptV2()
  receipt.schema_version = 1
  delete receipt.gate
  delete receipt.shadow_checks
  delete receipt.metrics
  receipt.checks = receipt.checks.map(({duration_ms, attempts, freshness, cache, baseline, ...rest}) => rest)
  assert.deepEqual(validateReceipt(receipt), [])
})

test('schema v2 binds environment, timing, cache, retry, and baseline evidence', () => {
  assert.deepEqual(validateReceipt(receiptV2()), [])
})

test('shadow false negatives cannot be reported as a passing candidate', () => {
  const receipt = receiptV2()
  receipt.shadow_checks[0] = check({
    id: 'full',
    status: 'failed',
    duration_ms: 300,
    baseline: {classification: 'new_failure', reference: null},
  })
  receipt.metrics.false_negative = true
  assert(validateReceipt(receipt).some((error) => error.includes('passed outcome')))

  receipt.outcome = 'failed'
  assert.deepEqual(validateReceipt(receipt), [])
})

test('known red baselines stay failed and require an evidence reference', () => {
  const receipt = receiptV2()
  receipt.checks[0] = check({
    status: 'failed',
    baseline: {classification: 'known_failure', reference: null},
  })
  receipt.shadow_checks = []
  receipt.metrics.shadow_duration_ms = 0
  receipt.outcome = 'failed'
  assert(validateReceipt(receipt).some((error) => error.includes('known failure requires')))

  receipt.checks[0].baseline.reference = 'main-run-123'
  assert.deepEqual(validateReceipt(receipt), [])
})

test('reused evidence must identify the cache entry that supplied it', () => {
  const receipt = receiptV2()
  receipt.checks[0] = check({
    freshness: 'reused',
    cache: {status: 'miss', key: null},
  })
  assert(validateReceipt(receipt).some((error) => error.includes('requires a cache hit')))

  receipt.checks[0].cache = {status: 'hit', key: 'candidate+toolchain+gate'}
  receipt.metrics.cache_hits = 1
  assert.deepEqual(validateReceipt(receipt), [])
})

test('retry and duration metrics must equal their underlying checks', () => {
  const receipt = receiptV2()
  receipt.checks[0].attempts = 2
  assert(validateReceipt(receipt).some((error) => error.includes('metrics.retries')))
  receipt.metrics.retries = 1
  receipt.metrics.selected_duration_ms = 99
  assert(validateReceipt(receipt).some((error) => error.includes('selected_duration_ms')))
})

test('unknown impact can be blocked but never green', () => {
  const receipt = receiptV2()
  receipt.impact.unknown = true
  receipt.checks[0] = check({
    status: 'blocked',
    baseline: {classification: 'not_applicable', reference: null},
  })
  receipt.shadow_checks = []
  receipt.metrics.shadow_duration_ms = 0
  receipt.outcome = 'blocked'
  assert.deepEqual(validateReceipt(receipt), [])
})

test('receipt summaries quantify comparable shadow savings and misses', () => {
  const first = receiptV2()
  const second = receiptV2()
  second.metrics.selected_duration_ms = 200
  second.checks[0].duration_ms = 200
  second.metrics.shadow_duration_ms = 400
  second.shadow_checks[0].duration_ms = 400
  second.metrics.cache_hits = 1
  second.checks[0].freshness = 'reused'
  second.checks[0].cache = {status: 'hit', key: 'candidate-2'}

  const summary = summarizeReceipts([first, second])
  assert.equal(summary.receipts, 2)
  assert.equal(summary.estimated_time_saved_ms, 400)
  assert.equal(summary.estimated_time_saved_percent, 57.14)
  assert.equal(summary.cache_hits, 1)
})
