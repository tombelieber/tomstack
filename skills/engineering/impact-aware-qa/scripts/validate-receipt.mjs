#!/usr/bin/env node

import {readFileSync, realpathSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const LANES = new Set(['edit', 'commit', 'affected', 'premerge', 'ci-lite'])
const OUTCOMES = new Set(['passed', 'failed', 'blocked'])
const CHECK_STATUSES = new Set(['passed', 'failed', 'blocked'])
const ENVIRONMENTS = new Set(['local', 'ci', 'simulator', 'device', 'service'])
const FRESHNESS = new Set(['executed', 'reused'])
const CACHE_STATUSES = new Set(['hit', 'miss', 'not_used'])
const BASELINE_CLASSIFICATIONS = new Set([
  'passed',
  'new_failure',
  'known_failure',
  'not_applicable',
])

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function nullableString(value) {
  return value === null || nonEmpty(value)
}

function nonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateCheck(check, index, prefix, schemaVersion, ids, errors) {
  const label = `${prefix}[${index}]`
  if (!object(check)) {
    errors.push(`${label} must be an object`)
    return
  }
  if (!nonEmpty(check.id)) errors.push(`${label}.id must be non-empty`)
  else if (ids.has(check.id)) errors.push(`${label}.id must be unique within ${prefix}`)
  else ids.add(check.id)
  if (!nonEmpty(check.command)) errors.push(`${label}.command must be non-empty`)
  if (!CHECK_STATUSES.has(check.status)) errors.push(`${label}.status is invalid`)
  if (!nonEmpty(check.evidence)) errors.push(`${label}.evidence must be non-empty`)

  if (schemaVersion !== 2) return
  if (!nonNegativeNumber(check.duration_ms)) {
    errors.push(`${label}.duration_ms must be a non-negative number`)
  }
  if (!Number.isInteger(check.attempts) || check.attempts < 1) {
    errors.push(`${label}.attempts must be an integer of at least 1`)
  }
  if (!FRESHNESS.has(check.freshness)) errors.push(`${label}.freshness is invalid`)
  if (!object(check.cache) || !CACHE_STATUSES.has(check.cache.status) || !nullableString(check.cache.key)) {
    errors.push(`${label}.cache needs a valid status and null or non-empty key`)
  } else {
    if (check.cache.status === 'hit' && !nonEmpty(check.cache.key)) {
      errors.push(`${label}.cache hit requires a key`)
    }
    if (check.freshness === 'reused' && check.cache.status !== 'hit') {
      errors.push(`${label}.reused evidence requires a cache hit`)
    }
  }
  if (
    !object(check.baseline)
    || !BASELINE_CLASSIFICATIONS.has(check.baseline.classification)
    || !nullableString(check.baseline.reference)
  ) {
    errors.push(`${label}.baseline needs a valid classification and null or non-empty reference`)
  } else {
    const classification = check.baseline.classification
    if (check.status === 'passed' && ['new_failure', 'known_failure'].includes(classification)) {
      errors.push(`${label}.passed status cannot claim a failure baseline`)
    }
    if (check.status === 'failed' && !['new_failure', 'known_failure'].includes(classification)) {
      errors.push(`${label}.failed status must distinguish a new or known failure`)
    }
    if (classification === 'known_failure' && !nonEmpty(check.baseline.reference)) {
      errors.push(`${label}.known failure requires a baseline reference`)
    }
  }
}

export function validateReceipt(receipt) {
  const errors = []
  if (!object(receipt)) return ['receipt must be an object']
  if (![1, 2].includes(receipt.schema_version)) errors.push('schema_version must equal 1 or 2')
  if (!LANES.has(receipt.lane)) errors.push('lane must be edit, commit, affected, premerge, or ci-lite')
  if (!OUTCOMES.has(receipt.outcome)) errors.push('outcome must be passed, failed, or blocked')

  if (!object(receipt.candidate)) {
    errors.push('candidate must be an object')
  } else {
    const candidate = receipt.candidate
    if (!nonEmpty(candidate.repository)) errors.push('candidate.repository must be non-empty')
    for (const key of ['base', 'head', 'tree', 'dirty_digest']) {
      if (!nullableString(candidate[key])) errors.push(`candidate.${key} must be null or non-empty`)
    }
    if (![candidate.head, candidate.tree, candidate.dirty_digest].some(nonEmpty)) {
      errors.push('candidate needs head, tree, or dirty_digest identity')
    }
  }

  if (!object(receipt.impact)) {
    errors.push('impact must be an object')
  } else {
    if (!Array.isArray(receipt.impact.classes) || receipt.impact.classes.some((item) => !nonEmpty(item))) {
      errors.push('impact.classes must be an array of non-empty strings')
    }
    if (typeof receipt.impact.unknown !== 'boolean') errors.push('impact.unknown must be boolean')
    if (!Array.isArray(receipt.impact.reasons) || receipt.impact.reasons.length === 0 || receipt.impact.reasons.some((item) => !nonEmpty(item))) {
      errors.push('impact.reasons must contain non-empty strings')
    }
  }

  if (receipt.schema_version === 2) {
    if (
      !object(receipt.gate)
      || !nonEmpty(receipt.gate.version)
      || !ENVIRONMENTS.has(receipt.gate.environment)
      || !nullableString(receipt.gate.toolchain_digest)
    ) {
      errors.push('gate needs version, environment, and null or non-empty toolchain_digest')
    }
  }

  if (!Array.isArray(receipt.checks) || receipt.checks.length === 0) {
    errors.push('checks must contain at least one selected check')
  } else {
    const ids = new Set()
    for (const [index, check] of receipt.checks.entries()) {
      validateCheck(check, index, 'checks', receipt.schema_version, ids, errors)
    }
  }

  if (receipt.schema_version === 2) {
    if (!Array.isArray(receipt.shadow_checks)) {
      errors.push('shadow_checks must be an array')
    } else {
      const ids = new Set()
      for (const [index, check] of receipt.shadow_checks.entries()) {
        validateCheck(check, index, 'shadow_checks', 2, ids, errors)
      }
    }
  }

  if (!Array.isArray(receipt.skipped)) {
    errors.push('skipped must be an array')
  } else {
    for (const [index, item] of receipt.skipped.entries()) {
      if (!object(item) || !nonEmpty(item.surface) || !nonEmpty(item.reason)) {
        errors.push(`skipped[${index}] needs non-empty surface and reason`)
      }
    }
  }

  if (!object(receipt.release) || typeof receipt.release.authorized !== 'boolean' || typeof receipt.release.performed !== 'boolean') {
    errors.push('release must contain boolean authorized and performed')
  } else if (receipt.release.performed && !receipt.release.authorized) {
    errors.push('release cannot be performed without authorization')
  }

  const selected = Array.isArray(receipt.checks) ? receipt.checks : []
  const shadow = receipt.schema_version === 2 && Array.isArray(receipt.shadow_checks)
    ? receipt.shadow_checks
    : []
  const statuses = [...selected, ...shadow].map((check) => check?.status)

  if (receipt.schema_version === 2) {
    const allChecks = [...selected, ...shadow]
    const selectedDuration = selected.reduce((sum, check) => sum + (nonNegativeNumber(check?.duration_ms) ? check.duration_ms : 0), 0)
    const shadowDuration = shadow.reduce((sum, check) => sum + (nonNegativeNumber(check?.duration_ms) ? check.duration_ms : 0), 0)
    const cacheHits = allChecks.filter((check) => check?.cache?.status === 'hit').length
    const retries = allChecks.reduce((sum, check) => sum + (Number.isInteger(check?.attempts) ? Math.max(0, check.attempts - 1) : 0), 0)
    const expectedFalseNegative = selected.length > 0
      && selected.every((check) => check.status === 'passed')
      && shadow.some((check) => check.status === 'failed')
    const metrics = receipt.metrics
    if (
      !object(metrics)
      || !nonNegativeNumber(metrics.selected_duration_ms)
      || !nonNegativeNumber(metrics.shadow_duration_ms)
      || typeof metrics.false_negative !== 'boolean'
      || typeof metrics.false_escalation !== 'boolean'
      || !Number.isInteger(metrics.cache_hits)
      || metrics.cache_hits < 0
      || !Number.isInteger(metrics.retries)
      || metrics.retries < 0
    ) {
      errors.push('metrics needs durations, false-negative/escalation flags, cache_hits, and retries')
    } else {
      if (metrics.selected_duration_ms !== selectedDuration) errors.push('metrics.selected_duration_ms must equal selected check durations')
      if (metrics.shadow_duration_ms !== shadowDuration) errors.push('metrics.shadow_duration_ms must equal shadow check durations')
      if (metrics.cache_hits !== cacheHits) errors.push('metrics.cache_hits must equal check cache hits')
      if (metrics.retries !== retries) errors.push('metrics.retries must equal attempts beyond the first')
      if (metrics.false_negative !== expectedFalseNegative) errors.push('metrics.false_negative does not match selected-versus-shadow outcomes')
    }
  }

  if (receipt.outcome === 'passed' && statuses.some((status) => status !== 'passed')) {
    errors.push('passed outcome requires every selected and shadow check to pass')
  }
  if (receipt.outcome === 'passed' && receipt.impact?.unknown === true) {
    errors.push('passed outcome cannot retain unknown impact')
  }
  if (receipt.outcome === 'failed' && !statuses.includes('failed')) {
    errors.push('failed outcome requires a failed check')
  }
  if (receipt.outcome === 'blocked' && !statuses.includes('blocked')) {
    errors.push('blocked outcome requires a blocked check')
  }
  return errors
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) {
    console.error('usage: validate-receipt.mjs <receipt.json>')
    return 2
  }
  try {
    const receipt = JSON.parse(readFileSync(resolve(argv[0]), 'utf8'))
    const errors = validateReceipt(receipt)
    if (errors.length === 0) {
      console.log('Impact-Aware QA receipt is valid.')
      return 0
    }
    console.error('Impact-Aware QA receipt is invalid:')
    for (const error of errors) console.error(`- ${error}`)
    return 1
  } catch (error) {
    console.error(`could not validate receipt: ${error.message}`)
    return 2
  }
}

if (process.argv[1] && realpath(process.argv[1]) === realpath(fileURLToPath(import.meta.url))) {
  process.exitCode = main()
}

function realpath(path) {
  try {
    return realpathSync(resolve(path))
  } catch {
    return null
  }
}
