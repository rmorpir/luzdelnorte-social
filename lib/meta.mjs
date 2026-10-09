// Conexión oficial con Meta (Facebook + Instagram) mediante "Iniciar sesión con Facebook".
// La app NUNCA ve ni guarda la contraseña del fotógrafo: solo un token de permiso
// que el propio usuario concede y puede revocar desde Facebook en cualquier momento.
import crypto from 'node:crypto';
import { logEvent } from './state.mjs';

export const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management'
];

export const graphVersion = (env) => env.META_GRAPH_VERSION || 'v26.0';
export const configured = (env) => Boolean(env.META_APP_ID && env.META_APP_SECRET);
const redirectUri = (env) => `${env.PUBLIC_URL}/auth/meta/callback`;

export function createState(db) {
  const state = crypto.randomBytes(16).toString('base64url');
  const now = Date.now();
  for (const [s, exp] of Object.entries(db.oauthStates)) if (exp < now) delete db.oauthStates[s];
  db.oauthStates[state] = now + 15 * 60 * 1000;
  return state;
}

export function dialogUrl(env, state) {
  const p = new URLSearchParams({ client_id: env.META_APP_ID, redirect_uri: redirectUri(env), state, response_type: 'code' });
  if (env.META_CONFIG_ID) p.set('config_id', env.META_CONFIG_ID);
  else p.set('scope', SCOPES.join(','));
  return `https://www.facebook.com/${graphVersion(env)}/dialog/oauth?${p}`;
}

export async function graph(env, method, pathname, params = {}) {
  const url = new URL(`https://graph.facebook.com/${graphVersion(env)}${pathname}`);
  let res;
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    res = await fetch(url);
  } else {
    res = await fetch(url, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    const err = new Error(e.error_user_msg || e.message || `Error ${res.status} de Meta`);
    err.code = e.code;
    throw err;
  }
  return json;
}

/** Canjea el código de Facebook por tokens. Devuelve los datos a guardar (sin tocar el estado). */
export async function exchange(env, code) {
  const base = { client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET };
  const short = await graph(env, 'GET', '/oauth/access_token', { ...base, redirect_uri: redirectUri(env), code });
  // Token de larga duración; los tokens de página obtenidos con él no caducan.
  const long = await graph(env, 'GET', '/oauth/access_token', { ...base, grant_type: 'fb_exchange_token', fb_exchange_token: short.access_token });
  const me = await graph(env, 'GET', '/me', { fields: 'id,name', access_token: long.access_token });
  const accounts = await graph(env, 'GET', '/me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '100', access_token: long.access_token
  });
  const pages = (accounts.data || []).map((p) => ({
    id: p.id, name: p.name, accessToken: p.access_token,
    ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username } : null
  }));
  return { userToken: long.access_token, userName: me.name, pages };
}

export function applyConnection(db, conn) {
  db.meta.userToken = conn.userToken;
  db.meta.userName = conn.userName;
  db.meta.pages = conn.pages;
  db.meta.connectedAt = new Date().toISOString();
  db.meta.lastError = null;
  if (!conn.pages.find((p) => p.id === db.meta.selectedPageId)) {
    db.meta.selectedPageId = (conn.pages.find((p) => p.ig) || conn.pages[0] || {}).id || null;
  }
  logEvent(db, 'meta', `Conectado como ${conn.userName} (${conn.pages.length} página/s)`);
}

export function selectedPage(db) {
  return db.meta.pages.find((p) => p.id === db.meta.selectedPageId) || null;
}

export function publicStatus(db, env) {
  const page = selectedPage(db);
  return {
    configured: configured(env),
    connected: Boolean(db.meta.userToken && page),
    userName: db.meta.userName,
    connectedAt: db.meta.connectedAt,
    lastError: db.meta.lastError,
    pages: db.meta.pages.map((p) => ({ id: p.id, name: p.name, ig: p.ig })),
    selectedPageId: db.meta.selectedPageId,
    facebook: page ? { id: page.id, name: page.name } : null,
    instagram: page && page.ig ? page.ig : null
  };
}

export function disconnect(db) {
  db.meta = { ...db.meta, userToken: null, userName: null, pages: [], selectedPageId: null, connectedAt: null };
  logEvent(db, 'meta', 'Cuenta de Meta desconectada');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Publicación en Instagram en dos pasos (crear contenedor → publicar).
 * Si Instagram tarda en procesar la imagen, devuelve {pending, containerId} para continuar
 * en la siguiente pasada del reloj (las funciones programadas de Netlify duran como máx. 30 s).
 */
export async function publishInstagram(env, page, imageUrl, caption, { containerId = null, budgetMs = 18000 } = {}) {
  if (!page || !page.ig) throw new Error('No hay cuenta de Instagram profesional vinculada a la página elegida.');
  const token = page.accessToken;
  const start = Date.now();
  if (!containerId) {
    containerId = (await graph(env, 'POST', `/${page.ig.id}/media`, { image_url: imageUrl, caption, access_token: token })).id;
  }
  for (;;) {
    const st = await graph(env, 'GET', `/${containerId}`, { fields: 'status_code,status', access_token: token });
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') {
      throw new Error(`Instagram no pudo procesar la imagen (${st.status || st.status_code}).`);
    }
    if (Date.now() - start > budgetMs) return { pending: true, containerId };
    await sleep(2500);
  }
  const published = await graph(env, 'POST', `/${page.ig.id}/media_publish`, { creation_id: containerId, access_token: token });
  let permalink = null;
  try { permalink = (await graph(env, 'GET', `/${published.id}`, { fields: 'permalink', access_token: token })).permalink; } catch { /* opcional */ }
  return { id: published.id, permalink };
}

export async function publishFacebook(env, page, imageUrl, caption) {
  if (!page) throw new Error('No hay ninguna página de Facebook seleccionada.');
  const r = await graph(env, 'POST', `/${page.id}/photos`, { url: imageUrl, caption, published: 'true', access_token: page.accessToken });
  const postId = r.post_id || r.id;
  return { id: postId, permalink: `https://www.facebook.com/${postId}` };
}
