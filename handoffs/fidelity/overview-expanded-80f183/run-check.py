#!/usr/bin/env python3
"""Run the committed static overview harness without changing its source."""
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
out = base / "attempt-01"
commit = "80f18372804cc083359260d06c1c950319feb7b4"
tool = source / "game/dev/harness/overview-current-check.cjs"
identity = json.loads((base / "source-identity.json").read_text())
assert identity["sourceCommit"] == commit
assert hashlib.sha256(tool.read_bytes()).hexdigest() == identity["toolSha256"]
assert not (out / "execution.json").exists(), "Never overwrite an earlier attempt"
env = dict(os.environ)
env["NODE_PATH"] = "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules"
env["NODE_OPTIONS"] = "--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs"
argv = ["node", str(tool), str(source), str(out), commit]
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
record = {
    "sourceCommit": commit,
    "toolSha256": identity["toolSha256"],
    "argv": argv,
    "cwd": str(source),
    "browserEnvironment": {key: env[key] for key in ("NODE_PATH", "NODE_OPTIONS")},
    "startedAt": now(),
    "wrapperPid": os.getpid(),
    "scope": "One static-page browser; committed tool unchanged; external aerial is an intercepted cache fixture only.",
}
started = time.monotonic()
with (out / "run.log").open("wb") as log:
    child = subprocess.Popen(argv, cwd=source, env=env, stdout=log, stderr=subprocess.STDOUT)
    record["toolPid"] = child.pid
    (out / "execution.json").write_text(json.dumps(record, indent=2) + "\n")
    code = child.wait()
record.update(endedAt=now(), elapsedSeconds=time.monotonic()-started, exitCode=code)
(out / "execution.json").write_text(json.dumps(record, indent=2) + "\n")
entries = json.loads((base / "source-files.json").read_text())
changed = []
for entry in entries:
    file = source / entry["path"]
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != entry["sha256"]:
        changed.append(entry["path"])
post = {"sourceCommit": commit, "checkedAt": now(), "verifiedFiles": len(entries), "changedFiles": changed}
(out / "source-postcheck.json").write_text(json.dumps(post, indent=2) + "\n")
print(json.dumps({"exitCode": code, "elapsedSeconds": record["elapsedSeconds"], "sourceChangedFiles": changed}))
sys.exit(code if code else bool(changed))
