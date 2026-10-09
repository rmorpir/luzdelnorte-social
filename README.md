# Luz del Norte · Redes

App para iPhone que publica **una foto distinta cada día** en Instagram y Facebook, con un texto escrito automáticamente según el motivo de la foto. Antes de publicar, el fotógrafo recibe una **notificación push** en el móvil para aprobarla, editarla o cambiarla.

- **Sin IA y sin costes por uso.** Los textos salen de plantillas escritas a mano (ganchos, llamadas a la acción y hashtags) que rotan para no repetirse.
- **Sin depender de Claude ni de servicios de terceros** para las notificaciones: se usa el estándar Web Push con el servicio de Apple.
- **Sin pedir contraseñas de Instagram/Facebook.** Se usa el inicio de sesión oficial de Meta. Pedir la contraseña está prohibido por Meta y provoca bloqueos de cuenta.
- **Sin dependencias**: solo Node.js. No hace falta `npm install`.

---

## Cómo funciona

1. **Primera vez**: la app pregunta en qué redes publicar (Instagram, Facebook o ambas). Después conecta la cuenta con "Continuar con Facebook", activa los avisos y fija el horario.
2. **Subir**: se eligen todas las fotos de golpe desde el carrete. La app las ajusta a las proporciones que admite Instagram.
3. **Clasificar**: en cada foto se toca el motivo que se quiere destacar: boda, preboda, retrato, embarazo, recién nacido, familia, comunión, infantil, paisaje, evento, empresa, mascotas, detrás de cámaras u otro. Opcionalmente se añade lugar y nota.
4. **Programa**: las fotos quedan en cola, una por día. El botón "Variar motivos" evita repetir el mismo motivo dos días seguidos.
5. **Cada día**:
   - A la hora del aviso (por defecto 10:00) el servidor prepara la publicación y envía un push al iPhone.
   - Al tocarlo se abre la revisión. Desde ahí puedes **Aprobar**, editar el texto, pedir **Otro texto**, **Otra foto**, **Hoy no publicar** o **Publicar ya**.
   - Si no está aprobada, llega un recordatorio antes de la hora de publicar.
   - A la hora de publicar (por defecto 19:30) se publica **solo si está aprobada**. Si no, no se publica: la foto vuelve al final de la cola y al día siguiente llega otra.

### Pautas que siguen los textos
- Gancho corto en la primera línea: menos de 125 caracteres, que es lo que se ve antes de "más".
- Historia y emoción antes que técnica.
- Una llamada a la acción (comentar, guardar, compartir, etiquetar) o una pregunta abierta.
- Máximo **5 hashtags** en Instagram, que es el límite actual: marca, zona y motivo. En Facebook, 2 hashtags y el enlace a la web.
- **Galego**: el público es sobre todo gallego, así que hay un ajuste «Idioma de los textos»:
  - **Castellano con toques de gallego** (por defecto): cada día va en gallego o el gancho o la llamada a la acción, alternando, más una frase de cierre como «Feito con agarimo en Galicia 💛». Se añade `#galicia` y, en bodas, `#vodas{ciudad}`.
  - **Más gallego**: gancho, llamada a la acción, contacto y cierre en gallego; el cuerpo sigue en castellano.
  - **Solo castellano**.
- La pantalla de revisión muestra una lista de comprobación con estas pautas mientras editas.

---

## Puesta en marcha (una sola vez)

### Paso 1 · Preparar Instagram y Facebook (en el móvil del fotógrafo)
1. Instagram → Ajustes → Tipo de cuenta → **Cambiar a cuenta profesional** (Creador o Empresa).
2. Tener una **Página de Facebook** del estudio (no un perfil personal).
3. Vincular la cuenta de Instagram a esa página desde el **Centro de cuentas** de Meta o desde Instagram (Ajustes → Cuentas vinculadas).

