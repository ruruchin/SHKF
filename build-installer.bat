@echo off
title Build SHKF Installer
cd /d "%~dp0"
set CSC_IDENTITY_AUTO_DISCOVERY=false
echo.
call npm install
if errorlevel 1 goto fail
echo.
call npm run build
if errorlevel 1 goto fail
echo.
echo ========================================
echo  Done! Send to another person:
echo  release\SHKF-Setup-1.1.0.exe
echo  (or release-build-*\ if release was locked)
echo ========================================
pause
exit /b 0

:fail
echo.
echo Build failed.
pause
exit /b 1
