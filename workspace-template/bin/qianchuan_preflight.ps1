<#
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
  if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
  return ($out -join "`n")
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
  const combo=e.comboKey||`${e.behavior}::${e.interest}`;
  if(names.has(name)) throw new Error('重复计划名：'+e.planName);
  if(combos.has(combo)) throw new Error('重复行为兴趣组合：'+combo);
  names.add(name); combos.add(combo);
}
console.log(`OK registry ${r.entries.length}`);
'@
  $tmp = Join-Path $env:TEMP "longxia-registry-check.js"
  Set-Content -Path $tmp -Value $js -Encoding UTF8
  $out = & node $tmp 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
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
