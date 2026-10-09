// Programador diario: cada día prepara UNA publicación nueva (foto distinta), avisa al móvil,
// espera la aprobación y publica a la hora fijada. Si no se aprueba, NO se publica:
// la foto vuelve al final de la cola y mañana se prepara la siguiente.
//
// Todo cambio de estado ocurre dentro de withState (transacción); los efectos externos
// (enviar notificaciones, llamar a Meta) se hacen fuera, después de guardar.
import * as captions from './captions.mjs';
import * as meta from './meta.mjs';
import * as webpush from './webpush.mjs';
import { withState, readState, newId, logEvent, defaults } from './state.mjs';
import { parts, toMinutes, addDays, weekdayOf } from './time.mjs';
import crypto from 'node:crypto';

export const OPEN_STATUSES = new Set(['pending', 'approved', 'publishing']);
export const demoMode = (env) => env.DEMO_MODE === '1' || !meta.configured(env);
const NAMES = { instagram: 'Instagram', facebook: 'Facebook' };

export const now = (db) => parts(new Date(), db.settings.timezone);
export const queue = (db) => db.photos.filter((p) => p.status === 'queued').sort((a, b) => a.order - b.order);
export const nextOrder = (db) => db.photos.reduce((m, p) => Math.max(m, p.order || 0), 0) + 1;
export const postForDate = (db, date) => db.posts.find((p) => p.date === date && p.status !== 'replaced') || null;
export const photoOf = (db, post) => db.photos.find((p) => p.id === post.photoId) || null;
export const publicImageUrl = (env, photo) => `${env.PUBLIC_URL}/p/${photo.file}`;

// ---------- claves (VAPID para push y secreto de sesión) ----------
let cachedSecrets = null;
export async function ensureSecrets(ctx) {
  if (cachedSecrets) return cachedSecrets;
  const current = (await readState(ctx)).secrets;
  if (current) return (cachedSecrets = current);
  const s = await withState(ctx, (db) => {
    if (!db.secrets) db.secrets = { vapid: webpush.generateVapid(), session: crypto.randomBytes(32).toString('hex') };
    return db.secrets;
  });
  return (cachedSecrets = s);
}
export function resetSecretsCache() { cachedSecrets = null; }

// ---------- notificaciones ----------
export async function notify(ctx, payloads) {
  if (!payloads.length) return { sent: 0, total: 0 };
  const db = await readState(ctx);
  const secrets = await ensureSecrets(ctx);
  const subject = ctx.env.VAPID_SUBJECT || 'mailto:avisos@luzdelnortefotografia.com';
  const dead = new Set();
  let sent = 0;
  for (const payload of payloads) {
    for (const sub of db.pushSubscriptions) {
      if (dead.has(sub.endpoint)) continue;
      try {
        const r = await webpush.send(secrets.vapid, subject, sub, payload);
        if (r.ok) sent++;
        else if (r.status === 404 || r.status === 410) dead.add(sub.endpoint);
        else console.warn('[push]', r.status, r.text);
      } catch (e) { console.warn('[push] error', e.message); }
    }
  }
  if (dead.size) await withState(ctx, (d) => { d.pushSubscriptions = d.pushSubscriptions.filter((s) => !dead.has(s.endpoint)); });
  return { sent, total: db.pushSubscriptions.length };
}

// ---------- operaciones sobre el estado (puras) ----------
function buildCaptions(db, photo) {
  const g = captions.generate(photo, db.settings, db.templateUsage);
  captions.markUsed(db.templateUsage, g.used);
  return g;
}

export function requeuePhoto(db, photo) {
  if (!photo) return;
  photo.status = 'queued';
  photo.order = nextOrder(db);
}

/** Crea la publicación del día con la siguiente foto de la cola. Devuelve {post, push}. */
export function createPost(db, env, date) {
  const next = queue(db)[0];
  if (!next) return null;
  const g = buildCaptions(db, next);
  next.status = 'scheduled';
  const post = {
    id: newId('post_'), date, photoId: next.id, status: 'pending',
    captionIg: g.instagram, captionFb: g.facebook, hashtags: g.hashtags,
    networks: [...db.settings.networks], createdAt: new Date().toISOString(),
    approvedAt: null, publishedAt: null, publishingAt: null, results: {}, reminded: false, demo: demoMode(env)
  };
  db.posts.unshift(post);
  db.posts = db.posts.slice(0, 400);
  logEvent(db, 'post', `Preparada la publicación del ${date} (${captions.MOTIVES[next.motive]?.label || 'Otro'})`);
  const push = {
    title: '📸 Tu publicación de hoy está lista',
    body: `${g.hook}\nSe publicará a las ${db.settings.publishTime}. Toca para revisarla.`,
    url: `/#/revisar/${post.id}`, tag: `post-${post.id}`
  };
  return { post, push };
}

