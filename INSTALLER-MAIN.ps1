$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Log = Join-Path $Root "install-windows.log"

try {
  Start-Transcript -Path $Log -Append | Out-Null
} catch {
  Write-Host "WARN: cannot start transcript: $_" -ForegroundColor Yellow
}

try {
  Write-Host "==================================================" -ForegroundColor Cyan
  Write-Host "Zhujiu Longxia Windows Installer" -ForegroundColor Cyan
  Write-Host "==================================================" -ForegroundColor Cyan
  Write-Host "Package folder: $Root"
  Write-Host "Log file:       $Log"
  Write-Host ""
  Write-Host "This PowerShell window is started with -NoExit." -ForegroundColor Yellow
  Write-Host "If OpenClaw is not on C drive, this version will detect non-C paths or ask you to paste the data folder." -ForegroundColor Yellow
  Write-Host ""

  $Installer = Join-Path $Root "install-windows.ps1"
  if (-not (Test-Path $Installer)) {
    throw "install-windows.ps1 not found. Please fully extract the zip before running the installer."
  }

  & $Installer
  Write-Host ""
  Write-Host "Installer script returned. LASTEXITCODE=$LASTEXITCODE" -ForegroundColor Green
} catch {
  Write-Host ""
  Write-Host "INSTALLER ERROR:" -ForegroundColor Red
  Write-Host $_ -ForegroundColor Red
  Write-Host ""
  Write-Host "Send screenshot or this log file to support: $Log" -ForegroundColor Yellow
} finally {
  try { Stop-Transcript | Out-Null } catch {}
  Write-Host ""
  Write-Host "If you see this line, the window did not auto-close." -ForegroundColor Green
  Read-Host "Press Enter to close"
}
