// Generador de la sección "Opiniones en Google" (la parte que va escrita en el HTML).
//
// Cómo funciona la sección, en dos capas:
//   1. EN VIVO (lo que ve la gente): resenas.js le pide las opiniones a
//      /api/resenas, que a su vez se las pide a Google. Se actualiza solo.
//   2. RESPALDO (lo que genera este archivo): las mismas tarjetas escritas dentro
//      del HTML a partir de data/resenas-google.json. Sirve para dos cosas: que la
//      página ya muestre algo en el primer parpadeo (y si el visitante tiene el
//      JavaScript apagado), y que Google y otros buscadores lean el texto.
//
// Para refrescar el respaldo:
//   1. editar data/resenas-google.json
//   2. correr:  node scripts/actualizar-resenas.mjs
//   3. git commit + git push
//
// IMPORTANTE: el diseño de la tarjeta está escrito DOS veces, aquí y en resenas.js
// (una versión para el servidor y otra para el navegador). Si cambias una, cambia
// la otra o las tarjetas se verán distintas antes y después de cargar.
//
// OJO con los datos estructurados: Google prohíbe marcar con schema.org las
// opiniones que uno muestra de otro sitio ("reseñas autoservidas"). Por eso aquí
// NO se genera ninguna ficha AggregateRating ni Review. Es a propósito.

export const MARCA_INICIO = '<!-- RESENAS-GOOGLE:inicio -->';
export const MARCA_FIN = '<!-- RESENAS-GOOGLE:fin -->';

// La insignia es la versión chiquita: solo el puntaje, en las páginas de Servicios,
// que es donde la persona está decidiendo si escribe o no.
export const MARCA_INSIGNIA_INICIO = '<!-- RESENA-INSIGNIA:inicio -->';
export const MARCA_INSIGNIA_FIN = '<!-- RESENA-INSIGNIA:fin -->';

export const PAGINAS_CON_INSIGNIA = [
  { ruta: 'servicios.html' },
  { ruta: 'servicios/mentorias-personalizadas/index.html' },
  { ruta: 'servicios/talleres/index.html' },
  { ruta: 'servicios/curso-grabado/index.html' },
];

// Páginas que llevan la sección. "limite" es cuántas tarjetas se muestran:
// null = todas las que haya en el JSON.
//
// En celular las tarjetas SIEMPRE van en fila, se pasan deslizando el dedo. Ocupan
// mucho menos alto que apiladas una debajo de otra. En pantalla grande, "rejilla"
// las pone en columnas y "riel" las deja en una sola fila con flechas.
export const PAGINAS_CON_RESENAS = [
  {
    ruta: 'index.html',
    id: 'google-reviews-title',
    limite: 3,
    // Fondo blanco: la sección de arriba (los testimonios en video) ya es gris y
    // dos grises pegados se ven como una sola mancha.
    clasesExtra: 'greviews--rejilla',
    etiqueta: 'Reseñas',
    titulo: 'Testimonios en Google',
    bajada: 'Opiniones de personas que hicieron terapia en la escuela.',
  },
  {
    ruta: 'testimonios.html',
    id: 'google-reviews-title',
    limite: null,
    // Va al final de la página y en una sola fila: es un complemento de los videos,
    // no la parte principal. Verde agua suave, el de las otras franjas de la página.
    clasesExtra: 'greviews--tint',
    etiqueta: 'Reseñas',
    titulo: 'Testimonios en Google',
    bajada: 'Opiniones de personas que hicieron terapia en la escuela.',
  },
];

// Logo de Google (los cuatro colores oficiales). Va como SVG dentro del HTML para
// no depender de ningún archivo externo.
const LOGO_GOOGLE =
  '<svg class="greviews__g" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
  '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
  '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
  '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
  '</svg>';

export function escapeHtml(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Primera letra del nombre, para el círculo de color de cada tarjeta.
function inicial(nombre) {
  const limpio = String(nombre || '').trim();
  return limpio ? limpio[0].toUpperCase() : '?';
}

function estrellas(cantidad) {
  const n = Math.max(0, Math.min(5, Number(cantidad) || 0));
  let html = '';
  for (let i = 0; i < 5; i += 1) {
    html += '<i class="fa-solid fa-star' + (i < n ? '' : ' is-off') + '" aria-hidden="true"></i>';
  }
  return html;
}

// Enlace a ESA opinión concreta dentro de Google. Se arma con "resenaId" y la
// plantilla del JSON. Si la opinión todavía no tiene identificador (pasa con las
// recién publicadas, que tardan en salir en el mapa), cae al listado general.
export function enlaceDeResena(op, datos) {
  const plantilla = datos.plantillaResena || '';
  if (op.resenaId && plantilla.includes('{id}')) {
    return plantilla.replace('{id}', encodeURIComponent(op.resenaId));
  }
  return datos.urlOpiniones || datos.urlFicha || '';
}

function tarjeta(op, datos) {
  const partes = [];
  partes.push('<article class="greview">');
  partes.push('<div class="greview__head">');
  if (op.fotoUrl) {
    partes.push(
      '<img class="greview__avatar greview__avatar--foto" src="' +
        escapeHtml(op.fotoUrl) +
        '" alt="" width="44" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer" />'
    );
  } else {
    partes.push('<span class="greview__avatar" aria-hidden="true">' + escapeHtml(inicial(op.nombre)) + '</span>');
  }
  partes.push('<div class="greview__who">');
  partes.push('<h3 class="greview__name">' + escapeHtml(op.nombre) + '</h3>');
  partes.push('<p class="greview__date">' + escapeHtml(op.fecha) + '</p>');
  partes.push('</div>');
  partes.push(LOGO_GOOGLE);
  partes.push('</div>');
  partes.push(
    '<p class="greview__stars" role="img" aria-label="' +
      escapeHtml(op.estrellas) +
      ' de 5 estrellas">' +
      estrellas(op.estrellas) +
      '</p>'
  );
  partes.push('<blockquote class="greview__text"><p>' + escapeHtml(op.texto) + '</p></blockquote>');
  // Este enlace va SIEMPRE, aunque el texto esté entero: el CSS lo estira por encima
  // de toda la tarjeta para que se pueda pulsar en cualquier punto y lleve a Google.
  partes.push(
    '<a class="greview__more" href="' +
      escapeHtml(enlaceDeResena(op, datos)) +
      '" target="_blank" rel="noopener nofollow" aria-label="' +
      escapeHtml((op.completa === false ? 'Leer la opinión completa de ' : 'Ver la opinión de ') + op.nombre + ' en Google') +
      '">' +
      (op.completa === false ? 'Leer la opinión completa en Google' : 'Ver esta opinión en Google') +
      '</a>'
  );
  partes.push('</article>');
  return partes.join('');
}

// De la más nueva a la más antigua. Manda "fechaOrden" (AAAA-MM-DD) del JSON; si a
// alguna le falta, esa se va al final en vez de romper el orden de las demás.
export function ordenarPorFecha(opiniones) {
  return opiniones.slice().sort((a, b) => {
    const fa = a.fechaOrden || '';
    const fb = b.fechaOrden || '';
    if (fa === fb) return 0;
    if (!fa) return 1;
    if (!fb) return -1;
    return fa < fb ? 1 : -1;
  });
}

export function generarSeccion(datos, pagina) {
  const todas = Array.isArray(datos.opiniones) ? datos.opiniones : [];
  let lista = ordenarPorFecha(todas);
  if (pagina.limite) lista = lista.slice(0, pagina.limite);

  const urlOpiniones = datos.urlOpiniones || datos.urlFicha;
  const partes = [];

  // Los atributos data-greviews-* son los ganchos que usa resenas.js para meter
  // las opiniones en vivo. "data-greviews-max" es cuántas tarjetas caben en esta
  // página (3 en la portada, todas en testimonios).
  partes.push(
    '\n<section class="greviews section ' +
      (pagina.clasesExtra || '') +
      '" aria-labelledby="' +
      pagina.id +
      '" data-greviews data-greviews-max="' +
      (pagina.limite || 0) +
      '">'
  );
  partes.push('<div class="container">');

  // Encabezado: a la izquierda el título, a la derecha el puntaje de la ficha.
  partes.push('<div class="greviews__top">');
  partes.push('<div class="greviews__intro">');
  partes.push('<p class="section__label">' + escapeHtml(pagina.etiqueta) + '</p>');
  partes.push('<h2 class="section__title" id="' + pagina.id + '">' + escapeHtml(pagina.titulo) + '</h2>');
  partes.push('<p class="greviews__lead">' + escapeHtml(pagina.bajada) + '</p>');
  partes.push('</div>');

  partes.push('<div class="greviews__score">');
  partes.push(
    '<p class="greviews__score-number" data-greviews-score>' + escapeHtml(datos.puntaje) + '</p>'
  );
  partes.push(
    '<p class="greviews__score-stars" role="img" aria-label="' +
      escapeHtml(datos.puntaje) +
      ' de 5 estrellas" data-greviews-score-stars>' +
      estrellas(5) +
      '</p>'
  );
  partes.push(
    '<p class="greviews__score-count">' +
      LOGO_GOOGLE +
      '<span data-greviews-count>' +
      escapeHtml(datos.total) +
      ' opiniones en Google</span></p>'
  );
  partes.push('</div>');
  partes.push('</div>');

  // El riel: las tarjetas en fila. Las flechas solo aparecen (las enciende
  // resenas.js) cuando de verdad hay tarjetas escondidas a los costados.
  partes.push('<div class="greviews__rail" data-greviews-rail>');
  partes.push(
    '<button type="button" class="greviews__arrow greviews__arrow--prev" data-greviews-prev aria-label="Ver opiniones anteriores" hidden><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>'
  );
  partes.push('<div class="greviews__grid" data-greviews-grid>');
  lista.forEach((op) => partes.push(tarjeta(op, datos)));
  partes.push('</div>');
  partes.push(
    '<button type="button" class="greviews__arrow greviews__arrow--next" data-greviews-next aria-label="Ver más opiniones" hidden><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>'
  );
  partes.push('</div>');

  partes.push('<div class="greviews__actions">');
  partes.push(
    '<a class="btn btn--outline" href="' +
      escapeHtml(urlOpiniones) +
      '" target="_blank" rel="noopener nofollow" data-greviews-link-all>Ver las ' +
      escapeHtml(datos.total) +
      ' opiniones en Google</a>'
  );
  if (datos.urlEscribir) {
    partes.push(
      '<a class="btn btn--primary" href="' +
        escapeHtml(datos.urlEscribir) +
        '" target="_blank" rel="noopener nofollow" data-greviews-link-write>Escribir una opinión</a>'
    );
  }
  partes.push('</div>');

  partes.push('</div>');
  partes.push('</section>\n');

  return partes.join('');
}

// Insignia compacta para las páginas de Servicios: "4,9 en Google · 17 opiniones".
export function generarInsignia(datos) {
  const url = datos.urlOpiniones || datos.urlFicha || '';
  return (
    '\n<div class="gbadge-wrap" data-gbadge>' +
    '<a class="gbadge" href="' +
    escapeHtml(url) +
    '" target="_blank" rel="noopener nofollow">' +
    LOGO_GOOGLE +
    '<span class="gbadge__score" data-gbadge-score>' +
    escapeHtml(datos.puntaje) +
    '</span>' +
    '<span class="gbadge__stars" role="img" aria-label="' +
    escapeHtml(datos.puntaje) +
    ' de 5 estrellas" data-gbadge-stars>' +
    estrellas(5) +
    '</span>' +
    '<span class="gbadge__text">en Google, <span data-gbadge-count>' +
    escapeHtml(datos.total) +
    ' opiniones</span></span>' +
    '</a></div>\n'
  );
}

// Reemplaza lo que hay entre los dos comentarios marcadores del HTML.
export function reemplazarBloque(html, contenido) {
  const inicio = html.indexOf(MARCA_INICIO);
  const fin = html.indexOf(MARCA_FIN);
  if (inicio === -1 || fin === -1 || fin < inicio) return null;
  return html.slice(0, inicio + MARCA_INICIO.length) + contenido + html.slice(fin);
}

export function actualizarPagina(html, datos, pagina) {
  const bloque = generarSeccion(datos, pagina);
  const nuevo = reemplazarBloque(html, bloque);
  if (nuevo === null) {
    return { error: 'La página ' + pagina.ruta + ' no tiene los marcadores RESENAS-GOOGLE.' };
  }
  if (nuevo === html) return { sinCambios: true };
  return { html: nuevo };
}

export function actualizarInsignia(html, datos, pagina) {
  const inicio = html.indexOf(MARCA_INSIGNIA_INICIO);
  const fin = html.indexOf(MARCA_INSIGNIA_FIN);
  if (inicio === -1 || fin === -1 || fin < inicio) {
    return { error: 'La página ' + pagina.ruta + ' no tiene los marcadores RESENA-INSIGNIA.' };
  }
  const nuevo =
    html.slice(0, inicio + MARCA_INSIGNIA_INICIO.length) + generarInsignia(datos) + html.slice(fin);
  if (nuevo === html) return { sinCambios: true };
  return { html: nuevo };
}
