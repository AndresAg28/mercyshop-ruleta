/**
 * API local para desarrollo.
 *
 * Ejecuta la MISMA función serverless de `api/room.ts` (la que corre en Vercel)
 * en un puerto local, para que `ng serve` pueda consumirla vía el proxy de
 * `proxy.conf.json`. Así `npm start` levanta front + API sin necesitar `vercel dev`.
 *
 *   npm run dev:api   → solo la API en http://localhost:8787
 *   npm start         → API + frontend juntos
 *
 * Si existen `.env.local` / `.env` con credenciales de Upstash se usa Redis;
 * si no, la función cae en un almacenamiento en memoria (solo local).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const entry = fileURLToPath(import.meta.url);
const here = dirname(entry);

// Node < 22.18 no entiende TypeScript sin flag: nos relanzamos con él.
if (!process.features.typescript) {
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', entry, ...process.argv.slice(2)],
    { stdio: 'inherit', env: process.env }
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
} else {
  main().catch(err => {
    console.error('[api] No se pudo iniciar:', err);
    process.exit(1);
  });
}

/** Lee un archivo .env simple (KEY=VALUE) sin pisar variables ya definidas. */
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*(#|\[|$)/.test(line)) continue;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Adaptador mínimo al API de VercelResponse que usa el handler. */
function toVercelResponse(res) {
  let code = 200;
  let done = false;
  const finish = (status, payload) => {
    if (done) return;
    done = true;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(payload);
  };
  return {
    setHeader(name, value) { res.setHeader(name, value); return this; },
    status(statusCode) { code = statusCode; return this; },
    json(obj) { finish(code, JSON.stringify(obj)); return this; },
    send(data) { finish(code, typeof data === 'string' ? data : JSON.stringify(data)); return this; },
    end() { if (!done) { done = true; res.end(); } },
    get finished() { return done; }
  };
}

async function main() {
  const root = join(here, '..');
  loadEnv(join(root, '.env.local'));
  loadEnv(join(root, '.env'));

  const { default: handler } = await import(pathToFileURL(join(root, 'api', 'room.ts')).href);

  const hasRedis =
    !!(process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
    !!(process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN);
  const port = Number(process.env.PORT) || 8787;

  const onRequest = async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const method = (req.method ?? 'GET').toUpperCase();
      const query = {};
      for (const [k, v] of url.searchParams) query[k] = v;

      let body;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        const raw = await readBody(req);
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            return toVercelResponse(res).status(400).json({ error: 'JSON inválido' });
          }
        }
      }

      const out = toVercelResponse(res);
      await handler({ method, query, body, headers: req.headers, url: req.url }, out);
      out.end();
    } catch (err) {
      console.error('[api] Error al atender la petición:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Error del servidor' }));
    }
  };

  const server = createServer((req, res) => onRequest(req, res));
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[api] El puerto ${port} ya está en uso. Cierra el proceso anterior o define PORT.`);
    } else {
      console.error('[api] Error:', err);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`[api] http://localhost:${port}/api/room · almacenamiento: ${hasRedis ? 'Upstash Redis' : 'memoria local (sin .env.local)'}`);
  });
}
