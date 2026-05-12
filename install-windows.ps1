<#
煮酒社群投流龙虾 Windows 一键安装器
适用对象：已经刚安装 OpenClaw、不会找文件的小白客户。

做什么：
1. 检查 Node/OpenClaw/浏览器/Gateway 基础环境。
2. 把本包的 skills + workspace-template 安装到 OpenClaw 当前 workspace。
3. 可选：启动飞书机器人自动创建/绑定向导。
4. 启动 Gateway，打开 Dashboard 和安装完成说明。
5. 生成客户下一步只需照抄的操作清单。
#>

param(
  [string]$WorkspaceName = "workspace-qianchuan-client",
  [string]$WorkspacePath = "",
  [string]$OpenClawHome = "",
  [string]$FeishuAccount = "longxia",
  [string]$FeishuAppName = "煮酒社群投流龙虾",
  [switch]$SkipFeishu,
  [switch]$SkipGatewayStart,
  [switch]$Overwrite,
  [switch]$MockFeishu,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step([string]$Text) {
  Write-Host ""
  Write-Host "==== $Text ====" -ForegroundColor Cyan
}
function Write-Ok([string]$Text) { Write-Host "OK: $Text" -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "WARN: $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }
function Read-YesNo([string]$Prompt, [bool]$DefaultYes = $true) {
  $suffix = if ($DefaultYes) { "[Y/n]" } else { "[y/N]" }
  $ans = Read-Host "$Prompt $suffix"
  if ([string]::IsNullOrWhiteSpace($ans)) { return $DefaultYes }
  return @("y", "yes", "Y", "YES", "是", "好", "好的") -contains $ans
}
function Test-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}
function Invoke-Logged([string]$File, [string[]]$Args, [string]$WorkingDirectory = $PSScriptRoot) {
  Write-Host "`n$ $File $($Args -join ' ')" -ForegroundColor DarkGray
  $p = Start-Process -FilePath $File -ArgumentList $Args -WorkingDirectory $WorkingDirectory -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { Fail "命令失败：$File $($Args -join ' ')，退出码 $($p.ExitCode)" }
}
function Get-ActiveOpenClawWorkspace {
  if (-not (Test-Command "openclaw")) { return "" }
  try {
    $raw = & openclaw config get agents.defaults.workspace --json 2>$null
    $line = ($raw | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($line)) { return "" }
    $value = $line | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($value)) { return "" }
    return [string]$value
  } catch {
    return ""
  }
}
function Find-OpenClawHome([string]$ExplicitHome, [string]$WorkspaceCandidate) {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($ExplicitHome)) { $candidates += $ExplicitHome }
  if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_STATE_DIR)) { $candidates += $env:OPENCLAW_STATE_DIR }
  if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_HOME)) { $candidates += $env:OPENCLAW_HOME }
  if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_CONFIG_PATH)) { $candidates += (Split-Path -Parent $env:OPENCLAW_CONFIG_PATH) }
  if (-not [string]::IsNullOrWhiteSpace($WorkspaceCandidate)) {
    $candidates += $WorkspaceCandidate
    $p = $WorkspaceCandidate
    while (-not [string]::IsNullOrWhiteSpace($p)) {
      if ((Test-Path (Join-Path $p "openclaw.json")) -or (Test-Path (Join-Path $p "agents")) -or (Test-Path (Join-Path $p "workspace"))) { $candidates += $p; break }
      $parent = Split-Path -Parent $p
      if ($parent -eq $p) { break }
      $p = $parent
    }
  }
  if ($env:USERPROFILE) { $candidates += (Join-Path $env:USERPROFILE ".openclaw") }
  foreach ($drive in [System.IO.DriveInfo]::GetDrives()) {
    if ($drive.DriveType -eq 'Fixed' -and $drive.IsReady) {
      $root = $drive.RootDirectory.FullName.TrimEnd('\')
      $candidates += @(
        "$root\.openclaw",
        "$root\openclaw",
        "$root\OpenClaw",
        "$root\OpenClaw\.openclaw"
      )
    }
  }
  foreach ($c in ($candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)) {
    try {
      $full = [System.IO.Path]::GetFullPath($c)
      if ((Test-Path (Join-Path $full "openclaw.json")) -or (Test-Path (Join-Path $full "agents")) -or (Test-Path (Join-Path $full "workspace"))) { return $full }
    } catch {}
  }
  return ""
}

$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallerJs = Join-Path $PackageRoot "scripts\install-qianchuan-client.js"
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = Get-ActiveOpenClawWorkspace
}
$OpenClawHome = Find-OpenClawHome $OpenClawHome $WorkspacePath
if ([string]::IsNullOrWhiteSpace($OpenClawHome)) {
  Write-Warn "没有自动找到 OpenClaw 数据目录。测试电脑如果 OpenClaw 不在 C 盘，请在下一行粘贴它的 .openclaw/openclaw 数据目录。"
  Write-Warn "示例：D:\\OpenClaw\\.openclaw 或 D:\\.openclaw。留空则使用 %USERPROFILE%\\.openclaw。"
  $manualHome = Read-Host "OpenClaw 数据目录"
  if (-not [string]::IsNullOrWhiteSpace($manualHome)) { $OpenClawHome = [System.IO.Path]::GetFullPath($manualHome) }
}
if ([string]::IsNullOrWhiteSpace($OpenClawHome)) {
  $OpenClawHome = Join-Path $env:USERPROFILE ".openclaw"
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = Join-Path $OpenClawHome $WorkspaceName
}
$DoneDoc = Join-Path $WorkspacePath "安装完成-下一步.txt"

