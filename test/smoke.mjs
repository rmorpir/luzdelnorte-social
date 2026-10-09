// Prueba de extremo a extremo en modo prueba (sin publicar de verdad), con el mismo código
// que se ejecuta en Netlify y el almacenamiento local:
// login → ajustes → subir → clasificar → programar → aviso push (descifrado real) → aprobar → publicar → caducidad.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/local.mjs';
import { tick } from '../lib/scheduler.mjs';
import { readState } from '../lib/state.mjs';
import * as webpush from '../lib/webpush.mjs';
import { GALEGO } from '../lib/captions.mjs';
import { parts, toMinutes } from '../lib/time.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ldn-test-'));
const hm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// "iPhone" simulado: recibe pushes, valida la firma VAPID y descifra el contenido.
const ua = crypto.createECDH('prime256v1');
ua.generateKeys();
const auth = crypto.randomBytes(16);
const received = [];
const pushServer = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const [, jwt, k] = req.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/);
    const [h, p, s] = jwt.split('.');
    const pub = Buffer.from(k, 'base64url');
    const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
    assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'firma VAPID válida');
    assert.equal(req.headers['content-encoding'], 'aes128gcm');
    received.push(JSON.parse(webpush.decrypt(Buffer.concat(chunks), ua, auth)));
    res.writeHead(201); res.end();
  });
});

const env = { APP_PASSWORD: 'prueba123', DEMO_MODE: '1', PUBLIC_URL: '' };
const { server, ctx } = createServer({ env, dataDir: tmp });

