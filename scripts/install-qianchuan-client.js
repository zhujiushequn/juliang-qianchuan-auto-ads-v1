#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_WORKSPACE_NAME = "workspace-qianchuan-client";
const WINDOWS_PREFLIGHT_CMD = `@echo off
setlocal
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0qianchuan_preflight.ps1" %*
exit /b %ERRORLEVEL%
`;
const WINDOWS_PREFLIGHT_PS1 = `<#
Windows 原生千川预检。无需 Git Bash。
用于客户刚安装 OpenClaw 的 Windows 机器。
#>
param(
  [string]$Workspace = (Resolve-Path (Join-Path $PSScriptRoot "..") | Select-Object -ExpandProperty Path),
  [string]$CdpUrl = "http://127.0.0.1:18800"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Ok($m) { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m) { Write-Host "NOTICE: $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "FAIL: $m" -ForegroundColor Red; exit 1 }
function Have($cmd) { return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) }
function RunText($file, [string[]]$args) {
  $out = & $file @args 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out -join "\`n") }
  return ($out -join "\`n")
}

Write-Host "煮酒社群投流龙虾 Windows 预检" -ForegroundColor Cyan
Ok "workspace: $Workspace"
if (-not (Test-Path $Workspace)) { Fail "工作区不存在：$Workspace" }

if (-not (Have "node")) { Fail "未找到 node。请先安装/修复 OpenClaw。" }
Ok "node: $((& node --version).Trim())"

if (-not (Have "openclaw")) { Fail "未找到 openclaw 命令。请重新打开 PowerShell，或重新安装 OpenClaw。" }
Ok "openclaw 命令可用"

try {
  RunText "openclaw" @("config", "validate") | Out-Null
  Ok "OpenClaw config validate 通过"
} catch {
  Fail "OpenClaw 配置校验失败：$($_.Exception.Message)"
}

foreach ($file in @("AGENTS.md", "QIANCHUAN_LIVE_HEATING_SOP.md", "customer-config.yaml", "qc_plan_registry.js", "qc_monitor_state_validate.js", "cdp_qc_create_today10.js", "cdp_qc_batch_loop.js", "memory\qianchuan-plan-registry.json", "memory\qianchuan-monitor-state.json", "memory\qianchuan-monitor-plan-list.md")) {
  $p = Join-Path $Workspace $file
  if (-not (Test-Path $p)) { Fail "缺少必要文件：$file" }
}
Ok "工作区文件完整"

try {
  Push-Location $Workspace
  & node --check qc_cli_args.js | Out-Null
  & node --check qc_plan_registry.js | Out-Null
  & node --check qc_monitor_state_validate.js | Out-Null
  & node --check cdp_qc_create_today10.js | Out-Null
  & node --check cdp_qc_batch_loop.js | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "node --check failed" }
  Ok "Node 脚本语法校验通过"
} catch {
  Fail "Node 脚本校验失败：$($_.Exception.Message)"
} finally {
  Pop-Location
}

try {
  Push-Location $Workspace
  $js = @'
const fs=require('fs');
const r=JSON.parse(fs.readFileSync('memory/qianchuan-plan-registry.json','utf8'));
if(!Array.isArray(r.entries)) throw new Error('registry.entries 不是数组');
const names=new Set(), combos=new Set();
for(const e of r.entries){
  if(!e.planName||!e.behavior||!e.interest) throw new Error('台账存在不完整记录');
  const name=String(e.planName).replace(/\s+/g,'');
  const combo=e.comboKey||\`\${e.behavior}::\${e.interest}\`;
  if(names.has(name)) throw new Error('重复计划名：'+e.planName);
  if(combos.has(combo)) throw new Error('重复行为兴趣组合：'+combo);
  names.add(name); combos.add(combo);
}
console.log(\`OK registry \${r.entries.length}\`);
'@
  $tmp = Join-Path $env:TEMP "longxia-registry-check.js"
  Set-Content -Path $tmp -Value $js -Encoding UTF8
  $out = & node $tmp 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out -join "\`n") }
  Ok "计划台账可读取且无重复"
} catch {
  Fail "计划台账校验失败：$($_.Exception.Message)"
} finally {
  Pop-Location
}

try {
  Push-Location $Workspace
  & node qc_monitor_state_validate.js --mode preflight
  if ($LASTEXITCODE -ne 0) { throw "监控状态校验失败" }
  Ok "监控状态预检通过"
} catch {
  Fail "监控状态预检失败：$($_.Exception.Message)"
} finally {
  Pop-Location
}

try {
  & openclaw browser start --json | Out-Null
  Start-Sleep -Seconds 2
  $version = Invoke-RestMethod -Uri "$CdpUrl/json/version" -TimeoutSec 3
  Ok "浏览器 CDP 可访问：$($version.Browser)"
} catch {
  Warn "浏览器 CDP 暂不可访问：$($_.Exception.Message)"
  Warn "如果后续需要页面自动化，请先打开 OpenClaw Browser 或 Chrome/Edge。"
}

try {
  $healthRaw = RunText "openclaw" @("health", "--json")
  if ($healthRaw -match '"ok"\s*:\s*true') { Ok "OpenClaw health 正常" }
  else { Warn "OpenClaw health 未明确 ok=true；如飞书不回消息，请重启 gateway。" }
} catch {
  Warn "OpenClaw health 查询失败：$($_.Exception.Message)"
}

Ok "preflight passed：可开始千川页面级操作；遇到登录/验证码/授权/风控/扣费等仍必须人工处理。"
exit 0
`;

