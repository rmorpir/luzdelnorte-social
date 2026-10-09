// Servidor local / Docker (sin dependencias). En Netlify no se usa: allí funcionan
// netlify/functions/api.mjs y netlify/functions/tick.mjs con el mismo código de lib/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../lib/app.mjs';
import { tick } from '../lib/scheduler.mjs';
import { fsContext } from '../lib/fs-adapter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function loadEnvFile(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const mt = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (mt && process.env[mt[1]] === undefined) process.env[mt[1]] = mt[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* sin .env */ }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ico': 'image/x-icon'
};

export function createServer({ env, dataDir }) {
  const store = fsContext(dataDir);
  const ctxFor = (ip) => ({ ...store, env, ip });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (/^\/(api|auth|p|m)\//.test(url.pathname)) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        if (body && body.length > 30 * 1024 * 1024) { res.writeHead(413); return res.end(); }
        const request = new Request(env.PUBLIC_URL + req.url, {
          method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
        });
        const response = await handle(request, ctxFor(req.socket.remoteAddress));
        const headers = Object.fromEntries(response.headers);
        const setCookie = response.headers.getSetCookie?.();
        if (setCookie?.length) headers['set-cookie'] = setCookie;
        res.writeHead(response.status, headers);
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/index.html';
      const file = path.normalize(path.join(PUBLIC_DIR, rel));
      if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('No encontrado'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) { res.writeHead(500); res.end('Error interno'); }
    }
  });
  return { server, ctx: ctxFor('local') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnvFile(path.join(ROOT, '.env'));
  const PORT = Number(process.env.PORT || 3000);
  const env = { ...process.env };
  env.PUBLIC_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
  if (!env.APP_PASSWORD) {
    if (env.PUBLIC_URL.startsWith('https://')) { console.error('Falta APP_PASSWORD.'); process.exit(1); }
    env.APP_PASSWORD = 'luzdelnorte';
    console.warn('[aviso] APP_PASSWORD no definida: usando "luzdelnorte" (solo para pruebas en local).');
  }
  const { server, ctx } = createServer({ env, dataDir: env.DATA_DIR || path.join(ROOT, 'data') });
  server.listen(PORT, () => {
    console.log(`Luz del Norte · Redes → ${env.PUBLIC_URL}`);
    const t = () => tick(ctx, { budgetMs: 40000 }).catch((e) => console.error('[tick]', e));
    setTimeout(t, 2000);
    setInterval(t, 60 * 1000);
  });
}
