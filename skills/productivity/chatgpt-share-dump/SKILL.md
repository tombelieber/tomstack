---
name: chatgpt-share-dump
description: Dump ChatGPT shared conversations from https://chatgpt.com/share/... into agent-readable archives. Use when a user gives an AI agent a ChatGPT share link and asks it to continue, analyze, test, migrate, summarize, implement from, or preserve the full transcript as Markdown, JSON turns, current-state handoff context, and strict media manifests.
---

# ChatGPT Share Dump

You operate `chatgpt-share-dump` on behalf of the user. The goal is to turn a ChatGPT share URL into an archive an agent can read safely as source context.

## Resolve CLI

Resolve the CLI in this order:

1. `chatgpt-share-dump` when installed by the tracked installer, GitHub install, or otherwise available on `PATH`.
2. `node ${CLAUDE_PLUGIN_ROOT}/bin/chatgpt-share-dump.mjs` only when that file exists in a standalone product-plugin install.
3. `npx --yes github:tombelieber/chatgpt-share-dump` when no installed command is available.
4. `node /absolute/path/to/bin/chatgpt-share-dump.mjs` when working from a cloned product repository.

Store the working command and reuse it for the rest of the session.

## Workflow

1. Choose an output directory. Use an absolute path when possible.
2. Run:

```bash
$CLI --url "https://chatgpt.com/share/..." --out "/absolute/output/dir" --zip
```

3. If the share contains uploaded or generated media, rerun with the complete local assets folder:

```bash
$CLI --url "https://chatgpt.com/share/..." --out "/absolute/output/dir" --assets-dir "/absolute/assets/folder" --zip
```

The media policy is strict. If media is present and `--assets-dir` is missing, incomplete, or has files whose byte size does not match the share payload, the CLI writes transcript files and `MISSING_MEDIA.md`, exits non-zero, and does not create a success zip.

## Output Contract

Read these files for downstream agent work:

- `visible-turns.json` - canonical structured visible turns.
- `CHAT_CONTEXT_FOR_CODEX_FULL.md` - current snapshot plus full transcript for agent context.
- `CURRENT_SNAPSHOT.md` - latest-turn state and coverage.
- `full-transcript.md` - readable Markdown transcript.
- `assets_manifest.json` / `assets_manifest.csv` - media rows and local validation state.
- `MISSING_MEDIA.md` - exact missing/invalid media rows when strict media validation fails.

## Trust Rules

- Do not scrape the visible ChatGPT UI; long conversations can be virtualized and incomplete.
- Treat `visible-turns.json` as canonical for extracted visible turns.
- Exclude hidden system/tool payloads, hidden code/tool calls, and hidden reasoning.
- Preserve visible thought recap labels when present.
- Do not claim a complete archive unless the command exits `0`.
- Install-source tracking is content-blind. The CLI may send one `source + version` beacon per install source/version; it must never send share URLs, transcript text, raw HTML, output paths, asset filenames, local usernames, or credentials.
