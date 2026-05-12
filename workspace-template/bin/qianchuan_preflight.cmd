@echo off
setlocal

where bash >nul 2>nul
if errorlevel 1 (
  echo FAIL: 未找到 bash。请先安装 Git for Windows 或 WSL，然后重新运行 bin\qianchuan_preflight.cmd。
  echo NOTICE: 也可以在 OpenClaw Dashboard 或飞书里发送“检查千川环境”，让机器人按页面执行只读预检。
  exit /b 1
)

bash "%~dp0qianchuan_preflight.sh" %*
exit /b %ERRORLEVEL%
