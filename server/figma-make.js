import LZString from 'lz-string';
import { spawn } from 'child_process';
import { getFigmaPath, focusFigmaWindow } from './figma-launcher.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function buildMakeUrl(prompt) {
  const text = prompt?.trim();
  if (!text) throw new Error('Введите промпт');
  if (text.length > 50000) throw new Error('Промпт слишком длинный (макс. 50 000 символов)');
  const compressed = LZString.compressToEncodedURIComponent(text);
  return `https://www.figma.com/make/new#prompt=${compressed}`;
}

export async function openMakeUrl(url) {
  const figmaPath = getFigmaPath();
  if (figmaPath) {
    spawn(figmaPath, [url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env },
    }).unref();
    return 'figma-desktop';
  }
  return 'external';
}

export async function sendMakePrompt(prompt, figmaCdp, openExternal, options = {}) {
  const {
    makeAutoSubmit = true,
    preferDesktopApp = true,
    makeAutoFocus = true,
  } = options;

  const url = buildMakeUrl(prompt);
  const via = preferDesktopApp ? await openMakeUrl(url) : 'external';

  if (via === 'external') {
    await openExternal(url);
  }

  if (!makeAutoSubmit) {
    return {
      success: true,
      url,
      submitted: false,
      message: 'Figma Make открыта — нажмите Submit вручную',
    };
  }

  await sleep(5500);

  if (makeAutoFocus) {
    try {
      await focusFigmaWindow();
    } catch {
      /* Figma may still be loading */
    }
  }

  await sleep(800);
  const submit = await figmaCdp.submitMakePrompt();

  if (submit.ok) {
    return {
      success: true,
      url,
      submitted: true,
      message: 'Figma Make открыта — генерация запущена',
    };
  }

  return {
    success: true,
    url,
    submitted: false,
    message:
      submit.reason === 'no-make-page'
        ? 'Figma Make открывается… Промпт уже в URL — дождитесь загрузки и нажмите Submit'
        : 'Figma Make открыта с вашим промптом — нажмите Submit для генерации',
  };
}
