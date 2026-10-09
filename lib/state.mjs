// Estado de la app (un único usuario: el fotógrafo) guardado como un documento JSON.
// Cada cambio se hace dentro de una "transacción": se lee el documento con su versión (etag),
// se modifica y se guarda SOLO si nadie lo ha cambiado entretanto; si no, se reintenta.
// Así el reloj diario y las acciones desde el móvil nunca se pisan.
import crypto from 'node:crypto';

export function defaults(env = {}) {
  return {
    version: 1,
    settings: {
      onboarded: false,
      networks: [],                 // 'instagram' | 'facebook'
      timezone: env.TZ_APP || 'Europe/Madrid',
      notifyTime: '10:00',          // hora del aviso al móvil
      publishTime: '19:30',         // hora de publicación
      reminderMinutes: 60,          // recordatorio antes de publicar si no se ha aprobado
      activeDays: [0, 1, 2, 3, 4, 5, 6], // 0 = domingo
      studioName: 'Luz del Norte Fotografía',
      city: '',
      language: 'mix',              // 'es' | 'mix' (castellano con toques de gallego) | 'gl' (más gallego)
      website: 'https://www.luzdelnortefotografia.com',
      brandHashtag: '#luzdelnortefotografia',
      signature: '',
      extraHashtags: ''
    },
    meta: { userToken: null, userName: null, pages: [], selectedPageId: null, connectedAt: null, lastError: null },
    secrets: null,                  // claves VAPID y secreto de sesión (se crean la primera vez)
    oauthStates: {},
    pushSubscriptions: [],
    photos: [],
    posts: [],
    templateUsage: {},
    events: []
  };
}

function normalize(raw, env) {
  const d = defaults(env);
  if (!raw) return d;
  return { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) }, meta: { ...d.meta, ...(raw.meta || {}) } };
}

export function newId(prefix = '') {
  return prefix + crypto.randomBytes(9).toString('base64url');
}

export function logEvent(db, type, message) {
  db.events.unshift({ at: new Date().toISOString(), type, message });
  db.events = db.events.slice(0, 200);
}

export class ConflictError extends Error {}

/**
 * Lee el estado, aplica fn(db) y guarda con control de versión. Reintenta si hubo conflicto.
 * fn NO debe tener efectos externos (enviar push, publicar): devuélvelos y hazlos después.
 * @param {{load():Promise<{data:any,etag:string|null}>, save(data:any, etag:string|null):Promise<boolean>}} adapter
 */
export async function withState(ctx, fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, etag } = await ctx.adapter.load();
    const db = normalize(data, ctx.env);
    const result = await fn(db);
    if (result && result.__readonly) return result.value;
    const ok = await ctx.adapter.save(db, etag);
    if (ok) return result;
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 200 * (attempt + 1)));
  }
  throw new ConflictError('Hay otro cambio en curso. Inténtalo de nuevo en unos segundos.');
}

/** Solo lectura (no guarda). */
export async function readState(ctx) {
  const { data } = await ctx.adapter.load();
  return normalize(data, ctx.env);
}

export const readonly = (value) => ({ __readonly: true, value });
