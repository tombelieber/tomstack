#!/usr/bin/env python3
"""Validate an Auto Pilot goal-attempt receipt."""

import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


CONTRACT_FILES = (
    "SKILL.md",
    "references/automatic-promotion.md",
    "references/release-promotion.md",
    "references/receipt-schema.md",
    "scripts/validate_receipt.py",
)
SCHEMA_VERSION = 10
SUPPORTED_SCHEMA_VERSIONS = {9, SCHEMA_VERSION}
LEGACY_V9_CONTRACT_SHA256 = {
    "b58bffb92017ff9d3d3bd0f062de922ba3e3ed415e41ec722b0ca93e4bb2768e",
    "e7a244b9698e36b8f08da520fc404ce89cb451de147d0a68d836954ee29d3c0e",
}
GOAL_ID = re.compile(r"apg_[A-Za-z0-9_-]{12,80}")
ATTEMPT_ID = re.compile(r"apa_[A-Za-z0-9_-]{12,80}")
OPEN_PHASES = {
    "implementation", "qualification", "pre_mutation", "post_mutation",
    "production_proof", "release_notes", "cleanup",
}
OPEN_CATEGORIES = {
    "code", "ci", "release_path", "authorization", "credential",
    "remote_state", "provider", "safety", "documentation", "cleanup", "other",
}
ROOT_KEYS = {
    "schema_version", "goal_mode", "invoked_alias", "goal", "attempt",
    "completion_scope", "open_items", "plan", "summary", "git", "criteria",
    "checks", "pull_request", "promotion", "release", "release_notes",
    "cleanup", "capability_reachability",
}
DEFERRED_ACTION = re.compile(
    r"\b(?:TODO|FIXME|TBD)\b"
    r"|\b(?:delete|remove|clean(?:up| up)|publish|document|fix|retry|follow[- ]?up)\b.{0,40}\b(?:later|afterward|subsequently|pending)\b"
    r"|\b(?:later|afterward|subsequently|pending)\b.{0,40}\b(?:delete|remove|clean(?:up| up)|publish|document|fix|retry|follow[- ]?up)\b",
    re.I,
)


def die(message):
    print(f"invalid receipt: {message}", file=sys.stderr)
    raise SystemExit(1)


def obj(value, name):
    if not isinstance(value, dict):
        die(f"{name} must be an object")
    return value


def known(value, allowed, name):
    unknown = sorted(set(value) - set(allowed))
    if unknown:
        die(f"{name} contains unsupported fields: {', '.join(unknown)}")


def text(value, name):
    if not isinstance(value, str) or not value.strip():
        die(f"{name} must be a non-empty string")
    return value.strip()


def full_git_sha(value, name):
    value = text(value, name)
    if not re.fullmatch(r"[0-9a-fA-F]{40}", value):
        die(f"{name} must be a full 40 character hexadecimal Git id")
    return value.lower()


def git_sha(value, name):
    value = text(value, name)
    if not re.fullmatch(r"[0-9a-fA-F]{7,64}", value):
        die(f"{name} must be a 7-64 character hexadecimal Git id")
    return value.lower()


def sha256_digest(value, name):
    value = text(value, name)
    if not re.fullmatch(r"[0-9a-fA-F]{64}", value):
        die(f"{name} must be a full 64 character hexadecimal SHA-256 digest")
    return value.lower()


def web_url(value, name):
    value = text(value, name)
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        die(f"{name} must be an http/https URL with a host")
    return value