### Paso 2 · Crear la app de Meta (gratis, unos 10 minutos)
La crea el propio fotógrafo con su cuenta de Facebook. Así es administrador de la app y puede publicar en sus cuentas **sin pasar la revisión de Meta**, en modo desarrollo.

1. Entra en <https://developers.facebook.com>, inicia sesión y regístrate como desarrollador si te lo pide.
2. **Mis apps → Crear app**. Elige el caso de uso para **gestionar una Página** y el de **Instagram con inicio de sesión con Facebook**. Los nombres pueden variar un poco.
3. Añade el producto **Inicio de sesión con Facebook** y, en su configuración, en **URI de redirección de OAuth válidos**, pon:
   `https://TU-DOMINIO/auth/meta/callback`
4. Comprueba que la app puede pedir estos permisos:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
5. En **Configuración de la app → Básica**, copia el **Identificador de la app** (`META_APP_ID`) y la **Clave secreta** (`META_APP_SECRET`).
6. Si Meta te obliga a usar "Inicio de sesión con Facebook **para empresas**":
   - crea una **configuración** con los permisos anteriores,
   - copia su ID en `META_CONFIG_ID`.

> La clave secreta solo va en el servidor. Nunca la pongas en la app ni la compartas.

### Paso 3 · Poner la app en Internet (Netlify, gratis)
La app está preparada para **Netlify**:
- La web (carpeta `public/`) se sirve con HTTPS.
- `netlify/functions/api.mjs` atiende la app, la conexión con Facebook y las imágenes.
- `netlify/functions/tick.mjs` es el **reloj**: se ejecuta cada 5 minutos y, según la hora de Galicia, prepara la publicación, avisa al móvil, recuerda y publica.
- Fotos y datos se guardan en **Netlify Blobs**. No hay servidor que mantener ni que se "duerma".

Proyecto ya creado: **luzdelnorte-redes** → `https://luzdelnorte-redes.netlify.app`. Variables ya configuradas: `APP_PASSWORD`, `PUBLIC_URL`, `TZ_APP`, `VAPID_SUBJECT`.

1. El código está en el repositorio privado de GitHub `rmorpir/luzdelnorte-social`.
2. En Netlify: proyecto **luzdelnorte-redes** → **Project configuration → Build & deploy → Continuous deployment → Link repository** → GitHub → `luzdelnorte-social`. No hace falta cambiar nada en la configuración de compilación: la lee de `netlify.toml`. Netlify publica la app sola y vuelve a publicarla en cada cambio.
3. Cuando tengas la app de Meta (paso 2), añade en **Project configuration → Environment variables**:
   - `META_APP_ID` (el identificador de la app)
   - `META_APP_SECRET` (la clave secreta; márcala como secreta)
   - opcional: `META_CONFIG_ID`

   Después ve a **Deploys → Trigger deploy**. Mientras falten, la app funciona en **modo prueba** (todo igual, pero sin publicar de verdad).
4. En la app de Meta, la URI de redirección es `https://luzdelnorte-redes.netlify.app/auth/meta/callback`.

> El reloj programado de Netlify solo funciona en el despliegue de producción (la rama `main`).

**Alternativa: servidor propio (VPS) con Docker**
```bash
cp .env.example .env              # y rellénalo
nano Caddyfile                    # pon tu dominio
docker compose up -d              # HTTPS automático con Caddy
```

**Probar en local, sin publicar de verdad** (Node 20+, sin instalar nada)
```bash
node server/local.mjs             # http://localhost:3000 · contraseña: luzdelnorte
node test/smoke.mjs               # prueba automática de todo el flujo
```

### Paso 4 · Instalar en el iPhone (iOS 16.4 o posterior)
1. Abre `https://luzdelnorte-redes.netlify.app` en **Safari** y entra con `APP_PASSWORD`.
2. Pulsa **Compartir** → **Añadir a pantalla de inicio**.
3. Abre la app **desde el icono nuevo** y sigue la bienvenida:
   - elegir redes,
   - Continuar con Facebook,
   - Activar notificaciones,
   - horario.

