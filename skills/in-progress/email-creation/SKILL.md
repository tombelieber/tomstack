---
name: email-creation
description: Design and localize branded product email examples with an interactive preview, using the product's actual logo, supported scenarios, and website language options.
---

# Email Creation

Turn product email requirements into clear copy and a reviewable design system.
Use this for essential account, security, billing, access, and operational email
examples, or a user-specified subset. The output is a design preview unless the
user also requests implementation or delivery.

## Establish the requested set

Reuse the user's existing brief, approved designs, language choices, and feedback.
Identify the product, audience, email scenarios, brand assets, language source,
and intended output. Resolve routine design choices from that context; ask only
for information that materially blocks the requested work. A logo or wording
revision does not need another discovery interview.

For scenario discovery, read [scenario-selection.md](references/scenario-selection.md).
Separate currently supported transactional notices from optional marketing and
future features. If the user asks for essential emails only, keep the visible
catalog and exported sources limited to that set. A competitor screenshot is a
layout reference, not evidence that the user's product has the same features,
limits, deadlines, or customer numbers.

## Match the actual product

Inspect and reuse the approved logo asset directly. Match the product's existing
palette, typography, naming, and visual direction; do not substitute a typed
wordmark, emoji, or newly generated logo. Keep the logo legible on light and dark
backgrounds, with its aspect ratio preserved and an accessible brand name.

Use a clear subject and preheader, a concise explanation of what happened, any
decision-relevant details, one primary action, and a useful support/footer area.
Retain necessary security or recovery instructions even when shortening copy.
Use placeholders for unresolved values; do not turn an unknown policy into a
confident sentence. The included SosoAPI examples illustrate a design, not a
source of truth for another product's behavior.

## Align languages and tone

Read [localization-and-copy.md](references/localization-and-copy.md). When the user
asks to match the website, inspect its canonical language configuration or
language selector and retain the exact supported codes, labels, order, default,
regional variants, and text direction. Do not infer website languages from a
different app's smaller registry, or claim a live-site check from repository data.

Translate the whole example: subject, preheader, body, CTA, detail labels,
security notes, footer, and preview controls. Preserve placeholders and their
meaning. Use natural written language suited to the audience; distinguish
written Hong Kong Chinese from spoken Cantonese and Taiwan Traditional Chinese.
Do not infer customer-email tone from the user's chat language or social posts.

## Build and review

Keep copy, locale metadata, brand assets, and rendering separate. The bundled
offline builder is an optional starting point; use it when its structure fits.
Read [preview-and-delivery.md](references/preview-and-delivery.md) for its source
format and commands. It works with Python 3.10+ and a browser, without a plugin,
account, network service, or email provider.

For the approved reference batch, read
[sosoapi-example.md](references/sosoapi-example.md), then render the included
source bundle. For a different product, copy the bundle into the task's output
directory, replace its product-specific content, and select only relevant
scenarios and languages. Do not edit an installed skill's reference assets as a
customer project or make SosoAPI's 12 scenarios and 18 languages universal.

Show the requested examples through scenario, language, and desktop/mobile
controls. Keep preview actions local and visibly inert. In an environment with
an inline visualization capability, follow that capability's instructions and
use a fragment when supported; otherwise provide the local standalone preview.
Do not require a specific desktop app or external design service.

Validate all selected locales and placeholders. Inspect the actual rendering at
desktop and narrow mobile widths, including long translations and RTL when
selected. Confirm the real logo loads, controls work, no content clips, and
actions do not send or mutate anything. Reuse valid evidence for unchanged copy;
a shared logo-only edit needs focused header checks, not a new language project.

Apply feedback to the shared source and show the revised examples. Keep stable
scenario IDs and preserve settled decisions. Do not reintroduce optional emails
or overwrite an approved design direction through an unrelated copy change.

## Handoff boundaries

Deliver the editable source and preview, with the scope of actual validation.
Keep browser-preview checks, email-client rendering, provider integration, and
live sending distinct. A browser preview is not send-ready email HTML. If asked
to implement email templates, use the product's email stack and validate its
escaping, fallback text, template variables, links, client compatibility, and
trigger semantics separately.

Designing or installing this skill does not authorize sending emails, changing
account/billing state, configuring providers, or deploying a mail flow. Respect
explicit authorization already present; do not introduce a blanket extra
approval round for reversible local design edits.
