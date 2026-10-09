// API de la app como manejador Web estándar (Request → Response).
// Funciona igual en Netlify Functions y en el servidor local (server/local.mjs).
import crypto from 'node:crypto';
import * as captions from './captions.mjs';
import * as meta from './meta.mjs';
import * as sch from './scheduler.mjs';
import { withState, readState, readonly, newId, logEvent } from './state.mjs';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const json = (status, obj, headers = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});
const fail = (status, message) => json(status, { error: message });
const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const httpError = (status, msg) => { throw new HttpError(status, msg); };

// ---------- sesión ----------
function parseCookies(h) {
  return Object.fromEntries((h || '').split(';').map((p) => p.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
const sign = (secret, v) => crypto.createHmac('sha256', secret).update(v).digest('base64url');
function makeSession(secret) {
  const exp = String(Date.now() + 365 * 24 * 3600 * 1000);
  return `${exp}.${sign(secret, exp)}`;
}
function validSession(req, secret) {
  const c = parseCookies(req.headers.get('cookie')).ldn_s;
  if (!c) return false;
  const [exp, sig] = c.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(secret, exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const sessionCookie = (env, value, maxAge) =>
  `ldn_s=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${env.PUBLIC_URL.startsWith('https://') ? '; Secure' : ''}`;

const attempts = new Map();
function tooMany(ip) {
  const t = Date.now();
  const a = (attempts.get(ip) || []).filter((x) => t - x < 15 * 60 * 1000);
  attempts.set(ip, a);
  return a.length >= 10;
}

// ---------- vistas ----------
function photoView(p) {
  if (!p) return null;
  return {
    id: p.id, motive: p.motive, lugar: p.lugar, nota: p.nota, status: p.status, order: p.order,
    width: p.width, height: p.height, createdAt: p.createdAt, thumb: `/m/${p.thumb}`, full: `/m/${p.file}`
  };
}
const postView = (db, post) => (post ? { ...post, photo: photoView(sch.photoOf(db, post)) } : null);

function stateView(db, env, secrets) {
  const t = sch.now(db);
  const counts = { new: 0, queued: 0, scheduled: 0, published: 0 };
  for (const p of db.photos) counts[p.status] = (counts[p.status] || 0) + 1;
  return {
    settings: db.settings, meta: meta.publicStatus(db, env), demo: sch.demoMode(env),
    vapidPublicKey: secrets.vapid.publicKey, pushDevices: db.pushSubscriptions.length, counts, now: t,
    today: postView(db, sch.postForDate(db, t.date)), motives: captions.motiveList(), graphVersion: meta.graphVersion(env)
  };
}

function decodeJpeg(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const buf = Buffer.from(dataUrl.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
  return buf.length > 100 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? buf : null;
}
const safeName = (n) => (/^[A-Za-z0-9_-]+(_t)?\.jpg$/.test(n) ? n : null);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function callbackPage(ok, message) {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conexión con Facebook</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1420;color:#f3ede2;font:16px/1.5 -apple-system,system-ui,sans-serif;padding:24px;box-sizing:border-box}
.c{max-width:420px;text-align:center}h1{font:600 26px/1.2 Georgia,serif;margin:16px 0 8px}p{color:#b9b2a5}img{width:110px}
a{display:inline-block;margin-top:20px;background:#e8b04b;color:#1a1408;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:600}
</style></head><body><div class="c"><img src="/brand/logo.png" alt=""><div style="font-size:36px">${ok ? '✅' : '⚠️'}</div>
<h1>${ok ? 'Cuenta conectada' : 'No se pudo conectar'}</h1><p>${message}</p>
<a href="/#/">Volver a la app</a><p style="font-size:13px;margin-top:18px">Si abriste esto desde la app del iPhone, ya puedes cerrar esta ventana y volver a ella.</p></div></body></html>`,
  { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function body(req) {
  const text = await req.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { httpError(400, 'JSON no válido'); }
}

// ---------- manejador principal ----------
export async function handle(req, ctx) {
  const env = ctx.env;
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;
  try {
    const secrets = await sch.ensureSecrets(ctx);

    // Imágenes públicas (Instagram/Facebook las descargan desde aquí). Nombres aleatorios no adivinables.
    let mm;
    if ((mm = p.match(/^\/p\/([^/]+)$/))) {
      const n = safeName(mm[1]);
      if (!n || n.includes('_t')) return new Response('No encontrado', { status: 404 });
      const bytes = await ctx.media.get(n);
      if (!bytes) return new Response('No encontrado', { status: 404 });
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
    }
    if ((mm = p.match(/^\/m\/([^/]+)$/))) {
      if (!validSession(req, secrets.session)) return new Response('Inicia sesión', { status: 401 });
      const n = safeName(mm[1]);
      const bytes = n && (await ctx.media.get(n));
      if (!bytes) return new Response('No encontrado', { status: 404 });
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=604800' } });
    }

    if (p === '/auth/meta/callback') {
      const q = Object.fromEntries(url.searchParams);
      try {
        if (q.error) throw new Error(q.error_description || 'Has cancelado la conexión con Facebook.');
        await withState(ctx, (db) => {
          if (!q.state || !db.oauthStates[q.state] || db.oauthStates[q.state] < Date.now()) {
            throw new Error('El enlace de conexión ha caducado. Vuelve a pulsar "Conectar" en la app.');
          }
          delete db.oauthStates[q.state];
        });
        const conn = await meta.exchange(env, q.code);
        const st = await withState(ctx, (db) => { meta.applyConnection(db, conn); return meta.publicStatus(db, env); });
        const msg = st.instagram
          ? `Conectado como ${escapeHtml(conn.userName)}. Publicaremos en la página «${escapeHtml(st.facebook.name)}» y en Instagram @${escapeHtml(st.instagram.username)}.`
          : `Conectado como ${escapeHtml(conn.userName)}, pero no encontramos ninguna cuenta de Instagram profesional vinculada a tus páginas. Revisa el paso 1 de la guía.`;
        return callbackPage(true, msg);
      } catch (e) {
        await withState(ctx, (db) => { db.meta.lastError = e.message; }).catch(() => {});
        return callbackPage(false, escapeHtml(e.message));
      }
    }

    if (!p.startsWith('/api/')) return new Response('No encontrado', { status: 404 });

    if (p === '/api/login' && m === 'POST') {
      const ip = ctx.ip || 'x';
      if (tooMany(ip)) return fail(429, 'Demasiados intentos. Espera 15 minutos.');
      const { password } = await body(req);
      const a = Buffer.from(String(password || ''));
      const b = Buffer.from(env.APP_PASSWORD || '');
      if (!env.APP_PASSWORD || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        attempts.get(ip).push(Date.now());
        return fail(401, env.APP_PASSWORD ? 'Contraseña incorrecta' : 'Falta configurar APP_PASSWORD en el servidor.');
      }
      return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(env, makeSession(secrets.session), 365 * 24 * 3600) });
    }
    if (p === '/api/logout' && m === 'POST') return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(env, '', 0) });
    if (p === '/api/session') return json(200, { authenticated: validSession(req, secrets.session) });
    if (!validSession(req, secrets.session)) return fail(401, 'Inicia sesión');

    const view = (db) => stateView(db, env, secrets);

    if (p === '/api/state' && m === 'GET') return json(200, view(await readState(ctx)));

    if (p === '/api/settings' && m === 'PUT') {
      const b = await body(req);
      const r = await withState(ctx, (db) => {
        const s = db.settings;
        const nt = b.notifyTime ?? s.notifyTime;
        const pt = b.publishTime ?? s.publishTime;
        if (!TIME_RE.test(nt) || !TIME_RE.test(pt)) httpError(400, 'Hora no válida');
        if (toMin(nt) >= toMin(pt)) httpError(400, 'El aviso tiene que llegar antes de la hora de publicación.');
        s.notifyTime = nt; s.publishTime = pt;
        if (Array.isArray(b.networks)) s.networks = b.networks.filter((n) => n === 'instagram' || n === 'facebook');
        if (b.language !== undefined) {
          if (!['es', 'mix', 'gl'].includes(b.language)) httpError(400, 'Idioma no válido');
          s.language = b.language;
        }
        if (b.timezone !== undefined) {
          try { new Intl.DateTimeFormat('es', { timeZone: b.timezone }); s.timezone = b.timezone; } catch { httpError(400, 'Zona horaria no válida'); }
        }
        if (b.reminderMinutes !== undefined) s.reminderMinutes = Math.max(0, Math.min(600, Number(b.reminderMinutes) || 0));
        if (Array.isArray(b.activeDays)) s.activeDays = b.activeDays.map(Number).filter((d) => d >= 0 && d <= 6);
        for (const k of ['studioName', 'city', 'website', 'brandHashtag', 'signature', 'extraHashtags']) {
          if (b[k] !== undefined) s[k] = String(b[k]).slice(0, 300);
        }
        if (b.onboarded !== undefined) s.onboarded = Boolean(b.onboarded);
        return view(db);
      });
      return json(200, r);
    }

    // --- fotos ---
    if (p === '/api/photos' && m === 'POST') {
      const b = await body(req);
      const img = decodeJpeg(b.image);
      const th = decodeJpeg(b.thumb);
      if (!img || !th) return fail(400, 'La imagen tiene que ser JPEG.');
      const base = crypto.randomBytes(18).toString('base64url');
      await ctx.media.set(`${base}.jpg`, img);
      await ctx.media.set(`${base}_t.jpg`, th);
      const photo = await withState(ctx, (db) => {
        const ph = {
          id: newId('ph_'), file: `${base}.jpg`, thumb: `${base}_t.jpg`,
          width: Number(b.width) || null, height: Number(b.height) || null, originalName: String(b.name || '').slice(0, 120),
          motive: captions.MOTIVES[b.motive] ? b.motive : null, lugar: '', nota: '', status: 'new', order: 0, createdAt: new Date().toISOString()
        };
        db.photos.push(ph);
        return ph;
      });
      return json(201, photoView(photo));
    }
    if (p === '/api/photos' && m === 'GET') {
      const db = await readState(ctx);
      const status = url.searchParams.get('status');
      const list = db.photos.filter((ph) => !status || ph.status === status).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return json(200, list.map(photoView));
    }
    if (p === '/api/photos/bulk' && m === 'POST') {
      const b = await body(req);
      const ids = new Set(b.ids || []);
      await withState(ctx, (db) => {
        for (const ph of db.photos) {
          if (!ids.has(ph.id)) continue;
          if (b.motive !== undefined && (captions.MOTIVES[b.motive] || b.motive === null)) ph.motive = b.motive;
          if (b.lugar !== undefined) ph.lugar = String(b.lugar).slice(0, 120);
        }
      });
      return json(200, { ok: true });
    }
    if (p === '/api/photos/enqueue' && m === 'POST') {
      const b = await body(req);
      const r = await withState(ctx, (db) => {
        let order = sch.nextOrder(db);
        let added = 0;
        let missing = 0;
        for (const pid of b.ids || []) {
          const ph = db.photos.find((x) => x.id === pid);
          if (!ph || ph.status !== 'new') continue;
          if (!ph.motive) { missing++; continue; }
          ph.status = 'queued'; ph.order = order++; added++;
        }
        if (added) logEvent(db, 'queue', `${added} foto/s añadidas a la programación`);
        return { added, missingMotive: missing };
      });
      return json(200, r);
    }
    if ((mm = p.match(/^\/api\/photos\/([\w-]+)$/))) {
      const pid = mm[1];
      if (m === 'PATCH') {
        const b = await body(req);
        const r = await withState(ctx, (db) => {
          const ph = db.photos.find((x) => x.id === pid) || httpError(404, 'Foto no encontrada');
          if (b.motive !== undefined && (captions.MOTIVES[b.motive] || b.motive === null)) ph.motive = b.motive;
          if (b.lugar !== undefined) ph.lugar = String(b.lugar).slice(0, 120);
          if (b.nota !== undefined) ph.nota = String(b.nota).slice(0, 600);
          if (b.status === 'new' && ph.status === 'queued') ph.status = 'new';
          return photoView(ph);
        });
        return json(200, r);
      }
      if (m === 'DELETE') {
        const ph = await withState(ctx, (db) => {
          const x = db.photos.find((y) => y.id === pid) || httpError(404, 'Foto no encontrada');
          if (x.status === 'scheduled') httpError(409, 'Esta foto es la publicación de hoy. Sáltala o cámbiala primero.');
          db.photos = db.photos.filter((y) => y.id !== pid);
          return x;
        });
        await Promise.all([ctx.media.delete(ph.file), ctx.media.delete(ph.thumb)]).catch(() => {});
        return json(200, { ok: true });
      }
    }

    // --- programa ---
    if (p === '/api/queue' && m === 'GET') {
      const db = await readState(ctx);
      const byId = new Map(sch.plannedSchedule(db).map((x) => [x.photoId, x.date]));
      return json(200, sch.queue(db).map((ph) => ({ ...photoView(ph), plannedDate: byId.get(ph.id) || null })));
    }
    if (p === '/api/queue/reorder' && m === 'POST') {
      const { ids } = await body(req);
      await withState(ctx, (db) => {
        let order = 1;
        const seen = new Set();
        for (const pid of ids || []) {
          const ph = db.photos.find((x) => x.id === pid);
          if (ph && ph.status === 'queued') { ph.order = order++; seen.add(pid); }
        }
        for (const ph of sch.queue(db)) if (!seen.has(ph.id)) ph.order = order++;
      });
      return json(200, { ok: true });
    }
    if (p === '/api/queue/vary' && m === 'POST') {
      // Reordena para no repetir el mismo motivo dos días seguidos.
      await withState(ctx, (db) => {
        const groups = new Map();
        for (const ph of sch.queue(db)) {
          if (!groups.has(ph.motive)) groups.set(ph.motive, []);
          groups.get(ph.motive).push(ph);
        }
        const lists = [...groups.values()];
        let order = 1;
        let last = null;
        while (lists.some((l) => l.length)) {
          lists.sort((a, b) => b.length - a.length);
          const pick = lists.find((l) => l.length && l[0].motive !== last) || lists.find((l) => l.length);
          const ph = pick.shift();
          ph.order = order++;
          last = ph.motive;
        }
      });
      return json(200, { ok: true });
    }

    // --- publicaciones ---
    if (p === '/api/posts' && m === 'GET') {
      const db = await readState(ctx);
      return json(200, db.posts.filter((x) => x.status !== 'replaced').slice(0, 100).map((x) => postView(db, x)));
    }
    if (p === '/api/posts/today' && m === 'POST') {
      const r = await withState(ctx, (db) => {
        const t = sch.now(db);
        const existing = sch.postForDate(db, t.date);
        if (existing) return readonly({ post: postView(db, existing) });
        const c = sch.createPost(db, env, t.date) || httpError(409, 'No hay fotos en la programación. Sube y clasifica alguna primero.');
        return { post: postView(db, c.post), push: c.push };
      });
      if (r.push) await sch.notify(ctx, [r.push]);
      return json(201, r.post);
    }
    if ((mm = p.match(/^\/api\/posts\/([\w-]+)(?:\/(approve|unapprove|regenerate|skip|swap|publish))?$/))) {
      const id = mm[1];
      const action = mm[2];
      if (!action && m === 'GET') {
        const db = await readState(ctx);
        const post = db.posts.find((x) => x.id === id);
        return post ? json(200, postView(db, post)) : fail(404, 'Publicación no encontrada');
      }
      if (!action && m !== 'PATCH') return fail(405, 'Método no permitido');
      if (action && m !== 'POST') return fail(405, 'Método no permitido');
      const b = await body(req);
      const applyEdits = (post) => {
        if (b.captionIg !== undefined) post.captionIg = String(b.captionIg).slice(0, 2200);
        if (b.captionFb !== undefined) post.captionFb = String(b.captionFb).slice(0, 5000);
        if (Array.isArray(b.networks)) post.networks = b.networks.filter((n) => n === 'instagram' || n === 'facebook');
      };
      let publishAfter = false;
      const r = await withState(ctx, (db) => {
        const post = db.posts.find((x) => x.id === id) || httpError(404, 'Publicación no encontrada');
        const editable = ['pending', 'approved', 'error', 'partial', 'expired'].includes(post.status);
        if ((b.captionIg !== undefined || b.captionFb !== undefined || b.networks) && !editable) httpError(409, 'Ya no se puede editar.');
        applyEdits(post);
        let target = post;
        switch (action) {
          case undefined: break;
          case 'approve': {
            if (!['pending', 'approved'].includes(post.status)) httpError(409, 'Esta publicación ya no está pendiente.');
            if (!post.networks.length) httpError(400, 'Elige al menos una red social.');
            post.status = 'approved';
            post.approvedAt = new Date().toISOString();
            logEvent(db, 'post', `Aprobada la publicación del ${post.date}`);
            // Si ya pasó la hora de publicar de hoy, se publica en este momento.
            const t = sch.now(db);
            if (post.date === t.date && toMin(t.hm) >= toMin(db.settings.publishTime)) { sch.claim(db, post); publishAfter = true; }
            break;
          }
          case 'unapprove':
            if (post.status !== 'approved') httpError(409, 'No está aprobada.');
            post.status = 'pending';
            break;
          case 'regenerate':
            if (!['pending', 'approved'].includes(post.status)) httpError(409, 'Ya no se puede cambiar el texto.');
            sch.regenerate(db, post);
            break;
          case 'skip': try { sch.skip(db, post); } catch (e) { httpError(409, e.message); } break;
          case 'swap': try { target = sch.swap(db, env, post); } catch (e) { httpError(409, e.message); } break;
          case 'publish': try { sch.claim(db, post); } catch (e) { httpError(409, e.message); } publishAfter = true; break;
        }
        return target.id;
      });
      if (publishAfter) await sch.runPublish(ctx, r, { budgetMs: 40000 });
      const db = await readState(ctx);
      return json(200, postView(db, db.posts.find((x) => x.id === r)));
    }

    // --- notificaciones push ---
    if (p === '/api/push/subscribe' && m === 'POST') {
      const sub = await body(req);
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return fail(400, 'Suscripción no válida');
      const devices = await withState(ctx, (db) => {
        db.pushSubscriptions = db.pushSubscriptions.filter((s) => s.endpoint !== sub.endpoint);
        db.pushSubscriptions.push({ endpoint: sub.endpoint, keys: sub.keys, createdAt: new Date().toISOString(), ua: String(req.headers.get('user-agent') || '').slice(0, 200) });
        return db.pushSubscriptions.length;
      });
      return json(200, { ok: true, devices });
    }
    if (p === '/api/push/test' && m === 'POST') {
      return json(200, await sch.notify(ctx, [{ title: '🔔 Notificaciones activadas', body: 'Así te llegará cada día la publicación para aprobarla.', url: '/#/', tag: 'test' }]));
    }

    // --- Meta ---
    if (p === '/api/meta/start' && m === 'POST') {
      if (!meta.configured(env)) return fail(400, 'Falta configurar META_APP_ID y META_APP_SECRET en el servidor (ver README).');
      const state = await withState(ctx, (db) => meta.createState(db));
      return json(200, { url: meta.dialogUrl(env, state) });
    }
    if (p === '/api/meta/select' && m === 'POST') {
      const { pageId } = await body(req);
      return json(200, await withState(ctx, (db) => {
        if (!db.meta.pages.find((x) => x.id === pageId)) httpError(404, 'Página no encontrada');
        db.meta.selectedPageId = pageId;
        return view(db);
      }));
    }
    if (p === '/api/meta/disconnect' && m === 'POST') return json(200, await withState(ctx, (db) => { meta.disconnect(db); return view(db); }));

    if (p === '/api/events' && m === 'GET') return json(200, (await readState(ctx)).events.slice(0, 50));

    return fail(404, 'Ruta no encontrada');
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, e.message || 'Error interno');
  }
}