function parseArgs(argv) {
  const args = {
    installGateway: false,
    startGateway: false,
    openDashboard: false,
    setupFeishu: false,
    feishuAccount: "longxia",
    feishuAppName: "煮酒社群投流龙虾",
    feishuDmPolicy: "allowlist",
    feishuGroupPolicy: "disabled",
    feishuMock: false,
    overwrite: false,
    dryRun: false,
    updateWorkspaceConfig: true,
    workspaceName: DEFAULT_WORKSPACE_NAME,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--install-gateway") args.installGateway = true;
    else if (arg === "--setup-feishu") args.setupFeishu = true;
    else if (arg === "--feishu-account") args.feishuAccount = requireValue(argv, ++i, arg);
    else if (arg === "--feishu-app-name") args.feishuAppName = requireValue(argv, ++i, arg);
    else if (arg === "--feishu-dm-policy") args.feishuDmPolicy = requireValue(argv, ++i, arg);
    else if (arg === "--feishu-group-policy") args.feishuGroupPolicy = requireValue(argv, ++i, arg);
    else if (arg === "--feishu-mock") args.feishuMock = true;
    else if (arg === "--start-gateway") args.startGateway = true;
    else if (arg === "--open-dashboard") args.openDashboard = true;
    else if (arg === "--overwrite") args.overwrite = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--workspace") args.workspace = requireValue(argv, ++i, arg);
    else if (arg === "--workspace-name") args.workspaceName = requireValue(argv, ++i, arg);
    else if (arg === "--openclaw-home") args.openclawHome = requireValue(argv, ++i, arg);
    else if (arg === "--config-path") args.configPath = requireValue(argv, ++i, arg);
    else if (arg === "--no-workspace-config" || arg === "--no-config-set") args.updateWorkspaceConfig = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.installGateway) args.startGateway = true;
  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function usage() {
  console.log(`Usage:
  node scripts/install-qianchuan-client.js [options]

Options:
  --workspace <path>       Customer workspace path.
  --workspace-name <name>  Fallback workspace folder under ~/.openclaw. Default: ${DEFAULT_WORKSPACE_NAME}
  --openclaw-home <path>   OpenClaw home scope. Default: active OpenClaw config home, then %USERPROFILE%\\.openclaw or ~/.openclaw
  --config-path <path>     OpenClaw config file. Default: active config from 'openclaw config file'
  --no-workspace-config    Do not patch agents.defaults.workspace when --workspace points elsewhere.
  --setup-feishu           One-click create/bind Feishu bot. Requires customer scan/authorization.
  --feishu-account <id>    OpenClaw Feishu account id. Default: longxia
  --feishu-app-name <name> Feishu app and bot name. Default: 煮酒社群投流龙虾
  --feishu-dm-policy <p>   open|pairing|allowlist|disabled. Default: allowlist
  --feishu-group-policy <p> open|allowlist|disabled. Default: disabled
  --install-gateway        Install/reinstall the OpenClaw gateway service and start it.
  --start-gateway          Start an already-installed gateway service.
  --open-dashboard         Open OpenClaw dashboard after setup.
  --overwrite              Overwrite existing template files.
  --dry-run                Print actions without writing.
  --help                   Show this help.

Examples:
  node scripts/install-qianchuan-client.js --setup-feishu --install-gateway --open-dashboard
  node scripts/install-qianchuan-client.js --workspace "C:\\Users\\Administrator\\.openclaw\\workspace-qianchuan-client"
`);
}

function resolvePaths(args) {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home && !args.openclawHome) {
    throw new Error("Cannot find USERPROFILE/HOME. Pass --openclaw-home <path>.");
  }

  const activeConfigPath = path.resolve(
    expandHome(
      args.configPath ||
        process.env.OPENCLAW_CONFIG_PATH ||
        getOpenClawConfigFile({ openclawHome: args.openclawHome }) ||
        path.join(args.openclawHome || path.join(home, ".openclaw"), "openclaw.json"),
    ),
  );
  const openclawHome = path.resolve(args.openclawHome || process.env.OPENCLAW_HOME || process.env.OPENCLAW_STATE_DIR || path.dirname(activeConfigPath));
  const activeWorkspace = normalizeMaybePath(
    getOpenClawConfigJsonValue("agents.defaults.workspace", {
      openclawHome,
      configPath: activeConfigPath,
    }),
  );
  const installedWorkspace = inferInstalledWorkspace();
  const fallbackWorkspace = path.join(openclawHome, args.workspaceName);
  const clientWorkspace = path.resolve(args.workspace || activeWorkspace || installedWorkspace || fallbackWorkspace);
  const defaultWorkspace = activeWorkspace || clientWorkspace;
  const skillsDir = path.join(clientWorkspace, "skills");
  const shouldPatchWorkspace =
    args.updateWorkspaceConfig &&
    Boolean(args.workspace) &&
    !samePath(clientWorkspace, activeWorkspace);

  return {
    openclawHome,
    configPath: activeConfigPath,
    defaultWorkspace,
    activeWorkspace,
    installedWorkspace,
    skillsDir,
    clientWorkspace,
    shouldPatchWorkspace,
    updateWorkspaceConfig: args.updateWorkspaceConfig,
  };
}

