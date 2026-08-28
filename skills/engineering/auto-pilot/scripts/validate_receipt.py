#!/usr/bin/env python3
"""Validate an Auto Pilot version 7 completion receipt."""

import json
import hashlib
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


CONTRACT_FILES = (
    "SKILL.md",
    "references/automatic-promotion.md",
    "references/release-promotion.md",
    "references/receipt-schema.md",
    "scripts/validate_receipt.py",
)


def die(message):
    print(f"invalid receipt: {message}", file=sys.stderr)
    raise SystemExit(1)


def obj(value, name):
    if not isinstance(value, dict):
        die(f"{name} must be an object")
    return value


def text(value, name):
    if not isinstance(value, str) or not value.strip():
        die(f"{name} must be a non-empty string")
    return value.strip()


def git_sha(value, name):
    value = text(value, name)
    if not re.fullmatch(r"[0-9a-fA-F]{7,64}", value):
        die(f"{name} must be a 7-64 character hexadecimal Git id")
    return value


def full_git_sha(value, name):
    value = text(value, name)
    if not re.fullmatch(r"[0-9a-fA-F]{40}", value):
        die(f"{name} must be a full 40 character hexadecimal Git id")
    return value.lower()


def sha256_digest(value, name):
    value = text(value, name)
    if not re.fullmatch(r"[0-9a-fA-F]{64}", value):
        die(f"{name} must be a full 64 character hexadecimal SHA-256 digest")
    return value.lower()


def release_contract_sha256():
    skill_root = Path(__file__).resolve().parents[1]
    digest = hashlib.sha256()
    for relative in CONTRACT_FILES:
        path = skill_root / relative
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def web_url(value, name):
    value = text(value, name)
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        die(f"{name} must be an http/https URL with a host")
    return value


def validate_git(value):
    value = obj(value, "git")
    text(value.get("base_branch"), "git.base_branch")
    text(value.get("delivery_branch"), "git.delivery_branch")
    commits = value.get("commits")
    if not isinstance(commits, list) or not commits:
        die("git.commits must contain at least one commit")
    for index, commit in enumerate(commits):
        git_sha(commit, f"git.commits[{index}]")
    return value


def validate_items(value, kind, require_pass):
    if not isinstance(value, list) or not value:
        die(f"{kind} must contain at least one item")
    passed = 0
    for index, item in enumerate(value):
        item = obj(item, f"{kind}[{index}]")
        key = "id" if kind == "criteria" else "name"
        text(item.get(key), f"{kind}[{index}].{key}")
        text(item.get("evidence"), f"{kind}[{index}].evidence")
        allowed = {"passed"} if kind == "criteria" else {"passed", "not_applicable"}
        if not require_pass:
            allowed |= {"failed", "not_run"}
        if item.get("status") not in allowed:
            die(f"{kind}[{index}].status is unsupported")
        if item.get("status") == "passed":
            passed += 1
    if require_pass and passed == 0:
        die(f"{kind} must contain at least one passed item")
    return value


def aware_timestamp(value, name):
    value = text(value, name)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        die(f"{name} must be an ISO 8601 timestamp")
    if parsed.tzinfo is None:
        die(f"{name} must include a timezone")
    return parsed


def validate_release_control_budget(checks, require_success):
    matches = [
        check for check in checks if check.get("name") == "release-control-budget"
    ]
    if len(matches) != 1:
        die("release mode requires exactly one release-control-budget check")

    check = matches[0]
    budget = check.get("budget_seconds")
    elapsed = check.get("elapsed_seconds")
    if not isinstance(budget, int) or isinstance(budget, bool) or budget <= 0:
        die("release-control-budget.budget_seconds must be a positive integer")
    if not isinstance(elapsed, int) or isinstance(elapsed, bool) or elapsed < 0:
        die("release-control-budget.elapsed_seconds must be a non-negative integer")

    started = aware_timestamp(
        check.get("live_pr_bound_at"), "release-control-budget.live_pr_bound_at"
    )
    ended = aware_timestamp(check.get("ended_at"), "release-control-budget.ended_at")
    if ended < started:
        die("release-control-budget.ended_at must not precede live_pr_bound_at")
    measured = round((ended - started).total_seconds())
    if abs(measured - elapsed) > 1:
        die("release-control-budget.elapsed_seconds must match the recorded timestamps")

    if check.get("end_kind") not in {"terminal", "safe_boundary"}:
        die("release-control-budget.end_kind must be terminal or safe_boundary")
    expected_outcome = "passed" if elapsed <= budget else "exhausted"
    if check.get("outcome") != expected_outcome:
        die(f"release-control-budget.outcome must be {expected_outcome}")
    expected_status = "passed" if expected_outcome == "passed" else "failed"
    if check.get("status") != expected_status:
        die(f"release-control-budget.status must be {expected_status}")
    if require_success and expected_outcome != "passed":
        die("successful release mode must finish within release-control-budget")
    return check


