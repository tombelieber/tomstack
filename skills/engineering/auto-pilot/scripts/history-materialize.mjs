import {createHash} from 'node:crypto'
import {
  chmodSync,
  createReadStream,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import {basename, dirname, join, sep} from 'node:path'

import {collectCompletionReceipt} from './history-receipt.mjs'
import {auditRouting} from './history-routing.mjs'

const TOKEN_FIELDS = [
  'input_tokens',
  'cached_input_tokens',
  'cache_write_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
]
const GOAL_ID = /^apg_[A-Za-z0-9_-]{12,80}$/
export const CODEX_PARSER_VERSION = 1
export const MATERIALIZER_VERSION = 3

export async function materializePendingRuns({dataRoot, schemaVersion, now = () => new Date()} = {}) {
  const root = join(dataRoot, 'runs')
  if (!safeDirectory(root)) return {scanned: 0, materialized: 0, unavailable: 0, failed: 0, errors: []}

  const result = {scanned: 0, materialized: 0, unavailable: 0, failed: 0, errors: []}
  const names = readdirSync(root).sort((left, right) => {
    const leftManifest = readJson(join(root, left, 'manifest.json'))
    const rightManifest = readJson(join(root, right, 'manifest.json'))
    return `${leftManifest?.started_at || ''}\0${left}`.localeCompare(`${rightManifest?.started_at || ''}\0${right}`)
  })
  for (const name of names) {
    const directory = join(root, name)
    if (!safeDirectory(directory)) continue
    const manifest = readJson(join(directory, 'manifest.json'))
    const metrics = readJson(join(directory, 'metrics.json'))
    const terminal = readJson(join(directory, 'terminal.json'))
    const needsMaterialization = manifest?.status === 'pending_materialization'
      || (terminal && (
        metrics?.parser_version !== CODEX_PARSER_VERSION
        || metrics?.materializer_version !== MATERIALIZER_VERSION
      ))
    if (!manifest || !needsMaterialization) continue
    result.scanned += 1
    try {
      const item = await materializeRun(directory, manifest, {schemaVersion, now})
      result[item.collectionComplete ? 'materialized' : 'unavailable'] += 1
    } catch (error) {
      result.failed += 1
      result.errors.push({run_id: manifest.run_id, error: error.message})
    }
  }
  return result
}

export async function materializeRun(directory, manifest, {schemaVersion, now = () => new Date()} = {}) {
  const terminal = readJson(join(directory, 'terminal.json')) || {}
  const transcript = resolveTranscriptPath(terminal.transcript_source || manifest.transcript_source)
  const transcriptPath = transcript.path
  const endBytes = transcriptPath
    ? boundedEndBytes(transcriptPath, terminal.transcript_end_bytes)
    : 0
  const parsed = transcriptPath
    ? await parseCodexTranscript(transcriptPath, {
      startBytes: manifest.transcript_start_bytes || 0,
      endBytes,
      turnId: manifest.turn_id,
    })
    : emptyParsedMetrics()
  const messageMatches = Boolean(
    parsed.last_assistant_message
    && terminal.last_assistant_message_sha256
    && sha256Text(parsed.last_assistant_message) === terminal.last_assistant_message_sha256,
  )
  const finalMessage = messageMatches ? parsed.last_assistant_message : null
  const agents = await materializeAgents(directory, schemaVersion)
  const invocationSchemaVersion = Number.isInteger(manifest.invocation_schema_version)
    ? manifest.invocation_schema_version
    : manifest.schema_version
  const expectedReceiptMode = invocationSchemaVersion >= 6
    ? manifest.goal_mode
    : invocationSchemaVersion >= 5 && manifest.continuation === 'release'
      ? 'release'
      : manifest.mode
  const routing = auditRouting({message: finalMessage, manifest, subagents: agents.length})
  const collectedCompletion = collectCompletionReceipt(
    finalMessage,
    expectedReceiptMode,
    directory,
    {
      validatorPath: archivedValidatorPath(directory, manifest),
      expectedGoalId: invocationSchemaVersion >= 6 ? manifest.goal_id : null,
      expectedLineage: invocationSchemaVersion >= 6 ? {
        previous_receipt_sha256: manifest.expected_previous_receipt_sha256 || null,
        attempt_ids: Array.isArray(manifest.prior_attempt_ids) ? manifest.prior_attempt_ids : [],
        completion_scope: manifest.expected_completion_scope || null,
      } : null,
    },
  )
  const completion = enforceReleaseRouting(
    collectedCompletion,
    routing,
    manifest,
    invocationSchemaVersion,
  )
  const endedAt = validDate(terminal.ended_at) || now()
  const collectionComplete = Boolean(
    transcriptPath && parsed.token_usage_observed && messageMatches && parsed.parse_errors === 0,
  )
  const goal = goalEvidence(manifest, routing)

  const metrics = {
    schema_version: schemaVersion,
    parser_version: CODEX_PARSER_VERSION,
    materializer_version: MATERIALIZER_VERSION,
    run_id: manifest.run_id,
    duration_ms: Math.max(0, endedAt.getTime() - Date.parse(manifest.started_at)),
    model: parsed.model || manifest.model,
    effort: parsed.effort || manifest.effort,
    collection_complete: collectionComplete,
    token_usage_observed: parsed.token_usage_observed,
    token_counter_reset: parsed.token_counter_reset,
    token_usage: parsed.token_usage_observed ? {
      ...parsed.token_usage,
      uncached_input_tokens: Math.max(
        0,
        parsed.token_usage.input_tokens - parsed.token_usage.cached_input_tokens,
      ),
    } : null,
    tool_calls: transcriptPath ? parsed.tool_calls : null,
    tools: transcriptPath ? parsed.tools : null,
    compactions: transcriptPath ? parsed.compactions : null,
    parse_errors: parsed.parse_errors,
    parse_warnings: parsed.parse_warnings,
    subagents: agents.length,
    subagent_types: countValues(agents.map((item) => item.agent_type).filter(Boolean)),
    subagent_models: countValues(agents.map((item) => item.model).filter(Boolean)),
    subagent_efforts: countValues(agents.map((item) => item.effort).filter(Boolean)),
    subagent_token_accounting_complete: agents.length === 0,
    topology: topologySummary(parsed, agents),
    routing,
    transcript_bytes: endBytes,
    transcript_sha256: parsed.transcript_sha256,
    transcript_source_available: Boolean(transcriptPath),
    transcript_source_location: transcript.location,
    final_message_hash_matched: messageMatches,
  }
  writePrivateJson(join(directory, 'metrics.json'), metrics)

  const terminalState = completion.legacy_terminal_state || completion.terminal_state
  const goalOutcome = completion.goal_outcome || null
  const attemptResult = completion.attempt_result || 'unknown'
  const goalStatus = invocationSchemaVersion >= 6
    ? goalOutcome ? 'achieved' : attemptResult === 'incomplete' ? 'waiting' : 'active'
    : 'legacy_unknown'
  writePrivateJson(join(directory, 'outcome.json'), {
    schema_version: schemaVersion,
    run_id: manifest.run_id,
    terminal_state: terminalState,
    attempt_result: attemptResult,
    attempt_id: completion.attempt_id || null,
    attempt_basis: completion.attempt_basis || null,
    previous_receipt_sha256: completion.previous_receipt_sha256 || null,
    completion_scope: completion.completion_scope || null,
    completion_scope_sha256: completion.completion_scope_sha256 || null,
    goal_target: completion.goal_target || manifest.goal_target || null,
    goal_outcome: goalOutcome,
    legacy_terminal_state: completion.legacy_terminal_state || null,
    completion_receipt: completion.evidence,
    collection_reason: terminal.reason || 'post_hoc',
    ended_at: endedAt.toISOString(),
    last_assistant_message_sha256: terminal.last_assistant_message_sha256 || null,
  })
  writePrivateJson(join(directory, 'manifest.json'), {
    ...manifest,
    schema_version: schemaVersion,
    invocation_schema_version: invocationSchemaVersion,
    collector_version: manifest.collector_version ?? invocationSchemaVersion,
    status: 'finished',
    terminal_state: terminalState,
    attempt_result: attemptResult,
    attempt_id: completion.attempt_id || null,
    attempt_basis: completion.attempt_basis || null,
    previous_receipt_sha256: completion.previous_receipt_sha256 || null,
    completion_scope: completion.completion_scope || null,
    completion_scope_sha256: completion.completion_scope_sha256 || null,
    goal_status: goalStatus,
    goal_target: completion.goal_target || manifest.goal_target || null,
    goal_outcome: goalOutcome,
    legacy_terminal_state: completion.legacy_terminal_state || null,
    ended_at: endedAt.toISOString(),
    model: metrics.model,
    effort: metrics.effort,
    orchestration_status: routing.status,
    goal_id: goal.id,
    goal_id_source: goal.source,
    goal_id_sources: goal.sources,
    parser_version: CODEX_PARSER_VERSION,
    materializer_version: MATERIALIZER_VERSION,
    materialized_at: now().toISOString(),
  })
  reconcileActiveGoal(directory, manifest, completion, {
    invocationSchemaVersion,
    goalId: goal.id,
    goalOutcome,
    attemptResult,
    endedAt,
  })
  return {collectionComplete, runId: manifest.run_id}
}

export function enforceReleaseRouting(completion, routing, manifest, invocationSchemaVersion = manifest.schema_version) {
  if (invocationSchemaVersion >= 6 || invocationSchemaVersion < 5 || completion.terminal_state !== 'released') return completion
  const expectedLane = manifest.mode === 'release'
    ? 'current_release_task'
    : manifest.continuation === 'release'
      ? 'current_ship_task'
      : null
  if (!expectedLane) return completion
  const lane = routing.declared?.continuation?.lane
  if (['passed', 'fallback'].includes(routing.status) && lane === expectedLane) return completion
  return {
    terminal_state: 'unknown',
    evidence: {
      ...completion.evidence,
      status: 'routing_mismatch',
      expected_lane: expectedLane,
      observed_lane: lane || null,
    },
  }
}

function archivedValidatorPath(directory, manifest) {
  const hash = manifest.skill_bundle_sha256
  if (!/^[a-f0-9]{64}$/.test(hash || '')) return null
  const candidate = join(
    dirname(dirname(directory)),
    'versions',
    hash,
    'bundle',
    'scripts',
    'validate_receipt.py',
  )
  return regularFile(candidate) ? candidate : null
}

function reconcileActiveGoal(directory, manifest, completion, state) {
  if (state.invocationSchemaVersion < 6 || !manifest.session_id) return
  const dataRoot = dirname(dirname(directory))
  const path = join(dataRoot, 'active-goals', `${safeSegment(manifest.session_id)}.json`)
  const active = readJson(path)
  if (!active || active.goal_id !== state.goalId) return
  const activeRun = Date.parse(active.latest_run_started_at || '')
  const materializedRun = Date.parse(manifest.started_at || '')
  if (Number.isFinite(activeRun) && Number.isFinite(materializedRun) && activeRun > materializedRun) return
  if (state.goalOutcome && completion.evidence?.status === 'valid') {
    rmSync(path, {force: true})
    return
  }
  const validAttempt = completion.evidence?.status === 'valid' && state.attemptResult === 'incomplete'
  const attemptIds = Array.isArray(active.attempt_ids) ? active.attempt_ids : []
  const nextAttemptIds = validAttempt && completion.attempt_id && !attemptIds.includes(completion.attempt_id)
    ? [...attemptIds, completion.attempt_id]
    : attemptIds
  writePrivateJson(path, {
    ...active,
    status: validAttempt ? 'waiting' : 'active',
    last_attempt_result: state.attemptResult,
    last_receipt_sha256: validAttempt ? completion.evidence.receipt_sha256 : active.last_receipt_sha256 ?? null,
    last_attempt_id: validAttempt ? completion.attempt_id : active.last_attempt_id ?? null,
    attempt_ids: nextAttemptIds,
    last_completion_scope: validAttempt ? completion.completion_scope : active.last_completion_scope ?? null,
    last_completion_scope_sha256: validAttempt
      ? completion.completion_scope_sha256
      : active.last_completion_scope_sha256 ?? null,
    last_materialized_started_at: manifest.started_at || null,
    updated_at: state.endedAt.toISOString(),
  })
}

export async function parseCodexTranscript(path, {startBytes = 0, endBytes, turnId = null} = {}) {
  const parsed = emptyParsedMetrics()
  if (!regularFile(path)) return parsed

  const limit = boundedEndBytes(path, endBytes)
  if (limit === 0) return parsed
  const stream = createReadStream(path, {start: 0, end: limit - 1})
  const hash = createHash('sha256')
  let carry = Buffer.alloc(0)
  let offset = 0
  let previousTotals = null

  const consume = (raw, lineStart, lineEnd) => {
    hash.update(raw)
    const text = raw.at(-1) === 0x0a ? raw.subarray(0, -1).toString('utf8').replace(/\r$/, '') : raw.toString('utf8')
    if (!text.trim()) return
    let event
    try { event = JSON.parse(text) } catch { parsed.parse_errors += 1; return }
    const inSegment = lineStart >= startBytes || lineEnd > startBytes

    if (event.type === 'session_meta') {
      parsed.session_id = stringOrNull(event.payload?.id) || stringOrNull(event.payload?.session_id) || parsed.session_id
      parsed.parent_thread_id = stringOrNull(event.payload?.source?.subagent?.thread_spawn?.parent_thread_id)
        || stringOrNull(event.payload?.parent_thread_id)
        || parsed.parent_thread_id
      parsed.agent_depth = Number.isInteger(event.payload?.source?.subagent?.thread_spawn?.depth)
        ? event.payload.source.subagent.thread_spawn.depth
        : parsed.agent_depth
      parsed.agent_path = stringOrNull(event.payload?.source?.subagent?.thread_spawn?.agent_path)
        || stringOrNull(event.payload?.agent_path)
        || parsed.agent_path
    }

    if (event.type === 'event_msg' && event.payload?.type === 'token_count') {
      const total = tokenUsageOrNull(event.payload.info?.total_token_usage)
      const last = tokenUsageOrNull(event.payload.info?.last_token_usage)
      const decision = tokenDecision(total, last, previousTotals)
      if (decision.warning && inSegment) parsed.parse_warnings.push(decision.warning)
      if (decision.reset && inSegment) parsed.token_counter_reset = true
      if (decision.delta && !zeroUsage(decision.delta)) {
        if (inSegment) {
          const delta = decision.delta
          addTokenUsage(parsed.token_usage, delta)
          parsed.token_usage_observed = true
        }
        previousTotals = decision.nextTotals
      }
      if (decision.advanceWithoutTokens) previousTotals = decision.nextTotals
    }
    if (inSegment && event.type === 'turn_context' && (!turnId || event.payload?.turn_id === turnId)) {
      parsed.model = stringOrNull(event.payload?.model) || parsed.model
      parsed.effort = stringOrNull(event.payload?.effort) || parsed.effort
    }
    if (inSegment && event.type === 'response_item' && ['function_call', 'custom_tool_call'].includes(event.payload?.type)) {
      parsed.tool_calls += 1
      const name = event.payload?.name || event.payload?.namespace || 'unknown'
      parsed.tools[name] = (parsed.tools[name] || 0) + 1
    }
    if (inSegment && (
      event.type === 'compacted'
      || (event.type === 'event_msg' && event.payload?.type === 'context_compacted')
    )) parsed.compactions += 1
    if (inSegment) {
      const assistant = assistantMessage(event)
      if (assistant !== null) parsed.last_assistant_message = assistant
    }
  }

  for await (const chunk of stream) {
    const buffer = carry.length ? Buffer.concat([carry, chunk]) : chunk
    let cursor = 0
    while (true) {
      const newline = buffer.indexOf(0x0a, cursor)
      if (newline === -1) break
      const raw = buffer.subarray(cursor, newline + 1)
      consume(raw, offset, offset + raw.length)
      offset += raw.length
      cursor = newline + 1
    }
    carry = buffer.subarray(cursor)
  }
  if (carry.length) {
    consume(carry, offset, offset + carry.length)
    offset += carry.length
  }
  parsed.transcript_sha256 = hash.digest('hex')
  parsed.consumed_bytes = offset
  return parsed
}

async function materializeAgents(directory, schemaVersion) {
  const agentsDirectory = join(directory, 'agents')
  if (!safeDirectory(agentsDirectory)) return []
  const metadata = []
  for (const name of readdirSync(agentsDirectory).filter((item) => item.endsWith('.marker.json'))) {
    const marker = readJson(join(agentsDirectory, name))
    if (!marker) continue
    const transcript = resolveTranscriptPath(marker.transcript_source)
    const parsed = transcript.path
      ? await parseCodexTranscript(transcript.path, {startBytes: 0, endBytes: marker.transcript_end_bytes})
      : emptyParsedMetrics()
    const item = {
      schema_version: schemaVersion,
      agent_id: marker.agent_id,
      agent_type: marker.agent_type,
      session_id: parsed.session_id,
      parent_thread_id: parsed.parent_thread_id,
      agent_depth: parsed.agent_depth,
      agent_path: parsed.agent_path,
      model: parsed.model,
      effort: parsed.effort,
      stopped_at: marker.stopped_at,
      transcript_source_available: Boolean(transcript.path),
      transcript_source_location: transcript.location,
      transcript_bytes: parsed.consumed_bytes,
      transcript_sha256: parsed.transcript_sha256,
      token_usage_observed: parsed.token_usage_observed,
      token_usage: parsed.token_usage_observed ? parsed.token_usage : null,
      token_semantics: 'agent_transcript_unverified',
      tool_calls: parsed.tool_calls,
      tools: parsed.tools,
      compactions: parsed.compactions,
      parse_errors: parsed.parse_errors,
      parse_warnings: parsed.parse_warnings,
    }
    writePrivateJson(join(agentsDirectory, `${safeSegment(marker.agent_id)}.json`), item)
    metadata.push(item)
  }
  return metadata
}

function tokenDecision(total, last, previous) {
  if (total && last && previous) {
    if (sameTokenUsage(total, previous)) return noTokenDecision(previous)
    if (!monotonicTokenUsage(total, previous) && looksLikeStaleRegression(total, previous, last)) {
      return noTokenDecision(previous)
    }
    return {
      delta: last,
      nextTotals: total,
      reset: !monotonicTokenUsage(total, previous),
      warning: !monotonicTokenUsage(total, previous)
        ? 'cumulative token counter reset; last_token_usage used'
        : null,
      advanceWithoutTokens: false,
    }
  }
  if (total && last) return {delta: last, nextTotals: total, reset: false, warning: null, advanceWithoutTokens: false}
  if (total && previous) {
    if (sameTokenUsage(total, previous)) return noTokenDecision(previous)
    if (monotonicTokenUsage(total, previous)) {
      return {delta: subtractTokenUsage(total, previous), nextTotals: total, reset: false, warning: null, advanceWithoutTokens: false}
    }
    return {
      delta: null, nextTotals: total, reset: true,
      warning: 'cumulative token counter reset without last_token_usage; event skipped',
      advanceWithoutTokens: true,
    }
  }
  if (total) {
    return {
      delta: total, nextTotals: total, reset: false,
      warning: 'legacy token event lacks last_token_usage; first cumulative total used',
      advanceWithoutTokens: false,
    }
  }
  if (last && previous) {
    return {delta: last, nextTotals: addUsage(previous, last), reset: false, warning: null, advanceWithoutTokens: false}
  }
  if (last) return {delta: last, nextTotals: null, reset: false, warning: null, advanceWithoutTokens: false}
  return noTokenDecision(previous)
}

function noTokenDecision(previous) {
  return {delta: null, nextTotals: previous, reset: false, warning: null, advanceWithoutTokens: false}
}

function looksLikeStaleRegression(total, previous, last) {
  const current = total.total_tokens
  const prior = previous.total_tokens
  const increment = last.total_tokens
  if (current <= 0 || prior <= 0 || increment <= 0) return false
  return current * 100 >= prior * 98 || current + increment * 2 >= prior
}

function assistantMessage(event) {
  const payload = event.type === 'response_item' ? event.payload : null
  if (payload?.type !== 'message' || payload.role !== 'assistant' || !Array.isArray(payload.content)) return null
  const text = payload.content
    .filter((item) => ['output_text', 'text'].includes(item?.type) && typeof item.text === 'string')
    .map((item) => item.text)
    .join('')
  return text || null
}

function topologySummary(root, agents) {
  const depths = agents.map((item) => item.agent_depth).filter(Number.isInteger)
  return {
    observed_agent_sessions: agents.length,
    lineage_complete: agents.length === 0 || agents.every((item) => item.session_id && item.parent_thread_id),
    max_observed_depth: depths.length ? Math.max(...depths) : agents.length ? null : 0,
    nested_agent_sessions: depths.length === agents.length
      ? depths.filter((depth) => depth > 1).length
      : null,
    delegation_tool_calls: Object.entries(root.tools)
      .filter(([name]) => ['spawn_agent', 'send_message', 'followup_task', 'wait_agent', 'list_agents'].includes(name))
      .reduce((sum, [, count]) => sum + count, 0),
  }
}

function goalEvidence(manifest, routing) {
  if ((manifest.invocation_schema_version ?? manifest.schema_version) >= 6) {
    if (typeof manifest.goal_id === 'string' && GOAL_ID.test(manifest.goal_id)) {
      const source = manifest.goal_id_source || 'generated'
      return {id: manifest.goal_id, source, sources: manifest.goal_id_sources || [source]}
    }
  }
  const declared = routing?.declared?.goal_id
  if (typeof declared === 'string' && GOAL_ID.test(declared)) {
    const sources = manifest.goal_id === declared && manifest.goal_id_source === 'invocation_marker'
      ? ['invocation_marker', 'routing_marker']
      : ['routing_marker']
    return {id: declared, source: 'routing_marker', sources}
  }
  if (typeof manifest.goal_id === 'string' && GOAL_ID.test(manifest.goal_id)) {
    const source = manifest.goal_id_source || 'invocation_marker'
    return {id: manifest.goal_id, source, sources: manifest.goal_id_sources || [source]}
  }
  return {id: manifest.run_id, source: 'run_id', sources: ['run_id']}
}

function boundedEndBytes(path, requested) {
  const size = statSync(path).size
  return Number.isInteger(requested) && requested >= 0 ? Math.min(size, requested) : size
}

function resolveTranscriptPath(recorded) {
  if (regularFile(recorded)) return {path: recorded, location: 'recorded'}
  if (typeof recorded !== 'string') return {path: null, location: 'unavailable'}
  const sessionsMarker = `${sep}sessions${sep}`
  const index = recorded.indexOf(sessionsMarker)
  if (index === -1) return {path: null, location: 'unavailable'}
  const archived = join(recorded.slice(0, index), 'archived_sessions', basename(recorded))
  return regularFile(archived)
    ? {path: archived, location: 'archived_sibling'}
    : {path: null, location: 'unavailable'}
}

function tokenUsageOrNull(value) {
  if (!value || typeof value !== 'object') return null
  const result = {}
  let observed = false
  for (const field of TOKEN_FIELDS) {
    const number = Number.isFinite(value[field]) && value[field] >= 0 ? value[field] : 0
    result[field] = number
    if (Number.isFinite(value[field])) observed = true
  }
  result.cached_input_tokens = Math.min(result.cached_input_tokens, result.input_tokens)
  result.reasoning_output_tokens = Math.min(result.reasoning_output_tokens, result.output_tokens)
  result.total_tokens = result.input_tokens + result.output_tokens
  return observed ? result : null
}

function zeroTokenUsage() { return Object.fromEntries(TOKEN_FIELDS.map((field) => [field, 0])) }
function addTokenUsage(target, value) { for (const field of TOKEN_FIELDS) target[field] += value[field] || 0 }
function addUsage(left, right) { return Object.fromEntries(TOKEN_FIELDS.map((field) => [field, left[field] + right[field]])) }
function subtractTokenUsage(left, right) {
  return Object.fromEntries(TOKEN_FIELDS.map((field) => [field, Math.max(0, left[field] - right[field])]))
}
function monotonicTokenUsage(left, right) { return TOKEN_FIELDS.every((field) => left[field] >= right[field]) }
function sameTokenUsage(left, right) { return TOKEN_FIELDS.every((field) => left[field] === right[field]) }
function zeroUsage(value) {
  return value.input_tokens === 0 && value.output_tokens === 0
    && value.cached_input_tokens === 0 && value.reasoning_output_tokens === 0
}
function stringOrNull(value) { return typeof value === 'string' && value ? value : null }
function countValues(values) { return values.reduce((counts, value) => ({...counts, [value]: (counts[value] || 0) + 1}), {}) }
function sha256Text(value) { return typeof value === 'string' ? createHash('sha256').update(value).digest('hex') : null }
function safeSegment(value) { return String(value || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180) }
function validDate(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null }

function emptyParsedMetrics() {
  return {
    token_usage: zeroTokenUsage(), token_usage_observed: false, token_counter_reset: false,
    model: null, effort: null, tool_calls: 0, tools: {}, compactions: 0,
    parse_errors: 0, parse_warnings: [], last_assistant_message: null,
    transcript_sha256: null, consumed_bytes: 0, session_id: null,
    parent_thread_id: null, agent_depth: null, agent_path: null,
  }
}

function regularFile(path) {
  if (!path || !existsSync(path)) return false
  const stats = lstatSync(path)
  return stats.isFile() && !stats.isSymbolicLink()
}

function safeDirectory(path) {
  if (!path || !existsSync(path)) return false
  const stats = lstatSync(path)
  return stats.isDirectory() && !stats.isSymbolicLink()
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function writePrivateJson(path, value) {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`)
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600})
  renameSync(temporary, path)
  try { chmodSync(path, 0o600) } catch {}
}
