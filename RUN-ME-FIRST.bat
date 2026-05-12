@echo off
title Longxia Installer - DO NOT CLOSE

echo ==================================================
echo Longxia Installer - this window should stay open
echo ==================================================
echo.
echo If this window still closes immediately, the file was not extracted
echo or Windows/security policy blocked .bat files.
echo.
echo Current folder:
echo %~dp0
echo.
pause

cd /d "%~dp0"

if not exist "INSTALLER-MAIN.ps1" (
  echo.
  echo ERROR: INSTALLER-MAIN.ps1 not found.
  echo Please fully extract the zip first, then run RUN-ME-FIRST.bat.
  echo.
  pause
  goto END
)

if not exist "install-windows.ps1" (
  echo.
  echo ERROR: install-windows.ps1 not found.
  echo Package is incomplete.
  echo.
  pause
  goto END
)

echo.
echo Starting PowerShell installer...
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALLER-MAIN.ps1"

echo.
echo PowerShell installer returned errorlevel %ERRORLEVEL%.
echo.
pause

:END
echo.
echo Keeping window open. Type exit and press Enter to close.
cmd /k
