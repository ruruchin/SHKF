#!/usr/bin/env bash
# Сборка Linux-установщика SHKF (AppImage + deb).
# Запуск на Linux:
#   ./scripts/linux-build.sh
#   ./scripts/linux-build.sh appimage   # только AppImage
#   ./scripts/linux-build.sh deb        # только .deb

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-all}"

log() { echo "[linux-build] $*"; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Не найдено: $1" >&2
    exit 1
  fi
}

install_build_deps() {
  if ! command -v apt-get >/dev/null 2>&1; then
    log "Для deb/AppImage на Fedora: dnf install rpm-build fakeroot"
    return 0
  fi
  log "Системные пакеты для сборки (sudo)…"
  sudo apt-get update -qq
  sudo apt-get install -y \
    libarchive-tools rpm fakeroot dpkg \
    libgtk-3-0t64 libnss3 libxss1t64 libasound2t64 libatspi2.0-0t64 libnotify4t64 libxtst6t64 \
    || sudo apt-get install -y \
    libarchive-tools rpm fakeroot dpkg \
    libgtk-3-0 libnss3 libxss1 libasound2 libatspi2.0-0 libnotify4 libxtst6
}

need_cmd node
need_cmd npm

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Нужен Node.js 20+ (сейчас $(node -v))." >&2
  exit 1
fi

install_build_deps

log "npm ci --ignore-scripts"
npm ci --ignore-scripts

log "electron-builder install-app-deps"
npx electron-builder install-app-deps

pick_target() {
  case "$TARGET" in
    appimage) echo "AppImage" ;;
    deb) echo "deb" ;;
    all) echo "AppImage deb" ;;
    -h|--help)
      cat <<'EOF'
Сборка SHKF для Linux

  ./scripts/linux-build.sh            AppImage + deb
  ./scripts/linux-build.sh appimage только AppImage (двойной клик, без установки)
  ./scripts/linux-build.sh deb        пакет для apt/dpkg

Результат: release/SHKF-<version>-x86_64.AppImage
           release/SHKF-<version>-amd64.deb
EOF
      exit 0
      ;;
    *)
      echo "Неизвестная цель: $TARGET (appimage | deb | all)" >&2
      exit 1
      ;;
  esac
}

LINUX_TARGETS="$(pick_target)"
log "electron-builder --linux $LINUX_TARGETS"
npx electron-builder --linux $LINUX_TARGETS --publish never

log "Готово. Смотрите release/:"
ls -lh release/*.AppImage release/*.deb 2>/dev/null || ls -lh release/
