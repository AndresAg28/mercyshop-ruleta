/**
 * `npm start` → levanta la API local y el frontend de Angular en paralelo.
 * Si uno muere, se apaga el otro (Ctrl+C detiene a los dos).
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const procs = [];
let stopping = false;

function run(name, command, args) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  procs.push({ name, child });
  child.on('exit', (code, signal) => {
    console.log(`\n[dev] ${name} terminó (${signal ?? code ?? 0}).`);
    stop(code ?? (signal ? 1 : 0));
  });
  child.on('error', err => {
    console.error(`[dev] No se pudo iniciar ${name}:`, err.message);
    stop(1);
  });
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const { child } of procs) {
    if (child.exitCode !== null || child.killed) continue;
    if (isWin) {
      // En Windows mata el árbol completo (incluido el hijo de la API).
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 300);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));

const ngBin = join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
run('front', process.execPath, [ngBin, 'serve']);
run('api', process.execPath, [join(root, 'scripts', 'dev-api.mjs')]);
