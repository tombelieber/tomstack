import {execFileSync, spawnSync} from 'node:child_process'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {
  attemptId,
  baseSha,
  goalId,
  headSha,
  incompleteReceipt as legacyIncompleteReceipt,
  mergeSha,
  prReadyReceipt as legacyPrReadyReceipt,
  releaseMessage,
  shippedReceipt as legacyShippedReceipt,
  validator,
} from './v9-fixture.mjs'

export {attemptId, baseSha, goalId, headSha, mergeSha, releaseMessage, validator}
export const contractSha = execFileSync(
  'python3',
  [validator, '--contract-sha256'],
  {encoding: 'utf8'},
).trim()

function productionRegressionCompatibility(productionCaseIds = []) {
  return {
    name: 'production-regression-compatibility',
    status: 'passed',
    current_production_baseline: 'current supported production capabilities and interfaces',
    representative_existing_data: 'current, legacy, and edge-shaped valid production fixtures',
    existing_behavior_status: 'passed',
    existing_data_status: 'passed',
    release_gate_status: 'passed',
    regression_suite_status: 'passed',
    gaps_detected: false,
    gap_remediation_status: 'not_applicable',
    gap_artifact_ref: null,
    production_case_ids: productionCaseIds,
    artifact_ref: 'test:production-regression-compatibility',
    evidence: 'Existing production behavior, data, and newly enforced gates passed on the exact candidate.',
  }
}

export function prReadyReceipt(options = {}) {
  const value = legacyPrReadyReceipt(options)
  value.schema_version = 10
  value.checks.push(productionRegressionCompatibility())
  return value
}

export function shippedReceipt(options = {}) {
  const value = legacyShippedReceipt(options)
  value.schema_version = 10
  value.checks.find(item => item.name === 'release-contract-binding').contract_sha256 = contractSha
  value.checks.push(productionRegressionCompatibility(['reply-comment']))
  return value
}

export function incompleteReceipt(goalMode = 'ship') {
  const value = legacyIncompleteReceipt(goalMode)
  value.schema_version = 10
  return value
}

export function validateReceipt(value) {
  const root = mkdtempSync(join(tmpdir(), 'auto-pilot-v10-fixture-'))
  const path = join(root, 'receipt.json')
  try {
    writeFileSync(path, JSON.stringify(value))
    return spawnSync('python3', [validator, path], {encoding: 'utf8'})
  } finally {
    rmSync(root, {recursive: true, force: true})
  }
}
