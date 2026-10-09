// Almacenamiento en disco para el servidor local / Docker (misma interfaz que Netlify Blobs).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function fsContext(dir) {
  const DATA = path.resolve(dir);
  const MEDIA = path.join(DATA, 'media');
  const FILE = path.join(DATA, 'db.json');
  fs.mkdirSync(MEDIA, { recursive: true });
  const tagOf = (txt) => crypto.createHash('sha1').update(txt).digest('hex');
  const readRaw = () => { try { return fs.readFileSync(FILE, 'utf8'); } catch { return null; } };
  const safe = (key) => path.join(MEDIA, path.basename(key));

  return {
    adapter: {
      async load() {
        const raw = readRaw();
        return raw ? { data: JSON.parse(raw), etag: tagOf(raw) } : { data: null, etag: null };
      },
      // Comprobar y escribir de forma síncrona = atómico dentro del proceso.
      async save(data, etag) {
        const raw = readRaw();
        const current = raw ? tagOf(raw) : null;
        if (current !== etag) return false;
        const tmp = FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data));
        fs.renameSync(tmp, FILE);
        return true;
      }
    },
    media: {
      async get(key) { try { return fs.readFileSync(safe(key)); } catch { return null; } },
      async set(key, bytes) { fs.writeFileSync(safe(key), bytes); },
      async delete(key) { fs.rmSync(safe(key), { force: true }); }
    }
  };
}