export function regenerate(db, post) {
  const g = buildCaptions(db, photoOf(db, post));
  post.captionIg = g.instagram;
  post.captionFb = g.facebook;
  post.hashtags = g.hashtags;
}

export function swap(db, env, post) {
  if (!['pending', 'approved'].includes(post.status)) throw new Error('Esta publicación ya no se puede cambiar.');
  if (!queue(db).length) throw new Error('No hay más fotos en la cola.');
  post.status = 'replaced';
  requeuePhoto(db, photoOf(db, post));
  return createPost(db, env, post.date).post;
}

export function skip(db, post) {
  if (!['pending', 'approved'].includes(post.status)) throw new Error('Esta publicación ya no se puede saltar.');
  post.status = 'skipped';
  requeuePhoto(db, photoOf(db, post));
  logEvent(db, 'post', `Saltada la publicación del ${post.date}`);
}

/** Reserva la publicación para publicarla (evita publicar dos veces). */
export function claim(db, post) {
  if (!['pending', 'approved', 'error', 'partial', 'expired'].includes(post.status)) {
    throw new Error(post.status === 'publishing' ? 'Ya se está publicando.' : 'Esta publicación no se puede publicar ahora.');
  }
  if (!post.networks.length) throw new Error('Elige al menos una red social.');
  const ph = photoOf(db, post);
  if (!ph) throw new Error('La foto de esta publicación ya no existe.');
  if (ph.status === 'queued') ph.status = 'scheduled';
  post.status = 'publishing';
  post.publishingAt = new Date().toISOString();
  post.approvedAt = post.approvedAt || post.publishingAt;
}

// ---------- publicar (efectos externos) ----------
export async function runPublish(ctx, postId, { budgetMs = 18000 } = {}) {
  const env = ctx.env;
  const snap = await readState(ctx);
  const post = snap.posts.find((p) => p.id === postId);
  if (!post || post.status !== 'publishing') return post;
  const photo = photoOf(snap, post);
  const page = meta.selectedPage(snap);
  const url = publicImageUrl(env, photo);
  const results = { ...post.results };
  const nets = post.networks.length ? post.networks : snap.settings.networks;
  let tokenExpired = false;

  for (const net of nets) {
    if (results[net]?.ok) continue; // en reintentos no se duplica lo ya publicado
    try {
      if (demoMode(env)) {
        results[net] = { ok: true, demo: true, id: null, permalink: null };
      } else if (net === 'instagram') {
        const r = await meta.publishInstagram(env, page, url, post.captionIg, { containerId: results.instagram?.containerId, budgetMs });
        results[net] = r.pending ? { ok: false, pending: true, containerId: r.containerId } : { ok: true, ...r };
      } else if (net === 'facebook') {
        results[net] = { ok: true, ...(await meta.publishFacebook(env, page, url, post.captionFb)) };
      }
    } catch (e) {
      results[net] = { ok: false, error: e.message };
      if (e.code === 190) tokenExpired = true;
    }
  }

  const push = await withState(ctx, (db) => {
    const p = db.posts.find((x) => x.id === postId);
    if (!p) return null;
    p.results = results;
    if (tokenExpired) db.meta.lastError = 'La conexión con Facebook ha caducado. Vuelve a conectar la cuenta en Ajustes.';
    if (nets.some((n) => results[n]?.pending)) return null; // Instagram sigue procesando: se continúa en la próxima pasada
    const oks = nets.filter((n) => results[n]?.ok);
    p.status = oks.length === nets.length ? 'published' : oks.length ? 'partial' : 'error';
    const ph = photoOf(db, p);
    if (oks.length) {
      p.publishedAt = new Date().toISOString();
      if (ph) ph.status = 'published';
    }
    if (p.status === 'published') {
      logEvent(db, 'publish', `Publicada (${oks.map((n) => NAMES[n]).join(' y ')})${p.demo ? ' [modo prueba]' : ''}`);
      return {
        title: p.demo ? '✅ Publicación simulada (modo prueba)' : '✅ ¡Publicado!',
        body: `Ya está en ${oks.map((n) => NAMES[n]).join(' y ')}. Responde a los primeros comentarios: ayuda al alcance.`,
        url: `/#/revisar/${p.id}`, tag: `post-${p.id}`
      };
    }
    const errs = nets.filter((n) => !results[n]?.ok).map((n) => `${NAMES[n]}: ${results[n]?.error}`).join(' · ');
    logEvent(db, 'error', `Error al publicar: ${errs}`);
    return { title: '⚠️ No se pudo publicar', body: `${errs}. Toca para reintentar.`, url: `/#/revisar/${p.id}`, tag: `post-${p.id}` };
  });
  if (push) await notify(ctx, [push]);
  return (await readState(ctx)).posts.find((p) => p.id === postId);
}

