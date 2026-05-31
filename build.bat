@echo off
title Build FIRURU Portable
cd /d "%~dp0"
set CSC_IDENTITY_AUTO_DISCOVERY=false
echo.
call npm install
if errorlevel 1 goto fail
echo.
call npm run build:portable
if errorlevel 1 goto fail
echo.
echo ========================================
echo  Done! Check release\ or release-build-*\
echo  Portable: FIRURU-*-portable.exe
echo ========================================
pause
exit /b 0

:fail
echo.
echo Build failed.
pause
exit /b 1
