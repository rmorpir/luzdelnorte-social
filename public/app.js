'use strict';
/* Luz del Norte · Redes — app para iPhone (PWA). Sin frameworks. */

const $app = document.getElementById('app');
const $tabs = document.getElementById('tabs');
const $toast = document.getElementById('toast');

let S = null;            // estado del servidor (/api/state)
let onboardStep = 1;
let reviewTab = 'instagram';
let selected = new Set(); // selección en "Clasificar"

const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const STATUS = {
  pending: 'Pendiente de aprobar', approved: 'Aprobada', publishing: 'Publicando…', published: 'Publicada',
  partial: 'Publicada a medias', error: 'Error al publicar', expired: 'No aprobada a tiempo', skipped: 'Saltada'
};
const TIPS = [
  'La primera línea es lo único que se ve antes de "más". Si no engancha, el resto no se lee.',
  'Responde a los comentarios en la primera hora: es cuando Instagram decide si enseña tu post a más gente.',
  'Las fotos verticales 4:5 ocupan más pantalla en el feed y suelen retener más.',
  'Pide algo concreto: comentar, guardar o etiquetar. Un "guardado" vale más que un "me gusta".',
  'Usa pocos hashtags y muy específicos (Instagram admite 5). Mejor #vodasgalicia que #love.',
  'Publicar todos los días a la misma hora acostumbra a tu audiencia a buscarte.',
  'Etiqueta la ubicación: aparecer en búsquedas locales trae clientes cercanos.'
];

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const motive = (k) => (S?.motives || []).find((m) => m.key === k);
const motiveLabel = (k) => { const m = motive(k); return m ? `${m.emoji} ${m.label}` : 'Sin motivo'; };

function toast(msg, err = false) {
  $toast.textContent = msg;
  $toast.className = 'toast' + (err ? ' err' : '');
  $toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { $toast.hidden = true; }, 3200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') { S = null; location.hash = '#/login'; throw new Error(data.error || 'Inicia sesión'); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

async function refresh() { S = await api('/api/state'); return S; }

function fmtDate(dateStr, long = false) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = S?.now?.date;
  const diff = today ? Math.round((d - new Date(today + 'T12:00:00')) / 86400000) : null;
  const base = d.toLocaleDateString('es-ES', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
  if (diff === 0) return 'Hoy · ' + base;
  if (diff === 1) return 'Mañana · ' + base;
  return base;
}

function header(title, kicker = 'Luz del Norte', back = null) {
  return `<header class="top">
    ${back ? `<button class="back" data-go="${back}">‹ Volver</button>` : '<img src="/brand/logo.png" alt="">'}
    <div class="t"><div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1></div>
  </header>`;
}

function demoBanner() {
  return S?.demo ? `<div class="notice warn small mt">Modo prueba: el servidor aún no tiene configurada la app de Meta, así que nada se publica de verdad. Todo lo demás funciona igual.</div>` : '';
}

function setTab(name) {
  $tabs.hidden = !name;
  for (const a of $tabs.querySelectorAll('a')) a.classList.toggle('on', a.dataset.tab === name);
}

// ---------- router ----------
async function route() {
  const hash = location.hash || '#/';
  const [, page, arg] = hash.match(/^#\/?([^/]*)\/?(.*)$/) || [];
  try {
    if (page === 'login') return renderLogin();
    if (!S) {
      const sess = await api('/api/session');
      if (!sess.authenticated) { location.hash = '#/login'; return; }
      await refresh();
    }
    if (!S.settings.onboarded && page !== 'revisar') return renderOnboarding();
    switch (page) {
      case '': return renderHome();
      case 'subir': return renderUpload();
      case 'clasificar': return renderClassify();
      case 'programa': return renderQueue();
      case 'revisar': return renderReview(arg);
      case 'historial': return renderHistory();
      case 'ajustes': return renderSettings();
      default: location.hash = '#/';
    }
  } catch (e) {
    if (location.hash !== '#/login') { $app.innerHTML = `<div class="notice err mt">${esc(e.message)}</div>`; }
  }
}
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S) { await refresh().catch(() => {}); route(); }
});

// Navegación con data-go
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { e.preventDefault(); location.hash = go.dataset.go; }
});

// ---------- login ----------
function renderLogin() {
  setTab(null);
  $app.innerHTML = `<form class="login" id="loginForm">
    <img src="/brand/logo.png" alt="">
    <div><h1>Luz del Norte</h1><p class="muted">Tu trabajo en redes, una foto cada día.</p></div>
    <input type="password" name="password" placeholder="Contraseña de la app" autocomplete="current-password" required>
    <button class="btn primary block" type="submit">Entrar</button>
    <p class="small muted">Esta contraseña es solo para abrir esta app. Nunca te pediremos la de Instagram o Facebook.</p>
  </form>`;
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/login', { body: { password: e.target.password.value } });
      await refresh();
      location.hash = '#/';
      route();
    } catch (err) { toast(err.message, true); }
  };
}

// ---------- bienvenida (primera vez) ----------
function steps(n) { return `<div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`; }

