// Web Push estándar (RFC 8030 / 8291 / 8292) implementado solo con node:crypto.
// Funciona con el servicio push de Apple (web.push.apple.com) para apps añadidas a la
// pantalla de inicio del iPhone, y con Chrome/Firefox. No depende de ninguna IA.
import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

export function generateVapid() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const publicKey = b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]));
  return { publicKey, jwk };
}

export function vapidJwt(vapid, audience, subject) {
  const key = crypto.createPrivateKey({ key: vapid.jwk, format: 'jwk' });
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const data = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${b64u(sig)}`;
}

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

function derive(authSecret, shared, uaPublic, asPublic, salt) {
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  return {
    cek: hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16),
    nonce: hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12)
  };
}

export function encrypt(payload, uaPublicB64, authSecretB64) {
  const uaPublic = fromB64u(uaPublicB64);
  const authSecret = fromB64u(authSecretB64);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = crypto.randomBytes(16);
  const { cek, nonce } = derive(authSecret, ecdh.computeSecret(uaPublic), uaPublic, asPublic, salt);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, ct]);
}

// Descifrado: solo para las pruebas automáticas (simula lo que hace el iPhone).
export function decrypt(body, uaEcdh, authSecret) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  const { cek, nonce } = derive(authSecret, uaEcdh.computeSecret(asPublic), uaEcdh.getPublicKey(), asPublic, salt);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return pt.subarray(0, pt.lastIndexOf(2)).toString();
}

export async function send(vapid, subject, subscription, data, { ttl = 86400, urgency = 'high' } = {}) {
  const endpoint = new URL(subscription.endpoint);
  const body = encrypt(JSON.stringify(data), subscription.keys.p256dh, subscription.keys.auth);
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: String(ttl),
      Urgency: urgency,
      Authorization: `vapid t=${vapidJwt(vapid, endpoint.origin, subject)}, k=${vapid.publicKey}`
    },
    body
  });
  const text = res.ok ? '' : await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, text };
}
