#!/usr/bin/env python3
# capture.py — ghost-decorator runner for Python clusters
# Reads regrets/manifest.json, instruments watched functions via
# unittest.mock.patch, runs entry points, and writes .regret files.
#
# Usage:
#   python scripts/capture.py
#   python scripts/capture.py --cluster transform-invoice
#   python scripts/capture.py --manifest ./regrets/manifest.json

import sys
import os
import json
import importlib
import copy
from datetime import datetime, timezone
from functools import wraps

# ─── CLI args ─────────────────────────────────────────────────────────────────

def parse_args():
    args = sys.argv[1:]
    cluster_filter = None
    manifest_path = None

    i = 0
    while i < len(args):
        if args[i] == '--cluster' and i + 1 < len(args):
            cluster_filter = args[i + 1]
            i += 2
        elif args[i] == '--manifest' and i + 1 < len(args):
            manifest_path = args[i + 1]
            i += 2
        else:
            i += 1

    if manifest_path is None:
        manifest_path = os.path.join(os.getcwd(), 'regrets', 'manifest.json')

    return cluster_filter, manifest_path

# ─── Fingerprint (identical algorithm to fingerprint.js) ──────────────────────

def stable_dumps(obj):
    """Stable JSON serialization — keys sorted recursively."""
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def normalize(obj, rules=None):
    """Normalize non-deterministic values before hashing."""
    if rules is None:
        rules = []

    if isinstance(obj, str):
        import re
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
    """Strip ignored fields from output before hashing."""
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
    """Convert integer to base36 string."""
    chars = '0123456789abcdefghijklmnopqrstuvwxyz'
    if n == 0:
        return '0'
    result = ''
    while n:
        result = chars[n % 36] + result
        n //= 36
    return result


def fingerprint(input_data, output_data, rules=None, ignore_fields=None):
    """
    Core fingerprint function — IDENTICAL algorithm to fingerprint.js:
    stableStringify(input) + '|' + stableStringify(output) → sha256 → base36 → first 7 chars
    """
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
    """Fingerprint an entire call sequence (for fingerprintLevel: 'full' or 'watched')."""
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


def deep_clone(val):
    """Deep clone via JSON round-trip."""
    try:
        return json.loads(json.dumps(val))
    except (TypeError, ValueError):
        return val


def json_serialize(val):
    """Serialize value to JSON string for .regret file."""
    return json.dumps(val, ensure_ascii=False)


# ─── Ghost decorator ──────────────────────────────────────────────────────────

recorder = []


