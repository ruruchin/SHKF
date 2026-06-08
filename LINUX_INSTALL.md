# SHKF на Linux — установка

Готовые пакеты собираются в **AppImage** (без установки) и **.deb** (через менеджер пакетов).

## Скачать установщик

### Вариант A — GitHub Actions (с Windows, без Linux)

1. Запушьте ветку с файлами `.github/workflows/linux-build.yml` и `package.json` (или откройте workflow в уже запушенном репозитории).
2. На GitHub: **Actions → Build Linux installer → Run workflow**.
3. После сборки (~10–15 мин) скачайте артефакты **shkf-linux-appimage** и/или **shkf-linux-deb**.

### Вариант B — сборка на Linux

```bash
./scripts/linux-build.sh           # AppImage + deb
./scripts/linux-build.sh appimage    # только AppImage
./scripts/linux-build.sh deb         # только .deb
```

Файлы появятся в `release/`.

### Вариант C — Docker на Windows

```powershell
npm run build:linux:docker
# или только AppImage:
.\scripts\linux-build-docker.ps1 -Target appimage
```

---

## Установка AppImage (рекомендуется)

1. Скачайте `SHKF-<версия>-x86_64.AppImage`.
2. Сделайте файл исполняемым (один раз):
   ```bash
   chmod +x SHKF-*-x86_64.AppImage
   ```
3. Запустите двойным щелчком или из терминала:
   ```bash
   ./SHKF-*-x86_64.AppImage
   ```

При первом запуске можно интегрировать в меню приложений — AppImageLauncher или встроенный диалог AppImage сделает это автоматически.

---

## Установка .deb (Ubuntu / Debian)

```bash
sudo dpkg -i SHKF-*-amd64.deb
sudo apt-get install -f   # если не хватает зависимостей
```

После установки SHKF появится в меню приложений. Запуск из терминала: `shkf`.

Удаление:

```bash
sudo apt remove shkf
```

---

## Live2D (модель Konstancia на экране входа)

Если видите «обрезанный» персонаж или пустой блок вместо модели:

1. Обновитесь до **v1.2.27+** (на Linux текстуры грузятся через локальный HTTP, не через custom protocol).
2. Запустите из терминала и проверьте строки `[auth-live2d]` / `[live2d]`:
   ```bash
   shkf
   # или для AppImage:
   ./SHKF-*-x86_64.AppImage
   ```
3. При проблемах с WebGL:
   ```bash
   shkf --disable-gpu-sandbox
   ```

---

## Konstancia (Yandex Cloud) — один ключ на всю команду

Konstancia работает через **Yandex Cloud API**. Ключ **не показывается в настройках приложения** и **не лежит в git**.

### Обычные пользователи

Скачайте **официальный релиз** с GitHub (v1.2.33+). Ключ Konstancia **уже встроен в установщик** — ничего настраивать на каждом ПК не нужно.

### Администратор / сборка релиза

1. GitHub → репозиторий **SHKF** → **Settings → Secrets and variables → Actions**
2. Добавьте секреты (минимум для Konstancia):
   - `KONSTANCIA_YANDEX_API_KEY` — ключ Yandex Cloud (Api-Key)
   - `KONSTANCIA_YANDEX_FOLDER_ID` — необязательно (folder подставится сам)
3. Запушьте тег `v*.*.*` — CI соберёт установщик с ключом внутри (`org-secrets.json`, только main process).

Локальная сборка с тем же ключом:

```bash
export KONSTANCIA_YANDEX_API_KEY=AQVNxxxxxxxx
npm run secrets:org
npm run build          # Windows
# или ./scripts/linux-build.sh
```

### Override на одном ПК (редко)

Файл `%APPDATA%\SHKF\.env` (Windows) или `~/.config/SHKF/.env` (Linux) **перекрывает** встроенный ключ — только для отладки администратора.

Проверка API из исходников:

```bash
node scripts/probe-yandex-deepseek.mjs
```

---

## Ограничения на Linux

| Функция | Статус |
|--------|--------|
| UI, агент, Kanban, Live2D | Работает |
| Глобальные хоткеи Figma | В основном Windows |
| Desktop agent, Яндекс Музыка | Windows |
| Голосовой ввод | Зависит от окружения |

Для разработки из исходников (без установщика): `npm run linux`.