// ---------- reloj (se ejecuta cada pocos minutos) ----------
export function planTick(db, env, at = new Date()) {
  const out = { pushes: [], publish: [] };
  const s = db.settings;
  // Publicaciones a medias (Instagram procesando) o interrumpidas.
  for (const p of db.posts) {
    if (p.status !== 'publishing') continue;
    const age = at - new Date(p.publishingAt || p.createdAt);
    if (age > 20 * 60 * 1000) {
      p.status = 'error';
      p.results = { ...p.results };
      for (const n of p.networks) if (!p.results[n]?.ok) p.results[n] = { ok: false, error: 'La publicación se interrumpió. Revisa la red antes de reintentar para no duplicarla.' };
    } else if (Object.values(p.results || {}).some((r) => r?.pending)) {
      out.publish.push(p.id);
    }
  }
  if (!s.onboarded || !s.networks.length) return out;

  const t = parts(at, s.timezone);
  const mins = toMinutes(t.hm);
  const notifyAt = toMinutes(s.notifyTime);
  const publishAt = toMinutes(s.publishTime);
  const remindAt = publishAt - (Number(s.reminderMinutes) || 0);
  const today = postForDate(db, t.date);

  // 1) Preparar y avisar (también si el reloj llega tarde, mientras no haya pasado la hora de publicar).
  if (!today) {
    if (s.activeDays.includes(t.weekday) && mins >= notifyAt && mins < publishAt) {
      const r = createPost(db, env, t.date);
      if (r) out.pushes.push(r.push);
    }
    return out;
  }

  // 2) Recordatorio si sigue pendiente.
  if (today.status === 'pending' && !today.reminded && s.reminderMinutes > 0 && mins >= remindAt && mins < publishAt) {
    today.reminded = true;
    out.pushes.push({
      title: '⏰ Falta poco para publicar',
      body: `La publicación de hoy sigue sin aprobar. Si no la apruebas antes de las ${s.publishTime}, no se publicará.`,
      url: `/#/revisar/${today.id}`, tag: `post-${today.id}`
    });
  }

  // 3) Hora de publicar.
  if (mins >= publishAt) {
    if (today.status === 'approved') {
      claim(db, today);
      out.publish.push(today.id);
    } else if (today.status === 'pending') {
      today.status = 'expired';
      requeuePhoto(db, photoOf(db, today));
      logEvent(db, 'post', `No aprobada a tiempo: no se publicó (${t.date}). La foto vuelve a la cola.`);
      out.pushes.push({
        title: 'Hoy no se ha publicado',
        body: 'No llegó la aprobación a tiempo. La foto vuelve a la cola y mañana te preparo la siguiente.',
        url: '/#/', tag: `post-${today.id}`
      });
    }
  }
  return out;
}

export async function tick(ctx, { at = new Date(), budgetMs = 18000 } = {}) {
  const plan = await withState(ctx, (db) => planTick(db, ctx.env, at));
  await notify(ctx, plan.pushes);
  for (const id of plan.publish) await runPublish(ctx, id, { budgetMs });
  return plan;
}

// ---------- calendario previsto ----------
export function plannedSchedule(db, limit = 200) {
  const s = db.settings;
  const t = now(db);
  const out = [];
  const q = queue(db);
  let date = t.date;
  const startToday = !postForDate(db, t.date) && toMinutes(t.hm) < toMinutes(s.publishTime);
  if (!startToday) date = addDays(date, 1);
  let i = 0;
  let guard = 0;
  while (i < q.length && out.length < limit && guard < 1000 && s.activeDays.length) {
    guard++;
    if (s.activeDays.includes(weekdayOf(date))) out.push({ date, photoId: q[i++].id });
    date = addDays(date, 1);
  }
  return out;
}

export { defaults };
