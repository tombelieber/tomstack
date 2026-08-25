#!/usr/bin/env node

import {readFileSync, realpathSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {validateReceipt} from './validate-receipt.mjs'

export function summarizeReceipts(receipts) {
  const totals = receipts.reduce((result, receipt) => {
    result.selected_duration_ms += receipt.metrics.selected_duration_ms
    result.shadow_duration_ms += receipt.metrics.shadow_duration_ms
    result.false_negatives += Number(receipt.metrics.false_negative)
    result.false_escalations += Number(receipt.metrics.false_escalation)
    result.cache_hits += receipt.metrics.cache_hits
    result.retries += receipt.metrics.retries
    result.outcomes[receipt.outcome] += 1
    return result
  }, {
    selected_duration_ms: 0,
    shadow_duration_ms: 0,
    false_negatives: 0,
    false_escalations: 0,
    cache_hits: 0,
    retries: 0,
    outcomes: {passed: 0, failed: 0, blocked: 0},
  })
  const comparable = receipts.filter((receipt) => receipt.metrics.shadow_duration_ms > 0)
  const comparableSelected = comparable.reduce((sum, receipt) => sum + receipt.metrics.selected_duration_ms, 0)
  const comparableShadow = comparable.reduce((sum, receipt) => sum + receipt.metrics.shadow_duration_ms, 0)

  return {
    schema_version: 1,
    receipts: receipts.length,
    comparable_shadow_receipts: comparable.length,
    ...totals,
    estimated_time_saved_ms: Math.max(0, comparableShadow - comparableSelected),
    estimated_time_saved_percent: comparableShadow === 0
      ? null
      : Math.max(0, Math.round(((comparableShadow - comparableSelected) / comparableShadow) * 10_000) / 100),
  }
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length === 0) {
    console.error('usage: summarize-receipts.mjs <receipt-v2.json> [...]')
    return 2
  }
  try {
    const receipts = argv.map((path) => JSON.parse(readFileSync(resolve(path), 'utf8')))
    for (const [index, receipt] of receipts.entries()) {
      const errors = validateReceipt(receipt)
      if (receipt.schema_version !== 2) errors.push('summary metrics require schema_version 2')
      if (errors.length > 0) {
        throw new Error(`${argv[index]}: ${errors.join('; ')}`)
      }
    }
    console.log(JSON.stringify(summarizeReceipts(receipts), null, 2))
    return 0
  } catch (error) {
    console.error(`could not summarize receipts: ${error.message}`)
    return 1
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
