#!/usr/bin/env python3
"""Validate a portable email source bundle and build its offline review preview."""

import argparse
import base64
from collections import Counter
import html
import json
import os
from pathlib import Path
import re
import sys
import tempfile

SKILL_ROOT = Path(__file__).resolve().parent.parent
MAX_OUTPUT_BYTES = 1_000_000
TOKEN = re.compile(r"\{\{([A-Za-z][A-Za-z0-9_]*)\}\}")
IDENTIFIER = re.compile(r"[A-Za-z][A-Za-z0-9_-]*\Z")
UI_KEYS = set("scenario language preview desktop mobile previewLabel demoNotice actionNotice "
              "greeting team help contact footer secureLink fallback codeLabel samplePost "
              "mediaUnavailable groups".split())
TEMPLATE_REQUIRED = set("name subject preview title body cta".split())
COLORS = {"paper": "paper", "surface": "white", "ink": "ink", "muted": "muted",
          "line": "line", "accent": "mint", "soft": "soft"}


class BundleError(ValueError):
    """A source bundle or output is not ready for review."""


def require(condition, message):
    if not condition:
        raise BundleError(message)


def object_keys(value, required, optional, location):
    require(isinstance(value, dict), f"{location}: expected an object")
    missing, extra = required - value.keys(), value.keys() - required - optional
    require(not missing and not extra,
            f"{location}: missing keys {sorted(missing)}, unexpected keys {sorted(extra)}")


def nonempty(value, location):
    require(isinstance(value, str) and bool(value.strip()), f"{location}: expected nonempty text")
    return value


def identifier(value, location):
    require(isinstance(value, str) and bool(IDENTIFIER.fullmatch(value)),
            f"{location}: invalid identifier")
    return value


def source_file(source, name):
    path = (source / name).resolve()
    require(path.is_relative_to(source), f"Source path escapes bundle: {name}")
    require(path.is_file(), f"Missing source file: {name}")
    return path


def read_json(source, name):
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"{name}: duplicate JSON key {key}")
            result[key] = value
        return result
    try:
        return json.loads(source_file(source, name).read_text(encoding="utf-8"),
                          object_pairs_hook=unique_object)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise BundleError(f"{name}: invalid UTF-8 JSON: {error}") from error


def leaves(value, location=""):
    require(isinstance(value, dict), f"{location}: expected an object")
    result = {}
    for key, child in value.items():
        path = f"{location}.{key}" if location else key
        if isinstance(child, dict):
            result.update(leaves(child, path))
        else:
            result[path] = nonempty(child, path)
    return result


def resolve_text(value, fixtures, location):
    def replace(match):
        key = match.group(1)
        return fixtures.get(key, match.group(0))
    result = TOKEN.sub(replace, value)
    remainder = TOKEN.sub("", result)
    require("{{" not in remainder and "}}" not in remainder,
            f"{location}: malformed content placeholder")
    return result


def resolve_tree(value, fixtures, location):
    if isinstance(value, dict):
        return {key: resolve_tree(child, fixtures, f"{location}.{key}")
                for key, child in value.items()}
    return resolve_text(value, fixtures, location)


def validate_fixtures(value, location):
    require(isinstance(value, dict), f"{location}: expected an object")
    for key, text in value.items():
        identifier(key, location)
        nonempty(text, f"{location}.{key}")
        require("{{" not in text and "}}" not in text, f"{location}.{key}: fixtures must be literal text")


