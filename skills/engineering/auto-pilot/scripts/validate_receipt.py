#!/usr/bin/env python3
"""Validate an Auto Pilot version 7 completion receipt."""

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


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
    if "git" in root:
        git_value = validate_git(root["git"])
    if "criteria" in root:
        validate_items(root["criteria"], "criteria", False)
    if "checks" in root:
        validate_items(root["checks"], "checks", False)
    if "pull_request" in root:
        validate_pull_request(root["pull_request"])
    if "release" in root:
        validate_release(root["release"], True)
    if "promotion" in root:
        validate_promotion(root["promotion"], git_value)
    if "cleanup" in root:
        validate_cleanup(root["cleanup"], False)
    if "capability_reachability" in root:
        validate_capability_reachability(root["capability_reachability"], False)


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
    validate_items(root.get("checks"), "checks", True)
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
    validate_promotion(root.get("promotion"), git_value)
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
    if len(sys.argv) != 2:
        die("usage: validate_receipt.py RECEIPT.json")
    print(f"valid Auto Pilot receipt: {validate(Path(sys.argv[1]).expanduser())}")