def validate_release_contract_binding(checks, promotion=None, require_success=False):
    matches = [
        check for check in checks if check.get("name") == "release-contract-binding"
    ]
    if len(matches) != 1:
        die("release mode requires exactly one release-contract-binding check")

    check = matches[0]
    if check.get("status") != "passed":
        die("release-contract-binding.status must be passed")
    if check.get("single_use") is not True:
        die("release-contract-binding.single_use must be true")

    contract = sha256_digest(
        check.get("contract_sha256"), "release-contract-binding.contract_sha256"
    )
    if contract != release_contract_sha256():
        die("release-contract-binding.contract_sha256 does not match the installed contract")
    candidate = full_git_sha(
        check.get("candidate_head_sha"),
        "release-contract-binding.candidate_head_sha",
    )

    source_digest = check.get("source_receipt_sha256")
    if source_digest is not None:
        sha256_digest(
            source_digest, "release-contract-binding.source_receipt_sha256"
        )
    if promotion is not None:
        if candidate != promotion.get("candidate_head_sha").lower():
            die("release-contract-binding candidate must equal promotion candidate head")
        if promotion.get("source") == "pr_ready_receipt" and source_digest is None:
            die("pr_ready_receipt promotion requires source_receipt_sha256")
        if promotion.get("source") == "live_pr" and source_digest is not None:
            die("live_pr promotion requires null source_receipt_sha256")
        if require_success and promotion.get("source") != "pr_ready_receipt":
            die("successful release mode requires a pr_ready_receipt source")
        if promotion.get("source") == "pr_ready_receipt":
            source_path = Path(promotion.get("source_receipt")).expanduser()
            if not source_path.is_absolute():
                die("promotion.source_receipt must be an absolute local path")
            try:
                source_bytes = source_path.read_bytes()
            except OSError:
                die("promotion.source_receipt must be a readable local receipt file")
            if hashlib.sha256(source_bytes).hexdigest() != source_digest:
                die("source_receipt_sha256 does not match promotion.source_receipt")
            try:
                source_root = obj(json.loads(source_bytes), "promotion.source_receipt")
            except (json.JSONDecodeError, UnicodeDecodeError):
                die("promotion.source_receipt must contain valid JSON")
            if source_root.get("mode") != "pr" or source_root.get("terminal_state") != "pr_ready":
                die("promotion.source_receipt must be a pr_ready receipt")
            if validate(source_path) != "pr_ready":
                die("promotion.source_receipt must validate as pr_ready")
            source_git = validate_git(source_root.get("git"))
            source_commits = {
                str(commit).lower() for commit in source_git.get("commits", [])
            }
            if candidate not in source_commits:
                die("promotion candidate must appear in the source pr_ready receipt")
    return check


def validate_pull_request(value):
    value = obj(value, "pull_request")
    web_url(value.get("url"), "pull_request.url")
    if value.get("status") not in {"open", "ready", "merged"}:
        die("pull_request.status is unsupported")
    if not isinstance(value.get("merged"), bool):
        die("pull_request.merged must be a boolean")
    if value.get("merge_sha") is not None:
        git_sha(value.get("merge_sha"), "pull_request.merge_sha")
    return value


def validate_release(value, allow_failed=False):
    value = obj(value, "release")
    statuses = {"not_requested", "no_mechanism", "passed"}
    if allow_failed:
        statuses.add("failed")
    if value.get("status") not in statuses:
        die("release.status is unsupported")
    if value.get("status") == "passed":
        web_url(value.get("url"), "release.url")
    elif value.get("url") is not None:
        web_url(value.get("url"), "release.url")
    notes_url = value.get("notes_url")
    message = value.get("message")
    if value.get("status") == "passed":
        notes_url = web_url(notes_url, "release.notes_url")
        message = text(message, "release.message")
        if not message.startswith("### Release"):
            die("release.message must start with the ### Release heading")
        if notes_url not in message:
            die("release.message must contain release.notes_url")
    elif notes_url is not None or message is not None:
        if notes_url is None or message is None:
            die("release.notes_url and release.message must both be set or both be null")
        notes_url = web_url(notes_url, "release.notes_url")
        message = text(message, "release.message")
        if notes_url not in message:
            die("release.message must contain release.notes_url")
    text(value.get("evidence"), "release.evidence")
    return value


