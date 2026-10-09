
// Generador de textos SIN inteligencia artificial: plantillas escritas a mano por motivo,
// combinadas con rotación para que cada día el texto sea distinto.
//
// Pautas que siguen las plantillas (buenas prácticas de alcance en Instagram/Facebook):
//  - Gancho corto en la primera línea (< 125 caracteres, lo que se ve antes de "más").
//  - Emoción o historia antes que descripción técnica.
//  - Una llamada a la acción clara: comentar, guardar, compartir o etiquetar.
//  - Pregunta abierta para provocar comentarios (lo que más empuja el alcance).
//  - Máximo 5 hashtags en Instagram (límite actual) y muy específicos: motivo + zona + marca.
//  - En Facebook: menos hashtags y enlace a la web (allí los enlaces sí son clicables).
//
// Sintaxis de plantillas: {lugar} {ciudad} {estudio} {web}. Lo que va entre [[ ]] desaparece
// entero si alguna variable de dentro está vacía. Ej.: "[[en {lugar}]]".

const MOTIVES = {
  boda: {
    label: 'Boda', emoji: '💍',
    hooks: [
      'Hay un segundo en cada boda que nadie más vio. Nosotros sí.',
      'Esta foto no se ensayó. Por eso emociona.',
      'Dentro de 30 años, esto es lo que querrán volver a mirar.',
      'El "sí, quiero" dura tres segundos. Esta mirada, para siempre.',
      'No fotografiamos bodas. Fotografiamos cómo se sintió.',
      'Si te pone la piel de gallina, la foto ha hecho su trabajo.'
    ],
    bodies: [
      'Entre nervios, abrazos y lágrimas que nadie esperaba, ocurrió esto[[ en {lugar}]]. Nuestro trabajo es estar en el sitio justo sin que se note que estamos.',
      'Las flores se marchitan, el traje se guarda y la tarta se acaba. Lo que queda es esto: la prueba de que aquel día fue real.',
      'Nos gusta la boda de verdad: la risa a destiempo, el abrazo que se alarga, el detalle que solo ve quien está atento[[. Así fue {lugar}]].',
      'Cada pareja tiene su forma de quererse. Nuestro trabajo no es inventarla, es contarla tal y como es.'
    ],
    ctas: [
      '¿Qué momento de tu boda volverías a vivir mañana mismo? Te leemos 👇',
      'Etiqueta a quien se casa pronto y necesita ver esto.',
      'Guárdala para cuando estés buscando fotógrafo 📌'
    ],
    tags: ['#fotografodebodas', '#bodasreales', '#bodasconalma', '#novias2026', '#fotografiadebodas', '#weddingphotographer', '#bodasbonitas', '#reportajedeboda', '#bodaespaña']
  },
  pareja: {
    label: 'Preboda / Pareja', emoji: '❤️',
    hooks: [
      'Así se ve el amor cuando nadie le dice cómo posar.',
      'Le pedimos que la mirara como el primer día. No hizo falta repetir.',
      'Hay parejas que no necesitan palabras. Esta es una de ellas.',
      'Dos personas, una luz bonita y cero guion.',
      'La complicidad no se fotografía: se espera.'
    ],
    bodies: [
      'Una sesión de pareja no va de posar bien. Va de pasarlo bien juntos mientras nosotros cazamos lo que surge[[. Esta vez, en {lugar}]].',
      'Paseamos, nos reímos y en algún momento se olvidaron de la cámara. Ahí apareció esta foto.',
      'Una preboda es el ensayo perfecto: perdéis el miedo a la cámara y el día de la boda solo os preocupáis de disfrutar.'
    ],
    ctas: [
      'Etiqueta a tu persona favorita 💛',
      '¿Lugar soñado para una sesión de pareja? Dínoslo en comentarios.',
      'Compártela con quien te mira así.'
    ],
    tags: ['#preboda', '#sesiondepareja', '#fotografiadepareja', '#couplegoals', '#lovestory', '#parejasreales', '#engagementsession', '#amorverdadero']
  },
  retrato: {
    label: 'Retrato', emoji: '👤',
    hooks: [
      '"Yo no salgo bien en las fotos." Eso nos dijo antes de esta.',
      'Un buen retrato no te cambia. Te enseña.',
      'Mira sus ojos. Ahí está toda la historia.',
      'La luz correcta lo cambia todo. Literalmente todo.',
      'Esto pasa cuando dejas de posar y empiezas a ser tú.'
    ],
    bodies: [
      'Casi todo el mundo llega a una sesión de retrato con la misma frase: "no soy fotogénico". Nadie lo es hasta que se siente cómodo. Nuestro trabajo empieza ahí.',
      'Sin filtros que te conviertan en otra persona. Luz, paciencia y conversación. El resultado eres tú en tu mejor versión real.',
      'Un retrato profesional sirve para tu marca, tu perfil o simplemente para tener una foto en la que te reconozcas y te guste.'
    ],
    ctas: [
      '¿Cuándo fue la última vez que te hicieron una foto que de verdad te gustara?',
      'Etiqueta a quien merece un retrato así y aún no lo sabe.',
      'Guarda esta idea para tu próxima foto de perfil 📌'
    ],
    tags: ['#retrato', '#fotografiaderetrato', '#portraitphotography', '#retratoprofesional', '#retratonatural', '#portrait', '#fotodeperfil', '#luznatural']
  },
  embarazo: {
    label: 'Embarazo', emoji: '🤰',
    hooks: [
      'Nueve meses que pasan volando. Esta foto los detiene.',
      'Un día le enseñará esta foto y le dirá: "aquí ya te queríamos".',
      'La espera más bonita merecía un recuerdo a la altura.',
      'Hay una luz que solo existe en esta etapa.'
    ],
    bodies: [
      'Las sesiones de embarazo son tranquilas, sin prisas y adaptadas a cómo te sientas ese día. Lo importante es que lo disfrutes.',
      'Te parecerá que hay tiempo de sobra, pero la barriga crece rápido. El mejor momento suele ser entre las semanas 28 y 34.',
      'Más allá de la barriga: las miradas, las manos, la ilusión. Eso es lo que buscamos en cada sesión.'
    ],
    ctas: [
      '¿Cuántas semanas tienes? Cuéntanos en comentarios 💛',
      'Compártela con esa futura mamá que se lo merece.',
      'Guárdala para cuando llegue tu momento 📌'
    ],
    tags: ['#fotografiadeembarazo', '#sesiondeembarazo', '#embarazada', '#maternidad', '#futuramama', '#maternityphotography', '#dulceespera', '#barriguita']
  },
  newborn: {
    label: 'Recién nacido', emoji: '👶',
    hooks: [
      'Así de pequeño solo será unos días.',
      'Esto no vuelve. Por eso existe la fotografía.',
      'Diez deditos, una respiración tranquila y todo el amor del mundo.',
      'Cuando crezca no se lo va a creer.'
    ],
    bodies: [
      'Las primeras dos semanas de vida son mágicas para fotografiar: duermen profundo y conservan esa postura de recién llegado. Lo hacemos todo con calma y máxima seguridad.',
      'Una sesión newborn va al ritmo del bebé: tomas, mimos y pausas cuando hace falta. Los papás solo tenéis que relajaros.',
      'En unas semanas esas manitas serán el doble de grandes. Lo bonito es poder recordarlas así siempre.'
    ],
    ctas: [
      '¿A quién se parece? Os leemos 👇',
      'Etiqueta a esos papás primerizos que necesitan ver esto.',
      'Si esperas un bebé, guárdala: las sesiones newborn se reservan antes del parto 📌'
    ],
    tags: ['#fotografianewborn', '#reciennacido', '#newbornphotography', '#sesionnewborn', '#bebe', '#newborn', '#primerosdias', '#fotografiadebebes']
  },
  familia: {
    label: 'Familia', emoji: '👨‍👩‍👧',
    hooks: [
      'Los niños no posan. Viven. Nosotros solo pulsamos a tiempo.',
      'Algún día esta será la foto favorita de alguien de esta familia.',
      'La casa desordenada, las risas a gritos… y esto.',
      'No hace falta que todos miren a cámara. Hace falta que estén juntos.'
    ],
    bodies: [
      'Una sesión de familia es una tarde para jugar, abrazarse y hacer el tonto. Las mejores fotos salen cuando nadie intenta salir bien.',
      'Los hijos crecen sin pedir permiso. Una sesión al año es la mejor forma de ver cuánto ha cambiado todo… y lo que no cambia nunca.',
      'Abuelos, padres, peques y hasta el perro. Cuanta más vida, mejor foto.'
    ],
    ctas: [
      '¿Cuándo fue la última foto en la que salisteis TODOS? Sé sincero 😅',
      'Etiqueta a tu familia y empezad a planear la vuestra.',
      'Comparte con quien siempre es el que hace las fotos y nunca sale.'
    ],
    tags: ['#fotografiadefamilia', '#sesionfamiliar', '#familia', '#familyphotography', '#momentosenfamilia', '#fotografiainfantil', '#recuerdos', '#familiafeliz']
  },
  comunion: {
    label: 'Comunión', emoji: '🕊️',
    hooks: [
      'Un día que solo pasa una vez, contado como se merece.',
      'Nervios, traje nuevo y una sonrisa que lo dice todo.',
      'Esta es la foto que estará en el salón de los abuelos.'
    ],
    bodies: [
      'Hacemos la sesión de comunión sin prisas y a su ritmo, para que el peque se divierta y salga tal y como es.',
      'Más allá del retrato oficial: los juegos, los primos, las risas. Todo cuenta para recordar el día.',
      'Las fechas de comunión vuelan cada temporada. Reservar con tiempo es la mejor decisión.'
    ],
    ctas: [
      '¿Te acuerdas de tu comunión? Cuéntanos una anécdota 👇',
      'Comparte con quien está organizando una este año.',
      'Guárdala como idea para la sesión 📌'
    ],
    tags: ['#comunion', '#fotografiadecomunion', '#primeracomunion', '#comuniones2027', '#fotografiainfantil', '#sesiondecomunion', '#reportajecomunion']
  },
  infantil: {
    label: 'Infantil', emoji: '🧸',
    hooks: [
      'Esa edad en la que todo es nuevo. Y se nota.',
      'No le dijimos que sonriera. Le contamos un chiste malo.',
      'Crecen tan rápido que da vértigo. Esto lo frena un poco.'
    ],
    bodies: [
      'Con los niños la regla es simple: jugar primero, fotografiar después. Así salen auténticos.',
      'Cada etapa tiene su magia y dura muy poco. Una sesión es la forma más bonita de guardarla.',
      'Sin poses forzadas ni "mira aquí". Dejamos que sean ellos y estamos atentos.'
    ],
    ctas: [
      '¿Qué edad tienen tus peques? 👇',
      'Etiqueta a quien tiene un peque así de expresivo.',
      'Guárdala para la próxima sesión 📌'
    ],
    tags: ['#fotografiainfantil', '#niños', '#infancia', '#childphotography', '#sesioninfantil', '#niñosfelices', '#kidsphotography']
  },
  paisaje: {
    label: 'Paisaje', emoji: '🏔️',
    hooks: [
      'Sin filtros exagerados. Así estaba la luz[[ en {lugar}]].',
      'Hay sitios que se merecen madrugar.',
      'Esto lo tenemos a un rato de casa y casi nadie lo mira.',
      'Diez minutos de luz perfecta. Merecieron cada kilómetro.',
      'Para la próxima vez que alguien diga que aquí no hay nada que ver.'
    ],
    bodies: [
      'La fotografía de paisaje es paciencia: volver, esperar y aceptar que a veces la luz no llega. Hoy sí llegó[[. {lugar}]].',
      'Nos encanta recordar lo bonito que es nuestro entorno. Esta luz no dura más que unos minutos.',
      'Antes de cada sesión hacemos esto: buscar sitios y luces que luego usamos en bodas, parejas y retratos.'
    ],
    ctas: [
      '¿Sabrías decir dónde está? Respuestas en comentarios 👇',
      'Comparte con quien necesite una escapada este finde.',
      'Guárdala para tu próxima ruta 📌'
    ],
    tags: ['#fotografiadepaisaje', '#landscapephotography', '#paisaje', '#naturaleza', '#atardecer', '#rincones', '#escapadas', '#goldenhour']
  },
  evento: {
    label: 'Evento', emoji: '🎉',
    hooks: [
      'Lo que se vivió allí no cabía en un móvil.',
      'Los eventos pasan. Las buenas fotos, no.',
      'Así se ve un evento cuando alguien está atento a todo.'
    ],
    bodies: [
      'Cubrimos eventos de forma discreta: sin interrumpir, captando a los protagonistas y también los detalles que nadie recuerda haber visto[[. {lugar}]].',
      'Un buen reportaje de evento sirve para recordar y también para comunicar: redes, prensa, web y la próxima edición.',
      'Entrega rápida y fotos listas para compartir. Así el evento sigue vivo días después.'
    ],
    ctas: [
      '¿Estuviste allí? Etiquétate 👇',
      'Comparte con quien organiza eventos y necesita fotos así.',
      '¿Qué evento te gustaría ver fotografiado así?'
    ],
    tags: ['#fotografiadeeventos', '#eventos', '#eventphotography', '#reportaje', '#fotografiacorporativa', '#eventoscorporativos', '#celebracion']
  },
  empresa: {
    label: 'Empresa / Producto', emoji: '🏷️',
    hooks: [
      'Tu producto puede ser bueno. Si la foto no lo parece, nadie lo sabrá.',
      'La primera impresión de tu negocio ya no es en persona. Es esta.',
      'Misma marca. Distinta foto. Distintos resultados.'
    ],
    bodies: [
      'Fotografía de producto, equipo y espacios para que tu web y tus redes transmitan lo que vales de verdad.',
      'Una buena imagen ahorra explicaciones: genera confianza antes de que el cliente lea una sola palabra.',
      'Trabajamos con negocios locales que quieren dar un salto en cómo se ven. Sin bancos de imágenes, con su gente y su espacio reales.'
    ],
    ctas: [
      '¿Tu web tiene fotos que te representen? Sé sincero 👇',
      'Comparte con ese negocio que se merece lucir mejor.',
      'Guárdala para cuando renueves tu imagen 📌'
    ],
    tags: ['#fotografiadeproducto', '#fotografiacorporativa', '#marcapersonal', '#fotografiacomercial', '#branding', '#negociolocal', '#productphotography']
  },
  mascotas: {
    label: 'Mascotas', emoji: '🐾',
    hooks: [
      'No le pagamos. Posó gratis. Y mira.',
      'También es de la familia. Y también merece su foto.',
      'Su mirada lo dice todo (y lo que dice es "¿hay premio?").'
    ],
    bodies: [
      'Las sesiones con mascotas tienen un ingrediente secreto: paciencia y premios. Lo demás lo ponen ellos.',
      'Viven menos de lo que nos gustaría. Por eso merece la pena tener fotos que de verdad los representen.',
      'Al aire libre, con su juguete favorito y su gente. Así sale su carácter.'
    ],
    ctas: [
      '¡Enséñanos a la tuya! Déjanos su nombre en comentarios 🐶🐱',
      'Etiqueta a quien tiene la mascota más fotogénica del mundo.',
      'Comparte con quien habla más de su perro que de sí mismo 😄'
    ],
    tags: ['#fotografiademascotas', '#petphotography', '#perros', '#mascotas', '#dogsofinstagram', '#gatos', '#amorperruno']
  },
  backstage: {
    label: 'Detrás de cámaras', emoji: '🎬',
    hooks: [
      'Lo que no ves de una sesión (y es mi parte favorita).',
      'Spoiler: las mejores fotos salen cuando parece que no estamos haciendo nada.',
      'Así se hizo. Sin trucos, con mucha paciencia.'
    ],
    bodies: [
      'Detrás de cada foto hay planificación, búsqueda de luz y mucha conversación. Queremos que estés a gusto, y eso se nota en el resultado.',
      'Nos encanta enseñar el proceso: así sabes exactamente qué esperar el día de tu sesión.',
      'Equipo, luz y un poco de improvisación. Así trabajamos cuando nadie mira.'
    ],
    ctas: [
      '¿Quieres que enseñemos más detrás de cámaras? 👀 Dinos en comentarios',
      'Pregúntanos lo que quieras sobre cómo trabajamos 👇',
      'Guárdala si te interesa la fotografía 📌'
    ],
    tags: ['#detrasdecamaras', '#behindthescenes', '#bts', '#fotografo', '#procesocreativo', '#fotografia', '#vidadefotografo']
  },
  otro: {
    label: 'Otro', emoji: '📷',
    hooks: [
      'Hay fotos que se explican solas. Esta es una.',
      'Esto es lo que pasa cuando la luz decide colaborar.',
      'Para mirarla dos veces.',
      'Si te has parado a mirarla, ya sabes por qué la compartimos.'
    ],
    bodies: [
      'Nos gusta la fotografía honesta: luz natural, emoción real y ningún artificio que no haga falta[[. {lugar}]].',
      'Cada foto es una pequeña historia. Esta nos encanta por cómo se siente.',
      'Fotografiar es aprender a mirar. Esto es lo que vimos.'
    ],
    ctas: [],
    tags: ['#fotografia', '#fotografo', '#photography', '#fotografiaartistica', '#luznatural', '#fotodeldia', '#instafoto']
  }
};

