#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawnSync } = require("node:child_process");

const DEFAULT_APP_NAME = "煮酒社群投流龙虾";
const DEFAULT_DESCRIPTION = "煮酒社群出品，用于巨量千川直播加热自动化通知与交互";

function parseArgs(argv) {
  const args = {
    account: "longxia",
    appName: DEFAULT_APP_NAME,
    description: DEFAULT_DESCRIPTION,
    source: "zujiu-qianchuan-live-heating",
    domain: "feishu",
    dmPolicy: "allowlist",
    groupPolicy: "disabled",
    workspace: process.cwd(),
    dryRun: false,
    mock: false,
    installSdk: true,
    patchConfig: true,
    openBrowser: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--account") args.account = requireValue(argv, ++i, arg);
    else if (arg === "--app-name") args.appName = requireValue(argv, ++i, arg);
    else if (arg === "--description") args.description = requireValue(argv, ++i, arg);
    else if (arg === "--source") args.source = requireValue(argv, ++i, arg);
    else if (arg === "--domain") args.domain = requireValue(argv, ++i, arg);
    else if (arg === "--dm-policy") args.dmPolicy = requireValue(argv, ++i, arg);
    else if (arg === "--group-policy") args.groupPolicy = requireValue(argv, ++i, arg);
    else if (arg === "--workspace") args.workspace = requireValue(argv, ++i, arg);
    else if (arg === "--openclaw-home") args.openclawHome = requireValue(argv, ++i, arg);
    else if (arg === "--config-path") args.configPath = requireValue(argv, ++i, arg);
    else if (arg === "--no-sdk-install") args.installSdk = false;
    else if (arg === "--no-config-patch") args.patchConfig = false;
    else if (arg === "--no-open") args.openBrowser = false;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--mock") args.mock = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  validateChoice("domain", args.domain, ["feishu", "lark"]);
  validateChoice("dm-policy", args.dmPolicy, ["open", "pairing", "allowlist", "disabled"]);
  validateChoice("group-policy", args.groupPolicy, ["open", "allowlist", "disabled"]);
  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function validateChoice(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

function usage() {
  console.log(`Usage:
  node bin/feishu_oneclick_setup.js [options]

Options:
  --account <id>             OpenClaw Feishu account id. Default: longxia
  --app-name <name>          Feishu app and bot name. Default: ${DEFAULT_APP_NAME}
  --description <text>       Feishu app description.
  --domain <feishu|lark>     Feishu/Lark API domain. Default: feishu
  --dm-policy <policy>       open|pairing|allowlist|disabled. Default: allowlist
  --group-policy <policy>    open|allowlist|disabled. Default: disabled
  --workspace <path>         Customer workspace path. Default: current directory
  --openclaw-home <path>     OpenClaw home. Default: OPENCLAW_HOME or ~/.openclaw
  --config-path <path>       OpenClaw config path. Default: <openclaw-home>/openclaw.json
  --no-sdk-install           Do not run npm install if the Feishu SDK is missing.
  --no-config-patch          Do not patch OpenClaw config.
  --no-open                  Print the auth URL but do not open a browser.
  --dry-run                  Print write/config actions without writing.
  --mock                     Test mode: do not call Feishu; use fake credentials.
  --help                     Show this help.
`);
}

function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function mkdirp(dir, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] mkdir ${dir}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

function openUrl(url, enabled) {
  if (!enabled) return;
  const platform = process.platform;
  const command = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(command, args, { stdio: "ignore" }, () => {});
}

function resolveOpenClawPaths(args) {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const activeConfigPath =
    args.configPath ||
    process.env.OPENCLAW_CONFIG_PATH ||
    getOpenClawConfigFile({
      openclawHome: args.openclawHome,
    });
  const expandedActiveConfigPath = expandHome(activeConfigPath);
  const openclawHome = path.resolve(
    args.openclawHome ||
      process.env.OPENCLAW_STATE_DIR ||
      process.env.OPENCLAW_HOME ||
      (expandedActiveConfigPath ? path.dirname(expandedActiveConfigPath) : path.join(home, ".openclaw")),
  );
  const configPath = path.resolve(expandedActiveConfigPath || path.join(openclawHome, "openclaw.json"));
  return { openclawHome, configPath };
}

function expandHome(value) {
  if (!value || typeof value !== "string") return value;
  return value.replace(/^~(?=$|[\\/])/, process.env.HOME || process.env.USERPROFILE || "~");
}

function openClawEnv(paths) {
  const env = { ...process.env };
  if (paths.openclawHome) {
    env.OPENCLAW_HOME = paths.openclawHome;
    env.OPENCLAW_STATE_DIR = paths.openclawHome;
  }
  if (paths.configPath) env.OPENCLAW_CONFIG_PATH = paths.configPath;
  return env;
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

function getOpenClawConfigFile(options = {}) {
  const env = { ...process.env };
  if (options.openclawHome) {
    env.OPENCLAW_HOME = options.openclawHome;
    env.OPENCLAW_STATE_DIR = options.openclawHome;
  }
  const result = spawnSync("openclaw", ["config", "file"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    env,
  });
  if (result.status !== 0) return "";
  const line = lastSignalLine(`${result.stdout || ""}\n${result.stderr || ""}`);
  if (!line || line.includes("Usage:")) return "";
  return line;
}

function resolveSdk(workspace) {
  return require.resolve("@larksuiteoapi/node-sdk", {
    paths: [workspace, __dirname, process.cwd()],
  });
}

function ensureSdk(workspace, args) {
  try {
    return resolveSdk(workspace);
  } catch (error) {
    if (!args.installSdk) throw new Error("Missing @larksuiteoapi/node-sdk. Re-run without --no-sdk-install.");
  }

  const packageJson = path.join(workspace, "package.json");
  if (!fs.existsSync(packageJson)) {
    const pkg = {
      private: true,
      name: "qianchuan-live-heating-client",
      version: "1.0.0",
      type: "commonjs",
      dependencies: {},
    };
    if (args.dryRun) console.log(`[dry-run] write ${packageJson}`);
    else fs.writeFileSync(packageJson, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  const command = "npm";
  const npmArgs = ["install", "--no-audit", "--no-fund", "@larksuiteoapi/node-sdk@^1.63.1"];
  if (args.dryRun) {
    console.log(`[dry-run] ${command} ${npmArgs.join(" ")}`);
    return null;
  }

  console.log(`\n$ ${command} ${npmArgs.join(" ")}`);
  const result = spawnSync(command, npmArgs, {
    cwd: workspace,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) throw new Error("npm install @larksuiteoapi/node-sdk failed");
  return resolveSdk(workspace);
}

async function registerApp(args, workspace) {
  if (args.mock) {
    return {
      client_id: "cli_mock_qianchuan_live_heating",
      client_secret: "mock_secret_do_not_use_in_production",
      user_info: { open_id: "ou_mock_installer" },
      mock: true,
    };
  }

  const sdkPath = ensureSdk(workspace, args);
  if (args.dryRun) {
    return {
      client_id: "cli_dry_run",
      client_secret: "dry_run_secret",
      dry_run: true,
    };
  }

  const lark = require(sdkPath);
  console.log("正在创建飞书智能体应用。请用飞书扫码或打开授权链接完成确认。");
  return await lark.registerApp({
    source: args.source,
    onQRCodeReady(info) {
      const pendingPath = path.join(workspace, "runs", "feishu_register_pending.json");
      mkdirp(path.dirname(pendingPath), false);
      fs.writeFileSync(
        pendingPath,
        JSON.stringify({ url: info.url, expire_in: info.expireIn, created_at: new Date().toISOString() }, null, 2),
        "utf8",
      );
      console.log("");
      console.log(`扫码/授权链接：${info.url}`);
      console.log(`有效期：${info.expireIn} 秒`);
      openUrl(info.url, args.openBrowser);
    },
    onStatusChange(info) {
      console.log(`状态：${info.status}${info.interval ? `，下次轮询 ${info.interval}s` : ""}`);
    },
  });
}

function extractCredentials(result) {
  const appId = result.client_id || result.app_id || result.appId || result.clientId;
  const appSecret = result.client_secret || result.app_secret || result.appSecret || result.clientSecret;
  const ownerOpenId = result.user_info?.open_id || result.userInfo?.openId || result.open_id || "";
  if (!appId || !appSecret) {
    throw new Error(`Feishu registerApp returned unexpected fields: ${Object.keys(result).join(", ")}`);
  }
  return { appId, appSecret, ownerOpenId };
}

function writeLocalFeishuFiles(workspace, args, creds) {
  const createdAt = new Date().toISOString();
  const secretDir = path.join(workspace, "runs", "secrets");
  const jsonPath = path.join(secretDir, `feishu-app-${stamp()}.json`);
  const envPath = path.join(workspace, ".env.feishu");
  const localYamlPath = path.join(workspace, "customer-config.local.yaml");

  const secretJson = {
    created_at: createdAt,
    account: args.account,
    app_name: args.appName,
    domain: args.domain,
    app_id: creds.appId,
    app_secret: creds.appSecret,
    owner_open_id: creds.ownerOpenId || undefined,
  };
  const envText = [
    `# Generated by bin/feishu_oneclick_setup.js at ${createdAt}`,
    `FEISHU_APP_ID=${creds.appId}`,
    `FEISHU_APP_SECRET=${creds.appSecret}`,
    `ZUJIU_FEISHU_ACCOUNT=${args.account}`,
    creds.ownerOpenId ? `FEISHU_OWNER_OPEN_ID=${creds.ownerOpenId}` : "",
    "",
  ].filter((line) => line !== "").join("\n") + "\n";
  const yamlText = [
    "# Generated locally. Do not commit this file.",
    "feishu:",
    "  enabled: true",
    `  bot_name: ${args.appName}`,
    `  account: ${args.account}`,
    `  domain: ${args.domain}`,
    `  app_id: ${creds.appId}`,
    `  app_secret: ${creds.appSecret}`,
    creds.ownerOpenId ? `  owner_open_id: ${creds.ownerOpenId}` : "",
    `  dm_policy: ${args.dmPolicy}`,
    `  group_policy: ${args.groupPolicy}`,
    "",
  ].filter((line) => line !== "").join("\n") + "\n";

  if (args.dryRun) {
    console.log(`[dry-run] write ${jsonPath}`);
    console.log(`[dry-run] write ${envPath}`);
    console.log(`[dry-run] write ${localYamlPath}`);
    return { jsonPath, envPath, localYamlPath };
  }

  mkdirp(secretDir, false);
  fs.writeFileSync(jsonPath, `${JSON.stringify(secretJson, null, 2)}\n`, { mode: 0o600 });
  for (const file of [envPath, localYamlPath]) {
    if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.backup-${stamp()}`);
  }
  fs.writeFileSync(envPath, envText, { mode: 0o600 });
  fs.writeFileSync(localYamlPath, yamlText, { mode: 0o600 });
  return { jsonPath, envPath, localYamlPath };
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) return {};
  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.log(`提示：无法直接解析 ${configPath}，将使用 OpenClaw config patch 做最小合并：${error.message}`);
    return {};
  }
}

function patchOpenClawConfig(args, paths, creds) {
  if (!args.patchConfig) return false;

  const config = readConfig(paths.configPath);
  const existingFeishu = config.channels?.feishu || {};
  const existingAccount = existingFeishu.accounts?.[args.account] || {};
  const feishuPatch = {
    enabled: true,
    domain: args.domain,
    connectionMode: "websocket",
    defaultAccount: args.account,
    dmPolicy: args.dmPolicy,
    groupPolicy: args.groupPolicy,
    accounts: {},
  };
  if (args.dmPolicy === "allowlist" && creds.ownerOpenId) {
    feishuPatch.allowFrom = Array.from(new Set([...(existingFeishu.allowFrom || []), creds.ownerOpenId]));
  }
  feishuPatch.accounts[args.account] = {
    ...existingAccount,
    appId: creds.appId,
    appSecret: creds.appSecret,
    name: args.appName,
    enabled: true,
    domain: args.domain,
    dmPolicy: args.dmPolicy,
    groupPolicy: args.groupPolicy,
    allowFrom:
      args.dmPolicy === "allowlist" && creds.ownerOpenId
        ? Array.from(new Set([...(existingAccount.allowFrom || []), creds.ownerOpenId]))
        : existingAccount.allowFrom,
    requireMention: args.groupPolicy === "open" ? false : true,
  };
  const patch = { channels: { feishu: feishuPatch } };

  if (args.dryRun) {
    console.log(`[dry-run] openclaw config patch ${paths.configPath}: channels.feishu.accounts.${args.account}`);
    console.log(
      JSON.stringify(
        {
          channels: {
            feishu: {
              enabled: true,
              domain: args.domain,
              defaultAccount: args.account,
              dmPolicy: args.dmPolicy,
              groupPolicy: args.groupPolicy,
              accounts: {
                [args.account]: {
                  appId: "***REDACTED***",
                  appSecret: "***REDACTED***",
                  name: args.appName,
                  enabled: true,
                },
              },
            },
          },
        },
        null,
        2,
      ),
    );
    return true;
  }

  console.log(`\n$ openclaw config patch --stdin`);
  const result = spawnSync("openclaw", ["config", "patch", "--stdin"], {
    input: `${JSON.stringify(patch, null, 2)}\n`,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
    env: openClawEnv(paths),
  });
  if (result.status !== 0) throw new Error("OpenClaw config patch failed after Feishu setup");
  return true;
}

function runOpenClawValidate(paths, dryRun) {
  const command = "openclaw";
  const args = ["config", "validate"];
  if (dryRun) {
    console.log(`[dry-run] ${command} ${args.join(" ")}`);
    return;
  }

  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: openClawEnv(paths),
  });
  if (result.status !== 0) throw new Error("OpenClaw config validation failed after Feishu setup");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const workspace = path.resolve(args.workspace);
  const paths = resolveOpenClawPaths(args);
  mkdirp(workspace, args.dryRun);

  console.log("飞书机器人一键对接 - 煮酒社群投流龙虾");
  console.log(`Workspace: ${workspace}`);
  console.log(`OpenClaw config: ${paths.configPath}`);
  console.log(`Feishu account: ${args.account}`);

  const result = await registerApp(args, workspace);
  const creds = extractCredentials(result);
  console.log(`\nApp ID：${creds.appId}`);
  console.log("App Secret：已获取，出于安全不在终端展示。");
  if (creds.ownerOpenId) {
    console.log(`扫码用户 open_id：${creds.ownerOpenId}`);
  } else if (args.dmPolicy === "allowlist") {
    console.log("提示：飞书未返回扫码用户 open_id。当前 dm-policy=allowlist，后续可能需要手动加入 allowFrom 或改用 pairing。");
  }

  const files = writeLocalFeishuFiles(workspace, args, creds);
  const patched = patchOpenClawConfig(args, paths, creds);
  if (patched) runOpenClawValidate(paths, args.dryRun);

  console.log(`
飞书机器人对接完成。

本地文件：
- ${files.envPath}
- ${files.localYamlPath}
- ${files.jsonPath}

下一步：
1. 重启 OpenClaw Gateway，让新飞书配置生效。
2. 在飞书给机器人发：测试
3. 收到回复后，发送：初始化千川直播加热

说明：默认只允许扫码创建应用的用户私聊，群聊默认关闭。如需群里使用，重新运行时加 --group-policy open。
`);
}

main().catch((error) => {
  console.error(`\n飞书机器人对接失败：${error.message}`);
  process.exit(1);
});