function renderOnboarding() {
  setTab(null);
  const nets = new Set(S.settings.networks);
  if (onboardStep === 1) {
    $app.innerHTML = `${steps(1)}${header('¿Dónde quieres publicar?', 'Bienvenido')}
      <p class="muted">Elige una o las dos. Podrás cambiarlo cuando quieras en Ajustes.</p>
      <div class="choice mt">
        <button data-net="instagram" aria-pressed="${nets.has('instagram')}"><span class="ic ig">◎</span><span><b>Instagram</b><span class="small muted">Cuenta profesional (Creador o Empresa)</span></span><span class="check">✓</span></button>
        <button data-net="facebook" aria-pressed="${nets.has('facebook')}"><span class="ic fb">f</span><span><b>Facebook</b><span class="small muted">Página de Facebook del estudio</span></span><span class="check">✓</span></button>
      </div>
      <button class="btn primary block mt-l" id="next" ${nets.size ? '' : 'disabled'}>Continuar</button>`;
    $app.querySelectorAll('[data-net]').forEach((b) => b.onclick = async () => {
      const n = b.dataset.net;
      nets.has(n) ? nets.delete(n) : nets.add(n);
      S = await api('/api/settings', { method: 'PUT', body: { networks: [...nets] } });
      renderOnboarding();
    });
    document.getElementById('next').onclick = () => { onboardStep = 2; renderOnboarding(); };
    return;
  }
  if (onboardStep === 2) {
    $app.innerHTML = `${steps(2)}${header('Conecta tus cuentas', 'Paso 2 de 4')}
      ${connectBlock()}
      <div class="btns two mt-l">
        <button class="btn ghost" id="prev">Atrás</button>
        <button class="btn primary" id="next">${S.meta.connected || S.demo ? 'Continuar' : 'Hacerlo luego'}</button>
      </div>`;
    bindConnect();
    document.getElementById('prev').onclick = () => { onboardStep = 1; renderOnboarding(); };
    document.getElementById('next').onclick = () => { onboardStep = 3; renderOnboarding(); };
    return;
  }
  if (onboardStep === 3) {
    $app.innerHTML = `${steps(3)}${header('Avisos en tu iPhone', 'Paso 3 de 4')}
      <p class="muted">Cada día te llegará una notificación con la publicación preparada para que la apruebes o la cambies. Sin aprobación, no se publica nada.</p>
      ${pushBlock()}
      <div class="btns two mt-l">
        <button class="btn ghost" id="prev">Atrás</button>
        <button class="btn primary" id="next">Continuar</button>
      </div>`;
    bindPush();
    document.getElementById('prev').onclick = () => { onboardStep = 2; renderOnboarding(); };
    document.getElementById('next').onclick = () => { onboardStep = 4; renderOnboarding(); };
    return;
  }
  // Paso 4: horario y datos del estudio
  $app.innerHTML = `${steps(4)}${header('Horario y estudio', 'Paso 4 de 4')}
    ${scheduleForm()}
    ${studioForm(true)}
    <div class="btns two mt-l">
      <button class="btn ghost" id="prev">Atrás</button>
      <button class="btn primary" id="finish">Empezar</button>
    </div>`;
  bindDays();
  document.getElementById('prev').onclick = () => { onboardStep = 3; renderOnboarding(); };
  document.getElementById('finish').onclick = async () => {
    try {
      S = await api('/api/settings', { method: 'PUT', body: { ...collectForms(), onboarded: true } });
      toast('¡Listo! Ahora sube tus fotos.');
      location.hash = '#/subir';
      route();
    } catch (e) { toast(e.message, true); }
  };
}

// ---------- bloques reutilizables ----------
function connectBlock() {
  const m = S.meta;
  const wantsIg = S.settings.networks.includes('instagram');
  if (m.connected) {
    return `<div class="notice ok">Conectado como <b>${esc(m.userName)}</b>.</div>
      ${m.pages.length > 1 ? `<label class="f">Página de Facebook en la que publicar</label>
        <select id="pageSel">${m.pages.map((p) => `<option value="${esc(p.id)}" ${p.id === m.selectedPageId ? 'selected' : ''}>${esc(p.name)}${p.ig ? ' · @' + esc(p.ig.username) : ''}</option>`).join('')}</select>` : ''}
      <div class="card mt small">
        <div>Facebook: <b>${esc(m.facebook?.name || '—')}</b></div>
        <div>Instagram: <b>${m.instagram ? '@' + esc(m.instagram.username) : '—'}</b></div>
        ${wantsIg && !m.instagram ? '<p class="notice warn mt">Esta página no tiene una cuenta de Instagram profesional vinculada. Vincúlala desde Instagram (Ajustes → Cuentas vinculadas) y vuelve a conectar.</p>' : ''}
      </div>
      <button class="btn sm ghost mt" id="reconnect">Volver a conectar</button>`;
  }
  return `<div class="card stack">
      <p><b>No te pedimos tu contraseña.</b> Instagram y Facebook prohíben dársela a otras apps y bloquean las cuentas que lo hacen.</p>
      <p class="muted">En su lugar usamos el inicio de sesión oficial de Meta: tú entras en Facebook, aceptas los permisos para publicar y puedes retirarlos cuando quieras desde la configuración de Facebook.</p>
      ${wantsIg ? `<details><summary>Antes de conectar Instagram</summary>
        <ol class="ios-steps small">
          <li>En Instagram: Ajustes → Tipo de cuenta → cambia a <b>cuenta profesional</b> (Creador o Empresa).</li>
          <li>Vincula esa cuenta a la <b>Página de Facebook</b> del estudio (Centro de cuentas de Meta).</li>
          <li>Al conectar, marca la página y la cuenta de Instagram cuando Facebook te lo pregunte.</li>
        </ol></details>` : ''}
    </div>
    ${m.lastError ? `<div class="notice err mt">${esc(m.lastError)}</div>` : ''}
    ${S.demo
      ? `<div class="notice warn mt">El servidor todavía no tiene configurada la app de Meta (META_APP_ID y META_APP_SECRET). Puedes seguir y probarlo todo en <b>modo prueba</b>; cuando esté configurada, conecta desde Ajustes.</div>`
      : `<button class="btn fb block mt" id="connect">Continuar con Facebook</button>
         <p class="small muted center">Se abrirá Facebook. Al terminar, vuelve a esta app.</p>`}`;
}

function bindConnect() {
  const c = document.getElementById('connect') || document.getElementById('reconnect');
  if (c) c.onclick = async () => {
    try {
      const { url } = await api('/api/meta/start', { body: {} });
      location.href = url;
    } catch (e) { toast(e.message, true); }
  };
  const sel = document.getElementById('pageSel');
  if (sel) sel.onchange = async () => { S = await api('/api/meta/select', { body: { pageId: sel.value } }); route(); };
}

