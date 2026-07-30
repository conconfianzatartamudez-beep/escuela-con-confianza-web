// Generador de sitemap.xml y de los listados de lecturas en HTML.
//
// ¿Por qué existe este archivo?
// El listado de lecturas se dibuja con JavaScript en el navegador (recursos.js).
// Google y otros buscadores muchas veces NO ejecutan ese JavaScript, así que veían
// la página vacía y nunca encontraban los artículos. Aquí generamos los MISMOS
// enlaces en el HTML, para que estén ahí desde el primer momento.
//
// Lo usan dos sitios (la lógica vive una sola vez, aquí):
//   1. functions/api/panel.js  -> automático, cada vez que el equipo publica desde /panel/
//   2. scripts/actualizar-web.mjs -> a mano, con: node scripts/actualizar-web.mjs
//
// IMPORTANTE: las tarjetas que se generan aquí deben verse igual que las que dibuja
// recursos.js (funciones escapeHtml / formatearFecha / articleCard). Si cambias el
// diseño de la tarjeta en recursos.js, cámbialo también aquí.

export const MARCA_INICIO = '<!-- LISTA-AUTOMATICA:inicio -->';
export const MARCA_FIN = '<!-- LISTA-AUTOMATICA:fin -->';

// Páginas fijas del sitio (las que no dependen del panel).
// Si algún día se crea una página nueva a mano, se agrega a esta lista.
export const PAGINAS_FIJAS = [
  { loc: 'https://escuelaconconfianza.com/', lastmod: '2026-07-05', priority: '1.0' },
  { loc: 'https://escuelaconconfianza.com/quienes-somos', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/servicios', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/testimonios', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/recursos-didacticos', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/servicios/mentorias-personalizadas/', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/servicios/talleres/', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/servicios/curso-grabado/', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/recursos-didacticos/guias/', lastmod: '2026-07-05', priority: '0.8' },
  { loc: 'https://escuelaconconfianza.com/recursos-didacticos/publicaciones/', lastmod: '2026-07-05', priority: '0.8' },
];

// Archivos HTML que muestran tarjetas de lecturas y hay que mantener al día.
// "prefijo" es lo que hay que anteponer a las rutas de imágenes (igual que hace
// resolveAssetPath en recursos.js), y "modo" dice si van todas o solo las destacadas.
export const PAGINAS_CON_LISTADO = [
  { ruta: 'recursos-didacticos.html', prefijo: '', modo: 'destacados' },
  { ruta: 'recursos-didacticos/publicaciones/index.html', prefijo: '../../', modo: 'todos' },
  // Este último hoy no se ve: _redirects manda /recursos-didacticos/articulos/ a
  // /publicaciones/ (301). Lo mantenemos al día igual, por si algún día se quita
  // esa redirección y la página vuelve a usarse.
  { ruta: 'recursos-didacticos/articulos/index.html', prefijo: '../../', modo: 'todos' },
];

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, function (char) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char];
  });
}

function formatearFecha(iso) {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const partes = String(iso || '').split('-');
  if (partes.length !== 3) return '';
  const mes = parseInt(partes[1], 10);
  const dia = parseInt(partes[2], 10);
  if (!mes || !dia || mes > 12) return '';
  return dia + ' de ' + meses[mes - 1] + ' de ' + partes[0];
}