def load_bundle(source):
    """Return a validated, resolved browser data pack and embedded PNG data URL."""
    source = Path(source).resolve()
    manifest = read_json(source, "locales.json")
    object_keys(manifest, {"defaultLocale", "locales"}, set(), "locales.json")
    require(isinstance(manifest["locales"], list) and manifest["locales"], "locales: expected a nonempty list")
    codes = []
    for locale in manifest["locales"]:
        object_keys(locale, {"code", "label", "dir", "tag"}, set(), "locale")
        code = identifier(locale["code"], "locale.code")
        require(code not in codes, f"Duplicate locale: {code}")
        codes.append(code)
        nonempty(locale["label"], f"{code}.label")
        require(locale["dir"] in ("ltr", "rtl"), f"{code}: direction must be ltr or rtl")
        require(isinstance(locale["tag"], str) and bool(re.fullmatch(r"[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*", locale["tag"])),
                f"{code}: invalid regional language tag")
    require(manifest["defaultLocale"] in codes, "defaultLocale must be declared in locales")
    translations = (source / "translations").resolve()
    require(translations.is_relative_to(source), "Translation directory escapes bundle")
    actual_files = {path.name for path in translations.glob("*.json")}
    expected_files = {f"{code}.json" for code in codes}
    require(actual_files == expected_files,
            f"Translation files: missing {sorted(expected_files - actual_files)}, undeclared {sorted(actual_files - expected_files)}")

    brand = read_json(source, "brand.json")
    object_keys(brand, {"name", "website", "logo", "colors", "groups", "catalog", "fixtures", "defaultScenario"}, set(), "brand.json")
    for key in ("name", "website", "logo"):
        nonempty(brand[key], f"brand.{key}")
    object_keys(brand["colors"], set(COLORS), set(), "brand.colors")
    for value in brand["colors"].values():
        require(isinstance(value, str) and bool(re.fullmatch(r"#[0-9a-fA-F]{6}", value)), "Brand colors must be six-digit hex colors")
    groups = brand["groups"]
    require(isinstance(groups, list) and groups, "brand.groups: expected a nonempty ordered list")
    for group in groups:
        identifier(group, "brand.groups")
    require(len(set(groups)) == len(groups), "brand.groups: duplicate group")
    validate_fixtures(brand["fixtures"], "brand.fixtures")
    catalog = brand["catalog"]
    require(isinstance(catalog, list) and catalog, "brand.catalog: expected a nonempty list")
    scenario_ids = []
    for item in catalog:
        object_keys(item, {"id", "group"}, {"tone", "fallback", "code", "post", "fixtures", "details"}, "catalog entry")
        scenario = identifier(item["id"], "catalog.id")
        require(scenario not in scenario_ids, f"Duplicate scenario: {scenario}")
        scenario_ids.append(scenario)
        require(item["group"] in groups, f"{scenario}: undeclared group")
        require(item.get("tone", "") in ("", "warning", "danger"), f"{scenario}: invalid tone")
        for key in ("fallback", "code"):
            require(key not in item or isinstance(item[key], bool), f"{scenario}.{key}: expected boolean")
        validate_fixtures(item.get("fixtures", {}), f"{scenario}.fixtures")
        require(isinstance(item.get("details", []), list), f"{scenario}.details: expected a list")
        for row in item.get("details", []):
            object_keys(row, {"label"}, {"value", "field"}, f"{scenario}.details")
            require(("value" in row) != ("field" in row), f"{scenario}.details: provide value or field")
            for key, value in row.items():
                nonempty(value, f"{scenario}.details.{key}")
        if "post" in item:
            object_keys(item["post"], {"account", "platform", "avatar"}, set(), f"{scenario}.post")
            for key, value in item["post"].items():
                nonempty(value, f"{scenario}.post.{key}")
    require(set(groups) == {item["group"] for item in catalog}, "Every declared group must have a scenario")
    require(brand["defaultScenario"] in scenario_ids, "defaultScenario must be declared in catalog")

    messages = {code: read_json(source, f"translations/{code}.json") for code in codes}
    baseline = None
    optional_ui = set() if any("post" in item for item in catalog) else {"samplePost", "mediaUnavailable"}
    for code, copy in messages.items():
        object_keys(copy, {"ui", "fields", "templates"}, set(), code)
        object_keys(copy["ui"], UI_KEYS - optional_ui, optional_ui, f"{code}.ui")
        object_keys(copy["ui"]["groups"], set(groups), set(), f"{code}.ui.groups")
        for key, value in copy["ui"].items():
            if key != "groups":
                nonempty(value, f"{code}.ui.{key}")
        for key, value in copy["ui"]["groups"].items():
            nonempty(value, f"{code}.ui.groups.{key}")
        require(isinstance(copy["fields"], dict), f"{code}.fields: expected an object")
        for key, value in copy["fields"].items():
            identifier(key, f"{code}.fields")
            nonempty(value, f"{code}.fields.{key}")
        object_keys(copy["templates"], set(scenario_ids), set(), f"{code}.templates")
        for scenario, template in copy["templates"].items():
            object_keys(template, TEMPLATE_REQUIRED, {"note", "callout"}, f"{code}.templates.{scenario}")
            for key, value in template.items():
                nonempty(value, f"{code}.templates.{scenario}.{key}")
        flat = leaves(copy, code)
        # Compare relative leaf paths and token counts, including repeated tokens.
        flat = {path[len(code) + 1:]: text for path, text in flat.items()}
        if baseline is None:
            baseline = flat
        require(flat.keys() == baseline.keys(), f"{code}: translation schema differs from {codes[0]}")
        for path, text in flat.items():
            require(Counter(TOKEN.findall(text)) == Counter(TOKEN.findall(baseline[path])),
                    f"{code}.{path}: placeholder parity differs from {codes[0]}")

    resolved_messages, views = {}, {}
    for code, copy in messages.items():
        # UI shared by all scenarios uses global fixtures. Scenario greetings and
        # template text may override them without introducing runtime logic.
        resolved = {"ui": resolve_tree(copy["ui"], brand["fixtures"], f"{code}.ui"),
                    "fields": resolve_tree(copy["fields"], brand["fixtures"], f"{code}.fields"),
                    "templates": {}}
        views[code] = {}
        for item in catalog:
            scenario = item["id"]
            fixtures = {**brand["fixtures"], **item.get("fixtures", {})}
            resolved["templates"][scenario] = resolve_tree(copy["templates"][scenario], fixtures, f"{code}.{scenario}")
            view = {"greeting": resolve_text(copy["ui"]["greeting"], fixtures, f"{code}.greeting"), "details": []}
            for row in item.get("details", []):
                fields = resolved["fields"]
                require(row["label"] in fields, f"{scenario}: unknown detail label {row['label']}")
                if "field" in row:
                    require(row["field"] in fields, f"{scenario}: unknown detail field {row['field']}")
                    value = fields[row["field"]]
                else:
                    value = resolve_text(row["value"], fixtures, f"{scenario}.detail")
                view["details"].append([fields[row["label"]], value])
            if item.get("code"):
                require("sign_in_code" in fixtures, f"{scenario}: missing sign_in_code fixture")
                view["code"] = resolve_text("{{sign_in_code}}", fixtures, f"{scenario}.code")
            if "post" in item:
                view["post"] = resolve_tree(item["post"], fixtures, f"{scenario}.post")
            views[code][scenario] = view
        resolved_messages[code] = resolved
    logo = source_file(source, brand["logo"]).read_bytes()
    require(logo.startswith(b"\x89PNG\r\n\x1a\n"), "Logo must be a PNG file")
    public_brand = {key: brand[key] for key in ("name", "website", "colors", "groups", "defaultScenario")}
    public_brand["catalog"] = [{key: item[key] for key in ("id", "group", "tone", "fallback") if key in item} for item in catalog]
    pack = {**manifest, "brand": public_brand, "messages": resolved_messages, "views": views}
    return pack, "data:image/png;base64," + base64.b64encode(logo).decode("ascii")


