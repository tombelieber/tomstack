const ROUTING_SCHEMA_VERSION = 3
const ROUTING_MARKER = /<!--\s*auto-pilot-routing:\s*(\{[^\r\n]*\})\s*-->/gi
const CREATED_THREAD_DIRECTIVE = /::created-thread\{([^}]*)\}/g
const TASK_REFERENCE = /(?:threadId|clientThreadId)="([^"]+)"/
const GOAL_ID = /^apg_[A-Za-z0-9_-]{12,80}$/

const IMPLEMENTATION_LANES = new Set(['independent_task', 'direct', 'collaboration_subagent', 'not_applicable'])
const CONTINUATION_LANES = new Set([
  'current_ship_task',
  'current_release_task',
  'not_requested',
  // Parse legacy markers so the audit can explain the contract deviation.
  'fresh_release_task',
  'reused_release_task',
  'fallback_command',
])

export function auditRouting({message, manifest, subagents = 0}) {
  const createdThreadRefs = createdThreadReferences(message)
  const parsed = parseRoutingMarker(message)
  const unverified = leafDepthEvidence(subagents)
  if (parsed.status !== 'valid') {
    return {
      schema_version: ROUTING_SCHEMA_VERSION,
      status: parsed.status === 'missing' ? 'unknown' : 'deviation',
      marker_status: parsed.status,
      declared: null,
      created_thread_refs: createdThreadRefs,
      observed_subagents: subagents,
      unverified,
      deviations: parsed.error ? [parsed.error] : ['routing marker missing'],
    }
  }

  const declared = parsed.value
  const deviations = []
  let fallback = false
  validateShape(declared, deviations)

  if (!deviations.length) {
    const implementationResult = auditImplementation({declared, manifest, subagents, createdThreadRefs, deviations})
    const continuationResult = auditContinuation({declared, manifest, message, createdThreadRefs, deviations})
    fallback = implementationResult.fallback || continuationResult.fallback
    auditCreatedTaskAccounting({declared, manifest, createdThreadRefs, deviations, unverified})
  }

  return {
    schema_version: ROUTING_SCHEMA_VERSION,
    status: deviations.length ? 'deviation' : fallback ? 'fallback' : 'passed',
    marker_status: 'valid',
    declared,
    created_thread_refs: createdThreadRefs,
    observed_subagents: subagents,
    unverified,
    deviations,
  }
}

export function parseRoutingMarker(message) {
  if (typeof message !== 'string') return {status: 'missing', value: null, error: null}
  const markers = [...message.matchAll(ROUTING_MARKER)]
  if (!markers.length) return {status: 'missing', value: null, error: null}
  if (markers.length !== 1) return {status: 'invalid', value: null, error: 'routing marker must appear exactly once'}
  try {
    return {status: 'valid', value: JSON.parse(markers[0][1]), error: null}
  } catch {
    return {status: 'invalid', value: null, error: 'routing marker is not valid single-line JSON'}
  }
}

function auditImplementation({declared, manifest, subagents, createdThreadRefs, deviations}) {
  const value = declared.implementation
  const executor = manifest.routing_config?.implementation?.substantive_executor || 'auto'
  const collaboration = manifest.routing_config?.collaboration?.policy || 'auto'
  let fallback = false

  if (manifest.mode === 'release') {
    if (value.lane !== 'not_applicable') deviations.push('release mode requires implementation.lane=not_applicable')
    return {fallback}
  }

  if (manifest.continuation === 'release' && value.lane === 'independent_task') {
    deviations.push('ship implementation and production ownership must remain in the same task')
  }

  if (value.lane === 'independent_task') {
    requireTaskEvidence(value, createdThreadRefs, 'implementation', deviations)
    if (!['task', 'auto'].includes(executor)) deviations.push(`implementation lane conflicts with configured executor=${executor}`)
    fallback = preferenceFallback(value, manifest.routing_config?.implementation, 'implementation', deviations)
  } else if (value.lane === 'collaboration_subagent') {
    if (!['subagent', 'auto'].includes(executor)) deviations.push(`primary subagent was not explicitly configured; executor=${executor}`)
    if (subagents < 1) deviations.push('primary subagent declared but no archived subagent was observed')
    if (value.worktree !== true) deviations.push('primary subagent requires worktree=true for implementation writes')
    if (!value.reason) deviations.push('primary subagent requires a reason')
    fallback = preferenceFallback(value, manifest.routing_config?.implementation, 'implementation', deviations)
  } else if (value.lane === 'direct') {
    if (!value.reason) deviations.push('direct implementation requires a reason')
    if (executor === 'subagent') deviations.push('direct implementation conflicts with configured executor=subagent')
    fallback = /fallback|unavailable|failed/i.test(value.reason || '')
  } else if (value.lane === 'not_applicable') {
    deviations.push('PR mode requires a real implementation lane')
  }

  if (collaboration === 'off' && subagents > 0) deviations.push('collaboration.policy=off but subagents were observed')
  return {fallback}
}

