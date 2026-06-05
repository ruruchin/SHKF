# SHKF

## Сборка EXE (Windows)

### Установщик — для отправки другому человеку

```bash
npm install
npm run build
```

Или **`build-installer.bat`**

Файл: **`release/SHKF-Setup-1.1.0.exe`**

### Portable — без установки

```bash
npm run build:portable
```

Или **`build.bat`**

Файл: **`release/SHKF-1.1.0-portable.exe`**

---

### Если сборка падает с «app.asar is used by another process»

1. Закрой **SHKF** (и portable exe из папки `out` / `release`)
2. Закрой **Проводник** в папке сборки
3. Запусти сборку снова — скрипт сам:
   - завершит процессы SHKF/Electron
   - попробует папки `release/` → `out/`
   - если обе заняты — соберёт в `release-build-<timestamp>/`

---

## Разработка

```bash
npm install
npm start
```

Настройки пользователя после установки: `%APPDATA%\SHKF\`
