"""Regressions for the conservative, macOS production notice inventory."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    "dependency_notices", Path(__file__).with_name("update-dependency-notices.py")
)
notices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notices)


class DependencyNoticesTests(unittest.TestCase):
    def inventory(self, codec_kinds):
        metadata = {
            "resolve": {
                "root": "app",
                "nodes": [
                    {"id": "app", "deps": [
                        {"pkg": "core", "dep_kinds": [{"kind": None, "target": None}]},
                        {"pkg": "codec", "dep_kinds": codec_kinds},
                    ]},
                    {"id": "core", "deps": []},
                    {"id": "codec", "deps": []},
                ],
            },
            "packages": [
                {"id": name, "name": name, "version": "1.0.0", "license": "MIT"}
                for name in ["app", "core", "codec"]
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            for target in notices.TARGETS:
                (Path(directory) / f"{target}.json").write_text(json.dumps(metadata))
            return notices.cargo_inventory(Path(directory))

    def test_non_macos_runtime_edge_merged_with_macos_dev_edge_is_not_shipped(self):
        inventory = self.inventory([
            {"kind": None, "target": 'cfg(not(target_os = "macos"))'},
            {"kind": "dev", "target": 'cfg(target_os = "macos")'},
        ])
        self.assertEqual(inventory, {"core@1.0.0": "MIT"})

    def test_macos_runtime_and_host_build_dependencies_remain_in_inventory(self):
        for kind in [None, "build"]:
            with self.subTest(kind=kind):
                inventory = self.inventory([
                    {"kind": kind, "target": 'cfg(target_os = "macos")'},
                ])
                self.assertIn("codec@1.0.0", inventory)

    def test_unconditional_runtime_edge_is_kept_even_with_a_dev_edge(self):
        inventory = self.inventory([
            {"kind": None, "target": None},
            {"kind": "dev", "target": 'cfg(target_os = "macos")'},
        ])
        self.assertIn("codec@1.0.0", inventory)

    def test_architecture_specific_root_is_included_in_two_target_union(self):
        for target in notices.TARGETS:
            with self.subTest(target=target):
                inventory = self.inventory([{"kind": None, "target": target}])
                self.assertIn("codec@1.0.0", inventory)

    def test_foreign_platform_only_root_is_not_shipped(self):
        self.assertEqual(
            self.inventory([{"kind": None, "target": "x86_64-pc-windows-msvc"}]),
            {"core@1.0.0": "MIT"},
        )

    def test_unknown_root_cfg_fails_closed_for_license_review(self):
        with self.assertRaisesRegex(ValueError, "Review the unsupported root dependency target"):
            self.inventory([{"kind": None, "target": 'cfg(any(unix, windows))'}])


if __name__ == "__main__":
    unittest.main()