// Mismo criterio que resolveAssetPath en recursos.js: las rutas absolutas
// (empiezan con "/" o con "http") se dejan igual; las relativas llevan prefijo.
function ruta(path, prefijo) {
  if (!path || /^(https?:)?\/\//.test(path) || path.charAt(0) === '/') return path || '';
  return prefijo + path;
}

// Un artículo cuenta como PUBLICADO (y entra al sitemap) si tiene una página real
// y no está marcado como "Próximamente".
export function estaPublicado(articulo) {
  if (!articulo) return false;
  if (String(articulo.badge || '').trim()) return false;
  const url = String(articulo.url || '');
  return url.startsWith('/recursos-didacticos/articulos/') && url !== '#';
}

export function articulosPublicados(articulos) {
  return (Array.isArray(articulos) ? articulos : []).filter(estaPublicado);
}

// ---------------------------------------------------------------- sitemap.xml

export function generarSitemap(articulos) {
  const entradas = PAGINAS_FIJAS.slice();

  for (const articulo of articulosPublicados(articulos)) {
    const url = String(articulo.url || '');
    entradas.push({
      loc: 'https://escuelaconconfianza.com' + url,
      lastmod: /^\d{4}-\d{2}-\d{2}$/.test(String(articulo.date || '')) ? articulo.date : '2026-07-05',
      priority: '0.8',
    });
  }

  const lineas = entradas.map(
    (e) => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><priority>${e.priority}</priority></url>`
  );

  return (
    "<?xml version='1.0' encoding='utf-8'?>\n" +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    lineas.join('\n') +
    '\n</urlset>\n'
  );
}

// ------------------------------------------------------- tarjetas del listado

// Copia fiel de articleCard() de recursos.js, para que el HTML generado aquí
// sea idéntico al que dibuja el navegador.
function tarjeta(articulo, prefijo) {
  const image = ruta(articulo.image, prefijo);
  const mobileImage = ruta(articulo.mobileImage || articulo.image, prefijo);
  const url = ruta(articulo.url, prefijo);

  const action = articulo.badge
    ? '<span class="resources-article-card__badge">' + escapeHtml(articulo.badge) + '</span>'
    : '<span class="resources-article-card__link">Leer más <span aria-hidden="true">-></span></span>';

  const tag = articulo.badge ? 'article' : 'a';
  const attrs = articulo.badge
    ? ''
    : ' href="' + escapeHtml(url) + '" aria-label="Leer artículo: ' + escapeHtml(articulo.title) + '"';

  return (
    '<' + tag + attrs + ' class="resources-article-card">' +
      '<picture>' +
        '<source media="(max-width: 700px)" srcset="' + escapeHtml(mobileImage) + '" />' +
        '<img loading="lazy" decoding="async" src="' + escapeHtml(image) + '" alt="' + escapeHtml(articulo.title) + '" />' +
      '</picture>' +
      '<div class="resources-article-card__body">' +
        (formatearFecha(articulo.date) ? '<p class="resources-article-card__date">' + formatearFecha(articulo.date) + '</p>' : '') +
        '<h3>' + escapeHtml(articulo.title) + '</h3>' +
        '<p>' + escapeHtml(articulo.description) + '</p>' +
        action +
      '</div>' +
      '<span class="resources-article-card__arrow" aria-hidden="true">›</span>' +
    '</' + tag + '>'
  );
}

export function generarListado(articulos, opciones) {
  const prefijo = (opciones && opciones.prefijo) || '';
  const modo = (opciones && opciones.modo) || 'todos';
  const lista = Array.isArray(articulos) ? articulos : [];

  // Igual que recursos.js: "destacados" son los marcados con featured (máximo 3),
  // en el orden elegido en el panel; "todos" es la lista completa tal cual.
  const elegidos = modo === 'destacados' ? lista.filter((a) => a.featured).slice(0, 3) : lista;

  return elegidos.map((articulo) => '\n          ' + tarjeta(articulo, prefijo)).join('') + '\n        ';
}

// Reemplaza lo que hay entre los dos comentarios marcadores del HTML.
// Si la página no tiene los marcadores, devuelve null (y quien llama avisa del problema).
export function reemplazarBloque(html, contenido) {
  const inicio = html.indexOf(MARCA_INICIO);
  const fin = html.indexOf(MARCA_FIN);
  if (inicio === -1 || fin === -1 || fin < inicio) return null;
  return html.slice(0, inicio + MARCA_INICIO.length) + contenido + html.slice(fin);
}

// Devuelve el HTML nuevo de una página del listado, o null si no cambia nada
// (así no generamos commits ni despliegues inútiles).
export function actualizarPagina(html, articulos, pagina) {
  const bloque = generarListado(articulos, pagina);
  const nuevo = reemplazarBloque(html, bloque);
  if (nuevo === null) return { error: 'La página ' + pagina.ruta + ' no tiene los marcadores LISTA-AUTOMATICA.' };
  if (nuevo === html) return { sinCambios: true };
  return { html: nuevo };
}
