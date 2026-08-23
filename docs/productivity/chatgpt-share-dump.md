# ChatGPT Share Dump

## What it does

Turns a ChatGPT shared-conversation URL into structured turns, Markdown context,
media manifests, and an optional portable archive.

## When to reach for it

Use it when a shared conversation must become reliable local evidence for
continuation, analysis, migration, preservation, or implementation.

## Common questions

- Does it scrape the visible page? No. The visible UI can be virtualized.
- Can it ignore missing media? It records the gap but does not claim a complete
  success archive.
- Does install tracking send conversation content? No.

## It's working if

The command exits successfully, visible turns are preserved, required media is
validated, and downstream agents have a complete context file.
