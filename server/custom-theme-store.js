import { existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { pathToFileURL } from 'url';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);

export class CustomThemeStore {
  constructor(assetsDir) {
    this.assetsDir = assetsDir;
    mkdirSync(this.assetsDir, { recursive: true });
  }

  themeDir(themeId) {
    return join(this.assetsDir, themeId);
  }

  assetPath(themeId, filename) {
    if (!filename) return null;
    const safe = basename(filename);
    const p = join(this.themeDir(themeId), safe);
    return existsSync(p) ? p : null;
  }

  mediaUrl(themeId, filename) {
    const p = this.assetPath(themeId, filename);
    return p ? pathToFileURL(p).href : null;
  }

  detectMediaType(filePath) {
    const ext = extname(filePath).toLowerCase();
    if (VIDEO_EXT.has(ext)) return 'video';
    if (IMAGE_EXT.has(ext)) return 'image';
    return null;
  }

  copyMedia(themeId, sourcePath, role = 'sidebar') {
    const ext = extname(sourcePath).toLowerCase();
    const type = this.detectMediaType(sourcePath);
    if (!type) throw new Error('Поддерживаются PNG, JPG, GIF, WebP, MP4, WebM, MOV');

    const dir = this.themeDir(themeId);
    mkdirSync(dir, { recursive: true });

    const filename = role === 'poster'
      ? `poster${ext}`
      : `sidebar${ext}`;
    copyFileSync(sourcePath, join(dir, filename));
    return { filename, type: role === 'poster' ? 'poster' : type };
  }

  deleteTheme(themeId) {
    const dir = this.themeDir(themeId);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  listAssets(themeId) {
    const dir = this.themeDir(themeId);
    if (!existsSync(dir)) return [];
    return readdirSync(dir);
  }
}
