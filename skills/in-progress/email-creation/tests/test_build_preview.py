"""Observable bundle/build behavior; Python standard library only."""
import base64
import copy
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_ROOT / "scripts/build_preview.py"
spec = importlib.util.spec_from_file_location("build_preview", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PreviewParser(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.data = ""
        self.in_data = False
        self.scripts = []
        self.images = []
        self.section = {}
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            self.scripts.append(attrs)
            self.in_data = attrs.get("type") == "application/json"
        if tag == "img":
            self.images.append(attrs)
        if tag == "section":
            self.section = attrs

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_data = False

    def handle_data(self, text):
        if self.in_data:
            self.data += text


class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / "source"
        shutil.copytree(SKILL_ROOT / "assets/sosoapi-example", self.source)

    def read(self, path):
        return json.loads((self.source / path).read_text(encoding="utf-8"))

    def write(self, path, value):
        (self.source / path).write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def build(self, **kwargs):
        return builder.build_preview(self.source, **kwargs).decode("utf-8")

    def run_cli(self, *arguments):
        return subprocess.run([sys.executable, str(SCRIPT), *arguments], cwd=self.root,
                              text=True, capture_output=True, timeout=10)

    def test_success_is_offline_deterministic_and_embeds_actual_logo(self):
        output = self.build()
        self.assertEqual(output, self.build())
        self.assertTrue(output.startswith("<!doctype html>"))
        self.assertLessEqual(len(output.encode("utf-8")), 1_000_000)
        parsed = PreviewParser(output)
        self.assertEqual(len(parsed.scripts), 2)
        self.assertTrue(all("src" not in item for item in parsed.scripts))
        logo = base64.b64decode(parsed.images[0]["src"].split(",", 1)[1])
        self.assertEqual(logo, (self.source / "logo.png").read_bytes())
        self.assertNotIn("window.openai", output)
        self.assertNotIn("fetch(", output)
        self.assertNotIn("https://", output)
        self.assertNotIn("%DATA%", output)
        self.assertIn("{{verification_expiry}}", output)
        pack = json.loads(parsed.data)
        self.assertEqual(pack["views"]["en"]["verify"]["greeting"], "Hello Jamie,")
        self.assertEqual(pack["views"]["en"]["invite"]["greeting"], "Hello Alex,")
        self.assertEqual(pack["views"]["en"]["signin"]["code"], "123 456")
        self.assertEqual(len(builder.leaves(self.read("translations/en.json"))), 130)

    def test_default_source_is_skill_relative_from_unrelated_directory(self):
        output = self.root / "preview.html"
        result = self.run_cli("--output", str(output))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(output.read_text(encoding="utf-8"), self.build())
        output.unlink()
        result = self.run_cli("--source", "assets/sosoapi-example", "--output", "preview.html", "--fragment")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(output.read_text(encoding="utf-8").startswith("<section"))
        self.assertNotIn("<!doctype", output.read_text(encoding="utf-8"))

    def test_missing_locale_is_rejected(self):
        (self.source / "translations/ar.json").unlink()
        with self.assertRaisesRegex(builder.BundleError, "missing.*ar.json"):
            self.build()

    def test_missing_or_empty_translation_is_rejected(self):
        value = self.read("translations/de.json")
        del value["templates"]["verify"]["subject"]
        self.write("translations/de.json", value)
        with self.assertRaisesRegex(builder.BundleError, "missing keys.*subject"):
            self.build()
        value["templates"]["verify"]["subject"] = " "
        self.write("translations/de.json", value)
        with self.assertRaisesRegex(builder.BundleError, "nonempty text"):
            self.build()

    def test_exact_leaf_schema_includes_optional_template_fields(self):
        value = self.read("translations/de.json")
        value["templates"]["verify"]["callout"] = "Extra copy"
        self.write("translations/de.json", value)
        with self.assertRaisesRegex(builder.BundleError, "translation schema differs"):
            self.build()

    def test_placeholder_parity_detects_renames_and_duplicate_counts(self):
        original = self.read("translations/fr.json")
        for text in ("{{different_expiry}}", "{{verification_expiry}} {{verification_expiry}}"):
            with self.subTest(text=text):
                value = copy.deepcopy(original)
                value["templates"]["verify"]["note"] = text
                self.write("translations/fr.json", value)
                with self.assertRaisesRegex(builder.BundleError, "placeholder parity"):
                    self.build()

    def test_script_closure_and_brand_markup_are_escaped(self):
        payload = '</script><script>alert("x")</script>&'
        value = self.read("translations/en.json")
        value["templates"]["verify"]["body"] = payload
        self.write("translations/en.json", value)
        brand = self.read("brand.json")
        brand["name"] = '<img src=x onerror="oops">'
        self.write("brand.json", brand)
        output = self.build()
        parsed = PreviewParser(output)
        self.assertEqual(len(parsed.scripts), 2)
        self.assertEqual(len(parsed.images), 1)
        self.assertNotIn(payload, output)
        self.assertIn("\\u003c/script\\u003e", output)
        self.assertIn("&lt;img src=x onerror=&quot;oops&quot;&gt;", output)
        self.assertEqual(json.loads(parsed.data)["messages"]["en"]["templates"]["verify"]["body"], payload)

    def test_locale_order_regional_tags_rtl_and_default_are_preserved(self):
        parsed = PreviewParser(self.build())
        pack = json.loads(parsed.data)
        self.assertEqual([item["code"] for item in pack["locales"]],
                         ["en", "zh-Hant", "zh-TW", "zh-Hans", "ja", "ko", "de", "fr", "es", "pt-BR", "ar", "he", "nl", "hi", "id", "nb", "sv", "hu"])
        self.assertEqual(pack["defaultLocale"], "zh-Hant")
        self.assertEqual(parsed.section["lang"], "zh-HK")
        self.assertEqual([item["code"] for item in pack["locales"] if item["dir"] == "rtl"], ["ar", "he"])
        self.assertEqual(pack["locales"][3]["tag"], "zh-CN")
        manifest = self.read("locales.json")
        manifest["defaultLocale"] = "ar"
        self.write("locales.json", manifest)
        self.assertEqual(PreviewParser(self.build()).section["lang"], "ar")

    def test_new_locale_and_scenario_need_only_source_changes(self):
        manifest = self.read("locales.json")
        manifest["locales"].append({"code": "en-AU", "tag": "en-AU", "label": "English (Australia)", "dir": "ltr"})
        self.write("locales.json", manifest)
        self.write("translations/en-AU.json", self.read("translations/en.json"))
        brand = self.read("brand.json")
        brand["catalog"].append({"id": "custom-event", "group": "auth", "details": [{"label": "workspace", "value": "{{workspace}}"}]})
        brand["defaultScenario"] = "custom-event"
        self.write("brand.json", brand)
        for locale in manifest["locales"]:
            path = f"translations/{locale['code']}.json"
            copy_text = self.read(path)
            copy_text["templates"]["custom-event"] = copy_text["templates"]["verify"].copy()
            self.write(path, copy_text)
        pack = json.loads(PreviewParser(self.build()).data)
        self.assertEqual(pack["brand"]["defaultScenario"], "custom-event")
        self.assertEqual(pack["views"]["en-AU"]["custom-event"]["details"], [["Workspace", "Studio"]])

    def test_post_specific_copy_is_optional_without_post_scenarios(self):
        brand = self.read("brand.json")
        for item in brand["catalog"]:
            item.pop("post", None)
        self.write("brand.json", brand)
        for locale in self.read("locales.json")["locales"]:
            path = f"translations/{locale['code']}.json"
            value = self.read(path)
            del value["ui"]["samplePost"]
            del value["ui"]["mediaUnavailable"]
            self.write(path, value)
        pack = json.loads(PreviewParser(self.build()).data)
        self.assertNotIn("samplePost", pack["messages"]["en"]["ui"])
        self.assertTrue(all("post" not in view for view in pack["views"]["en"].values()))

    def test_undeclared_catalog_group_and_invalid_detail_are_rejected(self):
        original = self.read("brand.json")
        for update, message in (({"group": "unknown"}, "undeclared group"),
                                ({"details": [{"label": "not-a-field", "value": "sample"}]}, "unknown detail label")):
            with self.subTest(update=update):
                brand = copy.deepcopy(original)
                brand["catalog"][0].update(update)
                self.write("brand.json", brand)
                with self.assertRaisesRegex(builder.BundleError, message):
                    self.build()

    def test_source_file_and_symlink_cannot_escape_bundle(self):
        outside = self.root / "outside.png"
        outside.write_bytes((self.source / "logo.png").read_bytes())
        brand = self.read("brand.json")
        brand["logo"] = "../outside.png"
        self.write("brand.json", brand)
        with self.assertRaisesRegex(builder.BundleError, "escapes bundle"):
            self.build()
        brand["logo"] = "linked.png"
        self.write("brand.json", brand)
        (self.source / "linked.png").symlink_to(outside)
        with self.assertRaisesRegex(builder.BundleError, "escapes bundle"):
            self.build()

    def test_validation_failure_preserves_existing_output_even_with_force(self):
        output = self.root / "existing.html"
        output.write_bytes(b"previous review")
        (self.source / "translations/he.json").unlink()
        result = self.run_cli("--source", str(self.source), "--output", str(output), "--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_bytes(), b"previous review")
        self.assertEqual(list(self.root.glob(".email-preview-*")), [])

    def test_output_overwrite_requires_force(self):
        output = self.root / "existing.html"
        output.write_bytes(b"previous review")
        result = self.run_cli("--source", str(self.source), "--output", str(output))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("use --force", result.stderr)
        self.assertEqual(output.read_bytes(), b"previous review")
        result = self.run_cli("--source", str(self.source), "--output", str(output), "--force")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(output.read_text(encoding="utf-8"), self.build())

    def test_oversized_and_unresolved_builder_markers_are_rejected(self):
        with patch.object(builder, "MAX_OUTPUT_BYTES", 100):
            with self.assertRaisesRegex(builder.BundleError, "byte limit"):
                self.build()
        brand = self.read("brand.json")
        for marker in ("%UNRESOLVED_MARKER%", "%DATA%", "%RUNTIME%"):
            with self.subTest(marker=marker):
                brand["name"] = marker
                self.write("brand.json", brand)
                with self.assertRaisesRegex(builder.BundleError, "unresolved builder template"):
                    self.build()


if __name__ == "__main__":
    unittest.main()
