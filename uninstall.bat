@echo off
setlocal
cd /d "%~dp0"
title Bezify uninstaller
echo.
echo  Bezify uninstaller
echo  ------------------
echo.
echo  Close After Effects before continuing.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause
