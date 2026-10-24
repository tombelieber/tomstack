# Locale alignment and copy

## Use the product's language source

Find the website's declared locale registry or inspect its language menu. Record
the source and observation date in the task handoff. Retain its codes, display
labels, ordering, default locale, language tags, and RTL metadata. Respect known
aliases when migrating an existing preview. Do not silently use the app's locale
list when the user named the website, or publish private source paths and commit
identifiers merely to document that check.

The reference bundle is a dated snapshot with 18 locales. Future work must read
the target product's current source; the snapshot is not a maintained global list.

## Use natural written language

The reference direction is friendly and direct, without slang or inflated
marketing claims. Make the event and next action understandable before adding
personality. Keep consequential dates, states, permissions, and limits precise.

| Variant | Example vocabulary | Example heading |
| --- | --- | --- |
| Hong Kong Traditional Chinese | 電郵、帳戶、發佈、帖文、私隱 | 請確認你的電郵地址 |
| Taiwan Traditional Chinese | 電子郵件、帳戶、發布、貼文、隱私 | 請確認你的電子郵件地址 |
| Simplified Chinese | 邮箱、账户、发布、帖子、隐私 | 请确认你的邮箱地址 |

Avoid Cantonese conversational particles such as 嘅、喺、唔、咗 in this written
email direction. This is a tone choice for the reference, not a ban on Cantonese
when a user explicitly requests it. Regional localization needs editorial
judgment; character conversion alone is insufficient. Keep English direct and
human, and adapt formality naturally for each language rather than translating
English sentence structure literally.

## Keep the entire example aligned

Translate shared UI, scenario names, subjects, preheaders, greetings, body text,
detail labels, CTA, recovery notes, help text, and footers. Keep brand/product
names and intentional synthetic names stable. Preserve the exact multiset of
template placeholders, including repeated occurrences; translating or dropping
one can break the eventual template.

Missing values and empty strings are errors, not permission for silent English
fallback. If scope is narrowed to selected locales, update the registry and
source bundle together. String parity proves completeness, not linguistic
quality; report native-language review only when it happened.

## Render for each writing direction

Set `lang` and `dir` explicitly. Use logical alignment, mirror directional CTA
arrows, and isolate codes, URLs, handles, amounts, and mixed-script dynamic values
with bidi-safe markup. Keep brand layout and one-time codes readable. Format
dates/times with an explicit, relevant timezone; do not inherit a previous
project's Hong Kong timezone as a universal default.

Inspect at least a long translation, the selected Chinese variants, and each
selected RTL language at narrow widths. Check button wrapping, detail rows,
font fallback, focus, and the real logo. Avoid compressing long text until it is
unreadable merely to match the English layout.
