#!/usr/bin/env python3
# validate.py — regression validator for Python clusters
# Usage:
#   python scripts/validate.py
#   python scripts/validate.py --runs 5
#   python scripts/validate.py --cluster transform-invoice
#   python scripts/validate.py --update transform-invoice --reason "tax rate changed to 12%"
#   python scripts/validate.py --fail-fast

import sys
import os
import json
import importlib
import re
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

# ─── CLI args ─────────────────────────────────────────────────────────────────

def parse_args():
    args = sys.argv[1:]
    result = {
        'cluster': None,
        'runs': 1,
        'update': None,
        'reason': None,
        'fail_fast': False,
        'manifest': os.path.join(os.getcwd(), 'regrets', 'manifest.json'),
    }

    i = 0
    while i < len(args):
        if args[i] == '--cluster' and i + 1 < len(args):
            result['cluster'] = args[i + 1]; i += 2
        elif args[i] == '--runs' and i + 1 < len(args):
            result['runs'] = int(args[i + 1]); i += 2
        elif args[i] == '--update' and i + 1 < len(args):
            result['update'] = args[i + 1]; i += 2
        elif args[i] == '--reason' and i + 1 < len(args):
            result['reason'] = args[i + 1]; i += 2
        elif args[i] == '--fail-fast':
            result['fail_fast'] = True; i += 1
        elif args[i] == '--manifest' and i + 1 < len(args):
            result['manifest'] = args[i + 1]; i += 2
        else:
            i += 1

    return result

# ─── Fingerprint (identical algorithm to fingerprint.js) ──────────────────────

