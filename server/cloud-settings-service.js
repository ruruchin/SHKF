const CLOUD_SETTING_SECTIONS = new Set([
  'appearance',
  'hotkeys',
  'figma',
  'make',
  'templates',
  'window',
  'search',
  'advanced',
  'user',
]);

const LOCAL_ONLY_PATHS = new Set([
  'hotkeys.serverEnabled',
  'figma.autoConnectOnStart',
  'window.startServerOnLaunch',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function stripLocalOnly(settings = {}) {
  const safe = {};
  for (const section of CLOUD_SETTING_SECTIONS) {
    if (settings[section] && typeof settings[section] === 'object') {
      safe[section] = clone(settings[section]);
    }
  }

  for (const path of LOCAL_ONLY_PATHS) {
    const [section, key] = path.split('.');
    if (safe[section]) delete safe[section][key];
  }
  return safe;
}

export class CloudSettingsService {
  constructor(authService) {
    this.authService = authService;
  }

  async pull() {
    if (!this.authService?.session) return {};
    const data = await this.authService.fetchUserSettings();
    return data?.settings && typeof data.settings === 'object' ? data.settings : {};
  }

  async push(settings) {
    if (!this.authService?.session) return { ok: false, skipped: true };
    return this.authService.updateUserSettings(stripLocalOnly(settings));
  }

  toCloudSettings(settings) {
    return stripLocalOnly(settings);
  }
}