def validate_promotion(value, git_value=None):
    value = obj(value, "promotion")
    source = value.get("source")
    if source not in {"live_pr", "pr_ready_receipt"}:
        die("promotion.source must be live_pr or pr_ready_receipt")
    source_receipt = value.get("source_receipt")
    if source == "pr_ready_receipt":
        text(source_receipt, "promotion.source_receipt")
    elif source_receipt is not None:
        die("promotion.source_receipt must be null for live_pr")
    base_sha = full_git_sha(value.get("candidate_base_sha"), "promotion.candidate_base_sha")
    head_sha = full_git_sha(value.get("candidate_head_sha"), "promotion.candidate_head_sha")
    if base_sha == head_sha:
        die("promotion candidate base and head must differ")
    authority = text(value.get("authority_evidence"), "promotion.authority_evidence")
    if not re.search(r"\$auto-pilot\s+(?:release|promote)\b", authority, re.IGNORECASE):
        die("promotion.authority_evidence must identify the fresh $auto-pilot release/promote invocation")
    if git_value is not None:
        commits = {commit.lower() for commit in git_value.get("commits", [])}
        if head_sha not in commits:
            die("promotion.candidate_head_sha must appear in git.commits")
    return value


def validate_cleanup(value, require_success):
    value = obj(value, "cleanup")
    status = value.get("status")
    allowed_statuses = {"passed"} if require_success else {"passed", "failed", "not_run"}
    if status not in allowed_statuses:
        die("cleanup.status is unsupported")

    terminal_states = {
        "worktree": {"removed", "not_used"},
        "local_branch": {"deleted", "not_used"},
        "remote_branch": {"deleted", "absent", "not_used", "retained_by_policy"},
    }
    incomplete_states = {
        "worktree": {"retained"},
        "local_branch": {"retained"},
        "remote_branch": {"retained"},
    }
    for key, terminal in terminal_states.items():
        allowed = terminal if status == "passed" else terminal | incomplete_states[key]
        if value.get(key) not in allowed:
            die(f"cleanup.{key} is unsupported for cleanup.status {status}")
    text(value.get("evidence"), "cleanup.evidence")
    return value


def validate_proof(value, name, require_success):
    value = obj(value, name)
    allowed = {"passed"} if require_success else {"passed", "failed", "not_run"}
    if value.get("status") not in allowed:
        die(f"{name}.status is unsupported")
    text(value.get("evidence"), f"{name}.evidence")
    return value


def validate_authorization_proof(value, name, decision, require_success):
    value = validate_proof(value, name, require_success)
    if value.get("decision") != decision:
        die(f"{name}.decision must be {decision}")
    binding_count = value.get("effective_binding_count")
    if not isinstance(binding_count, int) or isinstance(binding_count, bool):
        die(f"{name}.effective_binding_count must be an integer")
    if decision == "allowed" and binding_count < 1:
        die(f"{name}.effective_binding_count must be positive for an allowed decision")
    if decision == "denied" and binding_count != 0:
        die(f"{name}.effective_binding_count must be zero for a denied decision")
    return value


def validate_capability_reachability(value, require_success):
    value = obj(value, "capability_reachability")
    deployed_sha = full_git_sha(
        value.get("deployed_candidate_sha"),
        "capability_reachability.deployed_candidate_sha",
    )
    text(value.get("scope_evidence"), "capability_reachability.scope_evidence")
    cases = value.get("cases")
    if not isinstance(cases, list) or not cases:
        die("capability_reachability.cases must contain at least one case")
    seen = set()
    for index, case in enumerate(cases):
        name = f"capability_reachability.cases[{index}]"
        case = obj(case, name)
        case_id = text(case.get("id"), f"{name}.id")
        if case_id in seen:
            die(f"{name}.id must be unique")
        seen.add(case_id)
        for key in (
            "actor",
            "credential_class",
            "resource_scope",
            "entrypoint",
            "runtime_principal",
            "representative_data_case",
            "expected_terminal_outcome",
        ):
            text(case.get(key), f"{name}.{key}")
        validate_proof(case.get("deterministic"), f"{name}.deterministic", require_success)
        validate_proof(case.get("production"), f"{name}.production", require_success)
        if not isinstance(case.get("authorization_changed"), bool):
            die(f"{name}.authorization_changed must be a boolean")
        if case.get("authorization_changed"):
            validate_authorization_proof(
                case.get("authorized"), f"{name}.authorized", "allowed", require_success
            )
            validate_authorization_proof(
                case.get("unauthorized"), f"{name}.unauthorized", "denied", require_success
            )
        elif "authorized" in case or "unauthorized" in case:
            die(f"{name} authorization proofs require authorization_changed true")
    return deployed_sha