// Llamadas a la acción generales (se mezclan con las de cada motivo).
const GENERAL_CTAS = [
  'Si te ha gustado, guárdala y compártela: nos ayuda más de lo que imaginas 💛',
  '¿Qué es lo primero que te ha transmitido? Una palabra en comentarios 👇',
  'Dale doble toque si te ha hecho sentir algo.',
  'Comparte con alguien que tenga que ver esto hoy.'
];

// Línea comercial (solo en motivos donde se vende una sesión).
const CONTACT_LINES = [
  '📩 Reservas y presupuesto por mensaje directo.',
  '📅 Quedan pocas fechas para esta temporada. Escríbenos por privado.',
  '✨ ¿Quieres la tuya? Escríbenos y te contamos.',
  '📲 Información y disponibilidad: mensaje directo o enlace en la bio.'
];
// ---------- Galego ----------
// El público es mayoritariamente gallego. Según el ajuste "language":
//   'es'  → todo en castellano
//   'mix' → castellano con toques de gallego: cada día el gancho O la llamada a la acción
//           en gallego (se alterna) + una frase de cierre en gallego   (por defecto)
//   'gl'  → más gallego: gancho, llamada a la acción, contacto y cierre en gallego;
//           el cuerpo del texto sigue en castellano.
const GALEGO = {
  hooks: {
    boda: [
      'Hai un segundo en cada voda que ninguén máis viu. Nós si.',
      'Esta foto non se ensaiou. Por iso emociona.',
      'Dentro de 30 anos, isto é o que quererán volver mirar.'
    ],
    pareja: [
      'Así se ve o amor cando ninguén lle di como posar.',
      'A complicidade non se fotografa: agárdase.'
    ],
    retrato: [
      '"Eu non saio ben nas fotos." Iso dixo antes desta.',
      'Un bo retrato non te cambia. Amósate.'
    ],
    embarazo: [
      'Nove meses que pasan voando. Esta foto fai que duren para sempre.',
      'A espera máis bonita merecía un recordo á súa altura.'
    ],
    newborn: [
      'Así de pequeniño só será uns días.',
      'Isto non volve. Por iso existe a fotografía.'
    ],
    familia: [
      'Os nenos non posan. Viven. Nós só disparamos a tempo.',
      'Algún día esta será a foto favorita de alguén desta familia.'
    ],
    comunion: [
      'Un día que só pasa unha vez, contado como se merece.',
      'Nervios, traxe novo e un sorriso que o di todo.'
    ],
    infantil: [
      'Esa idade na que todo é novo. E nótase.',
      'Medran tan rápido que dá vertixe. Isto frea un pouco o tempo.'
    ],
    paisaje: [
      'Sen filtros esaxerados. Así estaba a luz[[ en {lugar}]].',
      'Hai sitios que merecen madrugar.',
      'Para a próxima vez que alguén diga que aquí non hai nada que ver.'
    ],
    evento: [
      'O que se viviu alí non cabía nun móbil.',
      'Os eventos pasan. As boas fotos, non.'
    ],
    empresa: [
      'A primeira impresión do teu negocio xa non é en persoa. É esta.',
      'Mesma marca. Distinta foto. Distintos resultados.'
    ],
    mascotas: [
      'Tamén é da familia. E tamén merece a súa foto.',
      'Non lle pagamos. Posou de balde. E mira.'
    ],
    backstage: [
      'O que non ves dunha sesión (e é a miña parte favorita).',
      'Así se fixo. Sen trucos, con moita paciencia.'
    ],
    otro: [
      'Hai fotos que se explican soas. Esta é unha.',
      'Para mirala dúas veces.'
    ]
  },
  ctas: [
    'Que che transmite esta foto? Cóntanolo nos comentarios 👇',
    'Se che gustou, gárdaa e compártea: axúdanos máis do que pensas 💛',
    'Etiqueta a quen ten que ver isto hoxe.',
    'Dálle dobre toque se che fixo sentir algo ✨'
  ],
  contact: [
    '📩 Reservas e orzamentos por mensaxe directa.',
    '📅 Quedan poucas datas para esta tempada. Escríbenos por privado.',
    '✨ Queres a túa? Escríbenos e contámosche.'
  ],
  closings: [
    'Feito con agarimo en Galicia 💛',
    'Grazas por mirar con nós.',
    'Dende Galicia, con luz propia ✨',
    'Moitas grazas por estar aí 🙌',
    'Galicia sempre ten unha luz especial.'
  ]
};

