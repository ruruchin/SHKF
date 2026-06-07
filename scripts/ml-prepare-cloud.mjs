#!/usr/bin/env node
/**
 * Lightweight local prep for cloud training — NO model download, NO training.
 * Toucan import + GPU train happen on the cloud pod only.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MERGED = path.join(ROOT, 'ml', 'data', 'konstancia-chat.merged.jsonl');

console.log('Konstancia cloud prep (local CPU only — merges JSONL, no training)\n');

const exportChat = spawnSync('node', ['scripts/export-konstancia-chat-dataset.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (exportChat.status !== 0) process.exit(exportChat.status ?? 1);

const toucanFile = path.join(ROOT, 'ml', 'data', 'konstancia-toucan-sft.jsonl');
if (!fs.existsSync(toucanFile)) {
  console.log('\nNote: konstancia-toucan-sft.jsonl not found locally — cloud pod will import Toucan from HF.\n');
}

const lines = fs.existsSync(MERGED)
  ? fs.readFileSync(MERGED, 'utf8').split(/\r?\n/).filter((l) => l.trim()).length
  : 0;

console.log(`
Ready for cloud GPU training (${lines} dialogs in merged set).

On RunPod / Yandex Cloud (GPU pod with 24GB+ VRAM):

  git clone https://github.com/ruruchin/SHKF.git && cd SHKF/ml
  bash cloud_train.sh

Or with Docker:

  docker build -f ml/Dockerfile.train -t konstancia-train .
  docker run --gpus all \\
    -e HF_TOKEN=hf_... \\
    -e HF_UPLOAD_REPO=your-user/konstancia-chat \\
    konstancia-train

After training, in SHKF → Settings → Konstancia:
  Cloud URL: http://<pod-ip>:8080
  API key: (same as KONSTANCIA_API_KEY on the pod)

Yandex Cloud (подробно): ml/YANDEX_CLOUD_TRAIN.md
General: ml/CLOUD_TRAIN.md
`);
