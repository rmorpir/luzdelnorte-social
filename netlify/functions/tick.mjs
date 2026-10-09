// Reloj de la app: se ejecuta cada 5 minutos (UTC) y decide, según la hora de Galicia
// (Europe/Madrid, con horario de verano incluido), si toca preparar la publicación del día,
// enviar el recordatorio o publicar. Las horas se configuran en la app, no aquí.
import { tick } from '../../lib/scheduler.mjs';
import { blobsContext, envFrom } from '../../lib/blobs-adapter.mjs';

export default async (req, context) => {
  const plan = await tick({ ...blobsContext(), env: envFrom(context) }, { budgetMs: 18000 });
  console.log('tick', JSON.stringify({ pushes: plan.pushes.length, publish: plan.publish }));
};

export const config = {
  schedule: '*/5 * * * *'
};