function pushBlock() {
  if (isIOS() && !isStandalone()) {
    return `<div class="card">
      <p><b>Primero, instala la app en tu iPhone</b> (Apple solo permite notificaciones a las apps de la pantalla de inicio):</p>
      <ol class="ios-steps">
        <li>Abre esta página en <b>Safari</b>.</li>
        <li>Pulsa el botón <b>Compartir</b> (el cuadrado con la flecha ↑).</li>
        <li>Elige <b>«Añadir a pantalla de inicio»</b> y pulsa Añadir.</li>
        <li>Abre la app desde el nuevo icono ✦ y activa aquí las notificaciones.</li>
      </ol>
      <p class="small muted mt">Requiere iOS 16.4 o posterior.</p>
    </div>`;
  }
  if (!pushSupported()) return `<div class="notice warn">Este navegador no admite notificaciones push. En iPhone, usa Safari y añade la app a la pantalla de inicio.</div>`;
  const perm = Notification.permission;
  if (perm === 'denied') return `<div class="notice err">Has bloqueado las notificaciones. Actívalas en Ajustes del iPhone → Notificaciones → Luz del Norte.</div>`;
  return `<div class="card">
      <p>${perm === 'granted' && S.pushDevices ? '✅ Notificaciones activadas en ' + S.pushDevices + ' dispositivo/s.' : 'Pulsa el botón y acepta el aviso del iPhone.'}</p>
      <div class="btns ${perm === 'granted' && S.pushDevices ? 'two' : ''} mt">
        <button class="btn primary" id="pushOn">${perm === 'granted' && S.pushDevices ? 'Reactivar' : 'Activar notificaciones'}</button>
        ${perm === 'granted' && S.pushDevices ? '<button class="btn" id="pushTest">Enviar prueba</button>' : ''}
      </div>
    </div>`;
}

function b64ToBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No se han permitido las notificaciones.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(S.vapidPublicKey) });
  await api('/api/push/subscribe', { body: sub.toJSON() });
  await refresh();
  await api('/api/push/test', { body: {} });
}

function bindPush() {
  const on = document.getElementById('pushOn');
  if (on) on.onclick = async () => {
    on.disabled = true;
    try { await enablePush(); toast('Notificaciones activadas. Te hemos enviado una de prueba.'); route(); }
    catch (e) { toast(e.message, true); on.disabled = false; }
  };
  const t = document.getElementById('pushTest');
  if (t) t.onclick = async () => {
    const r = await api('/api/push/test', { body: {} });
    toast(r.sent ? 'Notificación de prueba enviada' : 'No se pudo enviar. Pulsa "Reactivar".', !r.sent);
  };
}

function scheduleForm() {
  const s = S.settings;
  return `<div class="card">
    <h3>Horario diario</h3>
    <div class="grid2">
      <div><label class="f">Aviso al móvil</label><input type="time" id="notifyTime" value="${esc(s.notifyTime)}"></div>
      <div><label class="f">Publicación</label><input type="time" id="publishTime" value="${esc(s.publishTime)}"></div>
    </div>
    <label class="f">Recordatorio si no la has aprobado</label>
    <select id="reminderMinutes">${[0, 30, 60, 120, 180].map((n) => `<option value="${n}" ${Number(s.reminderMinutes) === n ? 'selected' : ''}>${n ? n + ' min antes de publicar' : 'Sin recordatorio'}</option>`).join('')}</select>
    <label class="f">Días en los que publicar</label>
    <div class="days">${DAY_ORDER.map((d) => `<button type="button" data-day="${d}" aria-pressed="${s.activeDays.includes(d)}">${DAY_NAMES[d]}</button>`).join('')}</div>
    <p class="small muted mt">Si a la hora de publicar no la has aprobado, no se publica: la foto vuelve a la cola y al día siguiente te llega otra.</p>
  </div>`;
}

