#!/usr/bin/env node

import {readFileSync, realpathSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const LANES = new Set(['edit', 'commit', 'affected', 'premerge', 'ci-lite'])
const OUTCOMES = new Set(['passed', 'failed', 'blocked'])
const CHECK_STATUSES = new Set(['passed', 'failed', 'blocked'])

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function nullableString(value) {
  return value === null || nonEmpty(value)
}

export function validateReceipt(receipt) {
  const errors = []
  if (!object(receipt)) return ['receipt must be an object']
  if (receipt.schema_version !== 1) errors.push('schema_version must equal 1')
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

  if (!Array.isArray(receipt.checks) || receipt.checks.length === 0) {
    errors.push('checks must contain at least one selected check')
  } else {
    const ids = new Set()
    for (const [index, check] of receipt.checks.entries()) {
      if (!object(check)) {
        errors.push(`checks[${index}] must be an object`)
        continue
      }
      if (!nonEmpty(check.id)) errors.push(`checks[${index}].id must be non-empty`)
      else if (ids.has(check.id)) errors.push(`checks[${index}].id must be unique`)
      else ids.add(check.id)
      if (!nonEmpty(check.command)) errors.push(`checks[${index}].command must be non-empty`)
      if (!CHECK_STATUSES.has(check.status)) errors.push(`checks[${index}].status is invalid`)
      if (!nonEmpty(check.evidence)) errors.push(`checks[${index}].evidence must be non-empty`)
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

  const statuses = Array.isArray(receipt.checks) ? receipt.checks.map((check) => check?.status) : []
  if (receipt.outcome === 'passed' && statuses.some((status) => status !== 'passed')) {
    errors.push('passed outcome requires every selected check to pass')
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