def embedded_json(value):
    # HTML parses script end tags even in application/json; escape at the HTML boundary.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def build_preview(source, fragment=False):
    pack, logo = load_bundle(source)
    brand = pack["brand"]
    locale = next(item for item in pack["locales"] if item["code"] == pack["defaultLocale"])
    esc = html.escape
    colors = ";".join(f"--se-{COLORS[key]}:{value}" for key, value in brand["colors"].items())
    css = (SKILL_ROOT / "assets/review/preview.css").read_text(encoding="utf-8")
    runtime = (SKILL_ROOT / "assets/review/preview.js").read_text(encoding="utf-8")
    markup = (SKILL_ROOT / "assets/review/layout.html").read_text(encoding="utf-8")
    substitutions = {"LANG": esc(locale["tag"]), "COLORS": colors, "BRAND": esc(brand["name"]),
                     "LOGO": logo, "CSS": css, "DATA": embedded_json(pack), "RUNTIME": runtime}
    markup = re.sub(r"%([A-Z_]+)%",
                    lambda match: substitutions.get(match.group(1), match.group(0)), markup)
    if not fragment:
        markup = '<!doctype html>\n<html lang="' + esc(locale["tag"]) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(brand["name"]) + ' email preview</title><style>body{margin:0;padding:24px;background:#fffefb}main{max-width:960px;margin:auto}@media(max-width:440px){body{padding:12px}}</style></head><body><main>' + markup + '</main></body></html>\n'
    require(not re.search(r"%[A-Z_]+%", markup), "Output contains unresolved builder template tokens")
    encoded = markup.encode("utf-8")
    require(len(encoded) <= MAX_OUTPUT_BYTES, f"Output exceeds {MAX_OUTPUT_BYTES:,} byte limit")
    return encoded


def write_output(output, content, force=False):
    output = Path(output)
    require(force or not output.exists(), f"Output already exists: {output}; use --force to replace it")
    # Build and validate everything before touching the output. Exclusive creation
    # handles accidental overwrites; forced replacement uses an adjacent temp file.
    if not force:
        with output.open("xb") as stream:
            stream.write(content)
        return
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, prefix=".email-preview-", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
        os.replace(temporary, output)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="assets/sosoapi-example", help="Bundle directory; relative paths are relative to this skill")
    parser.add_argument("--output", required=True, type=Path, help="Output HTML path (relative to the current working directory)")
    parser.add_argument("--fragment", action="store_true", help="Emit an inline fragment instead of a standalone HTML document")
    parser.add_argument("--force", action="store_true", help="Replace an existing output after successful validation")
    args = parser.parse_args(argv)
    source = Path(args.source)
    if not source.is_absolute():
        source = SKILL_ROOT / source
    try:
        content = build_preview(source, args.fragment)
        write_output(args.output, content, args.force)
    except (BundleError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"Built {args.output} ({len(content):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