function studioForm(short = false) {
  const s = S.settings;
  return `<div class="card">
    <h3>Tu estudio</h3>
    <label class="f">Nombre</label><input type="text" id="studioName" value="${esc(s.studioName)}">
    <label class="f">Ciudad o zona (para hashtags locales)</label><input type="text" id="city" value="${esc(s.city)}" placeholder="Ej.: A Coruña">
    <label class="f">Idioma de los textos</label>
    <select id="language">${[['mix', 'Castellano con toques de gallego (recomendado)'], ['gl', 'Más gallego (gancho, cierre y llamada a la acción en galego)'], ['es', 'Solo castellano']].map(([k, l]) => `<option value="${k}" ${(s.language || 'mix') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label class="f">Web</label><input type="url" id="website" value="${esc(s.website)}" inputmode="url">
    ${short ? '' : `
    <label class="f">Hashtag de marca</label><input type="text" id="brandHashtag" value="${esc(s.brandHashtag)}">
    <label class="f">Firma al final del texto (opcional)</label><input type="text" id="signature" value="${esc(s.signature)}" placeholder="📸 Luz del Norte Fotografía">
    <label class="f">Tus hashtags extra (se rotan con los del motivo)</label><input type="text" id="extraHashtags" value="${esc(s.extraHashtags)}" placeholder="#fotografogalicia #vodasgalicia">`}
  </div>`;
}

function bindDays() {
  $app.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
}

function collectForms() {
  const v = (id) => document.getElementById(id)?.value;
  const out = {};
  for (const k of ['notifyTime', 'publishTime', 'studioName', 'city', 'language', 'website', 'brandHashtag', 'signature', 'extraHashtags']) {
    if (v(k) !== undefined) out[k] = v(k);
  }
  if (v('reminderMinutes') !== undefined) out.reminderMinutes = Number(v('reminderMinutes'));
  const days = [...$app.querySelectorAll('[data-day]')];
  if (days.length) out.activeDays = days.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => Number(b.dataset.day));
  return out;
}

// ---------- HOY ----------
async function renderHome() {
  setTab('hoy');
  const [q] = await Promise.all([api('/api/queue'), refresh()]);
  const t = S.today;
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const date = new Date(S.now.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  let todayCard;
  if (t) {
    const hook = (t.captionIg || '').split('\n')[0];
    todayCard = `<div class="card ${t.status === 'pending' ? 'glow' : ''}">
      <div class="row spread"><h3>Publicación de hoy</h3><span class="badge ${t.status}">${STATUS[t.status] || t.status}</span></div>
      <div class="row mt">
        <img class="thumb l" src="${esc(t.photo?.thumb)}" alt="">
        <div><p>${esc(hook)}</p><p class="small muted">${motiveLabel(t.photo?.motive)} · ${t.status === 'published' ? 'publicada' : 'a las ' + esc(S.settings.publishTime)}</p></div>
      </div>
      <a class="btn ${t.status === 'pending' ? 'primary' : ''} block mt" href="#/revisar/${esc(t.id)}">${t.status === 'pending' ? 'Revisar y aprobar' : 'Ver publicación'}</a>
    </div>`;
  } else if (q.length) {
    const dayOn = S.settings.activeDays.includes(S.now.weekday);
    const past = S.now.hm >= S.settings.publishTime;
    todayCard = `<div class="card">
      <h3>Publicación de hoy</h3>
      <p class="muted">${!dayOn ? 'Hoy no es día de publicación.' : past ? 'La hora de publicar de hoy ya ha pasado. Mañana llega la siguiente.' : `Se preparará a las <b>${esc(S.settings.notifyTime)}</b> y te avisaré en el móvil.`}</p>
      ${dayOn && !past ? '<button class="btn block mt" id="prepNow">Prepararla ahora</button>' : ''}
    </div>`;
  } else {
    todayCard = `<div class="card empty"><div class="big">🌄</div><p>No hay fotos programadas.</p><a class="btn primary mt" href="#/subir">Subir fotos</a></div>`;
  }

  const days = q.filter((x) => x.plannedDate).slice(0, 10);
  $app.innerHTML = `${header('Hoy', date)}
    ${S.meta.lastError && !S.demo ? `<div class="notice err">${esc(S.meta.lastError)} <a href="#/ajustes">Ir a Ajustes</a></div>` : ''}
    ${todayCard}
    ${S.counts.new ? `<a class="notice warn mt" style="display:block;text-decoration:none;color:inherit" href="#/clasificar">Tienes <b>${S.counts.new}</b> foto/s sin clasificar → <u>elegir motivo</u></a>` : ''}
    <div class="stats mt">
      <div class="stat"><b>${S.counts.queued || 0}</b><span>en cola</span></div>
      <div class="stat"><b>${S.counts.new || 0}</b><span>sin clasificar</span></div>
      <div class="stat"><b>${S.counts.published || 0}</b><span>publicadas</span></div>
    </div>
    ${days.length ? `<div class="mt-l row spread"><h3>Próximos días</h3><a href="#/programa" class="small">Ver todo</a></div>
      <div class="strip mt">${days.map((d) => `<div class="d"><img src="${esc(d.thumb)}" alt="">${esc(fmtDate(d.plannedDate).replace(/^(Hoy|Mañana) · /, '$1 '))}</div>`).join('')}</div>` : ''}
    <div class="card mt-l"><div class="small muted" style="text-transform:uppercase;letter-spacing:1.4px">Consejo del día</div><p>${esc(tip)}</p></div>
    <p class="center mt"><a href="#/historial" class="small">Historial de publicaciones</a></p>
    ${demoBanner()}`;
  const prep = document.getElementById('prepNow');
  if (prep) prep.onclick = async () => {
    prep.disabled = true;
    try { const p = await api('/api/posts/today', { body: {} }); location.hash = '#/revisar/' + p.id; }
    catch (e) { toast(e.message, true); prep.disabled = false; }
  };
}

// ---------- SUBIR ----------
function getCropPref() { try { return localStorage.getItem('crop45') === '1'; } catch { return false; } }
function setCropPref(v) { try { localStorage.setItem('crop45', v ? '1' : '0'); } catch { /* sin almacenamiento */ } }

function renderUpload() {
  setTab('subir');
  $app.innerHTML = `${header('Subir fotos', 'Todas de golpe')}
    <label class="drop" for="files">
      <span class="big">✦</span>
      <b>Elegir fotos del carrete</b>
      <span class="small muted">Selecciona todas las que quieras compartir. Después eliges el motivo de cada una.</span>
    </label>
    <input type="file" id="files" accept="image/*" multiple hidden>
    <div class="card mt">
      <div class="switch"><span><b>Recortar a vertical 4:5</b><br><span class="small muted">Ocupa más pantalla en el feed. Si lo desactivas se respeta tu encuadre (solo se recorta si Instagram no admite la proporción).</span></span><input type="checkbox" id="crop45" ${getCropPref() ? 'checked' : ''}></div>
    </div>
    <div id="upProgress" class="mt" hidden>
      <p id="upText">Preparando…</p>
      <div class="progress"><i id="upBar"></i></div>
    </div>`;
  document.getElementById('crop45').onchange = (e) => setCropPref(e.target.checked);
  document.getElementById('files').onchange = (e) => uploadFiles([...e.target.files]);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo leer ${file.name}`)); };
    img.src = url;
  });
}

