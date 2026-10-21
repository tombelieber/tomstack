# UI PR/MR Visual Review

## What it does

Makes UI changes reviewable directly in a PR or MR description using comparable
Before/After screenshots of the real app, captured revisions, and accessible
original-size image links. Includes a reusable description template.

## When to reach for it

Use while implementing or reviewing UI changes, or preparing a PR/MR that
changes layout, styling, copy, responsive behavior, or visible interaction states.
The skill supports automatic discovery and explicit `$ui-mr-visual-review` use.

## Install

```bash
npx skills@latest add tombelieber/tomstack --skill ui-mr-visual-review
```

Claude Code users can also install the full `tomstack-skills@tomstack` plugin
through the marketplace instructions in the root README.

## It's working if

The description shows matching Before/After pairs for materially affected
screens and states, including phone views when responsive behavior changes.
Captures identify the baseline and candidate revisions, use fictional fixtures,
and preserve the original images. The reviewer can see the embedded images and
open their original-size links in the rendered PR/MR.

Behavioral checks remain necessary. Missing or inaccessible screenshots are
reported as evidence gaps. A UI-related change with no visible effect needs a
concrete explanation. The skill does not authorize publishing or merging a PR/MR.
