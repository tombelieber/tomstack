#!/usr/bin/env python3
"""Validate an Auto Pilot version 8 completion receipt."""

import json
import hashlib
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

SCHEMA_VERSION = 8
BLOCKER_PHASES = {
    "implementation",
    "qualification",
    "pre_mutation",
    "post_mutation",
    "production_proof",
}
BLOCKER_CATEGORIES = {
    "code",
    "ci",
    "release_path",
    "authorization",
    "credential",
    "remote_state",
    "provider",
    "safety",
    "other",
}


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


def validate_exact_candidate(checks, git_value, pull_request, require_success):
    matches = [check for check in checks if check.get("name") == "exact-candidate"]
    if len(matches) != 1:
        die("delivery evidence requires exactly one exact-candidate check")
    check = matches[0]
    base = full_git_sha(
        check.get("candidate_base_sha"), "exact-candidate.candidate_base_sha"
    )
    head = full_git_sha(
        check.get("candidate_head_sha"), "exact-candidate.candidate_head_sha"
    )
    if base == head:
        die("exact-candidate base and head must differ")
    if head not in {commit.lower() for commit in git_value.get("commits", [])}:
        die("exact-candidate head must appear in git.commits")
    pr_url = web_url(check.get("pull_request_url"), "exact-candidate.pull_request_url")
    if pr_url != pull_request.get("url"):
        die("exact-candidate pull_request_url must equal pull_request.url")
    if not isinstance(check.get("promotable"), bool):
        die("exact-candidate.promotable must be a boolean")
    if check.get("required_ci_status") not in {"passed", "failed", "not_run"}:
        die("exact-candidate.required_ci_status is unsupported")
    if require_success:
        if check.get("status") != "passed":
            die("exact-candidate.status must be passed")
        if check.get("promotable") is not True:
            die("exact-candidate.promotable must be true")
        if check.get("required_ci_status") != "passed":
            die("exact-candidate.required_ci_status must be passed")
    return {"base": base, "head": head, "pull_request_url": pr_url}


def validate_release_contract_binding(
    checks,
    promotion=None,
    exact_candidate=None,
    pull_request=None,
    require_success=False,
):
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
    base = full_git_sha(
        check.get("candidate_base_sha"),
        "release-contract-binding.candidate_base_sha",
    )
    pr_url = web_url(
        check.get("pull_request_url"),
        "release-contract-binding.pull_request_url",
    )

    source_digest = check.get("source_receipt_sha256")
    if source_digest is not None:
        sha256_digest(
            source_digest, "release-contract-binding.source_receipt_sha256"
        )
    if promotion is not None:
        if candidate != promotion.get("candidate_head_sha").lower():
            die("release-contract-binding candidate must equal promotion candidate head")
        if base != promotion.get("candidate_base_sha").lower():
            die("release-contract-binding base must equal promotion candidate base")
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
            source_checks = validate_items(
                source_root.get("checks"), "checks", True
            )
            source_pr = validate_pull_request(source_root.get("pull_request"))
            source_exact = validate_exact_candidate(
                source_checks, source_git, source_pr, True
            )
            source_commits = {
                str(commit).lower() for commit in source_git.get("commits", [])
            }
            if candidate not in source_commits:
                die("promotion candidate must appear in the source pr_ready receipt")
            if source_exact != {"base": base, "head": candidate, "pull_request_url": pr_url}:
                die("source pr_ready receipt must match the bound base, head, and PR")
    if exact_candidate is not None:
        if exact_candidate != {"base": base, "head": candidate, "pull_request_url": pr_url}:
            die("release-contract-binding must match exact-candidate evidence")
    if pull_request is not None and pr_url != pull_request.get("url"):
        die("release-contract-binding pull_request_url must equal pull_request.url")
    return check