function render(img, sx, sy, sw, sh, w, quality) {
  const h = Math.round(w * sh / sw);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

// Ajusta la proporción a lo que admite Instagram (entre 4:5 vertical y 1,91:1 horizontal).
async function processImage(file, crop45) {
  const { img, url } = await loadImage(file);
  try {
    const W = img.naturalWidth, H = img.naturalHeight;
    let ratio = W / H;
    let target = crop45 ? 0.8 : Math.min(1.91, Math.max(0.8, ratio));
    let sw = W, sh = H;
    if (ratio > target) sw = Math.round(H * target); else if (ratio < target) sh = Math.round(W / target);
    const sx = Math.round((W - sw) / 2), sy = Math.round((H - sh) / 2);
    const outW = Math.min(1440, sw);
    return {
      image: render(img, sx, sy, sw, sh, outW, 0.9),
      thumb: render(img, sx, sy, sw, sh, Math.min(420, sw), 0.75),
      width: outW, height: Math.round(outW * sh / sw), name: file.name
    };
  } finally { URL.revokeObjectURL(url); }
}

async function uploadFiles(files) {
  if (!files.length) return;
  const crop45 = document.getElementById('crop45').checked;
  const box = document.getElementById('upProgress');
  const txt = document.getElementById('upText');
  const bar = document.getElementById('upBar');
  box.hidden = false;
  let ok = 0, failed = 0;
  for (let i = 0; i < files.length; i++) {
    txt.textContent = `Subiendo ${i + 1} de ${files.length}…`;
    bar.style.width = `${(i / files.length) * 100}%`;
    try {
      const data = await processImage(files[i], crop45);
      let tries = 0;
      while (true) {
        try { await api('/api/photos', { body: data }); break; }
        catch (e) { if (++tries >= 3) throw e; await new Promise((r) => setTimeout(r, 1200 * tries)); }
      }
      ok++;
    } catch (e) { failed++; console.warn(e); }
  }
  bar.style.width = '100%';
  txt.textContent = `${ok} foto/s subidas${failed ? ` · ${failed} con error` : ''}.`;
  await refresh();
  toast(`${ok} fotos subidas. Ahora elige el motivo de cada una.`);
  setTimeout(() => { location.hash = '#/clasificar'; }, 700);
}

// ---------- CLASIFICAR ----------
async function renderClassify() {
  setTab('subir');
  const photos = await api('/api/photos?status=new');
  selected = new Set([...selected].filter((id) => photos.some((p) => p.id === id)));
  if (!photos.length) {
    $app.innerHTML = `${header('Clasificar', 'Motivo de cada foto', '#/subir')}
      <div class="empty"><div class="big">✓</div><p>No hay fotos pendientes de clasificar.</p><a class="btn primary mt" href="#/programa">Ver la programación</a></div>`;
    return;
  }
  const ready = photos.filter((p) => p.motive).length;
  const chips = (p) => S.motives.map((m) => `<button class="chip" data-photo="${esc(p.id)}" data-motive="${m.key}" aria-pressed="${p.motive === m.key}">${m.emoji} ${esc(m.label)}</button>`).join('');
  $app.innerHTML = `${header('Clasificar', `${photos.length} foto/s nuevas`, '#/subir')}
    <p class="muted">Elige qué quieres destacar en cada foto: el texto se escribirá solo según el motivo. Toca una foto para seleccionarla y asignar el mismo motivo a varias a la vez.</p>
    <div id="bulk" class="card mt" ${selected.size ? '' : 'hidden'}>
      <div class="row spread"><b>${selected.size} seleccionada/s</b><button class="btn sm ghost" id="clearSel">Quitar selección</button></div>
      <div class="chips mt">${S.motives.map((m) => `<button class="chip" data-bulk="${m.key}">${m.emoji} ${esc(m.label)}</button>`).join('')}</div>
    </div>
    <div class="mt">${photos.map((p) => `
      <div class="photo-card ${selected.has(p.id) ? 'selected' : ''}" id="pc-${esc(p.id)}">
        <div class="img" data-toggle="${esc(p.id)}">
          <img src="${esc(p.thumb)}" alt="" loading="lazy">
          <span class="sel">${selected.has(p.id) ? '✓' : ''}</span>
          <button class="icon-btn del" data-del="${esc(p.id)}" aria-label="Eliminar">🗑</button>
        </div>
        <div class="body">
          <div class="chips">${chips(p)}</div>
          <details class="mt"><summary class="small">Añadir lugar o nota (opcional)</summary>
            <label class="f">Lugar</label><input type="text" data-field="lugar" data-id="${esc(p.id)}" value="${esc(p.lugar)}" placeholder="Ej.: Torre de Hércules">
            <label class="f">Nota que se añadirá al texto</label><input type="text" data-field="nota" data-id="${esc(p.id)}" value="${esc(p.nota)}" placeholder="Ej.: Gracias Ana y Luis por confiar en nosotros">
          </details>
        </div>
      </div>`).join('')}</div>
    <div class="sticky-actions">
      <button class="btn primary block" id="enqueue" ${ready ? '' : 'disabled'}>Añadir ${ready} a la programación</button>
      <p class="small muted center" id="missing" style="margin:8px 0 0" ${ready < photos.length ? '' : 'hidden'}>${photos.length - ready} sin motivo todavía</p>
    </div>`;

  // Actualiza la barra inferior sin volver a pintar toda la lista (no se pierde el scroll).
  const updateBar = () => {
    const n = photos.filter((p) => p.motive).length;
    const btn = document.getElementById('enqueue');
    btn.textContent = `Añadir ${n} a la programación`;
    btn.disabled = !n;
    const miss = document.getElementById('missing');
    miss.hidden = n === photos.length;
    miss.textContent = `${photos.length - n} sin motivo todavía`;
    const bulk = document.getElementById('bulk');
    bulk.hidden = !selected.size;
    bulk.querySelector('b').textContent = `${selected.size} seleccionada/s`;
  };
  $app.querySelectorAll('[data-motive]').forEach((b) => b.onclick = async () => {
    const p = photos.find((x) => x.id === b.dataset.photo);
    p.motive = p.motive === b.dataset.motive ? null : b.dataset.motive;
    document.querySelectorAll(`[data-photo="${CSS.escape(p.id)}"]`).forEach((c) => c.setAttribute('aria-pressed', c.dataset.motive === p.motive));
    updateBar();
    try { await api('/api/photos/' + p.id, { method: 'PATCH', body: { motive: p.motive } }); }
    catch (e) { toast(e.message, true); }
  });
  $app.querySelectorAll('[data-toggle]').forEach((el) => el.onclick = (e) => {
    if (e.target.closest('[data-del]')) return;
    const id = el.dataset.toggle;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    const card = document.getElementById('pc-' + id);
    card.classList.toggle('selected', selected.has(id));
    card.querySelector('.sel').textContent = selected.has(id) ? '✓' : '';
    updateBar();
  });
  $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('¿Eliminar esta foto?')) return;
    await api('/api/photos/' + b.dataset.del, { method: 'DELETE' });
    selected.delete(b.dataset.del);
    renderClassify();
  });
  $app.querySelectorAll('[data-field]').forEach((inp) => inp.onchange = () =>
    api('/api/photos/' + inp.dataset.id, { method: 'PATCH', body: { [inp.dataset.field]: inp.value } }).catch((e) => toast(e.message, true)));
  $app.querySelectorAll('[data-bulk]').forEach((b) => b.onclick = async () => {
    await api('/api/photos/bulk', { body: { ids: [...selected], motive: b.dataset.bulk } });
    selected.clear();
    renderClassify();
  });
  const cs = document.getElementById('clearSel');
  if (cs) cs.onclick = () => { selected.clear(); renderClassify(); };
  document.getElementById('enqueue').onclick = async () => {
    const r = await api('/api/photos/enqueue', { body: { ids: photos.filter((p) => p.motive).map((p) => p.id) } });
    await refresh();
    toast(`${r.added} foto/s programadas: una cada día.`);
    location.hash = '#/programa';
  };
}

