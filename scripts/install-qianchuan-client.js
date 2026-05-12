#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_WORKSPACE_NAME = "workspace-qianchuan-client";
const WINDOWS_PREFLIGHT_CMD = `@echo off
setlocal

where bash >nul 2>nul
if errorlevel 1 (
  echo FAIL: 未找到 bash。请先安装 Git for Windows 或 WSL，然后重新运行 bin\\qianchuan_preflight.cmd。
  echo NOTICE: 也可以在 OpenClaw Dashboard 或飞书里发送“检查千川环境”，让机器人按页面执行只读预检。
  exit /b 1
)

bash "%~dp0qianchuan_preflight.sh" %*
exit /b %ERRORLEVEL%
`;
const WINDOWS_PREFLIGHT_PS1 = `$ErrorActionPreference = "Stop"

$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
  Write-Host "FAIL: 未找到 bash。请先安装 Git for Windows 或 WSL，然后重新运行 bin\\qianchuan_preflight.ps1。"
  Write-Host "NOTICE: 也可以在 OpenClaw Dashboard 或飞书里发送“检查千川环境”，让机器人按页面执行只读预检。"
  exit 1
}

& $bash.Source (Join-Path $PSScriptRoot "qianchuan_preflight.sh") @args
exit $LASTEXITCODE
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
  --workspace-name <name>  Workspace folder under ~/.openclaw. Default: ${DEFAULT_WORKSPACE_NAME}
  --openclaw-home <path>   OpenClaw home and config scope. Default: %USERPROFILE%\\.openclaw or ~/.openclaw
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

  const openclawHome = path.resolve(args.openclawHome || path.join(home, ".openclaw"));
  const configPath = path.join(openclawHome, "openclaw.json");
  const defaultWorkspace = path.join(openclawHome, "workspace");
  const skillsDir = path.join(defaultWorkspace, "skills");
  const clientWorkspace = path.resolve(args.workspace || path.join(openclawHome, args.workspaceName));

  return { openclawHome, configPath, defaultWorkspace, skillsDir, clientWorkspace };
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
  const env = {
    ...process.env,
    OPENCLAW_HOME: options.openclawHome,
    OPENCLAW_STATE_DIR: options.openclawHome,
    OPENCLAW_CONFIG_PATH: options.configPath,
  };
  const result = spawnSync("openclaw", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
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
    env: {
      ...process.env,
      OPENCLAW_HOME: options.openclawHome,
      OPENCLAW_STATE_DIR: options.openclawHome,
      OPENCLAW_CONFIG_PATH: options.configPath,
    },
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

  runOpenClaw(["config", "set", "agents.defaults.workspace", paths.clientWorkspace], options);
  runOpenClaw(["config", "get", "agents.defaults.workspace"], options);
  runOpenClaw(["config", "validate"], options);

  if (args.setupFeishu) {
    const feishuScript = path.join(paths.clientWorkspace, "bin", "feishu_oneclick_setup.js");
    const feishuArgs = [
      feishuScript,
      "--openclaw-home",
      paths.openclawHome,
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
