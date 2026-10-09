// Almacenamiento en Netlify Blobs (solo se usa dentro de Netlify).
// - "ldn-state": un documento JSON con el estado; se guarda con escritura condicional (etag)
//   para que el reloj y las acciones desde el móvil no se pisen.
// - "ldn-media": las fotos (JPEG).
import { getStore } from '@netlify/blobs';

export function blobsContext() {
  const state = getStore({ name: 'ldn-state', consistency: 'strong' });
  const media = getStore({ name: 'ldn-media', consistency: 'strong' });
  return {
    adapter: {
      async load() {
        const r = await state.getWithMetadata('state', { type: 'json' });
        return r ? { data: r.data, etag: r.etag } : { data: null, etag: null };
      },
      async save(data, etag) {
        const r = etag
          ? await state.setJSON('state', data, { onlyIfMatch: etag })
          : await state.setJSON('state', data, { onlyIfNew: true });
        return r ? r.modified !== false : true;
      }
    },
    media: {
      async get(key) {
        const b = await media.get(key, { type: 'arrayBuffer' });
        return b ? new Uint8Array(b) : null;
      },
      async set(key, bytes) {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        await media.set(key, u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
      },
      async delete(key) { await media.delete(key); }
    }
  };
}

const KEYS = ['APP_PASSWORD', 'META_APP_ID', 'META_APP_SECRET', 'META_CONFIG_ID', 'META_GRAPH_VERSION', 'PUBLIC_URL', 'DEMO_MODE', 'VAPID_SUBJECT', 'TZ_APP'];

export function envFrom(context) {
  const get = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
  const env = Object.fromEntries(KEYS.map((k) => [k, get(k) || '']));
  env.PUBLIC_URL = (env.PUBLIC_URL || context?.site?.url || process.env.URL || '').replace(/\/$/, '');
  return env;
}
