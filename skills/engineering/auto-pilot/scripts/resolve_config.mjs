#!/usr/bin/env node

import {existsSync, lstatSync, readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {isAbsolute, join} from 'node:path'
import {pathToFileURL} from 'node:url'

export const CONFIG_SCHEMA_VERSION = 1

export const DEFAULT_AUTO_PILOT_SETTINGS = Object.freeze({
  implementation: Object.freeze({
    substantive_executor: 'auto',
    model: 'gpt-5.6-sol',
    thinking: 'xhigh',
  }),
  release: Object.freeze({
    model: 'gpt-5.6-sol',
    thinking: 'xhigh',
  }),
  collaboration: Object.freeze({
    policy: 'auto',
    model: 'gpt-5.6-luna',
    thinking: 'max',
  }),
})

const EXECUTORS = new Set(['task', 'direct', 'subagent', 'auto'])
const COLLABORATION_POLICIES = new Set(['auto', 'off'])
const THINKING_LEVELS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
const MAX_CONFIG_BYTES = 64 * 1024
const DEFAULT_CONFIG_PATH = () => join(homedir(), '.codex-auto-pilot', 'config.json')
const LEADING_SKILL_SELECTION = /^\s*\[\$auto-pilot\]\([^)]+\)\s*/i
const OVERRIDE_FLAGS = [
  ['implementation-executor', 'implementation', 'substantive_executor'],
  ['implementation-model', 'implementation', 'model'],
  ['implementation-thinking', 'implementation', 'thinking'],
  ['release-model', 'release', 'model'],
  ['release-thinking', 'release', 'thinking'],
  ['collaboration', 'collaboration', 'policy'],
  ['collaboration-model', 'collaboration', 'model'],
  ['collaboration-thinking', 'collaboration', 'thinking'],
]

export function defaultConfigPath(env = process.env) {
  return env.CODEX_AUTO_PILOT_CONFIG || DEFAULT_CONFIG_PATH()
}

export function resolveAutoPilotConfig({env = process.env, prompt = '', configPath = null, strict = true} = {}) {
  const requestedPath = configPath || defaultConfigPath(env)
  const warnings = []
  const path = resolveConfigPath(requestedPath, strict, warnings)
  let userConfig = {}
  let loaded = false

  try {
    if (existsSync(path)) {
      const stats = lstatSync(path)
      if (stats.isSymbolicLink() || !stats.isFile()) throw new Error(`refusing unsafe config path: ${path}`)
      if (stats.size > MAX_CONFIG_BYTES) throw new Error(`config exceeds ${MAX_CONFIG_BYTES} bytes: ${path}`)
      userConfig = JSON.parse(readFileSync(path, 'utf8'))
      validateConfigDocument(userConfig)
      loaded = true
    }
  } catch (error) {
    if (strict) throw error
    warnings.push(error.message)
    userConfig = {}
  }

  let overrides = {}
  try {
    overrides = parseInvocationOverrides(prompt)
    validateConfigDocument({schema_version: CONFIG_SCHEMA_VERSION, ...overrides})
  } catch (error) {
    if (strict) throw error
    warnings.push(error.message)
    overrides = {}
  }

  let settings
  try {
    settings = mergeSettings(DEFAULT_AUTO_PILOT_SETTINGS, userConfig, overrides)
    validateResolvedSettings(settings)
  } catch (error) {
    if (strict) throw error
    warnings.push(error.message)
    settings = mergeSettings(DEFAULT_AUTO_PILOT_SETTINGS, {}, {})
  }

  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    ...settings,
    source: {
      config_path: path,
      config_loaded: loaded,
      invocation_overrides: overrideKeys(overrides),
      warnings,
    },
  }
}

export function parseInvocationOverrides(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) return {}
  const commandLine = prompt.replace(LEADING_SKILL_SELECTION, '').trimStart().split(/\r?\n/, 1)[0]
  rejectUnknownOverrideFlags(commandLine)
  const values = Object.fromEntries(OVERRIDE_FLAGS.map(([name]) => [name, flagValue(commandLine, name)]))
  return compactObject({
    implementation: compactObject({
      substantive_executor: values['implementation-executor'],
      model: values['implementation-model'],
      thinking: values['implementation-thinking'],
    }),
    release: compactObject({
      model: values['release-model'],
      thinking: values['release-thinking'],
    }),
    collaboration: compactObject({
      policy: values.collaboration,
      model: values['collaboration-model'],
      thinking: values['collaboration-thinking'],
    }),
  })
}

function rejectUnknownOverrideFlags(line) {
  const known = new Set(OVERRIDE_FLAGS.map(([name]) => name))
  const pattern = /(?:^|\s)--((?:implementation|release|collaboration)(?:-[a-z0-9-]+)?)(?==|\s|$)/gi
  const unknown = [...line.matchAll(pattern)]
    .map((match) => match[1])
    .filter((name) => !known.has(name))
  if (unknown.length) throw new Error(`unknown Auto Pilot override flag(s): ${[...new Set(unknown)].map((name) => `--${name}`).join(', ')}`)
}

