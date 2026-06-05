@echo off
title Sync SHKF plugin to install folder
cd /d "%~dp0"
set "SRC=%~dp0figma-plugin"
set "DEST=%USERPROFILE%\Downloads\SHKF\resources\figma-plugin"

if not exist "%SRC%\manifest.json" (
  echo figma-plugin folder not found.
  pause
  exit /b 1
)

if not exist "%DEST%" (
  echo Install folder not found: %DEST%
  echo Import from: %SRC%\manifest.json
  pause
  exit /b 0
)

copy /Y "%SRC%\code.js" "%DEST%\code.js" >nul
copy /Y "%SRC%\manifest.json" "%DEST%\manifest.json" >nul
copy /Y "%SRC%\ui.html" "%DEST%\ui.html" >nul
if exist "%DEST%\templates.js" del /F /Q "%DEST%\templates.js"

echo Synced plugin to:
echo   %DEST%
echo.
echo In Figma: Remove old plugin, Import manifest.json again.
pause