def validate_optional_blocked(root):
    git_value = None
    checks = None
    promotion = None
    if "git" in root:
        git_value = validate_git(root["git"])
    if "criteria" in root:
        validate_items(root["criteria"], "criteria", False)
    if "checks" in root:
        checks = validate_items(root["checks"], "checks", False)
    if "pull_request" in root:
        validate_pull_request(root["pull_request"])
    if "release" in root:
        validate_release(root["release"], True)
    if "promotion" in root:
        promotion = validate_promotion(root["promotion"], git_value)
    if "cleanup" in root:
        validate_cleanup(root["cleanup"], False)
    if "capability_reachability" in root:
        validate_capability_reachability(root["capability_reachability"], False)
    if root.get("mode") == "release":
        if checks is None:
            die("release-mode blocked receipt requires checks")
        validate_release_contract_binding(checks, promotion, False)
        validate_release_control_budget(checks, False)


def validate(path):
    try:
        root = obj(json.loads(path.read_text(encoding="utf-8")), "receipt")
    except FileNotFoundError:
        die(f"file not found: {path}")
    except json.JSONDecodeError as exc:
        die(f"invalid JSON at line {exc.lineno}, column {exc.colno}")

    if root.get("schema_version") != 7:
        die("schema_version must be 7")
    mode = root.get("mode")
    terminal = root.get("terminal_state")
    if mode not in {"pr", "release"}:
        die("mode must be pr or release")
    if terminal not in {"pr_ready", "merged_main", "released", "blocked"}:
        die("terminal_state is unsupported")

    plan = obj(root.get("plan"), "plan")
    if plan.get("approved") is not True:
        die("plan.approved must be true")
    text(plan.get("source"), "plan.source")
    text(root.get("summary"), "summary")

    blockers = root.get("blockers")
    if not isinstance(blockers, list):
        die("blockers must be an array")
    if terminal == "blocked":
        if not blockers:
            die("blocked terminal_state requires at least one blocker")
        for index, blocker in enumerate(blockers):
            blocker = obj(blocker, f"blockers[{index}]")
            text(blocker.get("reason"), f"blockers[{index}].reason")
            text(blocker.get("evidence"), f"blockers[{index}].evidence")
        validate_optional_blocked(root)
        return terminal
    if blockers:
        die("successful terminal_state cannot contain blockers")

    git_value = validate_git(root.get("git"))
    validate_items(root.get("criteria"), "criteria", True)
    checks = validate_items(root.get("checks"), "checks", True)
    pull_request = validate_pull_request(root.get("pull_request"))
    release = validate_release(root.get("release"))

    if terminal == "pr_ready":
        if mode != "pr":
            die("pr_ready requires mode pr")
        if pull_request.get("merged") is not False or pull_request.get("status") not in {"open", "ready"}:
            die("pr_ready requires an open, unmerged PR/MR")
        if pull_request.get("merge_sha") is not None:
            die("pr_ready requires pull_request.merge_sha to be null")
        if (
            release.get("status") != "not_requested"
            or release.get("url") is not None
            or release.get("notes_url") is not None
            or release.get("message") is not None
        ):
            die("pr_ready requires release status not_requested and null release artifacts")
        if "promotion" in root:
            die("pr_ready must not contain promotion evidence")
        if "cleanup" in root:
            die("pr_ready must not contain release cleanup evidence")
        if "capability_reachability" in root:
            die("pr_ready must not contain production capability reachability evidence")
        return terminal

    if mode != "release":
        die("merged_main and released require mode release")
    validate_release_control_budget(checks, True)
    promotion = validate_promotion(root.get("promotion"), git_value)
    validate_release_contract_binding(checks, promotion, True)
    validate_cleanup(root.get("cleanup"), True)
    if pull_request.get("merged") is not True or pull_request.get("status") != "merged":
        die("release mode requires a merged PR/MR")
    merge_sha = full_git_sha(pull_request.get("merge_sha"), "pull_request.merge_sha")

    if terminal == "merged_main":
        if (
            release.get("status") != "no_mechanism"
            or release.get("url") is not None
            or release.get("notes_url") is not None
            or release.get("message") is not None
        ):
            die("merged_main requires release status no_mechanism and null release artifacts")
        if "capability_reachability" in root:
            die("merged_main must not contain production capability reachability evidence")
        return terminal

    if release.get("status") != "passed":
        die("released requires release.status passed")
    web_url(release.get("url"), "release.url")
    deployed_sha = validate_capability_reachability(
        root.get("capability_reachability"), True
    )
    if deployed_sha != merge_sha:
        die("capability_reachability.deployed_candidate_sha must equal pull_request.merge_sha")
    return terminal


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--contract-sha256":
        print(release_contract_sha256())
    elif len(sys.argv) == 2:
        print(f"valid Auto Pilot receipt: {validate(Path(sys.argv[1]).expanduser())}")
    else:
        die("usage: validate_receipt.py RECEIPT.json | --contract-sha256")