> Apple solo permite notificaciones push en webs añadidas a la pantalla de inicio. Por eso no hace falta App Store ni cuenta de desarrollador de Apple.

---

## Personalizar
- **Logo**: ya está el oficial. `public/brand/logo-original.webp` es el archivo recibido; `logo.png` (líneas crema para el fondo oscuro de la app) y los iconos de `public/icons/` se generan a partir de él. Si cambia el logo, sustituye esos archivos con los mismos nombres y tamaños.
- **Colores**: variables al principio de `public/styles.css`.
- **Textos y hashtags**: `lib/captions.mjs` (las frases en gallego están en el bloque `GALEGO`). Cada motivo tiene ganchos, cuerpos, llamadas a la acción y hashtags. Añade frases sin miedo: cuantas más haya, más variedad.
- **Horario, días, ciudad, web, hashtag de marca, firma y hashtags propios**: desde la pestaña Ajustes de la app.

## Seguridad y privacidad
- La app está protegida con `APP_PASSWORD` y limita los intentos de acceso.
- Se guarda un **token de permiso** de Meta, nunca la contraseña. Se puede revocar en Facebook → Configuración → Integraciones empresariales.
- Las fotos se sirven a Instagram/Facebook desde una URL pública con un nombre aleatorio imposible de adivinar. Las miniaturas de la app requieren sesión.
- En Netlify, los datos se guardan en **Data & Storage → Blobs**:
  - `ldn-state`: datos, claves de notificaciones y firma de sesión.
  - `ldn-media`: las fotos.
- Cada cambio se guarda con control de versión, así que el reloj y las acciones desde el móvil nunca se pisan. Una publicación tampoco puede salir dos veces.
- Con Docker o en local, todo va en la carpeta `DATA_DIR` (`db.json` y `media/`). Haz copia de seguridad.

## Solución de problemas
| Problema | Qué hacer |
|---|---|
| No llegan notificaciones | Abre la app desde el icono (no desde Safari) → Ajustes → Reactivar → Enviar prueba. Revisa Ajustes del iPhone → Notificaciones → Luz del Norte. |
| "No hay cuenta de Instagram profesional vinculada" | Repite el Paso 1 y vuelve a conectar en Ajustes → Volver a conectar. Marca la página **y** la cuenta de Instagram en la ventana de Facebook. |
| "La conexión con Facebook ha caducado" | Ajustes → Volver a conectar. |
| Error de Instagram al procesar la imagen | Instagram admite proporciones entre 4:5 y 1,91:1. La app las ajusta sola; si persiste, vuelve a subir la foto. |
| No se publica a la hora | El reloj se ejecuta cada 5 minutos: puede publicar hasta 5 min después. En Netlify → Logs → Functions → `tick` se ve cada ejecución. |
| Aparece "Modo prueba" | Faltan `META_APP_ID`/`META_APP_SECRET` en el servidor, o `DEMO_MODE=1`. |

## Estructura
```
lib/
  app.mjs            API (Request → Response), igual en Netlify y en local
  scheduler.mjs      reloj diario: preparar, avisar, recordar y publicar
  captions.mjs       generador de textos por motivo, con gallego (sin IA)
  meta.mjs           conexión oficial con Facebook/Instagram (Graph API)
  webpush.mjs        notificaciones push estándar (VAPID + cifrado aes128gcm)
  state.mjs          estado en un documento JSON con transacciones
  blobs-adapter.mjs  almacenamiento en Netlify Blobs
  fs-adapter.mjs     almacenamiento en disco (local / Docker)
netlify/functions/   api.mjs (web) y tick.mjs (reloj cada 5 min)
server/local.mjs     servidor local / Docker
public/              app para iPhone (PWA): index.html, app.js, styles.css, sw.js
test/smoke.mjs       prueba de extremo a extremo
```
