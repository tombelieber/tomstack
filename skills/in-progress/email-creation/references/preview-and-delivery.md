# Preview sources and delivery

## Build the reference

From the skill directory, using Python 3.10+:

```bash
python3 scripts/build_preview.py --output /tmp/sosoapi-email-preview.html
```

Open the resulting file in a browser. It contains its own styles, runtime, data,
and logo; it makes no network requests and needs no host API, JavaScript package,
account, or email service. All buttons are inert preview actions. The included
renderer uses a fixed light brand palette and a small CSS accent in place of the
original host-provided icons, so the standalone preview has no icon dependency.

Use an explicit source bundle for another product:

```bash
python3 scripts/build_preview.py \
  --source /absolute/path/to/task/acme-email-source \
  --output /absolute/path/to/task/acme-email-preview.html
```

`--source` paths are relative to the installed skill directory unless absolute.
`--output` is relative to the current working directory unless absolute; its
parent directory must exist. Existing output is preserved unless `--force` is
given. Invalid input never replaces an existing output, even with `--force`.
Use `--fragment` to omit the standalone document shell when an available inline
preview host supports HTML fragments. Show only one generated gallery per page.
If a host has additional styling or state requirements, adapt the task output
to those requirements instead of treating this renderer as a universal host SDK.

## Source bundle

```text
source/
  brand.json
  locales.json
  logo.png
  translations/
    en.json
    zh-TW.json
```

`locales.json` contains `defaultLocale` and an ordered `locales` array. Each
locale has `code`, `label`, `dir` (`ltr` or `rtl`), and `tag` (regional HTML
language tag). A code has exactly one `translations/<code>.json`; remove files
for languages excluded from the requested scope.

`brand.json` defines:

- `name`, `website`, and a source-relative `logo` path. This starter accepts PNG
  and embeds the original bytes. For an approved SVG/JPEG/WebP logo, either use a
  renderer supporting it or make a faithful PNG conversion in the task output
  directory without changing the artwork. Do not generate a replacement logo.
- `colors`: six-digit hex values for `paper`, `surface`, `ink`, `muted`, `line`,
  `accent`, and `soft`. Check contrast after changing these defaults.
- `groups`: ordered group IDs, `defaultScenario`, and an ordered `catalog`.
- `fixtures`: known synthetic values such as recipient name or workspace.
  These are literal strings, not live customer records. Missing values remain
  visible as `{{named_placeholders}}`; do not invent prices or deadlines.

Each catalog entry has `id` and `group`. Optional fields are `tone` (`warning`
or `danger`), `fallback` (secure-link alternative), `code` (show the synthetic
`sign_in_code` fixture), per-scenario `fixtures`, `details`, and `post`.

Detail rows use `{"label":"workspace","value":"{{workspace}}"}` for a
literal/placeholder value or `{"label":"automaticRenewal","field":"off"}`
for a localized value. `label` and `field` refer to keys in translated `fields`.
Optional `post` has `account`, `platform`, and `avatar` strings; it uses translated
`ui.samplePost` and `ui.mediaUnavailable`. No social-platform integration runs.

Each translation file contains `ui`, `fields`, and `templates`. The reference
files show the shared control/help keys. Scenario-specific post UI keys may be
removed when no scenario has a `post`; other shared keys remain a small reusable
dictionary. Remove unused detail labels if helpful, consistently in each locale.
Every template has `name`, `subject`, `preview`, `title`, `body`, and `cta`, with
optional `note` and `callout`. Values are plain text, not raw HTML. The catalog
and template IDs must match exactly. All selected locales must have the same
leaf keys and the same placeholder counts for each corresponding field.

For a narrow request, remove unrelated catalog entries, unused groups, template
objects, and excluded translation files together. Update the defaults and
`ui.groups` in each locale. Replace any retained product-specific shared copy.
New scenario and locale IDs require only source-data changes, not runtime edits.

## Validation and review

The builder rejects missing/empty translations, undeclared groups/scenarios,
placeholder mismatches, duplicate JSON keys, and source paths outside the
bundle. It escapes text at HTML/JSON boundaries, embeds the logo, and limits
output to 1 MB. These checks do not establish whether a product claim is true.

Run helper regression tests after changing the builder or its source contract:

```bash
python3 -B -m unittest discover -s tests -v
```

Review the generated browser page at desktop and 320–390 px mobile widths. Check
the actual logo, language/scenario switches, full copy, long CTA/detail text,
RTL, and inert action feedback. Record checks actually performed. Do not claim
native-language review, dark-mode adaptation, or inbox rendering from a schema
or browser-only check.

## From a preview to an email implementation

The gallery uses browser JavaScript and modern CSS. It is not the HTML to upload
to an email provider. If implementation is requested, adapt the approved copy
and design to the existing email framework, use email-compatible layout and
styles, supply plain-text content, and resolve the product's real template
variables and authorized destinations. Check image hosting, alt text, preheader,
CTA/link fallbacks, RTL, escaping, and the clients the product supports.

Provider templates, authentication tokens, suppression/deduplication, trigger
timing, consent/unsubscribe behavior, and live delivery are separate integration
work. Keep their evidence and authorization separate from visual approval.