try {
  await new Promise((r) => pushServer.listen(0, r));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  env.PUBLIC_URL = base;
  let cookie = '';
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  // Acceso
  assert.equal((await call('GET', '/api/state')).status, 401);
  assert.equal((await call('POST', '/api/login', { password: 'mala' })).status, 401);
  assert.equal((await call('POST', '/api/login', { password: 'prueba123' })).status, 200);
  let st = (await call('GET', '/api/state')).data;
  assert.equal(st.demo, true);
  assert.equal(st.settings.language, 'mix');
  console.log('✓ login y estado');

  // Ajustes
  assert.equal((await call('PUT', '/api/settings', { networks: ['instagram', 'facebook'], city: 'A Coruña', onboarded: true })).status, 200);
  assert.equal((await call('PUT', '/api/settings', { notifyTime: '20:00', publishTime: '19:00' })).status, 400);
  assert.equal((await call('PUT', '/api/settings', { language: 'xx' })).status, 400);
  console.log('✓ ajustes y validaciones');

  // Push al "iPhone" simulado
  const endpoint = `http://127.0.0.1:${pushServer.address().port}/push/abc`;
  await call('POST', '/api/push/subscribe', { endpoint, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } });
  assert.equal((await call('POST', '/api/push/test', {})).data.sent, 1);
  assert.equal(received.at(-1).title, '🔔 Notificaciones activadas');
  console.log('✓ notificación push cifrada, firmada y descifrada');

  // Subir 4 fotos
  const jpg = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(here, 'fixture.jpg')).toString('base64');
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const r = await call('POST', '/api/photos', { image: jpg, thumb: jpg, width: 1440, height: 1080, name: `foto${i}.jpg` });
    assert.equal(r.status, 201);
    ids.push(r.data.id);
  }
  assert.equal((await call('POST', '/api/photos', { image: 'data:image/jpeg;base64,AAAA', thumb: jpg })).status, 400);
  console.log('✓ subida de fotos');

  // Cambios simultáneos: ninguno se pierde (control de versiones)
  await Promise.all(ids.map((id, i) => call('PATCH', `/api/photos/${id}`, { lugar: `Lugar ${i}` })));
  const afterPar = await readState(ctx);
  assert.deepEqual(ids.map((id) => afterPar.photos.find((p) => p.id === id).lugar), ['Lugar 0', 'Lugar 1', 'Lugar 2', 'Lugar 3']);
  console.log('✓ cambios simultáneos sin pérdidas');

  // Clasificar y programar
  await call('POST', '/api/photos/bulk', { ids: ids.slice(0, 2), motive: 'boda' });
  await call('PATCH', `/api/photos/${ids[2]}`, { motive: 'retrato' });
  await call('PATCH', `/api/photos/${ids[3]}`, { motive: 'paisaje', lugar: 'Torre de Hércules' });
  assert.equal((await call('POST', '/api/photos/enqueue', { ids })).data.added, 4);
  await call('POST', '/api/queue/vary', {});
  const q = (await call('GET', '/api/queue')).data;
  assert.equal(q.length, 4);
  for (let i = 1; i < q.length; i++) assert.notEqual(q[i].motive, q[i - 1].motive, 'no repite motivo seguido');
  assert.equal(new Set(q.map((x) => x.plannedDate)).size, 4, 'una foto distinta cada día');
  console.log('✓ clasificación, cola y calendario');

  const tz = (await readState(ctx)).settings.timezone;
  const now = toMinutes(parts(new Date(), tz).hm);
  if (now < 5 || now > 23 * 60 + 50) {
    console.log('(hora límite: se omite la parte del reloj)');
  } else {
    // El reloj prepara la publicación del día y avisa
    await call('PUT', '/api/settings', { notifyTime: hm(now - 2), publishTime: hm(now + 5) });
    const before = received.length;
    await tick(ctx);
    st = (await call('GET', '/api/state')).data;
    assert.equal(st.today?.status, 'pending');
    assert.equal(received.length, before + 1);
    assert.match(received.at(-1).url, /#\/revisar\//);
    const tags = st.today.captionIg.match(/#[\p{L}\p{N}_]+/gu);
    assert.ok(tags.includes('#galicia'), '#galicia');
    assert.ok(tags.length <= 5, 'máx. 5 hashtags');
    assert.ok(GALEGO.closings.some((c) => st.today.captionIg.includes(c)), 'cierre en gallego');
    assert.ok(st.today.captionIg.split('\n')[0].length <= 125, 'gancho corto');
    console.log('✓ aviso diario automático:\n---\n' + st.today.captionIg + '\n---');

    await tick(ctx);
    const dbNow = await readState(ctx);
    assert.equal(dbNow.posts.filter((p) => p.date === st.today.date && p.status !== 'replaced').length, 1, 'una sola por día');

    // Otro texto y otra foto
    const t0 = st.today;
    const rg = (await call('POST', `/api/posts/${t0.id}/regenerate`, {})).data;
    assert.notEqual(rg.captionIg, t0.captionIg);
    const sw = (await call('POST', `/api/posts/${t0.id}/swap`, {})).data;
    assert.notEqual(sw.photoId, t0.photoId);
    console.log('✓ regenerar texto y cambiar foto');

    // Sin aprobación → no se publica y la foto vuelve a la cola
    await call('PUT', '/api/settings', { notifyTime: hm(now - 2), publishTime: hm(now - 1) });
    await tick(ctx);
    const exp = (await call('GET', `/api/posts/${sw.id}`)).data;
    assert.equal(exp.status, 'expired');
    assert.equal(exp.photo.status, 'queued');
    assert.equal(received.at(-1).title, 'Hoy no se ha publicado');
    console.log('✓ sin aprobación no se publica (foto de vuelta a la cola)');

    // Dos "Publicar ya" a la vez → solo uno publica
    const [a, b] = await Promise.all([
      call('POST', `/api/posts/${exp.id}/publish`, { captionIg: exp.captionIg + '\n\nEditado a mano ✍️', networks: ['instagram', 'facebook'] }),
      call('POST', `/api/posts/${exp.id}/publish`, {})
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], 'no se publica dos veces');
    const pub = (await call('GET', `/api/posts/${exp.id}`)).data;
    assert.equal(pub.status, 'published');
    assert.ok(pub.results.instagram.ok && pub.results.facebook.ok);
    assert.equal(received.at(-1).title, '✅ Publicación simulada (modo prueba)');
    console.log('✓ publicación (modo prueba) sin duplicados');

    // Aprobar y que publique el reloj a su hora
    const t2 = (await call('POST', '/api/posts/today', {})).data; // ya existe hoy → devuelve la de hoy
    assert.equal(t2.id, exp.id);

    // Imagen pública para Meta y miniaturas privadas
    const photo = (await readState(ctx)).photos.find((p) => p.id === pub.photoId);
    const img = await fetch(`${base}/p/${photo.file}`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/jpeg');
    assert.equal((await fetch(`${base}/m/${photo.thumb}`)).status, 401);
    assert.equal((await fetch(`${base}/p/${photo.thumb}`)).status, 404);
    console.log('✓ URL pública de la imagen para Instagram/Facebook');
  }

  // Aprobación normal → el reloj publica a la hora (simulando el día siguiente)
  const db0 = await readState(ctx);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const tp = parts(tomorrow, tz);
  await call('PUT', '/api/settings', { notifyTime: '00:00', publishTime: '23:59' });
  await tick(ctx, { at: tomorrow });
  const pending = (await readState(ctx)).posts.find((p) => p.date === tp.date);
  assert.ok(pending && pending.status === 'pending', 'post de mañana preparado');
  await call('POST', `/api/posts/${pending.id}/approve`, {});
  const lateAt = new Date(tomorrow);
  await call('PUT', '/api/settings', { notifyTime: '00:00', publishTime: '00:01' });
  await tick(ctx, { at: lateAt });
  const done = (await readState(ctx)).posts.find((p) => p.id === pending.id);
  assert.equal(done.status, 'published', 'el reloj publica la aprobada');
  assert.equal(db0.secrets.vapid.publicKey, (await readState(ctx)).secrets.vapid.publicKey, 'claves estables');
  console.log('✓ aprobada → publicada por el reloj a su hora');

  console.log('\nTodo correcto ✔');
} catch (e) {
  console.error('✗', e);
  process.exitCode = 1;
} finally {
  server.close(); pushServer.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
