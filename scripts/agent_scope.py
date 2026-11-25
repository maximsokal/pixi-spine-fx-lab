#!/usr/bin/env python3
"""Audit committed scope and pinned assets; not a visual or runtime QA gate."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

MANIFEST = 'assets/template/template.json'
PREFIX = 'assets/template/'
REGULAR = {'100644', '100755'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def exact_path(path):
    require(isinstance(path, str) and path and not re.search(r'[\\:*?\[\]\x00-\x1f\x7f]', path)
            and all(p not in ('', '.', '..') for p in path.split('/')), 'Invalid exact path')
    return path


def git(repo, *args):
    try:
        return subprocess.check_output(['git', '--no-replace-objects', '-C', str(repo), *args], stderr=subprocess.PIPE)
    except (OSError, subprocess.CalledProcessError) as error:
        raise ValueError('Git command failed: ' + args[0]) from error


def resolve(repo, ref):
    require(isinstance(ref, str) and ref and not ref.startswith('-'), 'Invalid commit ref')
    return git(repo, 'rev-parse', '--verify', '--end-of-options', ref + '^{commit}').decode('ascii').strip()


def tree(repo, commit):
    result = {}
    seen = set()
    # Include directory entries: duplicate trees can have disjoint or empty leaves.
    for entry in git(repo, 'ls-tree', '-r', '-t', '-z', commit).split(b'\0'):
        if not entry:
            continue
        meta, name = entry.split(b'\t', 1)
        mode, kind, oid = meta.decode('ascii').split(' ')
        name = name.decode('utf8')
        require(name not in seen, 'Duplicate Git tree path: ' + name)
        seen.add(name)
        if kind != 'tree':
            result[name] = (mode, kind, oid)
    return result


def audit(repo, base, candidate, allowed):
    allowed = set(map(exact_path, allowed))
    base, candidate = resolve(repo, base), resolve(repo, candidate)
    old, new = tree(repo, base), tree(repo, candidate)
    require(MANIFEST in old and old[MANIFEST][0] in REGULAR, 'Missing regular baseline manifest')
    manifest = json.loads(git(repo, 'cat-file', 'blob', old[MANIFEST][2]))
    require(isinstance(manifest, dict), 'Invalid baseline manifest')
    pins = manifest.get('protectedFiles')
    require(isinstance(pins, dict) and pins, 'Missing baseline protected hashes')
    protected = {}
    for path, digest in pins.items():
        require(isinstance(digest, str) and re.fullmatch('[a-f0-9]{64}', digest), 'Invalid protected digest')
        protected[PREFIX + exact_path(path)] = digest
    changes = sorted(p for p in old.keys() | new.keys() if old.get(p) != new.get(p))
    outside = [p for p in changes if p not in allowed]
    protected_changes = [p for p in changes if p == MANIFEST or p in protected or
                         p.startswith(tuple(PREFIX + part + '/' for part in ('vendor', 'licenses', 'sample')))]
    unsafe = [p for p in changes if any(t is not None and t[0] not in REGULAR for t in (old.get(p), new.get(p)))]
    failures = []
    for p, expected in sorted(protected.items()):
        entries = [old.get(p), new.get(p)]
        if any(t is None or t[0] not in REGULAR or t[1] != 'blob' for t in entries):
            failures.append(p)
        elif any(hashlib.sha256(git(repo, 'cat-file', 'blob', oid)).hexdigest() != expected
                 for oid in {t[2] for t in entries}):
            failures.append(p)
    rows = [{'path': p, 'before': old.get(p), 'after': new.get(p)} for p in changes]
    return {'schemaVersion': 1, 'status': 'FAIL' if outside or protected_changes or unsafe or failures else 'PASS',
            'scope': 'committed-tree-and-protected-assets-only', 'base': base, 'candidate': candidate,
            'allowed': sorted(allowed), 'changes': rows, 'outsideScope': outside,
            'protectedChanges': protected_changes, 'unsafeModes': unsafe, 'integrityFailures': failures,
            'protectedVerified': len(protected) - len(failures),
            'checks': {k: 'NOT RUN' for k in ('worktree', 'renderer', 'png', 'exports', 'offline', 'artistReview')}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--base', required=True)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--allow', action='append', default=[])
    args = parser.parse_args()
    try:
        result = audit(args.repo, args.base, args.candidate, args.allow)
    except (ValueError, UnicodeError) as error:
        print(json.dumps({'status': 'UNVERIFIED', 'reason': str(error)}))
        return 2
    print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
