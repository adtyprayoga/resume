"""Stand-in for `python -m app.extract` so lifecycle tests run without Docling.

usage: fake_extractor.py MODE IN.pdf OUT.json
Writes its own pid (and a grandchild's, in `hang`) to $FAKE_PID_FILE.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

mode, source, target = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
pid_file = os.environ.get("FAKE_PID_FILE")
pids = [os.getpid()]

BLOCK = {"id": "b1", "page": 1, "label": "title", "group": None, "text": "Jane Doe", "bbox": {"l": 1, "t": 2, "r": 3, "b": 4}}

if mode == "hang":
    child = subprocess.Popen(["sleep", "1000"])
    pids.append(child.pid)
if pid_file:
    Path(pid_file).write_text(" ".join(map(str, pids)))

if mode == "ok":
    assert source.exists()
    target.write_text(json.dumps({"contract_version": 1, "pages": 1, "blocks": [BLOCK]}))
elif mode == "slow":
    time.sleep(1.5)
    target.write_text(json.dumps({"contract_version": 1, "pages": 1, "blocks": [BLOCK]}))
elif mode == "empty":
    target.write_text(json.dumps({"contract_version": 1, "pages": 1, "blocks": []}))
elif mode == "garbage":
    target.write_text("{not json")
elif mode == "hang":
    time.sleep(1000)
elif mode.startswith("exit:"):
    raise SystemExit(int(mode.split(":")[1]))