// ---------- PROGRAMA ----------
async function renderQueue() {
  setTab('programa');
  const [q] = await Promise.all([api('/api/queue'), refresh()]);
  const t = S.today;
  const last = q.filter((x) => x.plannedDate).at(-1);
  $app.innerHTML = `${header('Programa', 'Una foto distinta cada día')}
    ${t && ['pending', 'approved'].includes(t.status) ? `<a class="card glow row" style="text-decoration:none;color:inherit" href="#/revisar/${esc(t.id)}">
      <img class="thumb" src="${esc(t.photo?.thumb)}" alt=""><div class="info"><div class="small" style="color:var(--gold)">HOY · ${esc(S.settings.publishTime)}</div><div>${motiveLabel(t.photo?.motive)}</div><span class="badge ${t.status}">${STATUS[t.status]}</span></div></a>` : ''}
    ${q.length ? `<p class="muted mt">${q.length} foto/s = contenido hasta el <b>${esc(last ? fmtDate(last.plannedDate, true) : '—')}</b>.</p>
      <div class="row wrap mt"><button class="btn sm" id="vary">Variar motivos</button><a class="btn sm ghost" href="#/subir">Añadir más</a></div>
      <div class="card mt">${q.map((p, i) => `
        <div class="q-item">
          <img class="thumb" src="${esc(p.thumb)}" alt="" loading="lazy">
          <div class="info">
            <div class="date">${p.plannedDate ? esc(fmtDate(p.plannedDate)) : 'Sin fecha'}</div>
            <div>${motiveLabel(p.motive)}</div>
            ${p.lugar ? `<div class="small muted">📍 ${esc(p.lugar)}</div>` : ''}
          </div>
          <div class="mv">
            <button class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button class="icon-btn" data-down="${i}" ${i === q.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
          </div>
          <button class="icon-btn" data-out="${esc(p.id)}" aria-label="Quitar de la programación">✕</button>
        </div>`).join('')}</div>`
      : `<div class="card empty mt"><div class="big">🗓</div><p>No hay nada programado.</p><a class="btn primary mt" href="#/subir">Subir fotos</a></div>`}
    ${demoBanner()}`;

  const ids = q.map((p) => p.id);
  const move = async (i, d) => {
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await api('/api/queue/reorder', { body: { ids } });
    renderQueue();
  };
  $app.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => move(Number(b.dataset.up), -1));
  $app.querySelectorAll('[data-down]').forEach((b) => b.onclick = () => move(Number(b.dataset.down), 1));
  $app.querySelectorAll('[data-out]').forEach((b) => b.onclick = async () => {
    await api('/api/photos/' + b.dataset.out, { method: 'PATCH', body: { status: 'new' } });
    toast('Quitada. La tienes en "Clasificar".');
    renderQueue();
  });
  const v = document.getElementById('vary');
  if (v) v.onclick = async () => { await api('/api/queue/vary', { body: {} }); toast('Reordenado para no repetir motivo dos días seguidos.'); renderQueue(); };
}