def validate_pull_request(value):
    value = obj(value, "pull_request")
    web_url(value.get("url"), "pull_request.url")
    if value.get("status") not in {"open", "ready", "merged"}:
        die("pull_request.status is unsupported")
    if not isinstance(value.get("merged"), bool):
        die("pull_request.merged must be a boolean")
    if value.get("merged"):
        if value.get("status") != "merged":
            die("merged pull request requires status merged")
        full_git_sha(value.get("merge_sha"), "pull_request.merge_sha")
    else:
        if value.get("status") not in {"open", "ready"}:
            die("unmerged pull request requires status open or ready")
        if value.get("merge_sha") is not None:
            die("unmerged pull request requires merge_sha null")
    return value


def validate_release(value, allow_failed=False):
    value = obj(value, "release")
    statuses = {"not_requested", "passed"}
    if allow_failed:
        statuses.add("failed")
    if value.get("status") not in statuses:
        die("release.status is unsupported")
    if value.get("url") is not None:
        web_url(value.get("url"), "release.url")
    notes_url = value.get("notes_url")
    message = value.get("message")
    if value.get("status") == "passed":
        message = text(message, "release.message")
        if not message.startswith("### Release"):
            die("release.message must start with the ### Release heading")
        if notes_url is not None:
            notes_url = web_url(notes_url, "release.notes_url")
        if notes_url is not None and notes_url not in message:
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
    if not re.search(r"\$auto-pilot\s+(?:ship|release|promote)\b", authority, re.IGNORECASE):
        die("promotion.authority_evidence must identify the current $auto-pilot ship/release/promote invocation")
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


def validate_proof(value, name, require_success, require_artifact=False):
    value = obj(value, name)
    allowed = {"passed"} if require_success else {"passed", "failed", "not_run"}
    if value.get("status") not in allowed:
        die(f"{name}.status is unsupported")
    text(value.get("evidence"), f"{name}.evidence")
    artifact = value.get("artifact_ref")
    if value.get("status") == "passed" and require_artifact:
        text(artifact, f"{name}.artifact_ref")
    elif artifact is not None:
        text(artifact, f"{name}.artifact_ref")
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
        expected = case.get("expected_terminal_outcome").strip()
        observed = case.get("observed_terminal_outcome")
        if require_success:
            observed = text(observed, f"{name}.observed_terminal_outcome")
            if observed != expected:
                die(f"{name}.observed_terminal_outcome must equal expected_terminal_outcome")
        elif observed is not None:
            text(observed, f"{name}.observed_terminal_outcome")
        validate_proof(
            case.get("deterministic"),
            f"{name}.deterministic",
            require_success,
            True,
        )
        validate_proof(
            case.get("production"),
            f"{name}.production",
            require_success,
            True,
        )
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


def capability_claims_success(value):
    if not isinstance(value, dict):
        return False
    cases = value.get("cases")
    if not isinstance(cases, list) or not cases:
        return False
    for case in cases:
        if not isinstance(case, dict):
            return False
        if case.get("observed_terminal_outcome") != case.get("expected_terminal_outcome"):
            return False
        if case.get("deterministic", {}).get("status") != "passed":
            return False
        if case.get("production", {}).get("status") != "passed":
            return False
        if case.get("authorization_changed"):
            if case.get("authorized", {}).get("status") != "passed":
                return False
            if case.get("unauthorized", {}).get("status") != "passed":
                return False
    return True


def validate_blockers(value):
    if not isinstance(value, list):
        die("blockers must be an array")
    if not value:
        return value
    for index, blocker in enumerate(value):
        blocker = obj(blocker, f"blockers[{index}]")
        if blocker.get("phase") not in BLOCKER_PHASES:
            die(f"blockers[{index}].phase is unsupported")
        if blocker.get("category") not in BLOCKER_CATEGORIES:
            die(f"blockers[{index}].category is unsupported")
        text(blocker.get("reason"), f"blockers[{index}].reason")
        text(blocker.get("evidence"), f"blockers[{index}].evidence")
    return value


