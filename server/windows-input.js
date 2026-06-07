import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const VK = {
  SHIFT: 0x10,
  CTRL: 0x11,
  ALT: 0x12,
  ENTER: 0x0d,
  SPACE: 0x20,
  TAB: 0x09,
  ESCAPE: 0x1b,
  DOWN: 0x28,
  UP: 0x26,
  MEDIA_PLAY: 0xb0,
  MEDIA_PLAY_PAUSE: 0xb3,
  V: 0x56,
  L: 0x4c,
  F: 0x46,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

export async function pressKey(name) {
  const vk = VK[String(name || '').toUpperCase()];
  if (!vk) throw new Error(`Unknown key: ${name}`);
  await keyEvent(vk, 0);
  await sleep(30);
  await keyEvent(vk, 2);
}

export async function sendChord(keys = []) {
  const normalized = keys.map((k) => String(k || '').toUpperCase());
  for (const k of normalized) {
    const vk = VK[k];
    if (vk) await keyEvent(vk, 0);
  }
  await sleep(40);
  for (const k of [...normalized].reverse()) {
    const vk = VK[k];
    if (vk) await keyEvent(vk, 2);
  }
}

export async function setClipboardText(text) {
  const encoded = JSON.stringify(String(text ?? ''));
  await execFileAsync(
    'powershell',
    ['-NoProfile', '-Command', `Set-Clipboard -Value ${encoded}`],
    { windowsHide: true },
  );
}

function psSafe(value) {
  return String(value || '').replace(/'/g, "''");
}

function findWindowPs({ titlePattern = '', processPattern = '', pathPattern = '' } = {}) {
  const title = psSafe(titlePattern);
  const process = psSafe(processPattern);
  const path = psSafe(pathPattern);
  return `
    $titlePattern = '${title}'
    $processPattern = '${process}'
    $pathPattern = '${path}'
    $p = Get-Process -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } |
      Where-Object {
        ($titlePattern -and $_.MainWindowTitle -match $titlePattern) -or
        ($processPattern -and $_.ProcessName -match $processPattern) -or
        ($pathPattern -and $_.Path -and $_.Path -match $pathPattern)
      } |
      Sort-Object -Property @{ Expression = { $_.MainWindowTitle.Length }; Descending = $true } |
      Select-Object -First 1
  `;
}

export async function focusWindow({ titlePattern = '', processPattern = '', pathPattern = '' } = {}) {
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
      }
"@
    ${findWindowPs({ titlePattern, processPattern, pathPattern })}
    if ($p) {
      [Win32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
      [Win32]::AllowSetForegroundWindow($p.Id) | Out-Null
      [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
      'ok'
    } else { 'notfound' }
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  });
  return stdout.trim() === 'ok';
}

export async function focusWindowByTitle(pattern) {
  return focusWindow({ titlePattern: pattern, processPattern: pattern, pathPattern: pattern });
}

export async function isProcessRunning(namePattern) {
  const safe = String(namePattern || '').replace(/'/g, "''");
  const ps = `
    $p = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match '${safe}' }
    if ($p) { 'yes' } else { 'no' }
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  });
  return stdout.trim() === 'yes';
}

export async function pasteFromClipboard() {
  await sendChord(['CTRL', 'V']);
}

export async function maximizeWindow({ titlePattern = '', processPattern = '', pathPattern = '' } = {}) {
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
      }
"@
    ${findWindowPs({ titlePattern, processPattern, pathPattern })}
    if (-not $p) { 'notfound'; return }
    [Win32]::ShowWindow($p.MainWindowHandle, 3) | Out-Null
    [Win32]::AllowSetForegroundWindow($p.Id) | Out-Null
    [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    'ok'
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  });
  return stdout.trim() === 'ok';
}

export async function maximizeWindowByTitle(titlePattern) {
  return maximizeWindow({ titlePattern, processPattern: titlePattern, pathPattern: titlePattern });
}

export async function clickWindowRelative(
  pattern,
  xPercent = 0.5,
  yPercent = 0.12,
  { titlePattern = '', processPattern = '', pathPattern = '' } = {},
) {
  const x = Math.max(0, Math.min(1, Number(xPercent) || 0.5));
  const y = Math.max(0, Math.min(1, Number(yPercent) || 0.12));
  const title = psSafe(titlePattern || pattern);
  const process = psSafe(processPattern || pattern);
  const path = psSafe(pathPattern || 'YandexMusic');
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
        [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
        [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);
        public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        public const uint MOUSEEVENTF_LEFTUP = 0x0004;
      }
"@
    ${findWindowPs({ titlePattern: title, processPattern: process, pathPattern: path })}
    if (-not $p) { 'notfound'; return }
    [Win32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
    [Win32]::AllowSetForegroundWindow($p.Id) | Out-Null
    [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 180
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32Client {
        [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
        [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
        [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
        [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
      }
"@
    $client = New-Object Win32Client+RECT
    [Win32Client]::GetClientRect($p.MainWindowHandle, [ref]$client) | Out-Null
    $width = [Math]::Max(1, $client.Right - $client.Left)
    $height = [Math]::Max(1, $client.Bottom - $client.Top)
    $point = New-Object Win32Client+POINT
    $point.X = [int]($width * ${x})
    $point.Y = [int]($height * ${y})
    [Win32Client]::ClientToScreen($p.MainWindowHandle, [ref]$point) | Out-Null
    [Win32]::SetCursorPos($point.X, $point.Y) | Out-Null
    Start-Sleep -Milliseconds 80
    [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    'ok'
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  });
  return stdout.trim() === 'ok';
}

export async function playMediaSession(appPattern = 'Yandex|Music|Музык') {
  const safe = psSafe(appPattern);
  const ps = `
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
    })[0]
    Function Await($WinRtTask, $ResultType) {
      $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
      $netTask = $asTask.Invoke($null, @($WinRtTask))
      $netTask.Wait(-1) | Out-Null
      $netTask.Result
    }
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
    $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $pattern = '${safe}'
    foreach ($s in $mgr.GetSessions()) {
      if ($s.SourceAppUserModelId -match $pattern) {
        $null = Await ($s.TryPlayAsync()) ([bool])
        'ok'
        return
      }
    }
    'notfound'
  `;
  try {
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
      windowsHide: true,
      timeout: 15000,
    });
    return stdout.trim() === 'ok';
  } catch {
    return false;
  }
}

export { sleep };
