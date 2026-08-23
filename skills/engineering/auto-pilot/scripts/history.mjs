import {createHash} from 'node:crypto'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import {homedir} from 'node:os'
import {basename, dirname, join} from 'node:path'

import {archiveInstalledSkillVersion, installedSkillBundle} from './history-bundle.mjs'
import {materializePendingRuns} from './history-materialize.mjs'
import {snapshotCompletionReceipt} from './history-receipt.mjs'
import {resolveAutoPilotConfig} from './resolve_config.mjs'

export const AUTO_PILOT_VERSION = '0.11.0'
export const HISTORY_SCHEMA_VERSION = 4
export const DEFAULT_RAW_RETENTION_DAYS = 90

const SELECTED_SKILL = /^\s*\[\$auto-pilot\]\([^\r\n)]*[/\\]auto-pilot[/\\]SKILL\.md(?:#[^\r\n)]*)?\)(?=\s|$)/i
const LEADING_SKILL = /^\s*\$auto-pilot(?=\s|$)/i
const GOAL_MARKER = /<!--\s*auto-pilot-goal:\s*(apg_[A-Za-z0-9_-]{12,80})\s*-->/i
const NON_EXECUTION_REQUEST = /(?:do not|don't|dont|never)\s+(?:start|run|execute)|(?:just|only)\s+(?:confirm|answer|advise|explain|review|analyse|analyze)|what\s+do\s+you\s+think|how\s+(?:do|can|should|would)\b[^\r\n]{0,80}\b(?:improve|optimise|optimize|design)|\b(?:improve|optimise|optimize|review|analyse|analyze)\b[^\r\n]{0,80}\b(?:skill|auto[ -]?pilot)|(?:優化|改善|檢討)[^\r\n]{0,40}(?:skill|auto[ -]?pilot)|不要(?:開始|執行)|唔好(?:開始|執行)|只(?:需|要)?[^\r\n]{0,12}(?:確認|回答|建議|解釋|分析)|有冇足夠[^\r\n]{0,40}(?:開始|執行)/i
const NO_RELEASE_CONTINUATION = /(?:do not|don't|dont|never|without)\s+(?:merge|release|deploy|ship|go\s+live)|(?:不要|唔好|不用|唔使|毋須)[^\r\n]{0,20}(?:release|deploy|ship|merge|發布|發佈|上線)/i
const RELEASE_CONTINUATION = /--then-release\b|(?:finish|complete|implement|build|fix|do)\b[^\r\n]{0,100}\b(?:and|then)\b[^\r\n]{0,30}\b(?:merge|release|deploy|ship|go\s+live)\b|(?:after|once|when)\b[^\r\n]{0,100}\b(?:release|deploy|ship|go\s+live)\b|(?:merge)\b[^\r\n]{0,30}\b(?:and|then)\b[^\r\n]{0,20}\b(?:release|deploy|ship|go\s+live)\b|(?:完成|做完|搞掂)[^\r\n]{0,60}(?:之後|後|然后|然後|並|同埋|再|就)[^\r\n]{0,30}(?:release|deploy|ship|發布|發佈|上線)|(?:直接|自動)[^\r\n]{0,20}(?:release|deploy|ship|發布|發佈|上線)/i
const AMBIGUOUS_RELEASE_CONTINUATION = [
  /[?？]\s*$/,
  /\b(?:can|could|should|would|may|might|whether)\b[^\r\n]{0,100}\b(?:merge|release|deploy|ship|go\s+live)\b/i,
  /\b(?:later|future|eventually|someday)\b[^\r\n]{0,100}\b(?:merge|release|deploy|ship|go\s+live)\b/i,
  /\b(?:merge|release|deploy|ship|go\s+live)\b[^\r\n]{0,100}\b(?:later|future|eventually|someday)\b/i,
  /["“”][^\r\n"“”]{0,120}\b(?:merge|release|deploy|ship|go\s+live)\b[^\r\n"“”]{0,120}["“”]/i,
  /(?:可唔可以|可不可以|是否|可否|能否|會唔會|会不会|幾時|何時|何时|什么时候)[^\r\n]{0,100}(?:merge|release|deploy|ship|go\s+live|發布|發佈|上線|部署|合併|合并)/i,
  /(?:merge|release|deploy|ship|go\s+live|發布|發佈|上線|部署|合併|合并)[^\r\n]{0,30}(?:得唔得|行唔行|可以嗎|可以吗|好唔好|好不好|嗎|吗|呢)\s*[。.!！]?\s*$/i,
  /["“”][^\r\n"“”]{0,120}(?:發布|發佈|上線|部署|合併|合并)[^\r\n"“”]{0,120}["“”]/i,
  /(?:想|希望|可能|也許|也许|第時|遲啲|迟点|將來|将来)[^\r\n]{0,60}(?:merge|release|deploy|ship|go\s+live|發布|發佈|上線|部署|合併|合并)/i,
]

export function resolveHistoryRoot(env = process.env) {
  return env.CODEX_AUTO_PILOT_DATA || join(homedir(), '.codex-auto-pilot', 'history')
}

export function isAutoPilotInvocation(prompt) {
  return Boolean(parseAutoPilotInvocation(prompt))
}

export function parseAutoPilotInvocation(prompt) {
  if (typeof prompt !== 'string') return null
  const command = prompt.match(LEADING_SKILL)
  const selected = command ? null : prompt.match(SELECTED_SKILL)
  const match = command || selected
  if (!match) return null

  const argument = prompt.slice(match[0].length).trim()
  if (NON_EXECUTION_REQUEST.test(argument)) return null
  const subcommand = argument.match(/^(pr|release|promote|ship)(?=\s|$)/i)?.[1]?.toLowerCase() || null
  const releaseMode = subcommand === 'release' || subcommand === 'promote'
  const explicitContinuation = subcommand === 'ship' || /--then-release\b/i.test(argument)
  const continuation = !releaseMode && !NO_RELEASE_CONTINUATION.test(argument)
    && (explicitContinuation || (!ambiguousReleaseContinuation(argument) && RELEASE_CONTINUATION.test(argument)))
    ? 'release'
    : null
  return {
    mode: releaseMode ? 'release' : 'pr',
    continuation,
    invocation_source: command ? 'leading_command' : 'leading_skill_selection',
    explicit_subcommand: subcommand,
    goal_id: argument.match(GOAL_MARKER)?.[1] || null,
  }
}

function ambiguousReleaseContinuation(value) {
  return AMBIGUOUS_RELEASE_CONTINUATION.some((pattern) => pattern.test(value))
}

export async function handleHookEvent(event, options = {}) {
  if (!event || typeof event !== 'object') return {handled: false, reason: 'invalid_event'}
  const env = options.env || process.env
  const dataRoot = options.dataRoot || resolveHistoryRoot(env)
  const now = options.now || (() => new Date())

  switch (event.hook_event_name) {
    case 'UserPromptSubmit':
      {
        const invocation = parseAutoPilotInvocation(event.prompt)
        if (!invocation) return {handled: false, reason: 'not_auto_pilot'}
        return startRun(event, {dataRoot, now, invocation, env})
      }
    case 'SubagentStop':
      return archiveSubagent(event, {dataRoot, now})
    case 'Stop':
      return finalizeTurn(event, {dataRoot, now, reason: 'turn_stop'})
    case 'SessionEnd':
      return finalizeSession(event, {dataRoot, now})
    default:
      return {handled: false, reason: 'unsupported_event'}
  }
}

function startRun(event, {dataRoot, now, invocation, env}) {
  requireIds(event)
  ensurePrivateDirectory(dataRoot)
  const directory = runDirectory(dataRoot, event.session_id, event.turn_id)
  ensurePrivateDirectory(directory)
  const transcriptBytes = transcriptByteSize(event.transcript_path)
  const bundle = installedSkillBundle()
  const routingConfig = resolveAutoPilotConfig({env, prompt: event.prompt, strict: false})
  archiveInstalledSkillVersion(dataRoot, bundle, now(), {
    schema_version: HISTORY_SCHEMA_VERSION,
    auto_pilot_version: AUTO_PILOT_VERSION,
  })
  const manifest = {
    schema_version: HISTORY_SCHEMA_VERSION,
    auto_pilot_version: AUTO_PILOT_VERSION,
    collector_version: HISTORY_SCHEMA_VERSION,
    skill_sha256: installedSkillHash(),
    skill_bundle_sha256: bundle.sha256,
    skill_bundle_files: bundle.files,
    run_id: runKey(event.session_id, event.turn_id),
    session_id: event.session_id,
    turn_id: event.turn_id,
    status: 'running',
    terminal_state: null,
    mode: invocation.mode,
    continuation: invocation.continuation,
    invocation_source: invocation.invocation_source,
    explicit_subcommand: invocation.explicit_subcommand,
    goal_id: invocation.goal_id || runKey(event.session_id, event.turn_id),
    goal_id_source: invocation.goal_id ? 'invocation_marker' : 'run_id',
    goal_id_sources: [invocation.goal_id ? 'invocation_marker' : 'run_id'],
    started_at: now().toISOString(),
    ended_at: null,
    cwd: stringOrNull(event.cwd),
    model: stringOrNull(event.model),
    effort: null,
    permission_mode: stringOrNull(event.permission_mode),
    routing_config: routingConfig,
    invocation_prompt_sha256: sha256Text(event.prompt),
    transcript_source: stringOrNull(event.transcript_path),
    transcript_start_bytes: transcriptBytes,
    transcript_end_bytes: null,
    parser_version: null,
    materializer_version: null,
    materialized_at: null,
    raw_retention_days: historyConfig(dataRoot).raw_retention_days,
    raw_pruned_at: null,
  }
  writePrivateJson(join(directory, 'manifest.json'), manifest)
  return {handled: true, action: 'started', run_id: manifest.run_id, directory}
}

function archiveSubagent(event, {dataRoot, now}) {
  if (!event.session_id || !event.turn_id || !event.agent_id) return {handled: false, reason: 'missing_ids'}
  const directory = runDirectory(dataRoot, event.session_id, event.turn_id)
  if (!existsSync(join(directory, 'manifest.json'))) return {handled: false, reason: 'run_not_active'}
  const agents = join(directory, 'agents')
  ensurePrivateDirectory(agents)
  const key = safeSegment(event.agent_id)
  const marker = {
    schema_version: HISTORY_SCHEMA_VERSION,
    agent_id: event.agent_id,
    agent_type: stringOrNull(event.agent_type),
    stopped_at: now().toISOString(),
    transcript_source: stringOrNull(event.agent_transcript_path),
    transcript_end_bytes: transcriptByteSize(event.agent_transcript_path),
  }
  writePrivateJson(join(agents, `${key}.marker.json`), marker)
  return {handled: true, action: 'subagent_marked', agent_id: event.agent_id}
}

async function finalizeTurn(event, context) {
  if (!event.session_id || !event.turn_id) return {handled: false, reason: 'missing_ids'}
  const directory = runDirectory(context.dataRoot, event.session_id, event.turn_id)
  if (!existsSync(join(directory, 'manifest.json'))) return {handled: false, reason: 'run_not_active'}
  return markRunTerminal(directory, event, context)
}

async function finalizeSession(event, context) {
  if (!event.session_id || !existsSync(runsRoot(context.dataRoot))) return {handled: false, reason: 'run_not_active'}
  const results = []
  for (const directory of runDirectories(context.dataRoot)) {
    const manifest = readJson(join(directory, 'manifest.json'))
    if (manifest?.session_id !== event.session_id || manifest.status !== 'running') continue
    results.push(markRunTerminal(directory, event, {...context, reason: 'session_end'}))
  }
  return results.length ? {handled: true, action: 'session_recovered', runs: results.length} : {handled: false, reason: 'run_not_active'}
}

function markRunTerminal(directory, event, {now, reason}) {
  const manifestPath = join(directory, 'manifest.json')
  const manifest = readJson(manifestPath)
  if (!manifest) return {handled: false, reason: 'missing_manifest'}
  if (manifest.status === 'finished') return {handled: true, action: 'already_finished', run_id: manifest.run_id}

  const endedAt = now()
  const transcriptPath = regularFile(event.transcript_path) ? event.transcript_path : manifest.transcript_source
  const receiptSnapshot = snapshotCompletionReceipt(event.last_assistant_message, directory)
  writePrivateJson(join(directory, 'terminal.json'), {
    schema_version: HISTORY_SCHEMA_VERSION,
    run_id: manifest.run_id,
    reason,
    ended_at: endedAt.toISOString(),
    transcript_source: stringOrNull(transcriptPath),
    transcript_end_bytes: transcriptByteSize(transcriptPath),
    last_assistant_message_sha256: sha256Text(event.last_assistant_message),
    receipt_snapshot: receiptSnapshot,
  })
  writePrivateJson(manifestPath, {
    ...manifest,
    status: 'pending_materialization',
    terminal_state: null,
    ended_at: endedAt.toISOString(),
    transcript_source: stringOrNull(transcriptPath) || manifest.transcript_source,
    transcript_end_bytes: transcriptByteSize(transcriptPath),
  })
  return {handled: true, action: 'marked_terminal', run_id: manifest.run_id}
}

export function historyConfig(dataRoot = resolveHistoryRoot()) {
  const configured = readJson(join(dataRoot, 'config.json'))
  return {
    schema_version: HISTORY_SCHEMA_VERSION,
    raw_retention_days: configured?.raw_retention_days === null
      ? null
      : positiveInteger(configured?.raw_retention_days) || DEFAULT_RAW_RETENTION_DAYS,
  }
}

export function setRawRetention(value, dataRoot = resolveHistoryRoot()) {
  const days = value === 'forever' || value === null ? null : positiveInteger(Number(value))
  if (days === undefined) throw new Error('retention must be a positive day count or forever')
  ensurePrivateDirectory(dataRoot)
  const config = {schema_version: HISTORY_SCHEMA_VERSION, raw_retention_days: days}
  writePrivateJson(join(dataRoot, 'config.json'), config)
  return config
}

export function pruneExpiredRaw(dataRoot = resolveHistoryRoot(), now = new Date()) {
  const retention = historyConfig(dataRoot).raw_retention_days
  if (retention === null || !existsSync(runsRoot(dataRoot))) return {pruned_runs: 0, pruned_files: 0}
  const cutoff = now.getTime() - retention * 24 * 60 * 60 * 1000
  let prunedRuns = 0
  let prunedFiles = 0
  for (const directory of runDirectories(dataRoot)) {
    const manifestPath = join(directory, 'manifest.json')
    const manifest = readJson(manifestPath)
    const reference = Date.parse(manifest?.ended_at || manifest?.started_at || '')
    if (!Number.isFinite(reference) || reference >= cutoff || manifest?.raw_pruned_at) continue
    for (const path of rawTranscriptPaths(directory)) {
      rmSync(path, {force: true})
      prunedFiles += 1
    }
    writePrivateJson(manifestPath, {...manifest, raw_pruned_at: now.toISOString()})
    prunedRuns += 1
  }
  return {pruned_runs: prunedRuns, pruned_files: prunedFiles}
}

export function historyStatus(dataRoot = resolveHistoryRoot()) {
  const runs = loadRuns(dataRoot)
  const rawBytes = runs.reduce((sum, run) => sum + rawTranscriptPaths(run.directory).reduce((size, path) => size + statSync(path).size, 0), 0)
  return {
    data_root: dataRoot,
    retention: historyConfig(dataRoot).raw_retention_days,
    runs: runs.length,
    running: runs.filter((run) => run.manifest.status === 'running').length,
    pending_materialization: runs.filter((run) => run.manifest.status === 'pending_materialization').length,
    finished: runs.filter((run) => run.manifest.status === 'finished').length,
    raw_bytes: rawBytes,
  }
}

export async function materializeHistory({dataRoot = resolveHistoryRoot(), now = () => new Date()} = {}) {
  const result = await materializePendingRuns({dataRoot, schemaVersion: HISTORY_SCHEMA_VERSION, now})
  return {...result, retention: pruneExpiredRaw(dataRoot, now())}
}

export async function historyRuns({dataRoot = resolveHistoryRoot(), sinceDays = null, materialize = true} = {}) {
  if (materialize) await materializeHistory({dataRoot})
  const cutoff = sinceDays ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : null
  return loadRuns(dataRoot)
    .filter((run) => !cutoff || Date.parse(run.manifest.started_at) >= cutoff)
    .map((run) => ({
      run_id: run.manifest.run_id,
      started_at: run.manifest.started_at,
      duration_ms: run.metrics?.duration_ms ?? null,
      model: run.metrics?.model ?? run.manifest.model,
      effort: run.metrics?.effort ?? run.manifest.effort,
      auto_pilot_version: run.manifest.auto_pilot_version ?? null,
      skill_bundle_sha256: run.manifest.skill_bundle_sha256 ?? run.manifest.skill_sha256 ?? null,
      mode: run.manifest.mode ?? null,
      continuation: run.manifest.continuation ?? null,
      terminal_state: run.manifest.terminal_state,
      completion_receipt_status: run.outcome?.completion_receipt?.status ?? 'legacy_unverified',
      benchmark_eligible: run.outcome?.completion_receipt?.status === 'valid'
        && (run.manifest.schema_version < 4 || run.metrics?.collection_complete === true)
        && (run.metrics?.subagents === 0 || run.metrics?.subagent_token_accounting_complete === true),
      total_tokens: run.metrics?.token_usage_observed === false ? null : (run.metrics?.token_usage?.total_tokens ?? null),
      lifecycle_total_tokens: (
        run.metrics?.subagents === 0
        || run.metrics?.subagent_token_accounting_complete === true
        || (run.manifest.schema_version < 4 && run.metrics?.subagents === 0)
      ) ? (run.metrics?.token_usage?.total_tokens ?? null) : null,
      cached_input_tokens: run.metrics?.token_usage?.cached_input_tokens ?? null,
      tool_calls: run.metrics?.tool_calls ?? null,
      subagents: run.metrics?.subagents ?? null,
      orchestration_status: run.metrics?.routing?.status ?? run.manifest.orchestration_status ?? 'legacy_unobserved',
      goal_id: run.manifest.goal_id ?? run.manifest.run_id,
      goal_id_source: run.manifest.goal_id_source ?? 'legacy_unlinked',
      goal_id_sources: run.manifest.goal_id_sources ?? [run.manifest.goal_id_source ?? 'legacy_unlinked'],
      ended_at: run.manifest.ended_at ?? null,
      compactions: run.metrics?.compactions ?? null,
      topology: run.metrics?.topology ?? null,
    }))
    .sort((left, right) => left.started_at.localeCompare(right.started_at))
}

export async function historyReport(options = {}) {
  const allRuns = await historyRuns(options)
  const runs = allRuns.filter((run) => Number.isFinite(run.total_tokens))
  const totals = runs.map((run) => run.total_tokens).sort((a, b) => a - b)
  const medianTokens = percentile(totals, 0.5)
  const threshold = medianTokens === null ? null : medianTokens * 2
  const benchmark = runs.filter((run) => run.benchmark_eligible)
  const versions = {}
  for (const run of runs) {
    const version = run.auto_pilot_version || 'unknown'
    if (!versions[version]) versions[version] = new Set()
    if (run.skill_bundle_sha256) versions[version].add(run.skill_bundle_sha256)
  }
  const goals = summarizeGoals(allRuns)
  const benchmarkGoals = goals.filter((goal) => goal.benchmark_eligible)
  return {
    runs: runs.length,
    benchmark_runs: benchmark.length,
    excluded_unverified_runs: runs.length - benchmark.length,
    terminal_states: countValues(runs.map((run) => run.terminal_state || 'unknown')),
    continuations: countValues(runs.map((run) => run.continuation || 'none')),
    orchestration_statuses: countValues(runs.map((run) => run.orchestration_status || 'legacy_unobserved')),
    total_tokens: totals.reduce((sum, value) => sum + value, 0),
    median_tokens: medianTokens,
    p95_tokens: percentile(totals, 0.95),
    max_tokens: totals.length ? totals.at(-1) : null,
    median_duration_ms: percentile(runs.map((run) => run.duration_ms).filter(Number.isFinite).sort((a, b) => a - b), 0.5),
    outliers: threshold === null ? [] : runs.filter((run) => run.total_tokens > threshold).map((run) => run.run_id),
    version_bundles: Object.fromEntries(Object.entries(versions).map(([version, hashes]) => [version, [...hashes].sort()])),
    version_drift: Object.entries(versions).filter(([, hashes]) => hashes.size > 1).map(([version]) => version),
    benchmark: summarizeRuns(benchmark),
    goals: goals.length,
    benchmark_goals: benchmarkGoals.length,
    excluded_unverified_goals: goals.length - benchmarkGoals.length,
    goal_benchmark: summarizeGoalCohort(benchmarkGoals),
  }
}

export async function historyGoals(options = {}) {
  return summarizeGoals(await historyRuns(options))
}

function loadRuns(dataRoot) {
  return runDirectories(dataRoot).map((directory) => ({
    directory,
    manifest: readJson(join(directory, 'manifest.json')),
    metrics: readJson(join(directory, 'metrics.json')),
    outcome: readJson(join(directory, 'outcome.json')),
  })).filter((run) => run.manifest)
}

function summarizeRuns(runs) {
  const totals = runs.map((run) => run.total_tokens).filter(Number.isFinite).sort((a, b) => a - b)
  const durations = runs.map((run) => run.duration_ms).filter(Number.isFinite).sort((a, b) => a - b)
  return {
    runs: runs.length,
    terminal_states: countValues(runs.map((run) => run.terminal_state || 'unknown')),
    total_tokens: totals.reduce((sum, value) => sum + value, 0),
    median_tokens: percentile(totals, 0.5),
    median_duration_ms: percentile(durations, 0.5),
  }
}

function summarizeGoals(runs) {
  const grouped = new Map()
  for (const run of runs) {
    const goalId = run.goal_id || run.run_id
    if (!grouped.has(goalId)) grouped.set(goalId, [])
    grouped.get(goalId).push(run)
  }
  return [...grouped.entries()].map(([goalId, items]) => {
    const sorted = [...items].sort((left, right) => left.started_at.localeCompare(right.started_at))
    const sources = new Set(sorted.flatMap((run) => run.goal_id_sources || [run.goal_id_source]))
    const linked = sorted.length > 1 && sources.has('routing_marker') && sources.has('invocation_marker')
    const single = sorted.length === 1 && sources.has('run_id')
    const lineageStatus = linked ? 'linked' : single ? 'single_run' : 'unverified'
    const starts = sorted.map((run) => Date.parse(run.started_at)).filter(Number.isFinite)
    const ends = sorted.map((run) => Date.parse(run.ended_at)).filter(Number.isFinite)
    const allTokensKnown = sorted.every((run) => Number.isFinite(run.lifecycle_total_tokens))
    const allDurationsKnown = sorted.every((run) => Number.isFinite(run.duration_ms))
    const allCompactionsKnown = sorted.every((run) => Number.isFinite(run.compactions))
    return {
      goal_id: goalId,
      lineage_status: lineageStatus,
      runs: sorted.length,
      run_ids: sorted.map((run) => run.run_id),
      started_at: starts.length ? new Date(Math.min(...starts)).toISOString() : null,
      ended_at: ends.length === sorted.length ? new Date(Math.max(...ends)).toISOString() : null,
      wall_duration_ms: starts.length && ends.length === sorted.length ? Math.max(...ends) - Math.min(...starts) : null,
      active_duration_ms: allDurationsKnown ? sorted.reduce((sum, run) => sum + run.duration_ms, 0) : null,
      total_tokens: allTokensKnown ? sorted.reduce((sum, run) => sum + run.lifecycle_total_tokens, 0) : null,
      tool_calls: sorted.every((run) => Number.isFinite(run.tool_calls))
        ? sorted.reduce((sum, run) => sum + run.tool_calls, 0) : null,
      compactions: allCompactionsKnown ? sorted.reduce((sum, run) => sum + run.compactions, 0) : null,
      subagents: sorted.every((run) => Number.isFinite(run.subagents))
        ? sorted.reduce((sum, run) => sum + run.subagents, 0) : null,
      models: countValues(sorted.map((run) => run.model || 'unknown')),
      max_observed_agent_depth: sorted.every((run) => run.topology?.max_observed_depth !== null && run.topology?.max_observed_depth !== undefined)
        ? Math.max(...sorted.map((run) => run.topology.max_observed_depth))
        : null,
      terminal_states: countValues(sorted.map((run) => run.terminal_state || 'unknown')),
      benchmark_eligible: ['linked', 'single_run'].includes(lineageStatus)
        && sorted.every((run) => run.benchmark_eligible)
        && allTokensKnown,
    }
  }).sort((left, right) => (left.started_at || '').localeCompare(right.started_at || ''))
}

function summarizeGoalCohort(goals) {
  const totals = goals.map((goal) => goal.total_tokens).filter(Number.isFinite).sort((a, b) => a - b)
  const wall = goals.map((goal) => goal.wall_duration_ms).filter(Number.isFinite).sort((a, b) => a - b)
  return {
    goals: goals.length,
    total_tokens: totals.reduce((sum, value) => sum + value, 0),
    median_tokens: percentile(totals, 0.5),
    p95_tokens: percentile(totals, 0.95),
    median_wall_duration_ms: percentile(wall, 0.5),
  }
}

function rawTranscriptPaths(directory) {
  const paths = []
  const root = join(directory, 'transcript.jsonl')
  if (regularFile(root)) paths.push(root)
  const receiptSource = join(directory, 'receipt-source.json')
  if (regularFile(receiptSource)) paths.push(receiptSource)
  const agents = join(directory, 'agents')
  if (existsSync(agents) && lstatSync(agents).isDirectory()) {
    for (const name of readdirSync(agents)) {
      const path = join(agents, name)
      if (name.endsWith('.jsonl') && regularFile(path)) paths.push(path)
    }
  }
  return paths
}

function runDirectories(dataRoot) {
  const root = runsRoot(dataRoot)
  if (!existsSync(root) || !lstatSync(root).isDirectory()) return []
  return readdirSync(root).map((name) => join(root, name)).filter((path) => lstatSync(path).isDirectory())
}

function runsRoot(dataRoot) { return join(dataRoot, 'runs') }
function runDirectory(dataRoot, sessionId, turnId) { return join(runsRoot(dataRoot), runKey(sessionId, turnId)) }
function runKey(sessionId, turnId) { return `${safeSegment(sessionId)}--${safeSegment(turnId)}` }
function safeSegment(value) { return String(value || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180) }

function requireIds(event) {
  if (!event.session_id || !event.turn_id) throw new Error('hook event is missing session_id or turn_id')
}

function regularFile(path) {
  if (!path || !existsSync(path)) return false
  const stats = lstatSync(path)
  return stats.isFile() && !stats.isSymbolicLink()
}

function ensurePrivateDirectory(path) {
  if (existsSync(path)) {
    const stats = lstatSync(path)
    if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`refusing unsafe history directory: ${path}`)
  } else {
    const parent = dirname(path)
    if (existsSync(parent)) {
      const parentStats = lstatSync(parent)
      if (parentStats.isSymbolicLink() || !parentStats.isDirectory()) throw new Error(`refusing unsafe history parent: ${parent}`)
    }
  }
  mkdirSync(path, {recursive: true, mode: 0o700})
  try { chmodSync(path, 0o700) } catch {}
}

function writePrivateJson(path, value) {
  ensurePrivateDirectory(dirname(path))
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`)
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600})
  renameSync(temporary, path)
  try { chmodSync(path, 0o600) } catch {}
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function sha256Text(value) {
  return typeof value === 'string' ? createHash('sha256').update(value).digest('hex') : null
}

function stringOrNull(value) { return typeof value === 'string' && value ? value : null }
function positiveInteger(value) { return Number.isInteger(value) && value > 0 ? value : undefined }
function transcriptByteSize(path) { return regularFile(path) ? statSync(path).size : 0 }

function installedSkillHash() {
  try { return createHash('sha256').update(readFileSync(new URL('../SKILL.md', import.meta.url))).digest('hex') } catch { return null }
}

function countValues(values) {
  return values.reduce((counts, value) => ({...counts, [value]: (counts[value] || 0) + 1}), {})
}

function percentile(sorted, ratio) {
  if (!sorted.length) return null
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))]
}
