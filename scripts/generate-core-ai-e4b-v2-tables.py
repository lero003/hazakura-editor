#!/usr/bin/env python3
"""Rebuild the pinned E4B per-token PLE tables from the source checkpoint."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from safetensors import safe_open


TENSOR = "model.language_model.embed_tokens_per_layer.weight"
VOCAB = 262_144
ROW_ELEMENTS = 10_752


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source-model", required=True)
    parser.add_argument("--source-revision", required=True)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    if any(args.output.iterdir()):
        parser.error("output directory must be empty")

    table_hash = hashlib.sha256()
    scale_hash = hashlib.sha256()
    with safe_open(args.checkpoint, framework="pt", device="cpu") as checkpoint:
        source = checkpoint.get_slice(TENSOR)
        if source.get_shape() != [VOCAB, ROW_ELEMENTS]:
            raise ValueError(f"unexpected {TENSOR} shape: {source.get_shape()}")
        with (args.output / "embed_per_layer.i8").open("wb") as table_file, (
            args.output / "embed_per_layer.scale.f32"
        ).open("wb") as scale_file:
            for start in range(0, VOCAB, 256):
                weights = source[start : start + 256].float().numpy()
                scales = np.max(np.abs(weights), axis=1).astype(np.float32) / 127.0
                if not np.all(np.isfinite(scales)) or np.any(scales <= 0):
                    raise ValueError(f"invalid PLE scale at row {start}")
                quantized = np.rint(weights / scales[:, None]).clip(-127, 127).astype(np.int8)
                table_bytes = quantized.tobytes(order="C")
                scale_bytes = scales.astype("<f4", copy=False).tobytes(order="C")
                table_file.write(table_bytes)
                scale_file.write(scale_bytes)
                table_hash.update(table_bytes)
                scale_hash.update(scale_bytes)

    metadata = {
        "V": VOCAB,
        "PLD": ROW_ELEMENTS,
        "sourceModel": args.source_model,
        "sourceRevision": args.source_revision,
        "quantization": "per-row int8 symmetric absmax",
        "embedPerLayerSha256": table_hash.hexdigest(),
        "scaleSha256": scale_hash.hexdigest(),
    }
    (args.output / "meta.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
