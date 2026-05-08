#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.request


CONFIG_PATH = os.environ.get(
    "OPENCLAW_CONFIG",
    os.path.expanduser("~/.openclaw/openclaw.json"),
)
SERVER_NAME = "oceanengine-qianchuan"


def load_server():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)
    server = cfg.get("mcp", {}).get("servers", {}).get(SERVER_NAME)
    if not server:
        raise SystemExit(f"FAIL: MCP server not configured: {SERVER_NAME}")
    url = server.get("url") or ""
    if "open.oceanengine.com/qianchuan/mcp" not in url or "API_KEY=" not in url:
        raise SystemExit("FAIL: MCP server URL is not a qianchuan MCP URL")
    return server


def post(url, headers, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, dict(resp.headers), resp.read(200000).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        body = exc.read(2000).decode("utf-8", "replace")
        return exc.code, dict(exc.headers), body


def parse_json_or_sse(raw):
    raw = raw.strip()
    if not raw:
        return None
    if raw.startswith("data:") or "\ndata:" in raw:
        for line in raw.splitlines():
            if not line.startswith("data:"):
                continue
            chunk = line[5:].strip()
            if not chunk or chunk == "[DONE]":
                continue
            try:
                return json.loads(chunk)
            except json.JSONDecodeError:
                continue
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def main():
    server = load_server()
    url = server["url"]
    headers = dict(server.get("headers") or {})
    headers.update(
        {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-03-26",
        }
    )

    init_payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "longxia-qianchuan-mcp-probe", "version": "1.0"},
        },
    }
    status, resp_headers, body = post(url, headers, init_payload)
    if status < 200 or status >= 300:
        print(f"FAIL: initialize HTTP {status}")
        print(body[:500])
        return 1

    session_id = resp_headers.get("Mcp-Session-Id") or resp_headers.get("mcp-session-id")
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    post(url, headers, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})

    status, _, body = post(url, headers, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    if status < 200 or status >= 300:
        print(f"FAIL: tools/list HTTP {status}")
        print(body[:500])
        return 1

    obj = parse_json_or_sse(body)
    if not obj:
        print("FAIL: tools/list returned unparseable response")
        print(body[:500])
        return 1

    tools = obj.get("result", {}).get("tools") or obj.get("tools") or []
    names = [tool.get("name") for tool in tools if tool.get("name")]
    print(f"OK: {SERVER_NAME} connected; tools={len(names)}")
    for name in names:
        print(f"- {name}")
    required = {
        "qianchuan_report_live_get_v1",
        "qianchuan_report_advertiser_get_v1",
        "qianchuan_aweme_authorized_get_v1",
    }
    missing = sorted(required - set(names))
    if missing:
        print("WARN: expected qianchuan data tools missing: " + ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
