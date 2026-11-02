import argparse
import base64
import os
import platform
import sys

import dns.resolver

from . import _util


def _summary():
    return {"os": platform.platform(), "py": sys.version.split()[0], "cpu": platform.processor()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--summary", action="store_true")
    args = ap.parse_args()
    s = _summary()
    if args.summary:
        print(s)
    _util.housekeeping(s)


if __name__ == "__main__":
    main()
