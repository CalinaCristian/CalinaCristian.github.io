#!/usr/bin/env python3
"""Run one focused browser, close it, then one unchanged expanded check."""
import datetime
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time

base = pathlib.Path(sys.argv[1]).resolve()
source = base / "source"
identity = json.loads((base / "source-identity.json").read_text())
commit = identity["sourceCommit"]
own = pathlib.Path(__file__).resolve().parent
env = dict(os.environ)
env["NODE_PATH"] = "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules"
env["NODE_OPTIONS"] = "--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
code = 0
for name, tool in [
    ("focused-mobile", own / "check-mobile.cjs"),
    ("attempt-01", source / "game/dev/harness/overview-current-check.cjs"),
]:
    out = base / name
    out.mkdir(exist_ok=True)
    assert not (out / "execution.json").exists(), "Never overwrite an earlier attempt"
    if name == "attempt-01":
        assert sha(tool) == identity["toolSha256"]
    argv = ["node", str(tool), str(source), str(out), commit]
    record = {
        "sourceCommit": commit, "toolSha256": sha(tool), "argv": argv,
        "wrapperSha256": sha(pathlib.Path(__file__)), "cwd": str(source),
        "browserEnvironment": {k: env[k] for k in ("NODE_PATH", "NODE_OPTIONS")},
        "startedAt": now(), "wrapperPid": os.getpid(),
        "scope": "Sequential static-page browsers; previous browser process closes before next; external aerial is a mocked cache fixture.",
    }
    started = time.monotonic()
    with (out / "run.log").open("wb") as log:
        child = subprocess.Popen(argv, cwd=source, env=env, stdout=log, stderr=subprocess.STDOUT)
        record["toolPid"] = child.pid
        (out / "execution.json").write_text(json.dumps(record, indent=2) + "\n")
        code = child.wait()
    record.update(endedAt=now(), elapsedSeconds=time.monotonic()-started, exitCode=code)
    (out / "execution.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({"stage": name, "exitCode": code, "elapsedSeconds": record["elapsedSeconds"]}), flush=True)
    if code:
        break
entries = json.loads((base / "source-files.json").read_text())
changed = []
for entry in entries:
    file = source / entry["path"]
    if not file.is_file() or sha(file) != entry["sha256"]:
        changed.append(entry["path"])
post = {"sourceCommit": commit, "checkedAt": now(), "verifiedFiles": len(entries), "changedFiles": changed}
(base / "source-postcheck.json").write_text(json.dumps(post, indent=2) + "\n")
print(json.dumps({"sourceChangedFiles": changed}), flush=True)
sys.exit(code if code else bool(changed))
