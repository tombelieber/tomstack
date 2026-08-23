# Cleanup

## What it does

Uses `orphan-reaper` to find development processes that outlived their agent or
terminal session and can recover their memory safely.

## When to reach for it

Use it when the machine is slow, CPU or memory is unexpectedly high, or the
user asks to inspect or clean abandoned development servers.

## Common questions

- Does a scan kill anything? No.
- Are terminal-owned processes killed? No, a controlling TTY marks them as
  intentional.
- Is confirmation required? Scan first and ask unless the user already asked
  to clean or kill.

## It's working if

Only no-TTY processes matching known or user-configured patterns are selected,
and the result reports process count and recovered memory.