def create_ghost(module, watch_list):
    """
    Wrap watched functions in the module with recording decorators.
    Returns a namespace-like object with ghost-wrapped functions.
    """
    import types

    class GhostModule:
        pass

    ghost = GhostModule()

    # Copy all attributes from original module
    for attr_name in dir(module):
        if not attr_name.startswith('_'):
            try:
                setattr(ghost, attr_name, getattr(module, attr_name))
            except AttributeError:
                pass

    # Replace watched functions with ghost wrappers
    for fn_name in watch_list:
        original = getattr(module, fn_name, None)
        if original is None or not callable(original):
            print(f"  ⚠️  Watch target \"{fn_name}\" is not callable — skipping")
            continue

        # Create closure that captures the original function
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


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    cluster_filter, manifest_path = parse_args()

    # Load manifest
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"❌ Could not read manifest: {manifest_path}")
        print(f"   Error: {e}")
        print(f"   Create regrets/manifest.json first. See SKILL.md for format.")
        sys.exit(1)

    clusters = manifest.get('clusters', [])
    if cluster_filter:
        clusters = [c for c in clusters if c['id'] == cluster_filter]

    if not clusters:
        print(f"❌ No clusters found{' matching "' + cluster_filter + '"' if cluster_filter else ''}")
        sys.exit(1)

    # Filter to Python clusters only
    python_clusters = [c for c in clusters if c.get('stack') == 'python']
    if not python_clusters:
        print("No Python clusters found in manifest.")
        sys.exit(0)

    # Setup output directory
    out_dir = os.path.join(os.getcwd(), 'regrets')
    os.makedirs(out_dir, exist_ok=True)

    # Add pythonPath to sys.path if specified
    for cluster in python_clusters:
        python_path = cluster.get('pythonPath', '')
        if python_path and python_path not in sys.path:
            abs_python_path = os.path.join(os.getcwd(), python_path)
            if abs_python_path not in sys.path:
                sys.path.insert(0, abs_python_path)

    passed = 0
    failed = 0

    for cluster in python_clusters:
        cid = cluster['id']
        entry = cluster['entry']
        watches = cluster.get('watches', [])
        module_path = cluster.get('module', cluster.get('file', ''))
        normalize_rules = cluster.get('normalize', [])
        ignore_fields = cluster.get('ignoreFields', [])
        fingerprint_level = cluster.get('fingerprintLevel', 'entry')
        multi_args = cluster.get('multiArgs', False)
        inputs = cluster.get('inputs', [None])

        print(f"\n📡 Capturing: {cid}")
        print(f"   Module:  {module_path}")
        print(f"   Entry:   {entry}")
        print(f"   Watches: {', '.join(watches)}")

        try:
            # Dynamic import of target module
            # module uses dot notation: "src.invoice.processor"
            mod = importlib.import_module(module_path)

            global recorder
            recorder = []
            ghost = create_ghost(mod, watches)

            # Get entry function from ghost module
            entry_fn = getattr(ghost, entry, None) or getattr(mod, entry, None)
            if entry_fn is None or not callable(entry_fn):
                raise TypeError(f"Entry \"{entry}\" not found or not callable in {module_path}")

            # Run with provided inputs
            results = []
            for input_val in inputs:
                recorder = []

                if multi_args and isinstance(input_val, list):
                    output = entry_fn(*input_val)
                    fp_input = input_val
                else:
                    output = entry_fn(input_val) if input_val is not None else entry_fn()
                    fp_input = input_val

                if fingerprint_level == 'entry':
                    fp = fingerprint(fp_input, output, normalize_rules, ignore_fields)
                else:
                    fp = fingerprint_sequence(recorder, normalize_rules, ignore_fields)

                results.append({'input': input_val, 'output': output, 'fp': fp, 'calls': list(recorder)})

            # Use first result as golden
            golden = results[0]
            fp = golden['fp']

            # Write .regret file
            regret_path = os.path.join(out_dir, f"{cid}.regret")
            timestamp = datetime.now(timezone.utc).isoformat()

            lines = [
                f"cluster: {cid}",
                f"fingerprint: {fp}",
                f"captured: {timestamp}",
                f"watches: [{', '.join(watches)}]",
                f"entry: {entry}",
                "stack: python",
                f"fingerprintLevel: {fingerprint_level}",
            ]
            if normalize_rules:
                lines.append(f"normalize: [{', '.join(normalize_rules)}]")
            if ignore_fields:
                lines.append(f"ignoreFields: [{', '.join(ignore_fields)}]")
            if cluster.get('multiArgs'):
                lines.append(f"multiArgs: {multi_args}")
            if cluster.get('module'):
                lines.append(f"module: {module_path}")

            lines.append("---")
            lines.append(f"INPUT  {json_serialize(golden['input'])}")
            lines.append(f"OUTPUT {json_serialize(golden['output'])}")
            lines.append(f"HASH   {fp}")

            with open(regret_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))

            print(f"   ✅ Fingerprint: {fp}")
            print(f"   📄 Saved: regrets/{cid}.regret")
            passed += 1

        except Exception as err:
            print(f"   ❌ Capture failed: {err}")
            import traceback
            traceback.print_exc()
            failed += 1

    # ─── Summary ──────────────────────────────────────────────────────────────

    print(f"\n{'─' * 50}")
    print(f"Capture complete: {passed} captured, {failed} failed")

    if failed > 0:
        print(f"\n⚠️  Fix failed captures before proceeding to PHASE 2.")
        print(f"   Hint: Check that 'entry' and 'watches' names match exports in your module.")
        sys.exit(1)

    print(f"\nNext: python scripts/validate.py")
    print(f"If all green → you are clear to refactor.")


if __name__ == '__main__':
    main()
