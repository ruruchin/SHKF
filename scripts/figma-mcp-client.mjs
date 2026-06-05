import http from 'http';

export class FigmaMcpClient {
  constructor(port = 3845) {
    this.port = port;
    this.sessionId = null;
  }

  request(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(data),
      };
      if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

      const req = http.request(
        { hostname: '127.0.0.1', port: this.port, path: '/mcp', method: 'POST', headers },
        (res) => {
          const sid = res.headers['mcp-session-id'];
          if (sid) this.sessionId = sid;
          let buf = '';
          res.on('data', (c) => { buf += c; });
          res.on('end', () => resolve({ status: res.statusCode, buf }));
        },
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  parseSse(raw) {
    const out = [];
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try {
        out.push(JSON.parse(line.slice(5).trim()));
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  async init() {
    const res = await this.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'SHKF-mcp-client', version: '1.0.0' },
      },
    });
    const msgs = this.parseSse(res.buf);
    await this.request({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    return msgs.find((m) => m.result)?.result;
  }

  async listTools() {
    const res = await this.request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const msgs = this.parseSse(res.buf);
    return msgs.find((m) => m.result?.tools)?.result?.tools || [];
  }

  async callTool(name, args) {
    const res = await this.request({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name, arguments: args },
    });
    const msgs = this.parseSse(res.buf);
    return msgs.find((m) => m.result || m.error) || { error: { message: `HTTP ${res.status}` } };
  }
}
