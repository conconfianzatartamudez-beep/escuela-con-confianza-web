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

// Marcas de los bloques que se generan dentro de cada página de artículo.
export const MARCA_LD_INICIO = '<!-- DATOS-ESTRUCTURADOS:inicio -->';
export const MARCA_LD_FIN = '<!-- DATOS-ESTRUCTURADOS:fin -->';
export const MARCA_SIGUE_INICIO = '<!-- SIGUE-LEYENDO:inicio -->';
export const MARCA_SIGUE_FIN = '<!-- SIGUE-LEYENDO:fin -->';

export const SITIO = 'https://escuelaconconfianza.com';

// Quién firma las lecturas. Sirve para dos cosas: enlazar el nombre del autor con su
// biografía dentro del artículo, y decirle a Google quién es esa persona (en temas de
// salud, Google mira mucho la experiencia y las credenciales de quien escribe).
// "sameAs" solo lleva perfiles comprobados; si no hay, se deja vacío.
export const AUTORES = {
  'Adriano Vega': {
    ancla: '/quienes-somos#adriano-title',
    sameAs: [],
  },
  'Bruno Villegas': {
    ancla: '/quienes-somos#bruno-title',
    sameAs: ['https://www.facebook.com/brunove.ttm/'],
  },
};

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

// ------------------------------------------- páginas de artículo (SEO extra)

