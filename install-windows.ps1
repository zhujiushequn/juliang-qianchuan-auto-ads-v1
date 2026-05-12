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
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Step([string]$Text) { Write-Host ""; Write-Host "==== $Text ====" -ForegroundColor Cyan }
function Ok([string]$Text) { Write-Host "OK: $Text" -ForegroundColor Green }
function Warn([string]$Text) { Write-Host "WARN: $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }
function HasCommand([string]$Name) { return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }
function RunLogged([string]$File, [string[]]$Args, [string]$WorkingDirectory = $PSScriptRoot) {
  Write-Host ""
  Write-Host ("$ " + $File + " " + ($Args -join " ")) -ForegroundColor DarkGray
  $p = Start-Process -FilePath $File -ArgumentList $Args -WorkingDirectory $WorkingDirectory -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { Fail ("Command failed: " + $File + " " + ($Args -join " ") + ", exit code " + $p.ExitCode) }
}
function GetActiveWorkspace {
  if (-not (HasCommand "openclaw")) { return "" }
  try {
    $raw = & openclaw config get agents.defaults.workspace --json 2>$null
    $line = ($raw | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($line)) { return "" }
    $value = $line | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($value)) { return "" }
    return [string]$value
  } catch { return "" }
}
function FindOpenClawHome([string]$ExplicitHome, [string]$WorkspaceCandidate) {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($ExplicitHome)) { $candidates += $ExplicitHome }
  if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_STATE_DIR)) { $candidates += $env:OPENCLAW_STATE_DIR }
  if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_HOME)) { $candidates += $env:OPENCLAW_HOME }
  if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_CONFIG_PATH)) { $candidates += (Split-Path -Parent $env:OPENCLAW_CONFIG_PATH) }
  if (-not [string]::IsNullOrWhiteSpace($WorkspaceCandidate)) {
    $p = Split-Path -Parent $WorkspaceCandidate
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
      $candidates += @("$root\.openclaw", "$root\openclaw", "$root\OpenClaw", "$root\OpenClaw\.openclaw")
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
  $WorkspacePath = GetActiveWorkspace
}
$OpenClawHome = FindOpenClawHome $OpenClawHome $WorkspacePath
if ([string]::IsNullOrWhiteSpace($OpenClawHome)) {
  Warn "OpenClaw data folder was not auto-detected."
  Warn "If OpenClaw is installed on D/E drive, paste the folder that contains openclaw.json, agents, or workspace."
  Warn "Example: D:\\.openclaw or D:\\OpenClaw\\.openclaw. Leave empty to use USERPROFILE\.openclaw."
  $manualHome = Read-Host "OpenClaw data folder"
  if (-not [string]::IsNullOrWhiteSpace($manualHome)) { $OpenClawHome = [System.IO.Path]::GetFullPath($manualHome) }
}
if ([string]::IsNullOrWhiteSpace($OpenClawHome)) { $OpenClawHome = Join-Path $env:USERPROFILE ".openclaw" }
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) { $WorkspacePath = Join-Path $OpenClawHome $WorkspaceName }
$DoneDoc = Join-Path $WorkspacePath "NEXT-STEPS.txt"

Write-Host "Zhujiu Longxia Windows installer" -ForegroundColor Magenta
Write-Host "Package folder: $PackageRoot"
Write-Host "OpenClaw data folder: $OpenClawHome"
Write-Host "Target workspace: $WorkspacePath"

Step "1/7 Check package"
if (-not (Test-Path $InstallerJs)) { Fail "Package incomplete: missing scripts\install-qianchuan-client.js" }
foreach ($need in @("workspace-template", "skills\feishu-bot-provisioner", "skills\qianchuan-live-heating-automation")) {
  if (-not (Test-Path (Join-Path $PackageRoot $need))) { Fail "Package incomplete: missing $need" }
}
Ok "Package files are present"

Step "2/7 Check Windows environment"
if (-not (HasCommand "node")) { Fail "node was not found. Reinstall OpenClaw/Node.js or reopen PowerShell." }
Ok ("Node: " + ((& node --version).Trim()))
if (-not (HasCommand "openclaw")) { Fail "openclaw command was not found. Reinstall OpenClaw or reopen PowerShell." }
try { $openclawVersion = (& openclaw --version 2>$null | Select-Object -First 1); Ok ("OpenClaw command: " + $openclawVersion) } catch { Ok "OpenClaw command found" }

$browserFound = $false
foreach ($cmd in @("chrome", "msedge")) { if (HasCommand $cmd) { $browserFound = $true; Ok ("Browser command found: " + $cmd); break } }
if (-not $browserFound) { Warn "chrome/msedge was not found in PATH. This may still be OK if Chrome/Edge is installed normally." }

Step "3/7 Install workspace and skills"
$installArgs = @($InstallerJs, "--workspace", $WorkspacePath, "--workspace-name", $WorkspaceName, "--openclaw-home", $OpenClawHome)
if ($Overwrite) { $installArgs += "--overwrite" }
if (-not $SkipFeishu) {
  $installArgs += @("--setup-feishu", "--feishu-account", $FeishuAccount, "--feishu-app-name", $FeishuAppName)
  if ($MockFeishu) { $installArgs += "--feishu-mock" }
}
if (-not $SkipGatewayStart) { $installArgs += @("--start-gateway") }
RunLogged -File "node" -Args $installArgs -WorkingDirectory $PackageRoot

Step "4/7 Write next steps"
$nextText = @"
Zhujiu Longxia has been installed.

Workspace:
$WorkspacePath

Next steps:
1. Send this message to the Feishu bot: test
2. If it replies, send: init qianchuan live heating
3. Fill qianchuan account name, aavid, aweme name, brand, bid, and plan count.
4. Login to qianchuan manually. QR code, SMS code, authorization, and risk checks must be handled by the user.
5. Run preflight in the workspace:
   .\bin\qianchuan_preflight.ps1
6. When live starts, send to Feishu bot: start live

Sensitive files:
- .env.feishu
- customer-config.local.yaml
Do not upload or share secrets.
"@
New-Item -ItemType Directory -Force -Path $WorkspacePath | Out-Null
Set-Content -Path $DoneDoc -Value $nextText -Encoding UTF8
Ok ("Wrote: " + $DoneDoc)

Step "5/7 Open pages"
try { Start-Process notepad.exe $DoneDoc } catch { Warn ("Cannot open next steps: " + $_.Exception.Message) }
try { Start-Process "https://qianchuan.jinritemai.com/" } catch { Warn ("Cannot open qianchuan: " + $_.Exception.Message) }

Step "6/7 Acceptance"
Write-Host "Now test Feishu: send 'test' to the bot."
Write-Host "Then send: init qianchuan live heating"

Step "7/7 Done"
Ok "Installer finished."
Write-Host ("Workspace: " + $WorkspacePath)
Write-Host ("Next steps: " + $DoneDoc)

if (-not $NoPause) { Write-Host ""; Read-Host "Press Enter to close" }
