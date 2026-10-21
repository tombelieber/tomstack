---
name: ui-mr-visual-review
description: Prepare or review any UI-related pull request or merge request with comparable Before/After screenshots embedded in its description, so a human can see every material visual change. Apply during UI implementation and PR/MR creation or updates, including layout, styling, copy, responsive behavior and interaction states.
---

# UI PR/MR Visual Review

Make the visual impact of a PR/MR directly reviewable in its description. A
reviewer should see what changed, where, and under which conditions without
checking out either revision or following links to discover the comparison.

## 1. Identify the affected views

Inspect the actual diff and the repository's capture, fixture and PR/MR
conventions. Map changes to screens/routes and visible states, including shared
components, global styles, copy and conditional UI. Capture each materially
different affected view; reuse a representative pair for equivalent shared
component instances only when you explain the coverage. Do not show only the
landing screen when the changes appear in dialogs, menus or other routes.

Use the affected desktop/native sizes. Add phone pairs when responsive behavior
changes, including the narrow breakpoint involved in the change. Include changed
empty, error, expanded, selected, hover or focus states when they expose the
effect. Scale the evidence to the change, without inventing a full app audit.

For a UI-related change with no visible effect, explain the concrete reason in
the description. An unavailable build, capture tool or baseline is a missing
piece of evidence, not a reason to mark visual review as not applicable.

## 2. Capture the actual baseline and candidate

Render the real app at the PR/MR comparison base and the candidate being
reviewed. Record both captured revision IDs and how the baseline relates to the
target branch or merge base; do not silently compare against an unrelated build.
Use isolated checkouts/builds when needed to preserve unrelated working changes.
Record any uncommitted UI changes in a reproducible patch before capturing, or
capture a commit; a bare HEAD label must not hide a dirty implementation.

Within each Before/After pair, match synthetic data, route, viewport/device,
pixel ratio, locale, theme, authentication role, selected state and scroll
position. Stabilize time, loading, fonts and animation where they affect the
comparison. Explain intentional differences needed to show a layout or flow.
Use repository-approved fictional fixtures and isolated test storage. Keep
project-specific fixture requirements in their repository; do not make them
universal or use production data for captures.

For a new or removed screen, show the prior entry point, replacement or visible
absence at the corresponding step and explain the asymmetry. Never fabricate an
old screen, use a design mockup as a runtime capture, or silently omit Before.

Inspect the images: the changed elements must be readable and the app must be in
the intended state. Keep original capture bytes. A clearly labelled detail crop,
annotation or pixel diff may supplement the original pairs. Add a short recording
when motion or an interaction sequence cannot be understood from still states.

## 3. Put the comparison in the PR/MR description

Adapt [the visual review template](assets/visual-review.md) to the repository's
existing description. Keep unrelated sections and evidence. Put the first
Before/After pair directly in the main description, with Before on the left and
After on the right; do not hide all visual evidence in collapsed sections,
comments, a CI artifact or an external report.

For each pair, name the screen/state and viewport, explain the visible change in
one or two sentences, and embed both real images with meaningful alt text and
clickable original-size links. Preserve enough context to locate the change;
add a close-up when a full-page capture would make the change too small. Group
larger comparisons by screen or flow, with the affected views accounted for.

Use durable image locations that the intended reviewers can access under the
repository's privacy policy. Local filesystem paths, expiring signed URLs and
session-only previews do not count as PR/MR image delivery. Use an established
attachment/artifact flow or commit safe review assets when repository policy
permits it. Never upload private screenshots to a public host for convenience.

Creating or editing a PR/MR and uploading images must be within the user's task
authorization. When publication is outside scope, prepare the images and exact
description locally and report publication as pending. This skill alone does
not authorize opening, publishing or merging a PR/MR.

## 4. Verify the reviewer sees the final evidence

After an authorized update, open the actual rendered PR/MR and check every image
and original-size link as the intended reviewer. An API body, valid Markdown or
successful image upload alone does not establish that the comparison renders.
Use a supported browser/rendering tool; if access or rendering is unavailable,
report that exact verification gap without claiming visual review is complete.

Refresh affected captures after subsequent UI edits, rebases or changes to
rendering inputs, and update the recorded revisions and URLs. If the MR head
only adds documentation or evidence after capture, identify the captured code
revision and verify the intervening diff cannot affect those views.

Keep behavioral regression checks for affected navigation, state, data and
accessibility interactions. Screenshots establish visual evidence; behavioral
tests and release qualification have their own requirements. When reviewing an
existing PR/MR, report missing, stale, incomparable or unreadable pairs against
the affected view, without expanding the review into unrelated work.

Finish with the PR/MR link, what the pairs cover, relevant behavioral checks and
any concrete evidence gaps. Do not call visual review complete until the
affected views are covered and the images render in the actual description.