function inferInstalledWorkspace() {
  const maybeSkillsDir = path.dirname(ROOT);
  if (path.basename(maybeSkillsDir).toLowerCase() === "skills") {
    return path.dirname(maybeSkillsDir);
  }
  return "";
}

function samePath(a, b) {
  if (!a || !b) return false;
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function normalizeMaybePath(value) {
  if (!value || typeof value !== "string") return "";
  return path.resolve(expandHome(value));
}

function expandHome(value) {
  if (!value || typeof value !== "string") return value;
  return value.replace(/^~(?=$|[\\/])/, process.env.HOME || process.env.USERPROFILE || "~");
}

function stripAnsi(text) {
  return String(text || "").replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function lastSignalLine(output) {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("Config warnings:"))
    .filter((line) => !line.startsWith("- plugins."))
    .filter((line) => !line.startsWith("🦞"));
  return lines[lines.length - 1] || "";
}

function openClawEnv(options = {}) {
  const env = { ...process.env };
  if (options.openclawHome) {
    env.OPENCLAW_HOME = options.openclawHome;
    env.OPENCLAW_STATE_DIR = options.openclawHome;
  }
  if (options.configPath) env.OPENCLAW_CONFIG_PATH = options.configPath;
  return env;
}

function runOpenClawCapture(args, options = {}) {
  const result = spawnSync("openclaw", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: openClawEnv(options),
  });
  if (result.status !== 0) return "";
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function getOpenClawConfigFile(options = {}) {
  const output = runOpenClawCapture(["config", "file"], options);
  const line = lastSignalLine(output);
  if (!line || line.includes("Usage:")) return "";
  return line;
}

function getOpenClawConfigJsonValue(key, options = {}) {
  const output = runOpenClawCapture(["config", "get", key, "--json"], options);
  const line = lastSignalLine(output);
  if (!line) return "";
  try {
    return JSON.parse(line);
  } catch {
    return line;
  }
}

function mkdirp(dir, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] mkdir ${dir}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest, options) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    mkdirp(dest, options.dryRun);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry), options);
    }
    return;
  }

  if (!stat.isFile()) return;
  if (fs.existsSync(dest) && !options.overwrite) {
    options.skipped.push(dest);
    return;
  }

  mkdirp(path.dirname(dest), options.dryRun);
  if (options.dryRun) {
    console.log(`[dry-run] copy ${src} -> ${dest}`);
  } else {
    fs.copyFileSync(src, dest);
  }
  options.copied.push(dest);
}

