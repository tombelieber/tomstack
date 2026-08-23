#!/usr/bin/env node

import {handleHookEvent} from './history.mjs'

let input = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) input += chunk

try {
  const event = JSON.parse(input)
  await handleHookEvent(event)
} catch (error) {
  // Collection is passive: never block or add context to the Auto Pilot run.
  if (process.env.CODEX_AUTO_PILOT_DEBUG === '1') console.error(`codex-auto-pilot history: ${error.message}`)
}

// Stop and SubagentStop require JSON stdout. Empty JSON is inert for every hook.
process.stdout.write('{}\n')
