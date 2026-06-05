import { FigmaMcpClient } from './figma-mcp-client.mjs';
import { REVOLUT_FIGMA_USE_SCRIPT } from './build-revolut-screens-use-figma.mjs';

const client = new FigmaMcpClient(3845);
const init = await client.init();
console.log('server:', init?.serverInfo?.name);

const tools = await client.listTools();
console.log('tools:', tools.map((t) => t.name).join(', '));

if (!tools.some((t) => t.name === 'use_figma')) {
  console.error('use_figma недоступен на Desktop MCP (только read-tools). Нужен remote figma MCP или SHKF Bridge.');
  process.exit(1);
}

const out = await client.callTool('use_figma', {
  code: REVOLUT_FIGMA_USE_SCRIPT,
  skillNames: 'figma-use,figma-generate-design',
});
console.log(JSON.stringify(out, null, 2));
