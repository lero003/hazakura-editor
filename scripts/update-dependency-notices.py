#!/usr/bin/env python3
"""Refresh lock-derived notices, including after an individual dependency revert.

Python standard library only. Cargo is locked/offline; this does not resolve new
versions or access the network. --write is required to change the notice file.
"""

import argparse
import collections
import json
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = ("aarch64-apple-darwin", "x86_64-apple-darwin")


def cargo_inventory(metadata_directory=None):
    inventory = {}
    for target in TARGETS:
        if metadata_directory:
            metadata = json.loads((metadata_directory / f"{target}.json").read_text())
        else:
            metadata = json.loads(subprocess.check_output([
                "cargo", "metadata", "--locked", "--offline", "--format-version", "1",
                "--filter-platform", target, "--manifest-path", "src-tauri/Cargo.toml",
            ], cwd=ROOT))
        graph = {node["id"]: node for node in metadata["resolve"]["nodes"]}
        root = metadata["resolve"]["root"]
        pending, seen = [root], set()
        while pending:
            key = pending.pop()
            if key in seen:
                continue
            seen.add(key)
            pending.extend(edge["pkg"] for edge in graph[key]["deps"]
                           if any(kind["kind"] != "dev" for kind in edge["dep_kinds"]))
        for package in metadata["packages"]:
            if package["id"] not in seen or package["id"] == root:
                continue
            key = f'{package["name"]}@{package["version"]}'
            license_expression = package["license"]
            if not license_expression:
                raise ValueError(f"Review the missing license for {key}")
            if key in inventory and inventory[key] != license_expression:
                raise ValueError(f"Conflicting licenses for {key}")
            inventory[key] = license_expression
    return inventory


def refresh(current, cargo):
    lock = json.loads((ROOT / "package-lock.json").read_text())
    rows = []
    for location, package in lock["packages"].items():
        if not location or package.get("dev"):
            continue
        name = location.rsplit("node_modules/", 1)[-1]
        license_expression = package.get("license")
        if not license_expression:
            raise ValueError(f"Review the missing license for {name}")
        if name == "dompurify":
            license_expression += "; project policy chooses Apache-2.0"
        rows.append((f'{name}@{package["version"]}', license_expression))
    start = current.index("| Component | License |", current.index("## Runtime JavaScript"))
    end = current.index("### yaml (ISC)", start)
    table = "| Component | License |\n| --- | --- |\n"
    table += "".join(f"| `{name}` | `{license_expression}` |\n" for name, license_expression in sorted(rows))
    current = current[:start] + table + "\n" + current[end:]

    groups = collections.defaultdict(list)
    for name, license_expression in sorted(cargo.items()):
        groups[license_expression].append(name)
    start = current.index("| License expression | Resolved crates |")
    end = current.index("## Development / Build Tool", start)
    inventory = "| License expression | Resolved crates |\n| --- | ---: |\n"
    for license_expression, names in sorted(groups.items()):
        inventory += f"| `{license_expression}` | {len(names)} |\n"
    for license_expression, names in sorted(groups.items()):
        inventory += f"\n### `{license_expression}` ({len(names)})\n\n"
        inventory += textwrap.fill(", ".join(f"`{name}`" for name in names), width=96,
                                   initial_indent="- ", subsequent_indent="  ",
                                   break_long_words=False, break_on_hyphens=False) + "\n"
    return current[:start] + inventory + "\n" + current[end:], len(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--metadata-directory", type=Path,
                        help="Use saved locked metadata for both TARGET.json files")
    args = parser.parse_args()
    path = ROOT / "THIRD_PARTY_NOTICES.md"
    current = path.read_text()
    cargo = cargo_inventory(args.metadata_directory)
    updated, npm_count = refresh(current, cargo)
    print(f"macOS resolved Cargo inventory: {len(cargo)}; npm runtime inventory: {npm_count}")
    if updated != current:
        if not args.write:
            raise SystemExit("Notice inventory differs; inspect and run with --write.")
        path.write_text(updated)
        print("Updated THIRD_PARTY_NOTICES.md")
    else:
        print("Notice inventory matches")


if __name__ == "__main__":
    main()