def stable_dumps(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def normalize(obj, rules=None):
    if rules is None:
        rules = []

    if isinstance(obj, str):
        if 'timestamps' in rules and re.match(r'^\d{4}-\d{2}-\d{2}T[\d:.Z+\-]+$', obj):
            return '<TIMESTAMP>'
        if 'uuids' in rules and re.match(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', obj, re.I
        ):
            return '<UUID>'
        if 'absPaths' in rules and obj.startswith('/'):
            parts = obj.split('/')
            if len(parts) >= 3:
                return '<ROOT>/' + '/'.join(parts[3:])
        if 'dynamicDates' in rules:
            result = re.sub(r'\d{2}\d{4}', '<MMYYYY>', obj)
            result = re.sub(r'(?<!\d)(20\d{2}|19\d{2})(?!\d)', '<YYYY>', result)
            return result
        return obj

    if isinstance(obj, (int, float)):
        if 'epochs' in rules and 1_000_000_000 < obj < 9_999_999_999_999:
            return '<EPOCH>'
        return obj

    if isinstance(obj, list):
        return [normalize(v, rules) for v in obj]

    if isinstance(obj, dict):
        return {k: normalize(v, rules) for k, v in obj.items()}

    return obj


def strip_fields(obj, fields=None):
    if fields is None:
        fields = []
    if not fields:
        return obj

    if isinstance(obj, list):
        return [strip_fields(v, fields) for v in obj]

    if isinstance(obj, dict):
        return {
            k: strip_fields(v, fields)
            for k, v in obj.items()
            if k not in fields
        }

    return obj


def to_base36(n):
    chars = '0123456789abcdefghijklmnopqrstuvwxyz'
    if n == 0:
        return '0'
    result = ''
    while n:
        result = chars[n % 36] + result
        n //= 36
    return result


def deep_clone(val):
    try:
        return json.loads(json.dumps(val))
    except (TypeError, ValueError):
        return val


def fingerprint(input_data, output_data, rules=None, ignore_fields=None):
    import hashlib

    if rules is None:
        rules = []
    if ignore_fields is None:
        ignore_fields = []

    clean_input = strip_fields(normalize(deep_clone(input_data), rules), ignore_fields)
    clean_output = strip_fields(normalize(deep_clone(output_data), rules), ignore_fields)

    combined = stable_dumps(clean_input) + '|' + stable_dumps(clean_output)
    hash_hex = hashlib.sha256(combined.encode('utf-8')).hexdigest()

    big_num = int(hash_hex, 16)
    return to_base36(big_num)[:7]


def fingerprint_sequence(calls, rules=None, ignore_fields=None):
    import hashlib

    if rules is None:
        rules = []
    if ignore_fields is None:
        ignore_fields = []

    normalized = []
    for call in calls:
        normalized.append({
            'fn': call['fn'],
            'args': strip_fields(normalize(deep_clone(call['args']), rules), ignore_fields),
            'result': strip_fields(normalize(deep_clone(call['result']), rules), ignore_fields),
        })

    combined = stable_dumps(normalized)
    hash_hex = hashlib.sha256(combined.encode('utf-8')).hexdigest()
    big_num = int(hash_hex, 16)
    return to_base36(big_num)[:7]


# ─── Parse .regret file ──────────────────────────────────────────────────────

def parse_regret(content):
    parts = content.split('\n---\n', 1)
    meta_section = parts[0]
    data_section = parts[1] if len(parts) > 1 else ''

    meta = {}
    for line in meta_section.split('\n'):
        colon_idx = line.find(': ')
        if colon_idx == -1:
            continue
        key = line[:colon_idx]
        val = line[colon_idx + 2:].strip()

        if key == 'watches':
            meta['watches'] = [w.strip() for w in val.strip('[]').split(',') if w.strip()]
        elif key == 'normalize':
            meta['normalize'] = [n.strip() for n in val.strip('[]').split(',') if n.strip()]
        elif key == 'ignoreFields':
            meta['ignoreFields'] = [f.strip() for f in val.strip('[]').split(',') if f.strip()]
        else:
            meta[key] = val

    # Parse data section
    for line in data_section.split('\n'):
        if line.startswith('INPUT '):
            meta['input'] = json.loads(line[6:])
        elif line.startswith('OUTPUT '):
            meta['output'] = json.loads(line[7:])
        elif line.startswith('HASH '):
            meta['goldenHash'] = line[5:].strip()

    meta['raw'] = content
    return meta


# ─── Ghost wrapper ────────────────────────────────────────────────────────────

def create_ghost(mod, watch_list, recorder):
    """Wrap watched functions with recording decorators."""
    class GhostModule:
        pass

    ghost = GhostModule()

    for attr_name in dir(mod):
        if not attr_name.startswith('_'):
            try:
                setattr(ghost, attr_name, getattr(mod, attr_name))
            except AttributeError:
                pass

    for fn_name in (watch_list or []):
        original = getattr(mod, fn_name, None)
        if original is None or not callable(original):
            continue

        def make_ghost(orig, name):
            @wraps(orig)
            def wrapper(*args, **kwargs):
                result = orig(*args, **kwargs)
                recorder.append({
                    'fn': name,
                    'args': deep_clone(args),
                    'result': deep_clone(result),
                })
                return result
            return wrapper

        setattr(ghost, fn_name, make_ghost(original, fn_name))

    return ghost


# ─── Update .regret file ─────────────────────────────────────────────────────

def update_regret(regret_path, regret, new_hash, live_output, reason):
    old_hash = regret.get('goldenHash', '')
    now = datetime.now(timezone.utc).isoformat()

    # Rebuild .regret content
    raw = regret['raw']
    new_content = re.sub(r'^fingerprint: .+$', f'fingerprint: {new_hash}', raw, flags=re.MULTILINE)
    new_content = re.sub(r'^captured: .+$', f'captured: {now}', new_content, flags=re.MULTILINE)
    new_content = re.sub(r'^OUTPUT .+$', f'OUTPUT {json.dumps(live_output, ensure_ascii=False)}', new_content, flags=re.MULTILINE)
    new_content = re.sub(r'^HASH .+$', f'HASH   {new_hash}', new_content, flags=re.MULTILINE)

    with open(regret_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    # Append to audit.log
    audit_log = os.path.join(os.path.dirname(regret_path), 'audit.log')
    cluster_id = os.path.splitext(os.path.basename(regret_path))[0]
    entry = (
        f"\n{now}  UPDATE  {cluster_id}\n"
        f"  old: {old_hash}\n"
        f"  new: {new_hash}\n"
        f"  reason: {reason}\n"
        f"  by: AI refactor session"
    )
    with open(audit_log, 'a', encoding='utf-8') as f:
        f.write(entry)

    return old_hash, new_hash


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    cli = parse_args()

    # Validate --update usage
    if cli['update'] and not cli['reason']:
        print("❌ --update requires --reason")
        print(f'   Example: --update {cli["update"]} --reason "describe why behavior changed"')
        sys.exit(1)

    if cli['reason'] and len(cli['reason'].split()) < 4:
        print(f'❌ --reason is too vague: "{cli["reason"]}"')
        print('   Be specific. e.g. "tax rate updated from 11% to 12% per new regulation"')
        sys.exit(1)

    # Load manifest
    try:
        with open(cli['manifest'], 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print(f"❌ Could not read manifest: {cli['manifest']}")
        sys.exit(1)

    # Find .regret files
    regret_dir = os.path.join(os.getcwd(), 'regrets')
    filter_id = cli['cluster'] or cli['update'] or None

    try:
        regret_files = [
            f for f in os.listdir(regret_dir)
            if f.endswith('.regret') and (not filter_id or f == f'{filter_id}.regret')
        ]
    except FileNotFoundError:
        print("❌ regrets/ not found. Run capture.py first.")
        sys.exit(1)

    if not regret_files:
        print(f"❌ No .regret files found{' for "' + filter_id + '"' if filter_id else ''}.")
        sys.exit(1)

    # Add pythonPath to sys.path if specified in any Python cluster
    for cluster in manifest.get('clusters', []):
        if cluster.get('stack') == 'python':
            python_path = cluster.get('pythonPath', '')
            if python_path:
                abs_path = os.path.join(os.getcwd(), python_path)
                if abs_path not in sys.path:
                    sys.path.insert(0, abs_path)

    update_mode = bool(cli['update'])
    drift_mode = cli['runs'] > 1 and not update_mode

    if update_mode:
        print(f'\n🔄 Update mode — cluster: {cli["update"]}')
        print(f'   Reason: {cli["reason"]}\n')
    elif drift_mode:
        print(f'\n🔍 Drift detection — {cli["runs"]} runs per cluster...\n')
    else:
        print(f'\n🔍 Validating {len(regret_files)} cluster(s)...\n')

    results = []

    for regret_file in regret_files:
        cluster_id = os.path.splitext(regret_file)[0]
        regret_path = os.path.join(regret_dir, regret_file)

        with open(regret_path, 'r', encoding='utf-8') as f:
            regret = parse_regret(f.read())

        # Find cluster definition in manifest
        cluster_def = None
        for c in manifest.get('clusters', []):
            if c['id'] == cluster_id:
                cluster_def = c
                break

        if not cluster_def:
            print(f"  ⚠️  {cluster_id}: not in manifest — skipping")
            continue

        # Only validate Python clusters
        if cluster_def.get('stack') != 'python':
            print(f"  ⏭️  {cluster_id}: stack={cluster_def.get('stack', 'js')} — use JS validator")
            continue

        try:
            module_path = cluster_def.get('module', cluster_def.get('file', ''))
            entry_name = cluster_def['entry']
            norm_rules = cluster_def.get('normalize', [])
            ign_fields = cluster_def.get('ignoreFields', [])
            fp_level = cluster_def.get('fingerprintLevel', 'entry')
            multi_args = cluster_def.get('multiArgs', False)

            mod = importlib.import_module(module_path)

            hashes = []
            last_output = None

            for _ in range(cli['runs']):
                recorder = []
                ghost = create_ghost(mod, regret.get('watches', cluster_def.get('watches', [])), recorder)

                entry_fn = getattr(ghost, entry_name, None) or getattr(mod, entry_name, None)
                if entry_fn is None or not callable(entry_fn):
                    raise TypeError(f"Entry \"{entry_name}\" not found in {module_path}")

                # Run entry with golden input
                golden_input = regret.get('input')
                if multi_args and isinstance(golden_input, list):
                    output = entry_fn(*golden_input)
                    fp_input = golden_input
                else:
                    output = entry_fn(golden_input) if golden_input is not None else entry_fn()
                    fp_input = golden_input

                last_output = output

                if fp_level == 'entry':
                    fp = fingerprint(fp_input, output, norm_rules, ign_fields)
                else:
                    fp = fingerprint_sequence(recorder, norm_rules, ign_fields)

                hashes.append(fp)

            live_hash = hashes[0]
            is_match = live_hash == regret.get('goldenHash')
            is_drift = drift_mode and len(set(hashes)) > 1

            if update_mode:
                if is_match:
                    print(f"  ℹ️  {cluster_id:<35} unchanged — no update needed")
                    results.append({'id': cluster_id, 'pass': True})
                else:
                    old_hash, new_hash = update_regret(
                        regret_path, regret, live_hash, last_output, cli['reason']
                    )
                    print(f"  ✅ {cluster_id:<35} {old_hash} → {new_hash}  UPDATED")
                    results.append({'id': cluster_id, 'pass': True, 'updated': True})

            elif drift_mode:
                if is_drift:
                    print(f"  ❌ {cluster_id:<35} DRIFT  [{' / '.join(hashes)}]")
                    results.append({'id': cluster_id, 'pass': False, 'drift': True})
                else:
                    icon = '✅' if is_match else '❌'
                    print(f"  {icon} {cluster_id:<35} {live_hash}  × {cli['runs']}  {'PASS+STABLE' if is_match else 'FAIL'}")
                    results.append({'id': cluster_id, 'pass': is_match})

            else:
                icon = '✅' if is_match else '❌'
                hash_str = regret.get('goldenHash', '') if is_match else f"{regret.get('goldenHash', '')} → {live_hash}"
                print(f"  {icon} {cluster_id:<35} {hash_str:<22} {'PASS' if is_match else 'FAIL'}")
                results.append({
                    'id': cluster_id, 'pass': is_match,
                    'golden': regret.get('goldenHash'), 'live': live_hash
                })

        except Exception as err:
            print(f"  ❌ {cluster_id:<35} ERROR: {err}")
            results.append({'id': cluster_id, 'pass': False, 'error': str(err)})

        if results and not results[-1]['pass'] and cli['fail_fast']:
            print("\n  --fail-fast: stopping.")
            break

    # ─── Summary ──────────────────────────────────────────────────────────────

    passed = sum(1 for r in results if r['pass'])
    failed = sum(1 for r in results if not r['pass'])
    drifted = sum(1 for r in results if r.get('drift'))

    print(f"\n{'─' * 60}")

    if update_mode:
        updated = sum(1 for r in results if r.get('updated'))
        print(f"✅ Update complete. {updated} updated.\n   Audit: regrets/audit.log")
        sys.exit(0)

    if drift_mode and drifted > 0:
        print(f"❌ Drift in {drifted} cluster(s). Add normalize rules and re-capture.")
        sys.exit(1)

    if failed == 0:
        print(f"✅ All {passed} tests passed{' (' + str(cli['runs']) + ' runs — stable)' if drift_mode else ''}. Refactor is safe.\n")
        sys.exit(0)

    print(f"❌ {failed}/{len(results)} FAILED.\n")
    for r in results:
        if not r['pass']:
            print(f"  • {r['id']}")
            if r.get('error'):
                print(f"    {r['error']}")
            elif r.get('golden'):
                print(f"    Expected: {r['golden']}  Got: {r['live']}")
    print("\nFix the CODE — do not edit .regret files.")
    print("Re-run: python scripts/validate.py")
    sys.exit(1)


if __name__ == '__main__':
    main()