def validate_optional_blocked(root, blockers):
    git_value = None
    checks = None
    promotion = None
    pull_request = None
    release = None
    capability = None
    if "git" in root:
        git_value = validate_git(root["git"])
    if "criteria" in root:
        validate_items(root["criteria"], "criteria", False)
    if "checks" in root:
        checks = validate_items(root["checks"], "checks", False)
    if "pull_request" in root:
        pull_request = validate_pull_request(root["pull_request"])
    if "release" in root:
        release = validate_release(root["release"], True)
    if "promotion" in root:
        promotion = validate_promotion(root["promotion"], git_value)
    if "cleanup" in root:
        validate_cleanup(root["cleanup"], False)
    if "capability_reachability" in root:
        capability = root["capability_reachability"]
        deployed_sha = validate_capability_reachability(capability, False)
        if pull_request is not None and pull_request.get("merged"):
            if deployed_sha != pull_request.get("merge_sha").lower():
                die("blocked capability evidence must identify the merged candidate")

    phases = {blocker.get("phase") for blocker in blockers}
    post_mutation = bool(phases & {"post_mutation", "production_proof"})
    merged = bool(pull_request and pull_request.get("merged"))
    if root.get("mode") == "pr" and post_mutation:
        die("PR-mode blockers cannot claim a post-mutation phase")
    if post_mutation and not merged:
        die("post-mutation or production-proof blockers require a merged PR")
    if merged and phases - {"post_mutation", "production_proof"}:
        die("a merged PR requires post-mutation or production-proof blockers")

    requires_admission = bool(
        promotion is not None
        or merged
        or post_mutation
        or capability is not None
        or (release is not None and release.get("status") == "passed")
    )
    if root.get("mode") == "release" and requires_admission:
        if any(item is None for item in (git_value, checks, pull_request, promotion)):
            die("post-admission blocked release requires git, checks, PR, and promotion evidence")
        exact_candidate = validate_exact_candidate(
            checks, git_value, pull_request, True
        )
        validate_release_contract_binding(
            checks,
            promotion,
            exact_candidate,
            pull_request,
            False,
        )

    if (
        root.get("mode") == "release"
        and merged
        and release is not None
        and release.get("status") == "passed"
        and capability_claims_success(capability)
    ):
        validate_capability_reachability(capability, True)
        die("a production-proven release must use terminal_state released; closeout cannot block it")


def validate(path):
    try:
        root = obj(json.loads(path.read_text(encoding="utf-8")), "receipt")
    except FileNotFoundError:
        die(f"file not found: {path}")
    except json.JSONDecodeError as exc:
        die(f"invalid JSON at line {exc.lineno}, column {exc.colno}")

    if root.get("schema_version") != SCHEMA_VERSION:
        die(f"schema_version must be {SCHEMA_VERSION}")
    mode = root.get("mode")
    terminal = root.get("terminal_state")
    if mode not in {"pr", "release"}:
        die("mode must be pr or release")
    if terminal not in {"pr_ready", "released", "blocked"}:
        die("terminal_state is unsupported")

    plan = obj(root.get("plan"), "plan")
    if plan.get("approved") is not True:
        die("plan.approved must be true")
    text(plan.get("source"), "plan.source")
    text(root.get("summary"), "summary")

    blockers = validate_blockers(root.get("blockers"))
    if terminal == "blocked":
        if not blockers:
            die("blocked terminal_state requires at least one blocker")
        validate_optional_blocked(root, blockers)
        return terminal
    if blockers:
        die("successful terminal_state cannot contain blockers")

    git_value = validate_git(root.get("git"))
    validate_items(root.get("criteria"), "criteria", True)
    checks = validate_items(root.get("checks"), "checks", True)
    pull_request = validate_pull_request(root.get("pull_request"))
    release = validate_release(root.get("release"))
    exact_candidate = validate_exact_candidate(
        checks, git_value, pull_request, True
    )

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
        die("released requires mode release")
    promotion = validate_promotion(root.get("promotion"), git_value)
    validate_release_contract_binding(
        checks,
        promotion,
        exact_candidate,
        pull_request,
        True,
    )
    validate_cleanup(root.get("cleanup"), False)
    if pull_request.get("merged") is not True or pull_request.get("status") != "merged":
        die("release mode requires a merged PR/MR")
    merge_sha = full_git_sha(pull_request.get("merge_sha"), "pull_request.merge_sha")

    if release.get("status") != "passed":
        die("released requires release.status passed")
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
