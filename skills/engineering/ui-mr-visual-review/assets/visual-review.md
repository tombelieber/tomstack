<!-- Copy this section into the existing PR/MR description. Replace all fields
     with actual evidence and remove these instructions. Repeat the view block
     for each materially different affected screen/state and required viewport.
     If there is no visible effect, use a concrete explanation instead of pairs.
     Never label unavailable evidence as not applicable. -->

## Visual review

{{One sentence explaining the user-visible result.}}

Before: `{{captured baseline revision}}` ({{relationship to MR comparison base}}).
After: `{{captured candidate revision}}`.
{{If different from the current MR head, explain and verify the intervening diff.}}

Shared capture conditions: {{fictional fixture, locale, theme, role, device/browser,
pixel ratio and time/loading controls relevant to reproducibility}}.

### {{Screen or route — state — viewport width × height}}

{{One or two sentences explaining which visible elements changed and why.}}

| Before | After |
| --- | --- |
| [![Before: {{specific visible state}}]({{before image URL}})]({{before original URL}}) | [![After: {{specific visible state}}]({{after image URL}})]({{after original URL}}) |

{{Any intentional differences in scroll/state, or representative shared-component coverage.}}

### Verification

Affected views covered: {{map the changed UI to the pairs above; include phone
and narrow-breakpoint views when responsive behavior changes}}.

Behavioral checks: {{commands or exercised interactions and actual results}}.

Rendered PR/MR: {{actual check of every embedded image and original-size link,
or a precise statement that verification is still pending}}.

Evidence gaps: {{concrete missing evidence, or none after verification}}.
