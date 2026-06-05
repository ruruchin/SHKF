import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { HotkeyService } from './hotkey-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'config', 'hotkeys.json');
const userLibraryPaths = {
  libraryPath: join(__dirname, '..', 'config', 'user-library.json'),
  assetsDir: join(__dirname, '..', 'config', 'user-library-assets'),
};
const customThemeAssetsDir = join(__dirname, '..', 'config', 'custom-theme-assets');
const notesLibraryPath = join(__dirname, '..', 'config', 'notes-library.json');
const service = new HotkeyService(configPath, userLibraryPaths, customThemeAssetsDir, notesLibraryPath);

service.on('log', (msg) => console.log('[SHKF]', msg));
service.start();

process.on('SIGINT', () => {
  service.shutdown();
  process.exit(0);
});
