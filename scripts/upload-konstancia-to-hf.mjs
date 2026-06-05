#!/usr/bin/env node
/**
 * Upload trained Konstancia LoRA to Hugging Face Hub (private repo).
 *
 *   set HF_TOKEN=hf_...
 *   node scripts/upload-konstancia-to-hf.mjs your-username/konstancia-chat
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODEL = path.join(ROOT, 'ml', 'models', 'konstancia-chat');
const repo = process.argv[2];

if (!repo || !repo.includes('/')) {
  console.error('Usage: node scripts/upload-konstancia-to-hf.mjs <user/repo-name>');
  process.exit(1);
}
if (!fs.existsSync(MODEL)) {
  console.error(`Model not found: ${MODEL}\nRun: npm run ml:train:chat`);
  process.exit(1);
}
if (!process.env.HF_TOKEN) {
  console.error('Set HF_TOKEN (Hugging Face write token)');
  process.exit(1);
}

const py = process.env.SHKF_PYTHON || 'python';
const script = `
from huggingface_hub import HfApi
api = HfApi()
api.create_repo("${repo}", private=True, exist_ok=True)
api.upload_folder(folder_path=r"${MODEL.replace(/\\/g, '/')}", repo_id="${repo}", repo_type="model")
print("Uploaded to https://huggingface.co/${repo}")
`;
const r = spawnSync(py, ['-c', script], { stdio: 'inherit', cwd: ROOT, env: process.env });
process.exit(r.status ?? 1);
