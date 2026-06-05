import { PluginBridge } from '../server/plugin-bridge.js';

const bridge = new PluginBridge(3847);
await bridge.start();
console.log(`Plugin bridge listening on ws://127.0.0.1:${bridge.port}`);
process.on('SIGINT', () => {
  bridge.stop();
  process.exit(0);
});
