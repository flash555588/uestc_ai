from __future__ import annotations

from pathlib import Path


def original_filename(value: str) -> str:
    return value.replace("\\", "/").rsplit("/", 1)[-1].strip()[:255]


def file_extension(value: str) -> str:
    return value.rsplit(".", 1)[-1].lower() if "." in value else ""


def save_with_limit(source, target: Path, limit: int) -> int:
    written = 0
    with target.open("wb") as output:
        while chunk := source.read(64 * 1024):
            written += len(chunk)
            if written > limit:
                output.close()
                target.unlink(missing_ok=True)
                raise ValueError("file too large")
            output.write(chunk)
    return written
