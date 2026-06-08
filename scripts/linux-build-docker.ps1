# Сборка Linux AppImage/deb через Docker на Windows.
# Требуется Docker Desktop.
#   .\scripts\linux-build-docker.ps1
#   .\scripts\linux-build-docker.ps1 -Target appimage

param(
  [ValidateSet('all', 'appimage', 'deb')]
  [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Write-BuildLog([string]$Message) {
  Write-Host "[linux-build-docker] $Message"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker не найден. Установите Docker Desktop или соберите на Linux: ./scripts/linux-build.sh"
}

$linuxTarget = switch ($Target) {
  'appimage' { 'AppImage' }
  'deb' { 'deb' }
  default { 'AppImage deb' }
}

$projectName = Split-Path -Leaf $Root
$nodeModulesVolume = "${projectName}-node-modules"

Write-BuildLog "Проект: $Root"
Write-BuildLog "Цель: $linuxTarget"

$bashCommand = "set -e; npm ci --ignore-scripts; npx electron-builder install-app-deps; npx electron-builder --linux $linuxTarget --publish never; ls -lh release/*.AppImage release/*.deb 2>/dev/null || ls -lh release/"

docker run --rm `
  -v "${Root}:/project" `
  -v "${nodeModulesVolume}:/project/node_modules" `
  -w /project `
  electronuserland/builder `
  /bin/bash -lc "$bashCommand"

Write-BuildLog "Готово. Файлы в release/"