function auditContinuation({declared, manifest, deviations}) {
  const value = declared.continuation
  let fallback = false

  if (manifest.mode === 'release') {
    if (value.lane !== 'current_release_task') deviations.push('release mode requires continuation.lane=current_release_task')
    else fallback = preferenceFallback(value, manifest.routing_config?.release, 'release', deviations)
    return {fallback}
  }

  if (manifest.continuation === 'release') {
    if (value.lane !== 'current_ship_task') {
      deviations.push('ship release continuation must remain in the same task with continuation.lane=current_ship_task')
    }
  } else if (value.lane !== 'not_requested') {
    deviations.push('PR-only mode requires continuation.lane=not_requested')
  }

  return {fallback}
}

function validateShape(value, deviations) {
  if (!plainObject(value)) {
    deviations.push('routing marker must be an object')
    return
  }
  if (value.goal_id !== null && value.goal_id !== undefined && !GOAL_ID.test(value.goal_id)) {
    deviations.push('goal_id must be an opaque apg_ identifier')
  }
  for (const section of ['implementation', 'continuation']) {
    if (!plainObject(value[section])) {
      deviations.push(`routing marker requires ${section} object`)
      continue
    }
    const allowedLanes = section === 'implementation' ? IMPLEMENTATION_LANES : CONTINUATION_LANES
    if (!allowedLanes.has(value[section].lane)) deviations.push(`invalid ${section}.lane`)
    for (const field of ['task_ref', 'model', 'thinking', 'reason']) {
      if (value[section][field] !== null && value[section][field] !== undefined && typeof value[section][field] !== 'string') {
        deviations.push(`${section}.${field} must be a string or null`)
      }
    }
    if (value[section].worktree !== null && value[section].worktree !== undefined && typeof value[section].worktree !== 'boolean') {
      deviations.push(`${section}.worktree must be boolean or null`)
    }
  }
}

function requireTaskEvidence(value, createdThreadRefs, label, deviations) {
  if (!value.task_ref) deviations.push(`${label} requires task_ref`)
  if (value.worktree !== true) deviations.push(`${label} requires worktree=true`)
  if (value.task_ref && !createdThreadRefs.includes(value.task_ref)) deviations.push(`${label} task_ref has no matching created-thread directive`)
}

function auditCreatedTaskAccounting({declared, manifest, createdThreadRefs, deviations, unverified}) {
  const declaredRefs = []
  if (declared.implementation.lane === 'independent_task' && declared.implementation.task_ref) {
    declaredRefs.push(declared.implementation.task_ref)
  }
  const unexpected = createdThreadRefs.filter((reference) => !declaredRefs.includes(reference))
  if (!unexpected.length) return
  if (manifest.mode !== 'release' && declared.implementation.lane === 'independent_task') {
    unverified.push(`additional owner-stage relationships are not exposed by the current routing marker: ${unexpected.join(', ')}`)
    return
  }
  deviations.push(`created task directive is not accounted for by a declared lane: ${unexpected.join(', ')}`)
}

function leafDepthEvidence(subagents) {
  if (subagents < 1) return []
  return ['agent parent-child delegation depth is not exposed by the current history hooks']
}

function preferenceFallback(value, expected, label, deviations) {
  if (!expected) return false
  const mismatches = []
  if (value.model !== expected.model) mismatches.push('model')
  if (value.thinking !== expected.thinking) mismatches.push('thinking')
  if (!mismatches.length) return false
  if (!value.reason) {
    deviations.push(`${label} ${mismatches.join('/')} differs from resolved preference without a fallback reason`)
    return false
  }
  return true
}

function createdThreadReferences(message) {
  if (typeof message !== 'string') return []
  const references = []
  for (const match of message.matchAll(CREATED_THREAD_DIRECTIVE)) {
    const reference = match[1].match(TASK_REFERENCE)?.[1]
    if (reference && !references.includes(reference)) references.push(reference)
  }
  return references
}

function plainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
