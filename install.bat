@echo off
setlocal
cd /d "%~dp0"
title Bezify installer
echo.
echo  Bezify installer
echo  ----------------
if not exist "%~dp0Bezify\CSXS\manifest.xml" (
  echo.
  echo  Could not find the Bezify folder next to this file.
  echo  Please right-click the zip, choose "Extract All", and run install.bat
  echo  from the extracted folder.
  echo.
  pause
  exit /b 1
)
echo.
echo  Close After Effects before continuing.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
