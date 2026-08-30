import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import {basename, dirname, isAbsolute, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const RECEIPT_MARKER = /<!--\s*auto-pilot-receipt:\s*([^\r\n]*?)\s*-->/i
const ROUTING_MARKER = /<!--\s*auto-pilot-routing:\s*\{[^\r\n]*\}\s*-->/gi
const MAX_RECEIPT_BYTES = 1024 * 1024
const RECEIPT_VALIDATOR = fileURLToPath(new URL('./validate_receipt.py', import.meta.url))

export function collectCompletionReceipt(
  message,
  expectedMode,
  directory,
  {validatorPath = RECEIPT_VALIDATOR} = {},
) {
  const marker = typeof message === 'string' ? message.match(RECEIPT_MARKER) : null
  if (!marker) return receiptFailure('missing')

  const markedSource = marker[1].trim()
  if (!markedSource || markedSource.length > 4096 || !isAbsolute(markedSource)) return receiptFailure('invalid_path')
  const snapshot = join(directory, 'receipt-source.json')
  const validated = join(directory, 'receipt.json')
  const source = regularFile(snapshot) ? snapshot : regularFile(validated) ? validated : markedSource
  if (!regularFile(source)) return receiptFailure('missing_file', markedSource)
  if (lstatSync(source).size > MAX_RECEIPT_BYTES) return receiptFailure('too_large', markedSource)

  let bytes
  let receipt
  try {
    bytes = readFileSync(source)
    if (bytes.length > MAX_RECEIPT_BYTES) return receiptFailure('too_large', markedSource)
    receipt = JSON.parse(bytes.toString('utf8'))
  } catch {
    return receiptFailure('invalid_json', markedSource)
  }

  if (validatorPath === null) return receiptFailure('validator_unavailable', markedSource)
  const validation = spawnSync('python3', [validatorPath, source], {
    stdio: 'ignore',
    timeout: 5000,
    windowsHide: true,
  })
  if (validation.error) return receiptFailure('validator_unavailable', markedSource)
  if (validation.status !== 0) return receiptFailure('invalid_receipt', markedSource)

  const error = receiptModeError(receipt, expectedMode)
  if (error) return receiptFailure(error, markedSource)
  const messageError = releaseMessageError(message, receipt)
  if (messageError) return receiptFailure(messageError, markedSource)

  writePrivateJson(join(directory, 'receipt.json'), receipt)
  return {
    terminal_state: receipt.terminal_state,
    evidence: {
      status: 'valid',
      schema_version: receipt.schema_version,
      mode: receipt.mode,
      receipt_sha256: sha256(bytes),
      source_path_sha256: sha256(markedSource),
    },
  }
}

export function snapshotCompletionReceipt(message, directory) {
  const marker = typeof message === 'string' ? message.match(RECEIPT_MARKER) : null
  if (!marker) return {status: 'missing', source_path_sha256: null, receipt_sha256: null, bytes: 0}

  const source = marker[1].trim()
  if (!source || source.length > 4096 || !isAbsolute(source)) {
    return {status: 'invalid_path', source_path_sha256: null, receipt_sha256: null, bytes: 0}
  }
  if (!regularFile(source)) return {status: 'missing_file', source_path_sha256: sha256(source), receipt_sha256: null, bytes: 0}
  const size = lstatSync(source).size
  if (size > MAX_RECEIPT_BYTES) return {status: 'too_large', source_path_sha256: sha256(source), receipt_sha256: null, bytes: size}

  const destination = join(directory, 'receipt-source.json')
  const temporary = join(directory, `.receipt-source.json.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`)
  copyFileSync(source, temporary)
  try { chmodSync(temporary, 0o600) } catch {}
  renameSync(temporary, destination)
  const bytes = readFileSync(destination)
  return {
    status: 'captured',
    source_path_sha256: sha256(source),
    receipt_sha256: sha256(bytes),
    bytes: bytes.length,
  }
}

function receiptModeError(receipt, expectedMode) {
  if (expectedMode && receipt.mode !== expectedMode) return 'mode_mismatch'
  return null
}

function releaseMessageError(message, receipt) {
  if (receipt.terminal_state !== 'released') return null
  if (typeof message !== 'string') return 'release_message_mismatch'
  const expected = receipt.release?.message?.trim()
  if (!expected) return 'release_message_mismatch'
  const visible = message
    .replace(RECEIPT_MARKER, '')
    .replace(ROUTING_MARKER, '')
    .trim()
  return visible.endsWith(expected) ? null : 'release_message_mismatch'
}

function receiptFailure(status, source = null) {
  return {
    terminal_state: 'unknown',
    evidence: {
      status,
      schema_version: null,
      mode: null,
      receipt_sha256: null,
      source_path_sha256: source ? sha256(source) : null,
    },
  }
}

function regularFile(path) {
  if (!existsSync(path)) return false
  const stats = lstatSync(path)
  return stats.isFile() && !stats.isSymbolicLink()
}

function writePrivateJson(path, value) {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`)
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600})
  renameSync(temporary, path)
  try { chmodSync(path, 0o600) } catch {}
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
