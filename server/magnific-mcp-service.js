import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import EventSource from 'eventsource';
global.EventSource = EventSource;
import { BrowserWindow } from 'electron';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';

const OAUTH_DISCOVERY = 'https://auth.magnific.com/realms/mcp/.well-known/openid-configuration';
const REGISTRATION_ENDPOINT = 'https://auth.magnific.com/realms/mcp/clients-registrations/openid-connect';
const MCP_URL = 'https://mcp.magnific.com';

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
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Success! You can close this window.</h1><script>window.close()</script>');
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
        authUrl.searchParams.set('scope', 'openid profile email offline_access');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        const win = new BrowserWindow({ width: 800, height: 600, webPreferences: { nodeIntegration: false } });
        win.loadURL(authUrl.toString());
        win.on('closed', () => {
          server.close();
          reject(new Error('Auth window closed'));
        });
      });
    });
  }

  async getValidToken() {
    let settings = this.appService.config.settings?.magnific || {};
    if (settings.accessToken) {
      // TODO: Implement refresh token logic if needed
      return settings.accessToken;
    }
    return await this.authenticate();
  }

  async connect() {
    if (this.isConnected) return;
    
    const token = await this.getValidToken();
    
    this.transport = new SSEClientTransport(new URL(MCP_URL), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    this.client = new Client({
      name: "SHKF App",
      version: "1.0.0"
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  async getTools() {
    if (!this.isConnected) await this.connect();
    return await this.client.listTools();
  }

  async callTool(name, args) {
    if (!this.isConnected) await this.connect();
    return await this.client.callTool({ name, arguments: args });
  }
}
