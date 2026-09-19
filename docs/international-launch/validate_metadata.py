#!/usr/bin/env python3
"""Validate the English copy draft locally. No network or publishing actions."""
from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

CHAR_LIMITS = {
    "name": 30,
    "subtitle": 30,
    "promotional_text": 170,
    "description": 4000,
    "whats_new": 4000,
}


def validate(data: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["The JSON root must be an object."]
    if data.get("status") != "proposal" or data.get("publish_ready") is not False:
        errors.append("Keep this manual-copy draft marked proposal / publish_ready=false.")
    if data.get("locale") != "en-US":
        errors.append("This validator expects the en-US copy draft.")
    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        return errors + ["metadata must be an object."]
    if set(metadata) != set(CHAR_LIMITS) | {"keywords"}:
        errors.append("metadata fields do not match the expected copy fields.")
    for field, limit in CHAR_LIMITS.items():
        value = metadata.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{field}: a nonempty string is required.")
            continue
        if len(value) > limit:
            errors.append(f"{field}: {len(value)} characters exceeds {limit}.")
        if "\r" in value or value != value.strip():
            errors.append(f"{field}: remove CR characters or surrounding whitespace.")
    name = metadata.get("name", "")
    if isinstance(name, str) and len(name) < 2:
        errors.append("name: at least 2 characters are required.")
    keywords = metadata.get("keywords")
    if not isinstance(keywords, str) or not keywords:
        errors.append("keywords: a nonempty comma-separated string is required.")
    else:
        byte_count = len(keywords.encode("utf-8"))
        if byte_count > 100:
            errors.append(f"keywords: {byte_count} UTF-8 bytes exceeds 100.")
        tokens = keywords.split(",")
        if any(not re.fullmatch(r"[a-z]{3,}", word) for word in tokens):
            errors.append("keywords: use comma-separated lowercase ASCII words of 3+ letters.")
        if len(set(tokens)) != len(tokens):
            errors.append("keywords: duplicate words.")
        existing = " ".join(
            value for key in ("name", "subtitle")
            if isinstance(value := metadata.get(key), str)
        ).lower()
        if set(tokens) & set(re.findall(r"[a-z]+", existing)):
            errors.append("keywords: avoid repeating name/subtitle words in this draft.")
    urls = data.get("url_candidates")
    if not isinstance(urls, dict) or set(urls) != {
        "marketing_url", "support_url", "privacy_policy_url"
    }:
        errors.append("url_candidates: expected marketing, support, and privacy URLs.")
    else:
        for field, value in urls.items():
            if not isinstance(value, str):
                errors.append(f"{field}: URL must be a string.")
                continue
            parsed = urlparse(value)
            if parsed.scheme != "https" or not parsed.netloc:
                errors.append(f"{field}: an absolute HTTPS URL is required.")
    if not re.fullmatch(r"[0-9a-f]{40}", str(data.get("source_commit", ""))):
        errors.append("source_commit: expected a full Git SHA.")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(data.get("whats_new_version", ""))):
        errors.append("whats_new_version: explicit release version is required.")
    return errors


def self_test(valid: dict[str, Any]) -> int:
    cases = [
        ("subtitle", "x" * 31, "subtitle:"),
        ("promotional_text", "x" * 171, "promotional_text:"),
        ("description", "x" * 4001, "description:"),
        ("whats_new", "x" * 4001, "whats_new:"),
        ("keywords", "x" * 101, "UTF-8 bytes"),
        ("keywords", "é" * 51, "102 UTF-8 bytes"),
        ("keywords", "writer,writer", "duplicate"),
        ("keywords", "ai", "3+ letters"),
        ("keywords", "markdown", "repeating"),
        ("name", 123, "nonempty string"),
    ]
    if validate(valid):
        raise ValueError("The supplied draft must pass before running mutation tests.")
    for field, value, expected in cases:
        changed = copy.deepcopy(valid)
        changed["metadata"][field] = value
        if not any(expected in error for error in validate(changed)):
            raise ValueError(f"Mutation test did not reject {field}: {expected}")
    boundary = copy.deepcopy(valid)
    boundary["metadata"]["keywords"] = "x" * 100
    if validate(boundary):
        raise ValueError("The 100-byte keyword boundary should be accepted.")
    for invalid in (None, [], {"metadata": []}):
        if not validate(invalid):
            raise ValueError("Malformed input was accepted.")
    return len(cases) + 4


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path,
                        default=Path(__file__).with_name("app-store-en-US.json"))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        data = json.loads(args.path.read_text(encoding="utf-8"))
        errors = validate(data)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        for field, limit in CHAR_LIMITS.items():
            print(f"{field}: {len(data['metadata'][field])}/{limit} characters")
        print(f"keywords: {len(data['metadata']['keywords'].encode('utf-8'))}/100 UTF-8 bytes")
        if args.self_test:
            print(f"Self-tests: {self_test(data)} passed")
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print("Copy checks passed. URL reachability, product claims and publication gates remain manual.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
