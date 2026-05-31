import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export function getFigmaPath() {
  const local = process.env.LOCALAPPDATA;
  if (!local) return null;

  const candidates = [
    join(local, 'Figma', 'Figma.exe'),
    join(local, 'Programs', 'Figma', 'Figma.exe'),
  ];

  const figmaDir = join(local, 'Figma');
  if (existsSync(figmaDir)) {
    try {
      const apps = readdirSync(figmaDir)
        .filter((d) => d.startsWith('app-'))
        .sort()
        .reverse();
      for (const app of apps) {
        candidates.push(join(figmaDir, app, 'Figma.exe'));
      }
    } catch {
      /* ignore */
    }
  }

  return candidates.find((p) => existsSync(p)) || null;
}

export async function isFigmaProcessRunning() {
  const ps = `(Get-Process -Name "Figma" -ErrorAction SilentlyContinue | Measure-Object).Count`;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  });
  return parseInt(stdout.trim(), 10) > 0;
}

export async function killFigmaProcesses() {
  const ps = `
    Get-Process -Name "Figma" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "figma_agent" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  `;
  await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true });
  await new Promise((r) => setTimeout(r, 1500));
}

export async function isFigmaDebugRunning(port = 9222) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function launchFigmaWithDebug(port = 9222) {
  const figmaPath = getFigmaPath();
  if (!figmaPath) {
    throw new Error('Figma Desktop не найдена. Установите Figma для Windows.');
  }

  if (await isFigmaDebugRunning(port)) {
    return { launched: false, restarted: false, message: 'Figma уже подключена (CDP активен)' };
  }

  const wasRunning = await isFigmaProcessRunning();
  if (wasRunning) {
    await killFigmaProcesses();
  }

  const child = spawn(figmaPath, [`--remote-debugging-port=${port}`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env },
  });
  child.unref();

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isFigmaDebugRunning(port)) {
      return {
        launched: true,
        restarted: wasRunning,
        message: wasRunning
          ? 'Figma перезапущена с прямым подключением'
          : 'Figma запущена — прямое подключение активно',
      };
    }
  }

  throw new Error(
    'CDP-порт не открылся. Попробуйте: 1) закройте Figma вручную через диспетчер задач 2) нажмите кнопку снова.'
  );
}

export async function focusFigmaWindow() {
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      }
"@
    $p = Get-Process | Where-Object { $_.MainWindowTitle -match 'Figma' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($p) {
      [Win32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
      [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
      'ok'
    } else { 'notfound' }
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  });
  if (stdout.trim() === 'notfound') {
    throw new Error('Окно Figma не найдено. Откройте файл в Figma Desktop.');
  }
}

const VK = {
  SHIFT: 0x10,
  CTRL: 0x11,
  ALT: 0x12,
  ENTER: 0x0d,
  A: 0x41,
  X: 0x58,
};

async function keyEvent(vk, flags = 0) {
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Input {
        [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
      }
"@
    [Input]::keybd_event([byte]${vk}, 0, ${flags}, [UIntPtr]::Zero)
  `;
  await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true });
}

export async function sendKeysToFigma(keys) {
  await focusFigmaWindow();
  await new Promise((r) => setTimeout(r, 80));
  for (const k of keys) {
    const vk = VK[k] || VK[k.toUpperCase()];
    if (vk) await keyEvent(vk, 0);
  }
  await new Promise((r) => setTimeout(r, 50));
  for (const k of [...keys].reverse()) {
    const vk = VK[k] || VK[k.toUpperCase()];
    if (vk) await keyEvent(vk, 2);
  }
}
