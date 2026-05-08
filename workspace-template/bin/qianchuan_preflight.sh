#!/usr/bin/env bash
# provenance anchor: ZJSQ-LX-20260508-5A31C01698
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${LONGXIA_WORKSPACE:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
AAVID="${QIANCHUAN_AAVID:-${QC_AAVID:-${QC_ACCOUNT_ID:-}}}"
if [ -n "${AAVID}" ]; then
  QIANCHUAN_URL="${QIANCHUAN_URL:-https://qianchuan.jinritemai.com/brand_bid/promotion/standard?aavid=${AAVID}}"
else
  QIANCHUAN_URL="${QIANCHUAN_URL:-https://qianchuan.jinritemai.com/brand_bid/promotion/standard}"
fi
CDP_URL="${OPENCLAW_CDP_URL:-http://127.0.0.1:18800}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

say_ok() {
  printf 'OK: %s\n' "$*"
}

say_warn() {
  printf 'WARN: %s\n' "$*" >&2
}

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

run_json() {
  local outfile="$1"
  shift
  "$@" >"${outfile}" 2>&1 || {
    sed -n '1,80p' "${outfile}" >&2 || true
    fail "command failed: $*"
  }
}

py_json() {
  local infile="$1"
  shift
  python3 - "${infile}" "$@"
}

say_ok "preflight started for workspace ${WORKSPACE}"
test -d "${WORKSPACE}" || fail "longxia workspace not found: ${WORKSPACE}"

health_json="${TMP_DIR}/health.json"
run_json "${health_json}" openclaw health --json
py_json "${health_json}" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
start = min([i for i in [raw.find("{"), raw.find("[")] if i >= 0], default=-1)
if start < 0:
    raise SystemExit("no json in openclaw health output")
d = json.loads(raw[start:])
if not d.get("ok"):
    raise SystemExit("openclaw health ok=false")
feishu = d.get("channels", {}).get("feishu", {})
acct = feishu.get("accounts", {}).get("longxia", {})
if not acct.get("enabled"):
    raise SystemExit("Feishu longxia account is not enabled")
if not acct.get("configured"):
    raise SystemExit("Feishu longxia account is not configured")
if not acct.get("running"):
    raise SystemExit("Feishu longxia account is not running")
if acct.get("lastError"):
    raise SystemExit(f"Feishu longxia lastError: {acct.get('lastError')}")
print("OK: OpenClaw gateway and Feishu longxia are healthy")
if d.get("eventLoop", {}).get("degraded"):
    reasons = ",".join(d.get("eventLoop", {}).get("reasons") or [])
    print(f"NOTICE: OpenClaw event loop advisory: {reasons}")
PY

agents_json="${TMP_DIR}/agents.json"
run_json "${agents_json}" openclaw config get agents.list --json
py_json "${agents_json}" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
start = min([i for i in [raw.find("{"), raw.find("[")] if i >= 0], default=-1)
if start < 0:
    raise SystemExit("no json in agents.list output")
agents = json.loads(raw[start:])
longxia = next((a for a in agents if a.get("id") == "longxia"), None)
if not longxia:
    raise SystemExit("agent longxia not found")
model = longxia.get("model")
if model != "openai-codex/gpt-5.5":
    raise SystemExit(f"agent longxia model must be openai-codex/gpt-5.5, got {model}")
print("OK: longxia uses openai-codex/gpt-5.5")
PY

active_memory_json="${TMP_DIR}/active_memory_agents.json"
run_json "${active_memory_json}" openclaw config get plugins.entries.active-memory.config.agents --json
py_json "${active_memory_json}" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
start = min([i for i in [raw.find("{"), raw.find("[")] if i >= 0], default=-1)
if start < 0:
    raise SystemExit("no json in active-memory agents output")
agents = json.loads(raw[start:])
if "longxia" in agents:
    raise SystemExit("active-memory is enabled for longxia; this can break tool jobs")
print("OK: active-memory is not attached to longxia")
PY

LONGXIA_WORKSPACE_FOR_NODE="${WORKSPACE}" node - <<'NODE'
const path = require('path');
const workspace = process.env.LONGXIA_WORKSPACE_FOR_NODE;
const registry = require(path.join(workspace, 'qc_plan_registry.js')).loadRegistry();
if (!Array.isArray(registry.entries)) {
  throw new Error('qianchuan plan registry entries is not an array');
}
const names = new Set();
const combos = new Set();
for (const entry of registry.entries) {
  if (!entry.planName || !entry.behavior || !entry.interest) {
    throw new Error('qianchuan plan registry has incomplete entry');
  }
  const name = String(entry.planName).trim().replace(/\s+/g, '');
  const combo = entry.comboKey || `${entry.behavior}::${entry.interest}`;
  if (names.has(name)) {
    throw new Error(`qianchuan plan registry duplicate planName: ${entry.planName}`);
  }
  if (combos.has(combo)) {
    throw new Error(`qianchuan plan registry duplicate behavior+interest: ${entry.behavior}+${entry.interest}`);
  }
  names.add(name);
  combos.add(combo);
}
console.log(`OK: qianchuan plan registry loaded (${registry.entries.length} remembered plans)`);
NODE

if [ -f "${WORKSPACE}/qc_monitor_state_validate.js" ]; then
  node "${WORKSPACE}/qc_monitor_state_validate.js" --mode preflight
else
  say_warn "qc_monitor_state_validate.js not found; monitor pagination/state guard is unavailable"
fi

sessions_json="${TMP_DIR}/sessions.json"
run_json "${sessions_json}" openclaw sessions --agent longxia --json
py_json "${sessions_json}" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
start = min([i for i in [raw.find("{"), raw.find("[")] if i >= 0], default=-1)
if start < 0:
    raise SystemExit("no json in longxia sessions output")
d = json.loads(raw[start:])
limit = 0.85
for s in d.get("sessions", []):
    key = s.get("key") or ""
    if key.startswith("agent:longxia:feishu:direct:"):
        total = s.get("totalTokens") or 0
        cap = s.get("contextTokens") or 0
        if cap and total / cap >= limit:
            pct = round(total * 100 / cap, 1)
            raise SystemExit(f"longxia Feishu direct session context is {pct}% full; reset session before production qianchuan work")
print("OK: longxia Feishu direct session is below context safety limit")
PY

audit_json="${TMP_DIR}/tasks_audit.json"
run_json "${audit_json}" openclaw tasks audit --json
py_json "${audit_json}" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
start = min([i for i in [raw.find("{"), raw.find("[")] if i >= 0], default=-1)
if start < 0:
    raise SystemExit("no json in tasks audit output")
d = json.loads(raw[start:])
combined = d.get("summary", {}).get("combined", {})
errors = combined.get("errors", d.get("summary", {}).get("errors", 0))
warnings = combined.get("warnings", d.get("summary", {}).get("warnings", 0))
if errors:
    raise SystemExit(f"task audit has {errors} errors")
if warnings:
    findings = d.get("findings", [])
    blocking = []
    ignored = []
    for f in findings:
        if f.get("severity") != "warn":
            blocking.append(f)
            continue
        code = f.get("code")
        task = f.get("task") or {}
        status = task.get("status")
        if code == "lost" and status == "lost":
            ignored.append(f)
            continue
        blocking.append(f)
    if blocking:
        details = []
        for f in blocking[:5]:
            task = f.get("task") or {}
            details.append(f"{f.get('code')}:{task.get('taskId') or f.get('token') or 'unknown'}")
        raise SystemExit(f"task audit has blocking warnings: {', '.join(details)}")
    print(f"NOTICE: task audit has {len(ignored)} terminal lost warning(s); ignored for qianchuan production preflight")
else:
    print("OK: task audit is clean")
PY

cron_json="${TMP_DIR}/cron.json"
run_json "${cron_json}" openclaw cron list --all --json
py_json "${cron_json}" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
start = min([i for i in [raw.find("{"), raw.find("[")] if i >= 0], default=-1)
if start < 0:
    raise SystemExit("no json in cron list output")
d = json.loads(raw[start:])
jobs = d.get("jobs", [])
required = {"browser", "read", "write", "edit"}
for job in jobs:
    name = job.get("name", "")
    if "qianchuan" not in name:
        continue
    if "2026-05-02" in name and job.get("enabled"):
        raise SystemExit("legacy 2026-05-02 qianchuan monitor is still enabled")
    if not job.get("enabled"):
        continue
    if job.get("agentId") != "longxia":
        raise SystemExit(f"enabled qianchuan cron {name} is not assigned to longxia")
    if job.get("sessionTarget") != "isolated":
        raise SystemExit(f"enabled qianchuan cron {name} must use isolated session")
    tools = set(job.get("payload", {}).get("toolsAllow") or [])
    missing = sorted(required - tools)
    if missing:
        raise SystemExit(f"enabled qianchuan cron {name} missing tools: {','.join(missing)}")
print("OK: qianchuan cron jobs are not stale or unsafe")
PY

browser_start="${TMP_DIR}/browser_start.txt"
openclaw browser --json start >"${browser_start}" 2>&1 || {
  sed -n '1,100p' "${browser_start}" >&2 || true
  fail "failed to start OpenClaw browser"
}

ready=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sS --max-time 2 "${CDP_URL}/json/version" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "${ready}" != "1" ]; then
  sed -n '1,100p' "${browser_start}" >&2 || true
  fail "browser CDP is not reachable at ${CDP_URL}"