// La ruta del archivo se saca de la URL, NO del id: no siempre coinciden
// (por ejemplo el id "tecnicas-dejar-tartamudear" vive en la carpeta
// "tecnicas-para-dejar-de-tartamudear").
export function rutaPaginaArticulo(articulo) {
  const url = String((articulo && articulo.url) || '');
  if (!url.startsWith('/recursos-didacticos/articulos/')) return '';
  return url.replace(/^\//, '').replace(/\/?$/, '/') + 'index.html';
}

// "Lic. T.M. Terapeuta de lenguaje, Adriano Vega." -> "Adriano Vega"
// "Esp. Bruno Villegas." -> "Bruno Villegas"
export function nombreAutor(texto) {
  let nombre = String(texto || '').trim().replace(/\.$/, '');
  if (nombre.includes(',')) nombre = nombre.slice(nombre.lastIndexOf(',') + 1);
  nombre = nombre.replace(/^\s*(Lic\.|Esp\.|Dr\.|Dra\.|Mg\.|T\.M\.|Terapeuta de lenguaje)\s*/gi, '').trim();
  return nombre || String(texto || '').trim().replace(/\.$/, '');
}

function urlAbsoluta(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return SITIO + (path.charAt(0) === '/' ? path : '/' + path);
}

// Ficha de datos estructurados (JSON-LD). Le dice a Google que la página es un
// artículo, quién lo escribió y cuándo, para que pueda mostrarlo mejor.
export function generarJsonLd(articulo) {
  const autor = nombreAutor(articulo.author);
  const datosAutor = AUTORES[autor];

  const ficha = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: String(articulo.title || ''),
    description: String(articulo.description || ''),
    image: urlAbsoluta(articulo.image),
    datePublished: articulo.date || undefined,
    dateModified: articulo.date || undefined,
    inLanguage: 'es',
    author: {
      '@type': 'Person',
      name: autor,
      url: datosAutor ? SITIO + datosAutor.ancla : undefined,
      sameAs: datosAutor && datosAutor.sameAs.length ? datosAutor.sameAs : undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Escuela Con Confianza',
      url: SITIO + '/',
      logo: { '@type': 'ImageObject', url: SITIO + '/images/logo-con-confianza.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': urlAbsoluta(articulo.url) },
  };

  // El "<" se escapa para que nada pueda cerrar la etiqueta <script> antes de tiempo.
  const texto = JSON.stringify(ficha, null, 2).replace(/</g, '\\u003c');
  return '\n  <script type="application/ld+json">\n' + texto + '\n  </script>\n  ';
}

// Bloque "Sigue leyendo" con las otras lecturas publicadas (máximo 2).
// Reutiliza las clases de las tarjetas que ya existen, así que no hace falta CSS nuevo.
export function generarSigueLeyendo(articulo, articulos) {
  const otras = articulosPublicados(articulos)
    .filter((a) => a.url !== articulo.url)
    .slice(0, 2);

  if (!otras.length) return '';

  // Dentro de las páginas de artículo las rutas van absolutas (empiezan con "/").
  const tarjetas = otras.map((a) => '\n          ' + tarjeta(a, '/')).join('');

  // Los estilos van en línea a propósito (como las referencias del artículo), para no
  // depender de tocar styles.css ni de subir su "?v=".
  // - el bloque se alinea con el ancho del texto del artículo (920 px);
  // - auto-fit reparte las tarjetas que haya y baja a una sola columna en el móvil.
  return (
    '\n  <section class="resources-section resources-articles" aria-labelledby="sigue-leyendo-title">' +
    '\n    <div class="container">' +
    '\n      <div style="max-width:920px;margin:0 auto;">' +
    '\n        <div class="resources-section__header resources-section__header--row">' +
    '\n          <h2 class="resources-section__title" id="sigue-leyendo-title">Sigue leyendo</h2>' +
    '\n          <a href="/recursos-didacticos/publicaciones/" class="resources-section__link">Ver todas las lecturas <span aria-hidden="true">-></span></a>' +
    '\n        </div>' +
    '\n        <div class="resources-articles__grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">' + tarjetas +
    '\n        </div>' +
    '\n      </div>' +
    '\n    </div>' +
    '\n  </section>\n  '
  );
}

// Pone (o actualiza) los dos bloques dentro del HTML de una página de artículo.
// Si los marcadores no existen todavía, los inserta en el sitio correcto: la ficha
// antes de </head> y el "Sigue leyendo" antes de </main>.
// Convierte la línea "Autor: Fulano." del final del artículo en un enlace a su
// biografía. Solo actúa si encuentra exactamente el párrafo esperado y todavía no
// es un enlace; ante cualquier duda deja el HTML intacto.
export function enlazarAutor(html, articulo) {
  const autor = nombreAutor(articulo.author);
  const datos = AUTORES[autor];
  if (!datos) return html;

  const firma = String(articulo.author || '').trim();
  if (!firma || !firma.includes(autor)) return html;

  const patron = /<p class="resources-article-detail__author">([\s\S]*?)<\/p>/;
  const encontrado = html.match(patron);
  if (!encontrado) return html;

  // Se quitan los enlaces que ya hubiera, para poder rehacer el párrafo desde cero
  // tantas veces como haga falta sin ir acumulando etiquetas.
  const textoPlano = encontrado[1].replace(/<\/?a\b[^>]*>/g, '').trim();
  if (textoPlano !== 'Autor: ' + firma) return html;

  // El estilo va en línea porque el CSS de este párrafo pinta los enlaces igual que el
  // texto, y entonces nadie se da cuenta de que se puede pulsar.
  const enlace =
    '<a href="' + datos.ancla + '" style="color:#016f6d;text-decoration:underline;">' + autor + '</a>';

  const nuevo =
    '<p class="resources-article-detail__author">Autor: ' + firma.replace(autor, enlace) + '</p>';

  if (nuevo === encontrado[0]) return html;
  return html.replace(patron, nuevo);
}

export function actualizarPaginaArticulo(html, articulo, articulos) {
  let resultado = enlazarAutor(html, articulo);

  function ponerBloque(texto, marcaInicio, marcaFin, contenido, ancla) {
    const inicio = texto.indexOf(marcaInicio);
    const fin = texto.indexOf(marcaFin);

    if (inicio !== -1 && fin !== -1 && fin > inicio) {
      return texto.slice(0, inicio + marcaInicio.length) + contenido + texto.slice(fin);
    }

    const posicion = texto.lastIndexOf(ancla);
    if (posicion === -1) return null;
    return texto.slice(0, posicion) + marcaInicio + contenido + marcaFin + '\n' + texto.slice(posicion);
  }

  const conFicha = ponerBloque(resultado, MARCA_LD_INICIO, MARCA_LD_FIN, generarJsonLd(articulo), '</head>');
  if (conFicha === null) return { error: 'No se encontró </head> en la página del artículo.' };
  resultado = conFicha;

  const sigue = generarSigueLeyendo(articulo, articulos);
  if (sigue) {
    const conSigue = ponerBloque(resultado, MARCA_SIGUE_INICIO, MARCA_SIGUE_FIN, sigue, '</main>');
    if (conSigue === null) return { error: 'No se encontró </main> en la página del artículo.' };
    resultado = conSigue;
  }

  if (resultado === html) return { sinCambios: true };
  return { html: resultado };
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
