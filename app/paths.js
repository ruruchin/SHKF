import path from 'path';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { app } from 'electron';

export function getConfigPath(appDir) {
  if (app.isPackaged) {
    const userConfig = path.join(app.getPath('userData'), 'hotkeys.json');
    if (!existsSync(userConfig)) {
      const bundled = path.join(process.resourcesPath, 'config-default', 'hotkeys.json');
      const fallback = path.join(appDir, '..', 'config', 'hotkeys.json');
      const source = existsSync(bundled) ? bundled : fallback;
      if (existsSync(source)) {
        mkdirSync(path.dirname(userConfig), { recursive: true });
        copyFileSync(source, userConfig);
      }
    }
    return userConfig;
  }
  return path.join(appDir, '..', 'config', 'hotkeys.json');
}

export function getPluginPath(appDir) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'figma-plugin');
  }
  return path.join(appDir, '..', 'figma-plugin');
}

export function getUserLibraryPaths(appDir) {
  const base = app.isPackaged
    ? app.getPath('userData')
    : path.join(appDir, '..', 'config');
  const libraryPath = path.join(base, 'user-library.json');
  const assetsDir = path.join(base, 'user-library-assets');
  return { libraryPath, assetsDir };
}

export function getCustomThemeAssetsDir(appDir) {
  const base = app.isPackaged
    ? app.getPath('userData')
    : path.join(appDir, '..', 'config');
  return path.join(base, 'custom-theme-assets');
}

export function getNotesLibraryPath(appDir) {
  const base = app.isPackaged
    ? app.getPath('userData')
    : path.join(appDir, '..', 'config');
  return path.join(base, 'notes-library.json');
}

export function getNanobananaGalleryPath(appDir) {
  const base = app.isPackaged
    ? app.getPath('userData')
    : path.join(appDir, '..', 'config');
  return path.join(base, 'nanobanana-gallery.json');
}

export function getBannerMockupsConfigPath(appDir) {
  if (app.isPackaged) {
    const userPath = path.join(app.getPath('userData'), 'banner-mockups.json');
    if (!existsSync(userPath)) {
      const bundled = path.join(process.resourcesPath, 'config-default', 'banner-mockups.json');
      const fallback = path.join(appDir, '..', 'config', 'banner-mockups.json');
      const source = existsSync(bundled) ? bundled : fallback;
      if (existsSync(source)) {
        mkdirSync(path.dirname(userPath), { recursive: true });
        copyFileSync(source, userPath);
      }
    }
    return userPath;
  }
  return path.join(appDir, '..', 'config', 'banner-mockups.json');
}