def release_contract_sha256():
    root = Path(__file__).resolve().parents[1]
    digest = hashlib.sha256()
    for relative in CONTRACT_FILES:
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update((root / relative).read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def validate_goal(value, goal_mode):
    value = obj(value, "goal")
    known(value, {"id", "target", "achieved"}, "goal")
    goal_id = text(value.get("id"), "goal.id")
    if not GOAL_ID.fullmatch(goal_id):
        die("goal.id must be an opaque apg_ identifier")
    expected = "PR_READY" if goal_mode == "pr" else "SHIPPED"
    if value.get("target") != expected:
        die(f"goal.target must be {expected} for goal_mode {goal_mode}")
    if value.get("achieved") not in {None, expected}:
        die("goal.achieved must be null or exactly equal goal.target")
    return value


def validate_attempt(value):
    value = obj(value, "attempt")
    known(value, {
        "id", "result", "basis", "previous_receipt_sha256",
        "change_artifact_ref", "change_evidence",
    }, "attempt")
    attempt_id = text(value.get("id"), "attempt.id")
    if not ATTEMPT_ID.fullmatch(attempt_id):
        die("attempt.id must be an opaque apa_ identifier")
    if value.get("result") not in {"achieved", "incomplete"}:
        die("attempt.result must be achieved or incomplete")
    basis = value.get("basis")
    if basis not in {"initial", "repair", "external_state_change", "reconciliation"}:
        die("attempt.basis is unsupported")
    text(value.get("change_evidence"), "attempt.change_evidence")
    if basis == "initial":
        if value.get("previous_receipt_sha256") is not None or value.get("change_artifact_ref") is not None:
            die("initial attempt requires null prior receipt and change artifact")
    else:
        sha256_digest(value.get("previous_receipt_sha256"), "attempt.previous_receipt_sha256")
        text(value.get("change_artifact_ref"), "attempt.change_artifact_ref")
    return value


def string_ids(value, name, require_nonempty=False):
    if not isinstance(value, list) or (require_nonempty and not value):
        die(f"{name} must be {'a non-empty' if require_nonempty else 'an'} array")
    result = [text(item, f"{name}[{index}]") for index, item in enumerate(value)]
    if len(set(result)) != len(result):
        die(f"{name} must not contain duplicates")
    return result


def validate_completion_scope(value):
    value = obj(value, "completion_scope")
    known(value, {"criteria_ids", "production_case_ids", "release_notes", "artifact_ref", "evidence"}, "completion_scope")
    criteria_ids = string_ids(value.get("criteria_ids"), "completion_scope.criteria_ids", True)
    production_ids = string_ids(value.get("production_case_ids"), "completion_scope.production_case_ids")
    if value.get("release_notes") not in {"required", "not_applicable"}:
        die("completion_scope.release_notes is unsupported")
    text(value.get("artifact_ref"), "completion_scope.artifact_ref")
    text(value.get("evidence"), "completion_scope.evidence")
    return {
        "criteria_ids": criteria_ids,
        "production_case_ids": production_ids,
        "release_notes": value.get("release_notes"),
    }


def validate_open_items(value):
    if not isinstance(value, list):
        die("open_items must be an array")
    seen = set()
    for index, item in enumerate(value):
        name = f"open_items[{index}]"
        item = obj(item, name)
        known(item, {"id", "kind", "phase", "category", "reason", "evidence", "next_safe_action"}, name)
        item_id = text(item.get("id"), f"{name}.id")
        if item_id in seen:
            die(f"{name}.id must be unique")
        seen.add(item_id)
        if item.get("kind") not in {"blocker", "failure", "todo", "follow_up"}:
            die(f"{name}.kind is unsupported")
        if item.get("phase") not in OPEN_PHASES:
            die(f"{name}.phase is unsupported")
        if item.get("category") not in OPEN_CATEGORIES:
            die(f"{name}.category is unsupported")
        text(item.get("reason"), f"{name}.reason")
        text(item.get("evidence"), f"{name}.evidence")
        text(item.get("next_safe_action"), f"{name}.next_safe_action")
    return value


def validate_plan(value):
    value = obj(value, "plan")
    known(value, {"source", "approved"}, "plan")
    if value.get("approved") is not True:
        die("plan.approved must be true")
    text(value.get("source"), "plan.source")


def validate_git(value):
    value = obj(value, "git")
    known(value, {"base_branch", "delivery_branch", "commits"}, "git")
    text(value.get("base_branch"), "git.base_branch")
    text(value.get("delivery_branch"), "git.delivery_branch")
    commits = value.get("commits")
    if not isinstance(commits, list) or not commits:
        die("git.commits must contain at least one commit")
    return {**value, "commits": [git_sha(item, f"git.commits[{index}]") for index, item in enumerate(commits)]}


def validate_items(value, kind, require_pass, schema_version):
    if not isinstance(value, list) or not value:
        die(f"{kind} must contain at least one item")
    result = []
    for index, item in enumerate(value):
        item = obj(item, f"{kind}[{index}]")
        key = "id" if kind == "criteria" else "name"
        text(item.get(key), f"{kind}[{index}].{key}")
        text(item.get("evidence"), f"{kind}[{index}].evidence")
        allowed = {"passed"} if require_pass else {"passed", "not_applicable", "failed", "not_run"}
        if item.get("status") not in allowed:
            die(f"{kind}[{index}].status is unsupported")
        if kind == "criteria":
            known(item, {"id", "status", "evidence"}, f"criteria[{index}]")
        elif item.get("name") == "exact-candidate":
            known(item, {"name", "status", "candidate_base_sha", "candidate_head_sha", "pull_request_url", "promotable", "required_ci_status", "evidence"}, f"checks[{index}]")
        elif item.get("name") == "production-release-ready":
            known(item, {"name", "status", "production_path_status", "preflight_status", "credentials_status", "configuration_status", "migration_status", "recovery_status", "next_action", "evidence"}, f"checks[{index}]")
        elif item.get("name") == "production-data-compatibility":
            known(item, {
                "name", "status", "source_data_version", "target_data_version",
                "representative_legacy_data", "migration_execution_status",
                "new_system_read_status", "new_system_write_status",
                "critical_workflow_status", "data_invariants_status",
                "mixed_version_status", "production_case_id", "artifact_ref", "evidence",
            }, f"checks[{index}]")
        elif schema_version >= 10 and item.get("name") == "production-regression-compatibility":
            known(item, {
                "name", "status", "current_production_baseline",
                "representative_existing_data", "existing_behavior_status",
                "existing_data_status", "release_gate_status", "regression_suite_status",
                "gaps_detected", "gap_remediation_status", "gap_artifact_ref",
                "production_case_ids", "artifact_ref", "evidence",
            }, f"checks[{index}]")
        elif item.get("name") == "release-contract-binding":
            known(item, {"name", "status", "contract_sha256", "goal_id", "attempt_id", "candidate_base_sha", "candidate_head_sha", "pull_request_url", "source_receipt_sha256", "single_use", "evidence"}, f"checks[{index}]")
        elif item.get("name") == "remote-state-reconciliation":
            known(item, {"name", "status", "artifact_ref", "evidence"}, f"checks[{index}]")
            if item.get("status") == "passed":
                text(item.get("artifact_ref"), f"checks[{index}].artifact_ref")
        else:
            known(item, {"name", "status", "evidence"}, f"checks[{index}]")
        result.append(item)
    return result


def validate_pull_request(value):
    value = obj(value, "pull_request")
    known(value, {"url", "status", "merged", "merge_sha"}, "pull_request")
    web_url(value.get("url"), "pull_request.url")
    if value.get("status") not in {"open", "ready", "merged"} or not isinstance(value.get("merged"), bool):
        die("pull_request status or merged flag is unsupported")
    if value.get("merged"):
        if value.get("status") != "merged":
            die("merged pull request requires status merged")
        full_git_sha(value.get("merge_sha"), "pull_request.merge_sha")
    elif value.get("status") not in {"open", "ready"} or value.get("merge_sha") is not None:
        die("unmerged pull request requires open/ready status and null merge_sha")
    return value


def validate_exact_candidate(checks, git_value, pull_request, require_success):
    matches = [item for item in checks if item.get("name") == "exact-candidate"]
    if len(matches) != 1:
        die("delivery evidence requires exactly one exact-candidate check")
    check = matches[0]
    known(check, {"name", "status", "candidate_base_sha", "candidate_head_sha", "pull_request_url", "promotable", "required_ci_status", "evidence"}, "exact-candidate")
    base = full_git_sha(check.get("candidate_base_sha"), "exact-candidate.candidate_base_sha")
    head = full_git_sha(check.get("candidate_head_sha"), "exact-candidate.candidate_head_sha")
    if base == head or head not in set(git_value["commits"]):
        die("exact-candidate head must differ from base and appear in git.commits")
    if web_url(check.get("pull_request_url"), "exact-candidate.pull_request_url") != pull_request.get("url"):
        die("exact-candidate pull_request_url must equal pull_request.url")
    if not isinstance(check.get("promotable"), bool) or check.get("required_ci_status") not in {"passed", "failed", "not_run"}:
        die("exact-candidate promotability evidence is unsupported")
    if require_success and (check.get("status") != "passed" or check.get("promotable") is not True or check.get("required_ci_status") != "passed"):
        die("successful goal requires a passed, promotable exact candidate with current CI")
    return {"base": base, "head": head, "pull_request_url": pull_request.get("url")}


def validate_production_ready(checks, require_success):
    matches = [item for item in checks if item.get("name") == "production-release-ready"]
    if len(matches) != 1:
        die("delivery evidence requires exactly one production-release-ready check")
    check = matches[0]
    known(check, {
        "name", "status", "production_path_status", "preflight_status", "credentials_status",
        "configuration_status", "migration_status", "recovery_status", "next_action", "evidence",
    }, "production-release-ready")
    if require_success and (
        check.get("status") != "passed"
        or check.get("production_path_status") != "verified"
        or check.get("preflight_status") != "passed"
        or check.get("credentials_status") != "ready"
        or check.get("configuration_status") != "ready"
        or check.get("migration_status") not in {"ready", "not_applicable"}
        or check.get("recovery_status") != "ready"
        or check.get("next_action") != "production_release"
    ):
        die("production-release-ready must prove that only the production action remains")
    return check


def validate_production_data_compatibility(checks, production_ready, require_success):
    matches = [item for item in checks if item.get("name") == "production-data-compatibility"]
    migration_applies = production_ready.get("migration_status") == "ready"
    if not migration_applies:
        if matches:
            die("production-data-compatibility requires migration_status ready")
        return None
    if not matches and not require_success:
        return None
    if len(matches) != 1:
        die("migration_status ready requires exactly one production-data-compatibility check")

    check = matches[0]
    known(check, {
        "name", "status", "source_data_version", "target_data_version",
        "representative_legacy_data", "migration_execution_status",
        "new_system_read_status", "new_system_write_status",
        "critical_workflow_status", "data_invariants_status", "mixed_version_status",
        "production_case_id", "artifact_ref", "evidence",
    }, "production-data-compatibility")
    for key in (
        "source_data_version", "target_data_version", "representative_legacy_data",
        "artifact_ref", "evidence",
    ):
        text(check.get(key), f"production-data-compatibility.{key}")

    required_statuses = (
        "migration_execution_status", "new_system_read_status",
        "critical_workflow_status", "data_invariants_status",
    )
    for key in required_statuses:
        if check.get(key) not in {"passed", "failed", "not_run"}:
            die(f"production-data-compatibility.{key} is unsupported")
    if check.get("new_system_write_status") not in {"passed", "not_applicable", "failed", "not_run"}:
        die("production-data-compatibility.new_system_write_status is unsupported")
    if check.get("mixed_version_status") not in {"passed", "not_applicable", "failed", "not_run"}:
        die("production-data-compatibility.mixed_version_status is unsupported")

    if "production_case_id" not in check:
        die("production-data-compatibility.production_case_id is required")
    production_case_id = check.get("production_case_id")
    if production_case_id is not None:
        production_case_id = text(production_case_id, "production-data-compatibility.production_case_id")
    if require_success and (
        check.get("status") != "passed"
        or any(check.get(key) != "passed" for key in required_statuses)
        or check.get("new_system_write_status") not in {"passed", "not_applicable"}
        or check.get("mixed_version_status") not in {"passed", "not_applicable"}
    ):
        die("production-data-compatibility must prove migrated data works through the new system")
    return {"production_case_id": production_case_id}


def validate_production_regression_compatibility(checks, schema_version, require_success):
    matches = [item for item in checks if item.get("name") == "production-regression-compatibility"]
    if schema_version < 10:
        return None
    if not matches and not require_success:
        return None
    if len(matches) != 1:
        die("schema v10 delivery evidence requires exactly one production-regression-compatibility check")

    check = matches[0]
    known(check, {
        "name", "status", "current_production_baseline",
        "representative_existing_data", "existing_behavior_status",
        "existing_data_status", "release_gate_status", "regression_suite_status",
        "gaps_detected", "gap_remediation_status", "gap_artifact_ref",
        "production_case_ids", "artifact_ref", "evidence",
    }, "production-regression-compatibility")
    for key in (
        "current_production_baseline", "representative_existing_data",
        "artifact_ref", "evidence",
    ):
        text(check.get(key), f"production-regression-compatibility.{key}")

    required_statuses = (
        "existing_behavior_status", "existing_data_status",
        "release_gate_status", "regression_suite_status",
    )
    for key in required_statuses:
        if check.get(key) not in {"passed", "failed", "not_run"}:
            die(f"production-regression-compatibility.{key} is unsupported")
    if check.get("gap_remediation_status") not in {"passed", "not_applicable", "failed", "not_run"}:
        die("production-regression-compatibility.gap_remediation_status is unsupported")
    if not isinstance(check.get("gaps_detected"), bool):
        die("production-regression-compatibility.gaps_detected must be boolean")
    production_case_ids = string_ids(
        check.get("production_case_ids"),
        "production-regression-compatibility.production_case_ids",
    )

    if check.get("gaps_detected"):
        text(check.get("gap_artifact_ref"), "production-regression-compatibility.gap_artifact_ref")
    elif check.get("gap_remediation_status") != "not_applicable" or check.get("gap_artifact_ref") is not None:
        die("no detected regression gap requires not_applicable remediation and a null gap artifact")

    if require_success and (
        check.get("status") != "passed"
        or any(check.get(key) != "passed" for key in required_statuses)
        or (
            check.get("gaps_detected")
            and check.get("gap_remediation_status") != "passed"
        )
    ):
        die("production-regression-compatibility must prove existing production behavior, data, and gates remain operable")
    return {"production_case_ids": production_case_ids}


def validate_release(value, require_success):
    value = obj(value, "release")
    known(value, {"status", "url", "message", "evidence"}, "release")
    allowed = {"not_requested", "passed"} if require_success else {"not_requested", "passed", "failed", "not_run"}
    if value.get("status") not in allowed:
        die("release.status is unsupported")
    if value.get("url") is not None:
        web_url(value.get("url"), "release.url")
    if value.get("status") == "passed":
        web_url(value.get("url"), "release.url")
        message = text(value.get("message"), "release.message")
        if not message.startswith("### Release"):
            die("release.message must start with the ### Release heading")
    elif value.get("message") is not None:
        die("release.message must be null unless release.status passed")
    text(value.get("evidence"), "release.evidence")
    return value


def validate_release_notes(value, require_success):
    value = obj(value, "release_notes")
    known(value, {"status", "artifact_ref", "evidence"}, "release_notes")
    allowed = {"passed", "not_applicable"} if require_success else {"passed", "not_applicable", "failed", "not_run"}
    if value.get("status") not in allowed:
        die("release_notes.status is unsupported")
    if value.get("status") == "passed":
        text(value.get("artifact_ref"), "release_notes.artifact_ref")
    elif value.get("artifact_ref") is not None:
        text(value.get("artifact_ref"), "release_notes.artifact_ref")
    text(value.get("evidence"), "release_notes.evidence")
    return value


def validate_cleanup(value, require_success):
    value = obj(value, "cleanup")
    known(value, {"status", "worktree", "local_branch", "remote_branch", "remote_branch_policy_ref", "evidence"}, "cleanup")
    allowed = {"passed"} if require_success else {"passed", "failed", "not_run"}
    if value.get("status") not in allowed:
        die("cleanup.status is unsupported")
    terminal = {
        "worktree": {"removed", "not_used"},
        "local_branch": {"deleted", "not_used"},
        "remote_branch": {"deleted", "absent", "not_used", "retained_by_policy"},
    }
    incomplete = {"worktree": {"retained"}, "local_branch": {"retained"}, "remote_branch": {"retained"}}
    for key, values in terminal.items():
        allowed_values = values if value.get("status") == "passed" else values | incomplete[key]
        if value.get(key) not in allowed_values:
            die(f"cleanup.{key} is unsupported for cleanup.status {value.get('status')}")
    if value.get("remote_branch") == "retained_by_policy":
        text(value.get("remote_branch_policy_ref"), "cleanup.remote_branch_policy_ref")
    elif value.get("remote_branch_policy_ref") is not None:
        die("cleanup.remote_branch_policy_ref is only valid for retained_by_policy")
    text(value.get("evidence"), "cleanup.evidence")


def validate_promotion(value, git_value):
    value = obj(value, "promotion")
    known(value, {"source", "source_receipt", "candidate_base_sha", "candidate_head_sha", "authority_evidence"}, "promotion")
    if value.get("source") not in {"live_candidate", "pr_ready_receipt"}:
        die("promotion.source is unsupported")
    if value.get("source") == "live_candidate" and value.get("source_receipt") is not None:
        die("live_candidate promotion requires null source_receipt")
    if value.get("source") == "pr_ready_receipt":
        source = Path(text(value.get("source_receipt"), "promotion.source_receipt")).expanduser()
        if not source.is_absolute():
            die("promotion.source_receipt must be absolute")
    base = full_git_sha(value.get("candidate_base_sha"), "promotion.candidate_base_sha")
    head = full_git_sha(value.get("candidate_head_sha"), "promotion.candidate_head_sha")
    if base == head or head not in set(git_value["commits"]):
        die("promotion candidate must be the exact delivery head")
    authority = text(value.get("authority_evidence"), "promotion.authority_evidence")
    if not re.search(r"\$auto-pilot\s+(?:ship|release|promote|deploy)\b", authority, re.I):
        die("promotion authority must identify the current ship command or alias")
    return {"source": value.get("source"), "source_receipt": value.get("source_receipt"), "base": base, "head": head}


def validate_binding(checks, goal, attempt, promotion, exact, pull_request, schema_version):
    matches = [item for item in checks if item.get("name") == "release-contract-binding"]
    if len(matches) != 1:
        die("ship evidence requires exactly one release-contract-binding check")
    check = matches[0]
    known(check, {
        "name", "status", "contract_sha256", "goal_id", "attempt_id", "candidate_base_sha",
        "candidate_head_sha", "pull_request_url", "source_receipt_sha256", "single_use", "evidence",
    }, "release-contract-binding")
    if check.get("status") != "passed" or check.get("single_use") is not True:
        die("release-contract-binding must be passed and single-use at attempt scope")
    if check.get("goal_id") != goal.get("id") or check.get("attempt_id") != attempt.get("id"):
        die("release-contract-binding must bind the current goal and attempt")
    contract_digest = sha256_digest(
        check.get("contract_sha256"),
        "release-contract-binding.contract_sha256",
    )
    valid_contracts = (
        {release_contract_sha256()}
        if schema_version == SCHEMA_VERSION
        else LEGACY_V9_CONTRACT_SHA256
    )
    if contract_digest not in valid_contracts:
        die("release-contract-binding contract digest is not valid for this receipt schema")
    bound = {
        "base": full_git_sha(check.get("candidate_base_sha"), "release-contract-binding.candidate_base_sha"),
        "head": full_git_sha(check.get("candidate_head_sha"), "release-contract-binding.candidate_head_sha"),
        "pull_request_url": web_url(check.get("pull_request_url"), "release-contract-binding.pull_request_url"),
    }
    if bound != exact or bound["base"] != promotion["base"] or bound["head"] != promotion["head"] or bound["pull_request_url"] != pull_request.get("url"):
        die("release-contract-binding must match exact candidate, promotion, and PR")
    source_digest = check.get("source_receipt_sha256")
    if promotion["source"] == "live_candidate":
        if source_digest is not None:
            die("live_candidate binding requires null source_receipt_sha256")
        return
    source_digest = sha256_digest(source_digest, "release-contract-binding.source_receipt_sha256")
    source = Path(promotion["source_receipt"])
    try:
        source_bytes = source.read_bytes()
    except OSError:
        die("promotion.source_receipt must be readable")
    if hashlib.sha256(source_bytes).hexdigest() != source_digest:
        die("source_receipt_sha256 does not match promotion.source_receipt")
    try:
        source_value = json.loads(source_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError):
        die("promotion.source_receipt must contain valid JSON")
    if source_value.get("schema_version") != schema_version or source_value.get("goal_mode") != "pr" or source_value.get("goal", {}).get("achieved") != "PR_READY":
        die("promotion.source_receipt must be a same-schema valid PR_READY receipt")
    if validate(source) != "PR_READY":
        die("promotion.source_receipt must validate as PR_READY")
    try:
        if source.read_bytes() != source_bytes:
            die("promotion.source_receipt changed during validation")
    except OSError:
        die("promotion.source_receipt must remain readable during validation")
    source_checks = source_value.get("checks", [])
    source_exact = next((item for item in source_checks if item.get("name") == "exact-candidate"), None)
    source_identity = {
        "base": full_git_sha(source_exact.get("candidate_base_sha"), "promotion.source_receipt exact candidate base"),
        "head": full_git_sha(source_exact.get("candidate_head_sha"), "promotion.source_receipt exact candidate head"),
        "pull_request_url": web_url(source_exact.get("pull_request_url"), "promotion.source_receipt PR URL"),
    }
    if source_identity != exact or source_value.get("pull_request", {}).get("url") != pull_request.get("url"):
        die("promotion.source_receipt must identify the exact promoted candidate and PR")


def validate_proof(value, name, require_success, require_artifact=False):
    value = obj(value, name)
    known(value, {"status", "artifact_ref", "evidence", "decision", "effective_binding_count"}, name)
    allowed = {"passed"} if require_success else {"passed", "failed", "not_run"}
    if value.get("status") not in allowed:
        die(f"{name}.status is unsupported")
    text(value.get("evidence"), f"{name}.evidence")
    if require_artifact and value.get("status") == "passed":
        text(value.get("artifact_ref"), f"{name}.artifact_ref")
    elif value.get("artifact_ref") is not None:
        text(value.get("artifact_ref"), f"{name}.artifact_ref")
    return value


def validate_capability(value, require_success):
    value = obj(value, "capability_reachability")
    known(value, {"deployed_candidate_sha", "scope_evidence", "cases"}, "capability_reachability")
    deployed = full_git_sha(value.get("deployed_candidate_sha"), "capability_reachability.deployed_candidate_sha")
    text(value.get("scope_evidence"), "capability_reachability.scope_evidence")
    cases = value.get("cases")
    if not isinstance(cases, list) or not cases:
        die("capability_reachability.cases must be non-empty")
    ids = []
    for index, case in enumerate(cases):
        name = f"capability_reachability.cases[{index}]"
        case = obj(case, name)
        known(case, {
            "id", "actor", "credential_class", "resource_scope", "entrypoint", "runtime_principal",
            "representative_data_case", "expected_terminal_outcome", "observed_terminal_outcome",
            "deterministic", "production", "authorization_changed", "authorized", "unauthorized",
        }, name)
        ids.append(text(case.get("id"), f"{name}.id"))
        for key in ("actor", "credential_class", "resource_scope", "entrypoint", "runtime_principal", "representative_data_case", "expected_terminal_outcome"):
            text(case.get(key), f"{name}.{key}")
        observed = case.get("observed_terminal_outcome")
        if require_success and text(observed, f"{name}.observed_terminal_outcome") != case.get("expected_terminal_outcome"):
            die(f"{name} must observe its expected terminal outcome")
        elif observed is not None:
            text(observed, f"{name}.observed_terminal_outcome")
        validate_proof(case.get("deterministic"), f"{name}.deterministic", require_success, True)
        validate_proof(case.get("production"), f"{name}.production", require_success, True)
        if not isinstance(case.get("authorization_changed"), bool):
            die(f"{name}.authorization_changed must be boolean")
        if case.get("authorization_changed"):
            for label, decision, count in (("authorized", "allowed", 1), ("unauthorized", "denied", 0)):
                proof = validate_proof(case.get(label), f"{name}.{label}", require_success)
                if proof.get("decision") != decision or not isinstance(proof.get("effective_binding_count"), int):
                    die(f"{name}.{label} authorization evidence is invalid")
                if (decision == "allowed" and proof.get("effective_binding_count") < count) or (decision == "denied" and proof.get("effective_binding_count") != count):
                    die(f"{name}.{label} binding count is invalid")
        elif "authorized" in case or "unauthorized" in case:
            die(f"{name} authorization proofs require authorization_changed true")
    if len(set(ids)) != len(ids):
        die("capability case IDs must be unique")
    return {"deployed_sha": deployed, "case_ids": ids}


def validate_delivery_details(root, require_success, schema_version):
    git_value = validate_git(root.get("git"))
    criteria = validate_items(root.get("criteria"), "criteria", require_success, schema_version)
    checks = validate_items(root.get("checks"), "checks", require_success, schema_version)
    pull_request = validate_pull_request(root.get("pull_request"))
    exact = validate_exact_candidate(checks, git_value, pull_request, require_success)
    production_ready = validate_production_ready(checks, require_success)
    migration_compatibility = validate_production_data_compatibility(checks, production_ready, require_success)
    regression_compatibility = validate_production_regression_compatibility(
        checks,
        schema_version,
        require_success,
    )
    release = validate_release(root.get("release"), require_success)
    return (
        git_value, criteria, checks, pull_request, exact, release,
        migration_compatibility, regression_compatibility,
    )


def validate_incomplete(root, goal_mode, schema_version):
    delivery = {"git", "criteria", "checks", "pull_request", "release"}
    present = delivery & set(root)
    if present and present != delivery:
        die("partial delivery evidence must include git, criteria, checks, pull_request, and release together")
    advanced_phases = {"post_mutation", "production_proof", "release_notes", "cleanup"}
    observed_phases = {item.get("phase") for item in root.get("open_items", [])}
    after_mutation = bool(observed_phases & advanced_phases)
    if not present:
        unexpected = {"promotion", "release_notes", "cleanup", "capability_reachability"} & set(root)
        if unexpected:
            die("post-readiness evidence requires the complete delivery evidence set")
        if after_mutation:
            die("post-mutation incomplete evidence requires the admitted candidate and reconciled remote state")
        return None
    details = validate_delivery_details(root, False, schema_version)
    git_value, _, checks, pull_request, exact, _, _, _ = details
    if goal_mode == "pr" and pull_request.get("merged"):
        die("PR goal cannot include a merged candidate")
    promotion = None
    if "promotion" in root:
        promotion = validate_promotion(root.get("promotion"), git_value)
        validate_binding(
            checks, root["goal"], root["attempt"], promotion, exact,
            pull_request, schema_version,
        )
    if after_mutation:
        if goal_mode != "ship" or promotion is None:
            die("post-mutation incomplete evidence requires ship promotion and attempt binding")
        reconciliations = [item for item in checks if item.get("name") == "remote-state-reconciliation"]
        if len(reconciliations) != 1 or reconciliations[0].get("status") != "passed":
            die("post-mutation incomplete evidence requires one passed remote-state reconciliation")
        if observed_phases & {"production_proof", "release_notes", "cleanup"} and "capability_reachability" not in root:
            die("production-stage incomplete evidence requires capability reachability evidence")
        if observed_phases & {"release_notes", "cleanup"} and "release_notes" not in root:
            die("release-note or cleanup failure requires release_notes evidence")
        if "cleanup" in observed_phases and "cleanup" not in root:
            die("cleanup failure requires cleanup evidence")
    if "release_notes" in root:
        validate_release_notes(root.get("release_notes"), False)
    if "cleanup" in root:
        validate_cleanup(root.get("cleanup"), False)
    if "capability_reachability" in root:
        capability = validate_capability(root.get("capability_reachability"), False)
        if pull_request.get("merged") and capability["deployed_sha"] != pull_request.get("merge_sha").lower():
            die("capability evidence must identify the merged candidate")
    return details


def validate(path):
    try:
        root = obj(json.loads(path.read_text(encoding="utf-8")), "receipt")
    except FileNotFoundError:
        die(f"file not found: {path}")
    except json.JSONDecodeError as exc:
        die(f"invalid JSON at line {exc.lineno}, column {exc.colno}")

    known(root, ROOT_KEYS, "receipt")
    schema_version = root.get("schema_version")
    if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        supported = ", ".join(str(item) for item in sorted(SUPPORTED_SCHEMA_VERSIONS))
        die(f"schema_version must be one of: {supported}")
    goal_mode = root.get("goal_mode")
    if goal_mode not in {"pr", "ship"}:
        die("goal_mode must be pr or ship")
    alias = root.get("invoked_alias")
    if alias not in {None, "release", "promote", "deploy"} or (goal_mode == "pr" and alias is not None):
        die("invoked_alias is unsupported for goal_mode")

    goal = validate_goal(root.get("goal"), goal_mode)
    attempt = validate_attempt(root.get("attempt"))
    scope = validate_completion_scope(root.get("completion_scope"))
    open_items = validate_open_items(root.get("open_items"))
    validate_plan(root.get("plan"))
    text(root.get("summary"), "summary")

    achieved = attempt.get("result") == "achieved"
    if achieved:
        if goal.get("achieved") != goal.get("target") or open_items:
            die("achieved result requires the exact goal outcome and zero open items")
    elif goal.get("achieved") is not None or not open_items:
        die("incomplete result requires null goal.achieved and at least one open item")

    if not achieved:
        details = validate_incomplete(root, goal_mode, schema_version)
        if details:
            criteria_ids = [item["id"] for item in details[1]]
            if set(scope["criteria_ids"]) != set(criteria_ids):
                die("completion_scope.criteria_ids must exactly match criteria")
            if "capability_reachability" in root:
                case_ids = [item["id"] for item in root["capability_reachability"]["cases"]]
                if set(scope["production_case_ids"]) != set(case_ids):
                    die("completion_scope.production_case_ids must exactly match capability cases")
        return "incomplete"

    (
        git_value, criteria, checks, pull_request, exact, release,
        migration_compatibility, regression_compatibility,
    ) = validate_delivery_details(root, True, schema_version)
    if set(scope["criteria_ids"]) != {item["id"] for item in criteria}:
        die("completion_scope.criteria_ids must exactly match criteria")

    if goal_mode == "pr":
        if pull_request.get("merged") or release.get("status") != "not_requested" or release.get("url") is not None or release.get("message") is not None:
            die("PR_READY requires an open unmerged candidate and no production mutation")
        if scope["production_case_ids"]:
            die("PR_READY completion scope must not claim production cases")
        if migration_compatibility and migration_compatibility["production_case_id"] is not None:
            die("PR_READY production-data-compatibility must not claim a production case")
        if regression_compatibility and regression_compatibility["production_case_ids"]:
            die("PR_READY production-regression-compatibility must not claim production cases")
        for forbidden in ("promotion", "release_notes", "cleanup", "capability_reachability"):
            if forbidden in root:
                die(f"PR_READY must not contain {forbidden}")
        return "PR_READY"

    promotion = validate_promotion(root.get("promotion"), git_value)
    validate_binding(
        checks, goal, attempt, promotion, exact, pull_request, schema_version,
    )
    notes = validate_release_notes(root.get("release_notes"), True)
    if (scope["release_notes"] == "required" and notes.get("status") != "passed") or (
        scope["release_notes"] == "not_applicable" and notes.get("status") != "not_applicable"
    ):
        die("release_notes status must match completion_scope.release_notes")
    validate_cleanup(root.get("cleanup"), True)
    if not pull_request.get("merged") or release.get("status") != "passed":
        die("SHIPPED requires a merged PR and passed production release")
    capability = validate_capability(root.get("capability_reachability"), True)
    if capability["deployed_sha"] != pull_request.get("merge_sha").lower():
        die("deployed candidate must equal pull_request.merge_sha")
    if set(scope["production_case_ids"]) != set(capability["case_ids"]):
        die("completion_scope.production_case_ids must exactly match capability cases")
    if migration_compatibility:
        migration_case = migration_compatibility["production_case_id"]
        if migration_case is None or migration_case not in capability["case_ids"]:
            die("SHIPPED production-data-compatibility must link a production capability case")
    if regression_compatibility:
        regression_cases = regression_compatibility["production_case_ids"]
        if not regression_cases or not set(regression_cases).issubset(capability["case_ids"]):
            die("SHIPPED production-regression-compatibility must link existing-production capability cases")
    if attempt.get("basis") == "reconciliation":
        reconciliations = [item for item in checks if item.get("name") == "remote-state-reconciliation"]
        if len(reconciliations) != 1 or reconciliations[0].get("status") != "passed":
            die("reconciliation attempt requires one passed remote-state-reconciliation check")
    reject_deferred_actions(root)
    return "SHIPPED"


def reject_deferred_actions(value, name="receipt"):
    if isinstance(value, dict):
        for key, item in value.items():
            reject_deferred_actions(item, f"{name}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            reject_deferred_actions(item, f"{name}[{index}]")
    elif isinstance(value, str) and DEFERRED_ACTION.search(value):
        die(f"{name} contains deferred work in a SHIPPED receipt")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--contract-sha256":
        print(release_contract_sha256())
    elif len(sys.argv) == 2:
        print(f"valid Auto Pilot receipt: {validate(Path(sys.argv[1]).expanduser())}")
    else:
        die("usage: validate_receipt.py RECEIPT.json | --contract-sha256")