function resolveConfigPath(requestedPath, strict, warnings) {
  if (isAbsolute(requestedPath)) return requestedPath
  const error = new Error(`config path must be absolute: ${requestedPath}`)
  if (strict) throw error
  warnings.push(error.message)
  return DEFAULT_CONFIG_PATH()
}

function validateConfigDocument(value) {
  if (!plainObject(value)) throw new Error('config must be a JSON object')
  assertKnownKeys(value, ['schema_version', 'implementation', 'release', 'collaboration'], 'config')
  if (value.schema_version !== undefined && value.schema_version !== CONFIG_SCHEMA_VERSION) {
    throw new Error(`unsupported config schema_version: ${value.schema_version}`)
  }

  if (value.implementation !== undefined) {
    assertObject(value.implementation, 'implementation')
    assertKnownKeys(value.implementation, ['substantive_executor', 'model', 'thinking'], 'implementation')
    if (value.implementation.substantive_executor !== undefined && !EXECUTORS.has(value.implementation.substantive_executor)) {
      throw new Error('implementation.substantive_executor must be task, direct, subagent, or auto')
    }
    validateModel(value.implementation.model, 'implementation.model')
    validateThinking(value.implementation.thinking, 'implementation.thinking')
  }

  if (value.release !== undefined) {
    assertObject(value.release, 'release')
    assertKnownKeys(value.release, ['model', 'thinking'], 'release')
    validateModel(value.release.model, 'release.model')
    validateThinking(value.release.thinking, 'release.thinking')
  }

  if (value.collaboration !== undefined) {
    assertObject(value.collaboration, 'collaboration')
    assertKnownKeys(value.collaboration, ['policy', 'model', 'thinking'], 'collaboration')
    if (value.collaboration.policy !== undefined && !COLLABORATION_POLICIES.has(value.collaboration.policy)) {
      throw new Error('collaboration.policy must be auto or off')
    }
    validateModel(value.collaboration.model, 'collaboration.model')
    validateThinking(value.collaboration.thinking, 'collaboration.thinking')
  }
}

function validateResolvedSettings(settings) {
  validateConfigDocument({schema_version: CONFIG_SCHEMA_VERSION, ...settings})
  if (settings.implementation.substantive_executor === 'subagent' && settings.collaboration.policy === 'off') {
    throw new Error('implementation.substantive_executor=subagent conflicts with collaboration.policy=off')
  }
}

function mergeSettings(defaults, userConfig, overrides) {
  return {
    implementation: {
      ...defaults.implementation,
      ...(userConfig.implementation || {}),
      ...(overrides.implementation || {}),
    },
    release: {
      ...defaults.release,
      ...(userConfig.release || {}),
      ...(overrides.release || {}),
    },
    collaboration: {
      ...defaults.collaboration,
      ...(userConfig.collaboration || {}),
      ...(overrides.collaboration || {}),
    },
  }
}

function flagValue(line, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?:^|\\s)--${escaped}(?:=|\\s+)(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, 'g')
  const matches = [...line.matchAll(pattern)]
  if (!matches.length) {
    if (new RegExp(`(?:^|\\s)--${escaped}=(?=\\s|$)`).test(line)) throw new Error(`--${name} requires a value`)
    if (new RegExp(`(?:^|\\s)--${escaped}(?=\\s|$)`).test(line)) throw new Error(`--${name} requires a value`)
    return undefined
  }
  if (matches.length > 1) throw new Error(`--${name} may be supplied only once`)
  const quoted = matches[0][1] !== undefined || matches[0][2] !== undefined
  const value = matches[0][1] ?? matches[0][2] ?? matches[0][3]
  if (!value || (!quoted && value.startsWith('--'))) throw new Error(`--${name} requires a value`)
  return value
}

function validateModel(value, label) {
  if (value === undefined) return
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /\s/.test(value)) {
    throw new Error(`${label} must be a non-empty model identifier without whitespace`)
  }
}

function validateThinking(value, label) {
  if (value !== undefined && !THINKING_LEVELS.has(value)) {
    throw new Error(`${label} must be one of ${[...THINKING_LEVELS].join(', ')}`)
  }
}

function assertObject(value, label) {
  if (!plainObject(value)) throw new Error(`${label} must be a JSON object`)
}

function assertKnownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length) throw new Error(`${label} has unknown field(s): ${unknown.join(', ')}`)
}

function plainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && (!plainObject(item) || Object.keys(item).length)))
}

function overrideKeys(overrides) {
  return Object.entries(overrides).flatMap(([section, values]) => Object.keys(values).map((key) => `${section}.${key}`))
}

function cliConfigPath(args) {
  const index = args.indexOf('--config')
  if (index === -1) return {path: null, remaining: args}
  if (!args[index + 1]) throw new Error('--config requires a path')
  return {
    path: args[index + 1],
    remaining: args.filter((_, position) => position !== index && position !== index + 1),
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    process.stdout.write('Usage: node resolve_config.mjs [--config PATH] [Auto Pilot override flags]\n')
    return
  }
  const selected = cliConfigPath(args)
  const resolved = resolveAutoPilotConfig({
    configPath: selected.path,
    prompt: `$auto-pilot ${selected.remaining.join(' ')}`,
  })
  process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`auto-pilot config error: ${error.message}\n`)
    process.exitCode = 1
  })
}
