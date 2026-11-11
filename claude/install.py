#!/usr/bin/env python3
"""Put this repo's Claude Code setup into ~/.claude. Safe to run again.

- Merges claude/settings.json into ~/.claude/settings.json. Objects merge key by key, lists
  only gain the entries they miss, and any other value comes from the repo. Keys that exist
  only in ~/.claude/settings.json stay: hooks that iTerm2's integration wrote, the homelab
  settings, anything set on this machine. So the order of installs doesn't matter.
- Copies statusline-command.sh to ~/.claude/ and every folder in skills/ to ~/.claude/skills/.

A file gets a backup (<file>.bak-YYYYmmdd-HHMMSS) before it changes. Prints what it did.

    python3 claude/install.py              # install
    python3 claude/install.py --home /tmp/x  # try it on a scratch folder first
"""

import argparse
import copy
import datetime
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAMP = f"{datetime.datetime.now():%Y%m%d-%H%M%S}"


def merge(dst, src):
    for key, val in src.items():
        if isinstance(val, dict) and isinstance(dst.get(key), dict):
            merge(dst[key], val)
        elif isinstance(val, list) and isinstance(dst.get(key), list):
            dst[key] += [x for x in val if x not in dst[key]]
        else:
            dst[key] = copy.deepcopy(val)
    return dst


def write(path, text, mode=None):
    if path.exists() and path.read_text() == text:
        print(f"unchanged  {path}")
    else:
        if path.exists():
            shutil.copy2(path, f"{path}.bak-{STAMP}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        print(f"wrote      {path}")
    if mode is not None:
        path.chmod(mode)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--home", default=str(Path.home()), help="home folder to install into")
    claude = Path(ap.parse_args().home) / ".claude"

    settings = claude / "settings.json"
    have = json.loads(settings.read_text()) if settings.exists() else {}
    want = merge(copy.deepcopy(have), json.loads((HERE / "settings.json").read_text()))
    if want == have and settings.exists():
        print(f"unchanged  {settings}")
    else:
        write(settings, json.dumps(want, indent=2) + "\n")

    write(claude / "statusline-command.sh", (HERE / "statusline-command.sh").read_text(), 0o755)

    for skill in sorted(p for p in (HERE / "skills").iterdir() if p.is_dir()):
        for f in sorted(p for p in skill.rglob("*") if p.is_file()):
            write(claude / "skills" / skill.name / f.relative_to(skill), f.read_text())


if __name__ == "__main__":
    main()