function runOpenClaw(args, options = {}) {
  const command = `openclaw ${args.join(" ")}`;
  if (options.dryRun) {
    console.log(`[dry-run] ${command}`);
    return;
  }

  console.log(`\n$ ${command}`);
  const result = spawnSync("openclaw", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: openClawEnv(options),
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function runOpenClawPatch(patch, options = {}) {
  const command = "openclaw config patch --stdin";
  if (options.dryRun) {
    console.log(`[dry-run] ${command}`);
    console.log(JSON.stringify(patch, null, 2));
    return;
  }

  console.log(`\n$ ${command}`);
  const result = spawnSync("openclaw", ["config", "patch", "--stdin"], {
    input: `${JSON.stringify(patch, null, 2)}\n`,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
    env: openClawEnv(options),
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function runNode(args, options = {}) {
  const command = `node ${args.join(" ")}`;
  if (options.dryRun) {
    console.log(`[dry-run] ${command}`);
    return;
  }

  console.log(`\n$ ${command}`);
  const result = spawnSync("node", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: openClawEnv(options),
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function ensureConfigFile(clientWorkspace, options) {
  const example = path.join(clientWorkspace, "customer-config.example.yaml");
  const target = path.join(clientWorkspace, "customer-config.yaml");
  if (!fs.existsSync(example) || fs.existsSync(target)) return;

  if (options.dryRun) {
    console.log(`[dry-run] copy ${example} -> ${target}`);
  } else {
    fs.copyFileSync(example, target);
  }
  options.copied.push(target);
}

function ensureTextFile(file, content, options) {
  if (fs.existsSync(file) && !options.overwrite) {
    options.skipped.push(file);
    return;
  }

  mkdirp(path.dirname(file), options.dryRun);
  if (options.dryRun) {
    console.log(`[dry-run] write ${file}`);
  } else {
    fs.writeFileSync(file, content, "utf8");
  }
  options.copied.push(file);
}

function ensureWindowsPreflightWrappers(clientWorkspace, options) {
  ensureTextFile(path.join(clientWorkspace, "bin", "qianchuan_preflight.cmd"), WINDOWS_PREFLIGHT_CMD, options);
  ensureTextFile(path.join(clientWorkspace, "bin", "qianchuan_preflight.ps1"), WINDOWS_PREFLIGHT_PS1, options);
}

function ensureWorkspaceConfig(paths, options) {
  if (samePath(paths.clientWorkspace, paths.activeWorkspace)) {
    console.log("OpenClaw 默认工作区已经是目标工作区，跳过默认工作区修改。");
    return;
  }

  if (!paths.updateWorkspaceConfig) {
    console.log("已按 --no-workspace-config 跳过默认工作区修改。");
    console.log(`提示：OpenClaw 当前默认工作区仍是 ${paths.activeWorkspace || "未识别"}。`);
    return;
  }

  if (!paths.shouldPatchWorkspace) {
    console.log("未指定独立 --workspace，跳过默认工作区修改。");
    return;
  }

  runOpenClawPatch(
    {
      agents: {
        defaults: {
          workspace: paths.clientWorkspace,
        },
      },
    },
    options,
  );
  runOpenClaw(["config", "get", "agents.defaults.workspace"], options);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const paths = resolvePaths(args);
  const options = {
    dryRun: args.dryRun,
    overwrite: args.overwrite,
    openclawHome: paths.openclawHome,
    configPath: paths.configPath,
    copied: [],
    skipped: [],
  };

  const required = [
    path.join(ROOT, "skills", "feishu-bot-provisioner"),
    path.join(ROOT, "skills", "qianchuan-live-heating-automation"),
    path.join(ROOT, "workspace-template"),
  ];
  for (const item of required) {
    if (!fs.existsSync(item)) {
      throw new Error(`Package is incomplete, missing: ${item}`);
    }
  }

  console.log("煮酒社群投流龙虾 - 客户一键安装");
  console.log(`OpenClaw home: ${paths.openclawHome}`);
  console.log(`OpenClaw config: ${paths.configPath}`);
  console.log(`Active workspace: ${paths.activeWorkspace || "未识别，将使用目标工作区"}`);
  console.log(`Skills dir: ${paths.skillsDir}`);
  console.log(`Client workspace: ${paths.clientWorkspace}`);

  copyRecursive(
    path.join(ROOT, "skills", "feishu-bot-provisioner"),
    path.join(paths.skillsDir, "feishu-bot-provisioner"),
    options,
  );
  copyRecursive(
    path.join(ROOT, "skills", "qianchuan-live-heating-automation"),
    path.join(paths.skillsDir, "qianchuan-live-heating-automation"),
    options,
  );
  copyRecursive(path.join(ROOT, "workspace-template"), paths.clientWorkspace, options);
  ensureConfigFile(paths.clientWorkspace, options);
  ensureWindowsPreflightWrappers(paths.clientWorkspace, options);

  console.log(`\nCopied files: ${options.copied.length}`);
  if (options.skipped.length > 0) {
    console.log(`Skipped existing files: ${options.skipped.length} (use --overwrite to replace templates)`);
  }

  ensureWorkspaceConfig(paths, options);
  runOpenClaw(["config", "validate"], options);

  if (args.setupFeishu) {
    const feishuScript = path.join(paths.clientWorkspace, "bin", "feishu_oneclick_setup.js");
    const feishuArgs = [
      feishuScript,
      "--openclaw-home",
      paths.openclawHome,
      "--config-path",
      paths.configPath,
      "--workspace",
      paths.clientWorkspace,
      "--account",
      args.feishuAccount,
      "--app-name",
      args.feishuAppName,
      "--dm-policy",
      args.feishuDmPolicy,
      "--group-policy",
      args.feishuGroupPolicy,
    ];
    if (args.feishuMock) feishuArgs.push("--mock");
    runNode(feishuArgs, options);
  }

  if (args.installGateway) {
    runOpenClaw(["gateway", "install", "--force", "--runtime", "node", "--port", "18789"], options);
  }
  if (args.startGateway) {
    runOpenClaw(["gateway", "start"], options);
    runOpenClaw(["gateway", "status"], options);
  }
  if (args.openDashboard) {
    runOpenClaw(["dashboard"], options);
  }

  console.log(`
安装完成。

下一步：
1. 打开 OpenClaw 网页。
2. 如果已使用 --setup-feishu，先在飞书给机器人发：测试
3. 新建对话或通过飞书输入：初始化千川直播加热
4. 按向导填写客户自己的千川账号、抖音号、预算、性别、年龄等配置。
5. 客户人工登录巨量千川后，在客户工作区运行预检：
   - macOS/Linux/Git Bash：bash bin/qianchuan_preflight.sh
   - Windows CMD：bin\\qianchuan_preflight.cmd
6. 预检通过后，通过飞书发送：开始直播了

遇到登录、验证码、二维码、风控、授权、扣费确认、余额不足、资质审核时，必须暂停并人工处理。
`);
}

try {
  main();
} catch (error) {
  console.error(`\n安装失败：${error.message}`);
  process.exit(1);
}