// ---------- REVISAR ----------
function analyze(text, net) {
  const first = (text.split('\n')[0] || '').trim();
  const tags = (text.match(/#[\p{L}\p{N}_]+/gu) || []);
  return {
    hook: first.length > 0 && first.length <= 125,
    cta: /\?|coment|guárd|guard|compart|etiquet|escríb|escrib|mensaje|cuéntan|dinos/i.test(text),
    tags: net === 'instagram' ? tags.length >= 1 && tags.length <= 5 : tags.length <= 3,
    place: /📍/.test(text),
    tagCount: tags.length,
    first
  };
}

async function renderReview(id) {
  setTab('hoy');
  const post = await api('/api/posts/' + id);
  if (!S) await refresh();
  const editable = ['pending', 'approved', 'error', 'partial', 'expired'].includes(post.status);
  const nets = new Set(post.networks);
  const enabledNets = ['instagram', 'facebook'].filter((n) => S.settings.networks.includes(n) || nets.has(n));
  if (!enabledNets.includes(reviewTab)) reviewTab = enabledNets[0] || 'instagram';
  const text = reviewTab === 'instagram' ? post.captionIg : post.captionFb;
  const isToday = post.date === S.now.date;
  const names = { instagram: 'Instagram', facebook: 'Facebook' };

  let banner = '';
  if (post.status === 'pending') banner = `<div class="notice warn">Pendiente de aprobar. ${isToday ? `Si la apruebas, se publicará hoy a las <b>${esc(S.settings.publishTime)}</b>.` : ''}</div>`;
  if (post.status === 'approved') banner = `<div class="notice ok">Aprobada ✓ ${isToday ? `Se publicará a las <b>${esc(S.settings.publishTime)}</b>.` : ''}</div>`;
  if (post.status === 'expired') banner = `<div class="notice">No se aprobó a tiempo y no se publicó. Puedes publicarla ahora si quieres.</div>`;
  if (post.status === 'skipped') banner = `<div class="notice">La saltaste. La foto volvió a la cola.</div>`;
  if (['published', 'partial', 'error'].includes(post.status)) {
    banner = Object.entries(post.results || {}).map(([n, r]) => r.ok
      ? `<div class="notice ok">✓ ${names[n]}${r.demo ? ' (simulada, modo prueba)' : ''}${r.permalink ? ` · <a href="${esc(r.permalink)}" target="_blank" rel="noopener">ver publicación</a>` : ''}</div>`
      : `<div class="notice err">✕ ${names[n]}: ${esc(r.error)}</div>`).join('<div style="height:8px"></div>');
  }

  const a = analyze(text || '', reviewTab);
  $app.innerHTML = `${header(fmtDate(post.date, true), STATUS[post.status] || '', '#/')}
    ${banner}
    <div class="review-photo mt"><img src="${esc(post.photo?.full)}" alt=""></div>
    <p class="small muted mt">${motiveLabel(post.photo?.motive)}${post.photo?.lugar ? ' · 📍 ' + esc(post.photo.lugar) : ''}</p>

    ${editable ? `<label class="f">Publicar en</label>
      <div class="chips wrap">${['instagram', 'facebook'].filter((n) => S.settings.networks.includes(n) || nets.has(n)).map((n) => `<button class="chip" data-pnet="${n}" aria-pressed="${nets.has(n)}">${names[n]}</button>`).join('')}</div>` : ''}

    ${enabledNets.length > 1 ? `<div class="seg mt" role="tablist">${enabledNets.map((n) => `<button role="tab" data-rtab="${n}" aria-selected="${reviewTab === n}">${names[n]}</button>`).join('')}</div>` : ''}
    <label class="f">Texto para ${names[reviewTab]}</label>
    <textarea id="caption" ${editable ? '' : 'readonly'}>${esc(text)}</textarea>
    <div class="counter"><span class="${(text || '').length > (reviewTab === 'instagram' ? 2200 : 5000) ? 'bad' : ''}">${(text || '').length} caracteres</span> · <span class="${reviewTab === 'instagram' && a.tagCount > 5 ? 'bad' : ''}">${a.tagCount} hashtags${reviewTab === 'instagram' ? ' (máx. 5)' : ''}</span></div>

    <div class="card mt">
      <b>Lo que se verá antes de "más"</b>
      <div class="preview-line mt">${esc(a.first.slice(0, 125))}${a.first.length > 125 ? '…' : ''}</div>
      <ul class="checklist" id="checks">
        <li class="${a.hook ? 'ok' : ''}">Gancho corto en la primera línea</li>
        <li class="${a.cta ? 'ok' : ''}">Pregunta o llamada a la acción</li>
        <li class="${a.tags ? 'ok' : ''}">${reviewTab === 'instagram' ? 'Entre 1 y 5 hashtags específicos' : 'Pocos hashtags (máx. 3 en Facebook)'}</li>
        <li class="${a.place ? 'ok' : ''}">Ubicación indicada</li>
      </ul>
    </div>

    ${post.status === 'pending' ? `<div class="card mt"><b>Otras opciones</b>
        <div class="btns two mt"><button class="btn sm" id="regen">Otro texto</button><button class="btn sm" id="swap">Otra foto</button></div>
        <div class="btns two mt"><button class="btn sm ghost" id="skip">Hoy no publicar</button><button class="btn sm ghost" id="pubNow">Publicar ya</button></div>
      </div>` : ''}
    ${post.status === 'approved' ? `<button class="btn sm ghost block mt" id="unapprove">Deshacer aprobación</button>` : ''}
    ${editable ? `<div class="sticky-actions">
      ${post.status === 'pending' ? `<button class="btn primary block" id="approve">Aprobar${isToday ? ' · se publica a las ' + esc(S.settings.publishTime) : ''}</button>` : ''}
      ${post.status === 'approved' ? `<div class="btns two"><button class="btn" id="save">Guardar cambios</button><button class="btn primary" id="pubNow">Publicar ya</button></div>` : ''}
      ${['error', 'partial', 'expired'].includes(post.status) ? `<button class="btn primary block" id="pubNow">${post.status === 'expired' ? 'Publicar ahora' : 'Reintentar'}</button>` : ''}
    </div>` : ''}`;

  const $c = document.getElementById('caption');
  let dirty = false;
  const body = () => {
    const b = { networks: [...nets] };
    if (dirty) b[reviewTab === 'instagram' ? 'captionIg' : 'captionFb'] = $c.value;
    return b;
  };
  $c.oninput = () => {
    dirty = true;
    const r = analyze($c.value, reviewTab);
    const lis = document.querySelectorAll('#checks li');
    [r.hook, r.cta, r.tags, r.place].forEach((ok, i) => lis[i].classList.toggle('ok', ok));
    document.querySelector('.preview-line').textContent = r.first.slice(0, 125) + (r.first.length > 125 ? '…' : '');
    document.querySelector('.counter').innerHTML = `${$c.value.length} caracteres · ${r.tagCount} hashtags${reviewTab === 'instagram' ? ' (máx. 5)' : ''}`;
  };
  const saveIfDirty = async () => { if (dirty) { await api('/api/posts/' + post.id, { method: 'PATCH', body: body() }); dirty = false; } };

  $app.querySelectorAll('[data-rtab]').forEach((b) => b.onclick = async () => {
    if (editable) await saveIfDirty();
    reviewTab = b.dataset.rtab;
    renderReview(id);
  });
  $app.querySelectorAll('[data-pnet]').forEach((b) => b.onclick = async () => {
    const n = b.dataset.pnet;
    nets.has(n) ? nets.delete(n) : nets.add(n);
    await api('/api/posts/' + post.id, { method: 'PATCH', body: body() });
    dirty = false;
    renderReview(id);
  });

  const act = (elId, fn) => { const el = document.getElementById(elId); if (el) el.onclick = async () => {
    el.disabled = true;
    try { await fn(); } catch (e) { toast(e.message, true); } finally { el.disabled = false; }
  }; };
  act('approve', async () => {
    if (!nets.size) throw new Error('Elige al menos una red social.');
    await api(`/api/posts/${post.id}/approve`, { body: body() });
    toast('Aprobada. Se publicará a su hora ✓');
    renderReview(id);
  });
  act('save', async () => { await saveIfDirty(); toast('Cambios guardados'); });
  act('unapprove', async () => { await api(`/api/posts/${post.id}/unapprove`, { body: body() }); renderReview(id); });
  act('regen', async () => {
    if (dirty && !confirm('Perderás los cambios que has hecho en el texto. ¿Generar otro?')) return;
    await api(`/api/posts/${post.id}/regenerate`, { body: {} });
    renderReview(id);
  });
  act('swap', async () => {
    const np = await api(`/api/posts/${post.id}/swap`, { body: {} });
    toast('Cambiada por la siguiente foto de la cola');
    location.hash = '#/revisar/' + np.id;
  });
  act('skip', async () => {
    if (!confirm('Hoy no se publicará nada. La foto vuelve a la cola. ¿Seguro?')) return;
    await api(`/api/posts/${post.id}/skip`, { body: {} });
    renderReview(id);
  });
  act('pubNow', async () => {
    if (!nets.size) throw new Error('Elige al menos una red social.');
    if (!confirm(`¿Publicar ahora en ${[...nets].map((n) => names[n]).join(' y ')}?`)) return;
    toast('Publicando…');
    const r = await api(`/api/posts/${post.id}/publish`, { body: body() });
    toast(r.status === 'published' ? '¡Publicado!' : 'Hubo un problema al publicar', r.status !== 'published');
    renderReview(id);
  });
}

// ---------- HISTORIAL ----------
async function renderHistory() {
  setTab('hoy');
  const posts = await api('/api/posts');
  $app.innerHTML = `${header('Historial', 'Publicaciones', '#/')}
    ${posts.length ? `<div class="card">${posts.map((p) => `
      <a class="q-item" style="text-decoration:none;color:inherit" href="#/revisar/${esc(p.id)}">
        <img class="thumb" src="${esc(p.photo?.thumb || '')}" alt="">
        <div class="info"><div class="date">${esc(fmtDate(p.date))}</div><div class="small">${esc((p.captionIg || '').split('\n')[0])}</div></div>
        <span class="badge ${p.status}">${STATUS[p.status] || p.status}</span>
      </a>`).join('')}</div>` : '<div class="empty"><p>Todavía no hay publicaciones.</p></div>'}`;
}

// ---------- AJUSTES ----------
async function renderSettings() {
  setTab('ajustes');
  await refresh();
  const nets = new Set(S.settings.networks);
  $app.innerHTML = `${header('Ajustes')}
    <div class="card">
      <h3>Redes sociales</h3>
      <div class="choice mt">
        <button data-net="instagram" aria-pressed="${nets.has('instagram')}"><span class="ic ig">◎</span><span><b>Instagram</b></span><span class="check">✓</span></button>
        <button data-net="facebook" aria-pressed="${nets.has('facebook')}"><span class="ic fb">f</span><span><b>Facebook</b></span><span class="check">✓</span></button>
      </div>
    </div>
    <div class="card"><h3>Cuenta de Meta</h3><div class="mt">${connectBlock()}</div>
      ${S.meta.connected ? '<button class="btn sm ghost danger mt" id="disconnect">Desconectar</button>' : ''}</div>
    <div class="card"><h3>Notificaciones</h3><div class="mt">${pushBlock()}</div></div>
    ${scheduleForm()}
    ${studioForm(false)}
    <button class="btn primary block mt" id="saveSettings">Guardar ajustes</button>
    <hr>
    <button class="btn ghost block" id="logout">Cerrar sesión</button>
    <p class="small muted center mt">Graph API ${esc(S.graphVersion)} · Zona horaria ${esc(S.settings.timezone)}</p>
    ${demoBanner()}`;
  bindConnect();
  bindPush();
  bindDays();
  $app.querySelectorAll('[data-net]').forEach((b) => b.onclick = async () => {
    const n = b.dataset.net;
    nets.has(n) ? nets.delete(n) : nets.add(n);
    if (!nets.size) { toast('Deja al menos una red activa.', true); nets.add(n); return; }
    S = await api('/api/settings', { method: 'PUT', body: { networks: [...nets] } });
    renderSettings();
  });
  const dc = document.getElementById('disconnect');
  if (dc) dc.onclick = async () => { if (confirm('¿Desconectar la cuenta? Dejará de publicarse.')) { S = await api('/api/meta/disconnect', { body: {} }); renderSettings(); } };
  document.getElementById('saveSettings').onclick = async () => {
    try { S = await api('/api/settings', { method: 'PUT', body: collectForms() }); toast('Ajustes guardados'); }
    catch (e) { toast(e.message, true); }
  };
  document.getElementById('logout').onclick = async () => { await api('/api/logout', { body: {} }); S = null; location.hash = '#/login'; };
}

// ---------- arranque ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW', e));
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'open' && e.data.url) location.href = e.data.url;
  });
}
route();
