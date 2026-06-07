#!/usr/bin/env bash
# SHKF — запуск на Linux из исходников.
# Использование:
#   ./scripts/linux-start.sh
#   ./scripts/linux-start.sh --install-deps   # поставить системные пакеты (Ubuntu/Debian)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INSTALL_DEPS=false
for arg in "$@"; do
  case "$arg" in
    --install-deps) INSTALL_DEPS=true ;;
    -h|--help)
      cat <<'EOF'
SHKF на Linux

  ./scripts/linux-start.sh              установить npm-зависимости и запустить
  ./scripts/linux-start.sh --install-deps   + системные пакеты (apt)

Работает: UI, вход, Live2D (встроенная модель), Kanban, агент, Figma-плагин.
Только Windows: глобальные хоткеи (Wayland), desktop agent, Яндекс Музыка, голос.
EOF
      exit 0
      ;;
    *)
      echo "Неизвестный аргумент: $arg (см. --help)" >&2
      exit 1
      ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Не найдено: $1" >&2
    exit 1
  fi
}

install_apt_deps() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "apt-get не найден. На Fedora/RHEL: dnf install gtk3 libnotify nss libXScrnSaver libXtst at-spi2-atk alsa-lib" >&2
    exit 1
  fi
  echo "[linux] Системные пакеты для Electron (sudo)…"
  sudo apt-get update -qq
  sudo apt-get install -y \
    libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils \
    libatspi2.0-0 libdrm2 libgbm1 libasound2 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libxkbcommon0 \
    ca-certificates curl git
}

need_cmd node
need_cmd npm

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Нужен Node.js 20+ (сейчас $(node -v)). Рекомендуется 22 LTS." >&2
  exit 1
fi

if [ "$INSTALL_DEPS" = true ]; then
  install_apt_deps
fi

if [ ! -d node_modules ]; then
  echo "[linux] npm install…"
  npm install
else
  echo "[linux] Зависимости уже есть (node_modules/). Пропуск npm install."
  echo "[linux] Для чистой установки: rm -rf node_modules && ./scripts/linux-start.sh"
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  echo "[linux] Скопируйте .env.example → .env и заполните ключи при необходимости."
fi

echo "[linux] Запуск SHKF…"
exec npm start