Write-Host "煮酒社群投流龙虾 Windows 一键安装器" -ForegroundColor Magenta
Write-Host "安装包目录：$PackageRoot"
Write-Host "OpenClaw 数据目录：$OpenClawHome"
Write-Host "目标工作区：$WorkspacePath"

Write-Step "1/7 检查安装包"
if (-not (Test-Path $InstallerJs)) { Fail "安装包不完整：缺少 scripts\install-qianchuan-client.js" }
foreach ($need in @("workspace-template", "skills\feishu-bot-provisioner", "skills\qianchuan-live-heating-automation")) {
  if (-not (Test-Path (Join-Path $PackageRoot $need))) { Fail "安装包不完整：缺少 $need" }
}
Write-Ok "安装包完整"

Write-Step "2/7 检查 Windows 基础环境"
if (-not (Test-Command "node")) {
  Fail "未找到 node。请先安装 OpenClaw 所需 Node.js，或重新安装 OpenClaw 后再运行本安装器。"
}
$nodeVersion = (& node --version).Trim()
Write-Ok "Node 已安装：$nodeVersion"

if (-not (Test-Command "openclaw")) {
  Fail "未找到 openclaw 命令。请先安装 OpenClaw，并确认重新打开过 PowerShell/CMD。"
}
$openclawVersion = (& openclaw --version 2>$null | Select-Object -First 1)
Write-Ok "OpenClaw 命令可用：$openclawVersion"

$browserFound = $false
foreach ($cmd in @("chrome", "msedge")) {
  if (Test-Command $cmd) { $browserFound = $true; Write-Ok "浏览器命令可用：$cmd"; break }
}
if (-not $browserFound) {
  Write-Warn "没有在 PATH 里找到 chrome/msedge。只要系统安装了 Chrome 或 Edge，OpenClaw 通常仍可调用；若后续浏览器启动失败，再安装 Chrome。"
}

Write-Step "3/7 安装 OpenClaw 工作区和技能"
$installArgs = @(
  $InstallerJs,
  "--workspace", $WorkspacePath,
  "--workspace-name", $WorkspaceName,
  "--openclaw-home", $OpenClawHome
)
if ($Overwrite) { $installArgs += "--overwrite" }
if (-not $SkipFeishu) {
  $installArgs += @("--setup-feishu", "--feishu-account", $FeishuAccount, "--feishu-app-name", $FeishuAppName)
  if ($MockFeishu) { $installArgs += "--feishu-mock" }
}
if (-not $SkipGatewayStart) { $installArgs += @("--start-gateway") }
Invoke-Logged "node" $installArgs $PackageRoot

Write-Step "4/7 生成小白下一步说明"
$nextText = @"
煮酒社群投流龙虾已安装到本机。

工作区位置：
$WorkspacePath

接下来按顺序做：

1. 如果刚才没有完成飞书绑定：
   双击本包里的 `RUN-ME-FIRST.bat`，不要加 SkipFeishu；
   或在当前目录运行：
   node scripts\install-qianchuan-client.js --setup-feishu --start-gateway --openclaw-home "$OpenClawHome" --workspace "$WorkspacePath"

2. 在飞书给机器人发：
   测试
   如果机器人能回复，说明飞书绑定成功。

3. 在飞书给机器人发：
   初始化千川直播加热
   按提示填写：千川账户名、aavid、抖音号、品牌名、出价、计划数量。

4. 打开巨量千川并人工登录。
   遇到二维码、验证码、短信、授权、风控，必须本人处理。

5. 预检：
   在工作区打开 PowerShell，运行：
   .\bin\qianchuan_preflight.ps1

6. 直播开始时，在飞书发：
   开始直播了

重要停止条件：
登录、验证码、二维码、短信验证、扣费确认、支付、充值、授权、协议确认、余额不足、资质、违规、权限、风控，机器人都会暂停，不能绕过。

敏感信息位置：
- 飞书 App Secret 在本机 .env.feishu / customer-config.local.yaml
- 不要发群里，不要上传公开仓库
"@
New-Item -ItemType Directory -Force -Path $WorkspacePath | Out-Null
Set-Content -Path $DoneDoc -Value $nextText -Encoding UTF8
Write-Ok "已生成：$DoneDoc"

Write-Step "5/7 打开说明和千川页面"
try { Start-Process notepad.exe $DoneDoc } catch { Write-Warn "无法自动打开说明：$($_.Exception.Message)" }
if (-not $SkipFeishu) {
  Write-Ok "飞书已优先通过开放平台 CLI/SDK 一键创建/绑定；只有失败时才需要手动打开开放平台兜底。"
}
try { Start-Process "https://qianchuan.jinritemai.com/" } catch { Write-Warn "无法打开千川：$($_.Exception.Message)" }

Write-Step "6/7 最小验收提示"
Write-Host "请现在做两件事：" -ForegroundColor Yellow
Write-Host "1. 在飞书给机器人发：测试"
Write-Host "2. 如果能回复，再发：初始化千川直播加热"
Write-Host ""
Write-Host "如果飞书还没绑定成功，回到安装窗口按提示扫码/授权，或把错误截图发给协助人员。"

Write-Step "7/7 完成"
Write-Ok "Windows 安装器已完成。"
Write-Host "工作区：$WorkspacePath"
Write-Host "说明文件：$DoneDoc"

if (-not $NoPause) {
  Write-Host ""
  Read-Host "按回车关闭窗口"
}
