$ErrorActionPreference = "Stop"

$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
  Write-Host "FAIL: 未找到 bash。请先安装 Git for Windows 或 WSL，然后重新运行 bin\qianchuan_preflight.ps1。"
  Write-Host "NOTICE: 也可以在 OpenClaw Dashboard 或飞书里发送“检查千川环境”，让机器人按页面执行只读预检。"
  exit 1
}

& $bash.Source (Join-Path $PSScriptRoot "qianchuan_preflight.sh") @args
exit $LASTEXITCODE
