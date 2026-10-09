// API de la app: /api/*, conexión con Facebook y servicio de imágenes.
import { handle } from '../../lib/app.mjs';
import { blobsContext, envFrom } from '../../lib/blobs-adapter.mjs';

export default async (req, context) => handle(req, { ...blobsContext(), env: envFrom(context), ip: context.ip });

export const config = {
  path: ['/api/*', '/auth/meta/callback', '/p/*', '/m/*']
};