const COMMERCIAL = new Set(['boda', 'pareja', 'retrato', 'embarazo', 'newborn', 'familia', 'comunion', 'infantil', 'evento', 'empresa', 'mascotas']);

// ---------- utilidades ----------
function fill(tpl, vars) {
  // Quita los bloques [[...]] con variables vacías y luego sustituye.
  let out = tpl.replace(/\[\[(.*?)\]\]/g, (_, inner) => {
    const names = [...inner.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return names.every((n) => vars[n]) ? inner : '';
  });
  out = out.replace(/\{(\w+)\}/g, (_, n) => vars[n] || '');
  return out.replace(/\s+([.,!?])/g, '$1').replace(/ {2,}/g, ' ').trim();
}

function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9ñ]/g, '');
}

function normTag(t) {
  t = String(t || '').trim();
  if (!t) return '';
  return '#' + t.replace(/^#+/, '').replace(/\s+/g, '');
}

// Elige la opción menos usada recientemente (con algo de azar entre empatadas).
function pickLRU(items, keyPrefix, usage, rand = Math.random) {
  const scored = items.map((text, i) => ({ text, key: `${keyPrefix}.${i}`, last: usage[`${keyPrefix}.${i}`] || 0 }));
  const minLast = Math.min(...scored.map((s) => s.last));
  const candidates = scored.filter((s) => s.last === minLast);
  return candidates[Math.floor(rand() * candidates.length)];
}

function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- generador principal ----------
/**
 * @param {object} photo  { motive, lugar, nota }
 * @param {object} settings ajustes del estudio
 * @param {object} usage   registro de uso de plantillas (se actualiza)
 * @returns {{instagram:string, facebook:string, hashtags:string[], used:string[]}}
 */
function generate(photo, settings, usage = {}, rand = Math.random) {
  const m = MOTIVES[photo.motive] || MOTIVES.otro;
  const mk = MOTIVES[photo.motive] ? photo.motive : 'otro';
  const vars = {
    lugar: (photo.lugar || '').trim(),
    ciudad: (settings.city || '').trim(),
    estudio: settings.studioName || 'Luz del Norte Fotografía',
    web: settings.website || ''
  };

  // Idioma: castellano, mixto (por defecto) o más gallego.
  const lang = ['es', 'mix', 'gl'].includes(settings.language) ? settings.language : 'mix';
  const used = [];
  let glHook = false;
  let glCta = false;
  if (lang === 'gl') { glHook = true; glCta = true; }
  if (lang === 'mix') {
    // Alterna cada día qué parte va en gallego: el gancho o la llamada a la acción.
    const which = pickLRU(['hook', 'cta'], 'gl.mix', usage, rand);
    used.push(which.key);
    if (which.text === 'hook') glHook = true; else glCta = true;
  }

  const hook = glHook
    ? pickLRU(GALEGO.hooks[mk], `gl.${mk}.h`, usage, rand)
    : pickLRU(m.hooks, `${mk}.h`, usage, rand);
  const body = pickLRU(m.bodies, `${mk}.b`, usage, rand);
  let ctaPick;
  if (glCta) {
    const c = pickLRU(GALEGO.ctas, 'gl.c', usage, rand);
    ctaPick = { t: c.text, k: c.key };
  } else {
    const ctaPool = [...m.ctas.map((t, i) => ({ t, k: `${mk}.c.${i}` })), ...GENERAL_CTAS.map((t, i) => ({ t, k: `g.c.${i}` }))];
    const ctaScored = ctaPool.map((c) => ({ ...c, last: usage[c.k] || 0 }));
    const ctaMin = Math.min(...ctaScored.map((c) => c.last));
    const ctaCands = ctaScored.filter((c) => c.last === ctaMin);
    ctaPick = ctaCands[Math.floor(rand() * ctaCands.length)];
  }

  const contact = !COMMERCIAL.has(mk) ? null
    : lang === 'gl' ? pickLRU(GALEGO.contact, 'gl.contact', usage, rand)
      : pickLRU(CONTACT_LINES, 'g.contact', usage, rand);
  const closing = lang === 'es' ? null : pickLRU(GALEGO.closings, 'gl.close', usage, rand);

  // Hashtags: máx. 5 → marca + zona (+ #galicia) + motivo (rotando).
  const brand = normTag(settings.brandHashtag || '#' + slug(vars.estudio));
  const tags = [brand];
  // Para el hashtag local se quita el artículo: "A Coruña" → #vodascoruna
  const city = slug(vars.ciudad.replace(/^(a|o|as|os|la|el|las|los)\s+/i, ''));
  if (city) {
    const bodas = lang === 'es' ? 'bodas' : 'vodas';
    const local = mk === 'boda' ? `#${bodas}${city}` : `#fotografo${city}`;
    tags.push(local);
  }
  if (lang !== 'es' && city !== 'galicia') tags.push('#galicia');
  const extra = String(settings.extraHashtags || '').split(/[\s,]+/).map(normTag).filter(Boolean);
  const motivePool = shuffle([...new Set([...m.tags, ...extra])], rand)
    .map((t) => ({ t, last: usage['tag' + t] || 0 }))
    .sort((a, b) => a.last - b.last)
    .map((x) => x.t);
  for (const t of motivePool) {
    if (tags.length >= 5) break;
    if (!tags.includes(t)) tags.push(t);
  }
  const hashtags = tags.slice(0, 5);

  const hookTxt = fill(hook.text, vars);
  const bodyTxt = fill(body.text, vars);
  const ctaTxt = fill(ctaPick.t, vars);
  const sign = settings.signature ? fill(settings.signature, vars) : `📸 ${vars.estudio}`;
  const place = vars.lugar ? `📍 ${vars.lugar}` : (vars.ciudad ? `📍 ${vars.ciudad}` : '');
  const note = (photo.nota || '').trim();

  const igParts = [
    hookTxt,
    bodyTxt,
    note || null,
    ctaTxt,
    contact ? fill(contact.text, vars) : null,
    closing ? closing.text : null,
    [place, sign].filter(Boolean).join('\n'),
    hashtags.join(' ')
  ].filter(Boolean);

  const fbContact = contact
    ? fill(contact.text, vars).replace(/ o enlace en la bio/, '') + (vars.web ? `\n👉 ${vars.web}` : '')
    : (vars.web ? `👉 ${vars.web}` : null);
  const fbParts = [
    hookTxt,
    bodyTxt,
    note || null,
    ctaTxt,
    fbContact,
    closing ? closing.text : null,
    [place, sign].filter(Boolean).join('\n'),
    hashtags.slice(0, 2).join(' ')
  ].filter(Boolean);

  used.push(hook.key, body.key, ctaPick.k, ...(contact ? [contact.key] : []), ...(closing ? [closing.key] : []), ...hashtags.map((t) => 'tag' + t));
  return {
    instagram: igParts.join('\n\n'),
    facebook: fbParts.join('\n\n'),
    hashtags,
    hook: hookTxt,
    used
  };
}

function markUsed(usage, keys, when = Date.now()) {
  for (const k of keys) usage[k] = when;
}

function motiveList() {
  return Object.entries(MOTIVES).map(([key, m]) => ({ key, label: m.label, emoji: m.emoji }));
}

export { generate, markUsed, motiveList, MOTIVES, GALEGO, fill, slug };
