---
name: pain-point-mining
description: Use when mining real chat history, session logs, support tickets, or exported transcripts into product pain points, feature demand, weighted frequency x value rankings, PRD updates, and E2E test requirements.
---

# Pain Point Mining

## Overview

Use this skill to turn real user interaction history into product decisions. The core job is to treat every user message as a demand signal, cluster those signals, rank them by frequency and product value, and convert the result into requirements, E2E coverage, and a golden pain point the team can build against.

This is especially relevant when the user asks for pain point mining, gem mining, transcript-to-PRD work, real usage E2E coverage, demand ranking, frequency/value scoring, or a "golden pain point" from chat history.

## Workflow

### 1. Lock The Evidence Source

Start from real artifacts, not memory or assumptions:

- Transcript exports, share dumps, JSON/Markdown snapshots, screenshots, media manifests, or repo docs derived from those artifacts.
- If media or attachments are part of the history, include them in scope and separate confirmed source evidence from generated/non-authoritative images.
- If the source is a ChatGPT share page, check whether the page is virtualized or incomplete. Prefer saved snapshots when available.

Record the source set before scoring. If the user asks for "latest", refresh or re-export first when possible.

### 2. Normalize Turns

Treat every user message as a possible requirement, action, correction, anxiety signal, or workflow demand.

For each user turn, capture:

- `turn_id` or source position
- exact or summarized user ask
- related media/source files
- demand cluster tags
- whether it is a new request, correction, clarification, panic/anxiety, evidence challenge, or follow-up
- whether assistant replies are needed to understand the trust failure or quota mismatch

Do not only read user messages when the pain point depends on assistant behavior. Assistant replies matter when they create confusion, correct a prior answer, change quota logic, or expose a missing evidence trail.

### 3. Cluster Demand Signals

Create non-exclusive clusters. A single turn can count toward multiple clusters if it expresses multiple needs.

Example clusters for coaching, quota, or decision-support transcript mining:

- Golden trust layer: "Can I trust this advice/quota right now, and can I inspect the evidence?"
- Latest quota/status: current intake, remaining allowance, deficit/surplus, macros, fiber, sodium, effective protein.
- Evidence and source drilldown: citations, source tiers, detailed calculation basis, inspectable assumptions.
- Correction and recomputation: "I ate X instead", "actually not that item", portion fixes, final lock.
- Real-time next action: whether to eat, stop eating, walk incline, gym, leg day adjustment, recovery choice.
- Media/source routing: photo OCR, label image, scale readout, Apple Watch/InBody/restaurant menu/media.
- Food logging and meal reconstruction: Genki, McDonald's, snacks, partial consumption, candidates vs confirmed items.
- Workout-aware policy: rest day, normal lifting, leg day, PT, cardio, incline walking, recovery state.
- Health/safety anxiety: visceral fat, muscle loss, misleading advice, sodium, symptoms, professional-care escalation.
- Context and memory: keep durable state across a long session; preserve latest confirmed facts.
- Export/import and parity: refresh history, map requirements, keep E2E docs aligned.

Rename or split clusters to fit the product, but preserve the distinction between "what the user did often" and "what creates the most trust/value risk."

### 4. Score Frequency And Value

Use a transparent weighted score:

```text
weighted priority score = frequency count x PM value weight
```

Frequency rules:

- Count from normalized user turns or documented source rows.
- Use non-exclusive counts when turns carry multiple demand signals.
- State the denominator and whether assistant turns are excluded.
- If the cluster is a cross-cutting union, explain the union instead of pretending it is a single literal phrase count.

Value weight:

- `5`: core daily decision, trust, safety, retention, or product identity risk.
- `4`: high-value workflow enabler that materially improves speed, confidence, or completion.
- `3`: support, migration, setup, or operational feature that matters but is not the core daily loop.
- `2`: convenience feature with limited direct product leverage.
- `1`: rare, low-risk, or cosmetic signal.

Sort by `frequency x value`, then call out any low-frequency/high-severity items separately if they should not wait.

### 5. Identify The Golden Pain Point

The golden pain point is the highest-leverage problem that explains multiple high-ranking clusters.

For real-time coaching or quota products, the expected shape is:

```text
User needs to know whether the current quota/advice is trustworthy right now,
why it changed, what evidence backs it, and what action to take next.
```

Pin it explicitly as:

- `Golden Pain Point`
- why it combines frequency and value
- which clusters roll up into it
- which product surfaces must solve it

Avoid choosing a shallow feature like "show a quota table" if the real pain is evidence-backed trust and inspectability.

### 6. Convert To Product Artifacts

When the user asks to update docs, apply the ranking into:

- PRD: golden pain point, target user anxiety, source-backed trust principles, scope.
- E2E tests: large-to-small workflows based on real user actions, including corrections and panic loops.
- Requirement map: each user turn mapped to demand tags and expected product behavior.
- System/audit docs: source tiers, evidence requirements, replayability, parity checks.
- Priority/ranking doc: frequency, value, weighted score, evidence, and build implication.

Keep docs explicit about confirmed facts vs estimates, pending clarification, failed/hidden states, and generated/non-authoritative media.

### 7. Validate The Result

Before claiming completion:

- Check that counts match the source artifacts and docs.
- Search for stale totals or outdated turn counts.
- Verify that the golden pain point appears in the PRD and E2E coverage.
- Ensure every ranked item has a build implication, not just a label.
- Run repo-specific gates when docs/scripts changed.

If git write access is restricted, report that staging/commit was blocked and identify the exact files changed.

## Output Contract

When reporting the mined result, use this structure:

```markdown
## Golden Pain Point

<one sentence>

## Method

- Source set:
- Count basis:
- Value rubric:

## Weighted Ranking

| Rank | Cluster | Frequency | Value | Score | Evidence Pattern | Build Implication |
|---:|---|---:|---:|---:|---|---|

## Build Order

1. <highest score product capability>
2. <next capability>
3. <next capability>

## Docs / Tests

- Updated:
- Verified:
- Blocked:
```

Keep the report decision-grade. The point is to reveal what to build first, not just summarize what users said.

## Guardrails

- Do not conflate frequency with value. A rare safety/trust issue can still be P0.
- Do not treat candidate foods or speculative items as confirmed intake without evidence.
- Do not collapse correction loops into ordinary messages; they often reveal the most valuable product gaps.
- Do not hide weak evidence. If a count is inferred, say so.
- Do not create deterministic keyword classifiers in production code from this analysis. This skill is for product discovery and test/doc generation; product cognition should remain evidence-driven and appropriate to the host system.
