#!/usr/bin/env python3
"""Extract only committed runtime/dev inputs, verify every copied Git blob."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys
import tarfile

repo, commit, base = pathlib.Path(sys.argv[1]).resolve(), sys.argv[2], pathlib.Path(sys.argv[3]).resolve()
assert len(commit) == 40 and not base.exists()
source = base / "source"
source.mkdir(parents=True)
paths = ["game/src", "game/data", "game/vendor", "game/assets", "game/dev", "game/index.html", "game/style.css", "public"]
proc = subprocess.Popen(["git", "-C", str(repo), "archive", commit, *paths], stdout=subprocess.PIPE)
with tarfile.open(fileobj=proc.stdout, mode="r|") as archive:
    archive.extractall(source, filter="data")
assert proc.wait() == 0
files = []
for line in subprocess.check_output(["git", "-C", str(repo), "ls-tree", "-rz", commit, "--", *paths]).split(b"\0"):
    if not line:
        continue
    header, name = line.split(b"\t", 1)
    mode, kind, blob = header.decode().split()
    name = name.decode()
    data = (source / name).read_bytes()
    assert kind == "blob" and hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest() == blob
    files.append({"path": name, "sha256": hashlib.sha256(data).hexdigest(), "gitBlob": blob, "bytes": len(data)})
payload = (json.dumps(files, sort_keys=True, separators=(",", ":")) + "\n").encode()
(base / "source-files.json").write_bytes(payload)
identity = {"sourceCommit": commit, "sourceTree": subprocess.check_output(["git", "-C", str(repo), "rev-parse", commit + "^{tree}"], text=True).strip(),
    "archivePaths": paths, "files": len(files), "bytes": sum(f["bytes"] for f in files),
    "sourceFilesSha256": hashlib.sha256(payload).hexdigest(), "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "allCopiedGitBlobsVerified": True, "noOverview": True}
(base / "source-identity.json").write_text(json.dumps(identity, indent=2) + "\n")
for file in source.rglob("*"):
    if file.is_file():
        file.chmod(0o444)
for directory in sorted((p for p in source.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
    directory.chmod(0o555)
source.chmod(0o555)
print(json.dumps(identity))
