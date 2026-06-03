import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrowserWindow } from 'electron';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';

const OAUTH_DISCOVERY = 'https://auth.magnific.com/realms/mcp/.well-known/openid-configuration';
const REGISTRATION_ENDPOINT = 'https://auth.magnific.com/realms/mcp/clients-registrations/openid-connect';
const MCP_URL = 'https://mcp.magnific.com';
const MAGNIFIC_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SHKF/1.0',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
};

function isAccessDeniedError(raw) {
  return (
    /<html[\s\S]*access denied/i.test(raw) ||
    /you don't have permission to access/i.test(raw) ||
    /\b403\b/.test(raw)
  );
}

function isAuthError(raw) {
  return /\b401\b/.test(raw) || /unauthenticated/i.test(raw) || /invalid.*token/i.test(raw);
}

function sanitizeMagnificError(err) {
  const raw = String(err?.message || err || '');
  if (isAccessDeniedError(raw)) {
    return 'Magnific не принял запрос (Access Denied). Обычно помогает: нажмите «Выйти и войти снова», завершите вход в окне Magnific до конца, отключите VPN или попробуйте другую сеть.';
  }
  if (isAuthError(raw)) {
    return 'Сессия Magnific истекла или вы ещё не вошли. Нажмите «Войти в Magnific» и пройдите вход в браузере до сообщения «Success».';
  }
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600) || 'Ошибка Magnific MCP';
}

function httpsJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export class MagnificMcpService {
  constructor(appService) {
    this.appService = appService;
    this.client = null;
    this.transport = null;
    this.oauthConfig = null;
    this.isConnected = false;
    this.lastConnectError = '';
  }

  async getOAuthConfig() {
    if (this.oauthConfig) return this.oauthConfig;
    const res = await httpsJson(OAUTH_DISCOVERY);
    if (res.status !== 200) throw new Error('Failed to fetch OAuth config');
    this.oauthConfig = res.json;
    return this.oauthConfig;
  }

  async getClientId() {
    let settings = this.appService.config.settings?.magnific || {};
    if (settings.clientId) return settings.clientId;

    const data = JSON.stringify({
      client_name: 'SHKF App',
      redirect_uris: ['http://localhost:34567/callback'],
      token_endpoint_auth_method: 'none'
    });

    const res = await httpsJson(REGISTRATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json'
      },
      body: data
    });

    if (res.status !== 201 || !res.json.client_id) {
      throw new Error('Failed to register client');
    }

    this.appService.updateAppSettings({ magnific: { ...settings, clientId: res.json.client_id } });
    return res.json.client_id;
  }

  async authenticate() {
    const config = await this.getOAuthConfig();
    const clientId = await this.getClientId();
    const { codeVerifier, codeChallenge } = generatePKCE();
    const redirectUri = 'http://localhost:34567/callback';

    return new Promise((resolve, reject) => {
      let settled = false;
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Готово! Можно закрыть это окно.</h1><p>Вернитесь в приложение — Magnific подключится автоматически.</p><script>window.close()</script>');
            server.close();
            
            try {
              const tokenData = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                code: code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
              }).toString();

              const tokenRes = await httpsJson(config.token_endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': Buffer.byteLength(tokenData)
                },
                body: tokenData
              });

              if (tokenRes.status !== 200 || !tokenRes.json.access_token) {
                reject(new Error('Failed to exchange token'));
              } else {
                let settings = this.appService.config.settings?.magnific || {};
                this.appService.updateAppSettings({ 
                  magnific: { 
                    ...settings,
                    accessToken: tokenRes.json.access_token,
                    refreshToken: tokenRes.json.refresh_token
                  }
                });
                settled = true;
                resolve(tokenRes.json.access_token);
              }
            } catch (e) {
              reject(e);
            }
          } else {
            res.writeHead(400);
            res.end('No code provided');
            server.close();
            reject(new Error('No code provided'));
          }
        }
      });

      server.listen(34567, () => {
        const authUrl = new URL(config.authorization_endpoint);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid profile email mcp:custom-audience offline_access');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        const win = new BrowserWindow({ width: 800, height: 600, webPreferences: { nodeIntegration: false } });
        win.loadURL(authUrl.toString());
        win.on('closed', () => {
          server.close();
          if (!settled) reject(new Error('Auth window closed'));
        });
      });
    });
  }

  hasSavedLogin() {
    return Boolean(this.appService.config.settings?.magnific?.accessToken);
  }

  clearSession() {
    const settings = this.appService.config.settings?.magnific || {};
    const { clientId } = settings;
    this.appService.updateAppSettings({
      magnific: clientId ? { clientId } : {},
    });
    this.disconnect();
  }

  disconnect() {
    this.isConnected = false;
    this.client = null;
    this.transport = null;
  }

  async refreshAccessToken() {
    const settings = this.appService.config.settings?.magnific || {};
    if (!settings.refreshToken) return null;

    const config = await this.getOAuthConfig();
    const clientId = await this.getClientId();
    const tokenData = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: settings.refreshToken,
    }).toString();

    const tokenRes = await httpsJson(config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData),
      },
      body: tokenData,
    });

    if (tokenRes.status !== 200 || !tokenRes.json?.access_token) {
      return null;
    }

    this.appService.updateAppSettings({
      magnific: {
        ...settings,
        accessToken: tokenRes.json.access_token,
        refreshToken: tokenRes.json.refresh_token || settings.refreshToken,
      },
    });
    return tokenRes.json.access_token;
  }

  async getValidToken({ forceLogin = false } = {}) {
    const settings = this.appService.config.settings?.magnific || {};
    if (!forceLogin && settings.accessToken) {
      return settings.accessToken;
    }
    return await this.authenticate();
  }

  async connectWithToken(token) {
    this.disconnect();

    this.transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: {
        headers: {
          ...MAGNIFIC_REQUEST_HEADERS,
          Authorization: `Bearer ${token}`,
        },
      },
    });

    this.client = new Client(
      {
        name: 'SHKF App',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    await this.client.connect(this.transport);
    this.isConnected = true;
    this.lastConnectError = '';
  }

  async connect({ forceLogin = false } = {}) {
    if (this.isConnected && !forceLogin) return;

    let lastErr = null;

    const tryOnce = async (token) => {
      try {
        await this.connectWithToken(token);
        return true;
      } catch (err) {
        lastErr = err;
        return false;
      }
    };

    const token = await this.getValidToken({ forceLogin });
    if (await tryOnce(token)) return;

    if (!forceLogin && this.hasSavedLogin()) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed && (await tryOnce(refreshed))) return;
    }

    const raw = String(lastErr?.message || lastErr || '');
    this.lastConnectError = sanitizeMagnificError(lastErr);

    if (isAuthError(raw)) {
      this.clearSession();
    } else {
      this.disconnect();
    }

    throw new Error(this.lastConnectError);
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      hasSavedLogin: this.hasSavedLogin(),
      lastConnectError: this.lastConnectError || '',
    };
  }

  async getTools() {
    try {
      if (!this.isConnected) await this.connect();
      return await this.client.listTools();
    } catch (err) {
      const msg = sanitizeMagnificError(err);
      if (isAccessDeniedError(String(err?.message || err)) || isAuthError(String(err?.message || err))) {
        this.clearSession();
      }
      throw new Error(msg);
    }
  }

  async callTool(name, args) {
    try {
      if (!this.isConnected) await this.connect();
      return await this.client.callTool({ name, arguments: args });
    } catch (err) {
      const msg = sanitizeMagnificError(err);
      if (isAccessDeniedError(String(err?.message || err)) || isAuthError(String(err?.message || err))) {
        this.clearSession();
      }
      throw new Error(msg);
    }
  }
}