fi
say_ok "browser CDP is reachable at ${CDP_URL}"

tabs_json="${TMP_DIR}/tabs.json"
curl -sS --max-time 3 "${CDP_URL}/json/list" >"${tabs_json}" || fail "failed to read browser tabs"
if ! py_json "${tabs_json}" <<'PY'
import json, sys
tabs = json.load(open(sys.argv[1], encoding="utf-8"))
ok = any("qianchuan.jinritemai.com" in (t.get("url") or "") for t in tabs)
raise SystemExit(0 if ok else 1)
PY
then
  openclaw browser --json open "${QIANCHUAN_URL}" >/dev/null 2>&1 || fail "failed to open qianchuan page"
  sleep 2
  curl -sS --max-time 3 "${CDP_URL}/json/list" >"${tabs_json}" || fail "failed to read browser tabs after open"
fi

py_json "${tabs_json}" <<'PY'
import json, sys
tabs = json.load(open(sys.argv[1], encoding="utf-8"))
matches = [t for t in tabs if "qianchuan.jinritemai.com" in (t.get("url") or "")]
if not matches:
    raise SystemExit("qianchuan tab is not open")
t = matches[0]
url = t.get("url") or ""
short_url = url.split("#", 1)[0]
if len(short_url) > 180:
    short_url = short_url[:177] + "..."
print(f"OK: qianchuan tab ready: {t.get('title') or '(no title)'} | {short_url}")
PY

say_ok "preflight passed. It is safe to start page-level qianchuan work, subject to login/risk/manual-confirmation rules."
