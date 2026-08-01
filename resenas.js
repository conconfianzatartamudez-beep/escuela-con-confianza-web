/* ============================================================
   ESCUELA CON CONFIANZA – resenas.js
   Trae las opiniones de Google EN VIVO y las pone en la sección
   "Opiniones en Google" (portada y página de testimonios).

   Cómo funciona:
   - El HTML ya viene con unas opiniones escritas (el respaldo que genera
     lib/generar-resenas.js desde data/resenas-google.json). Eso es lo que se ve
     al instante y lo que leen los buscadores.
   - Este script le pregunta a /api/resenas, que a su vez le pregunta a Google.
     Si responde bien, reemplaza las tarjetas por las de verdad, al día.
   - Si algo falla (sin llave de Google, sin internet, Google caído), NO toca
     nada y la página se queda con el respaldo. Nunca se ve rota.

   OJO: el diseño de la tarjeta está escrito también en lib/generar-resenas.js.
   Si cambias uno, cambia el otro.
   ============================================================ */

(function () {
  'use strict';

  var secciones = document.querySelectorAll('[data-greviews]');
  var insignias = document.querySelectorAll('[data-gbadge]');
  if ((!secciones.length && !insignias.length) || !window.fetch) return;

  function escapeHtml(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inicial(nombre) {
    var limpio = String(nombre || '').trim();
    return limpio ? limpio.charAt(0).toUpperCase() : '?';
  }

  function estrellas(cantidad) {
    var n = Math.max(0, Math.min(5, Number(cantidad) || 0));
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<i class="fa-solid fa-star' + (i < n ? '' : ' is-off') + '" aria-hidden="true"></i>';
    }
    return html;
  }

  var LOGO_GOOGLE =
    '<svg class="greviews__g" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
    '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
    '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
    '</svg>';

  function tarjeta(op, urlOpiniones) {
    var html = '<article class="greview">';
    html += '<div class="greview__head">';
    if (op.fotoUrl) {
      html +=
        '<img class="greview__avatar greview__avatar--foto" src="' +
        escapeHtml(op.fotoUrl) +
        '" alt="" width="44" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer" />';
    } else {
      html += '<span class="greview__avatar" aria-hidden="true">' + escapeHtml(inicial(op.nombre)) + '</span>';
    }
    html += '<div class="greview__who">';
    // Google pide que el nombre de quien escribió enlace a su perfil, cuando lo hay.
    if (op.perfilUrl) {
      html +=
        '<h3 class="greview__name"><a href="' +
        escapeHtml(op.perfilUrl) +
        '" target="_blank" rel="noopener nofollow">' +
        escapeHtml(op.nombre) +
        '</a></h3>';
    } else {
      html += '<h3 class="greview__name">' + escapeHtml(op.nombre) + '</h3>';
    }
    html += '<p class="greview__date">' + escapeHtml(op.fecha) + '</p>';
    html += '</div>';
    html += LOGO_GOOGLE;
    html += '</div>';
    html +=
      '<p class="greview__stars" role="img" aria-label="' +
      escapeHtml(op.estrellas) +
      ' de 5 estrellas">' +
      estrellas(op.estrellas) +
      '</p>';
    html += '<blockquote class="greview__text"><p>' + escapeHtml(op.texto) + '</p></blockquote>';
    // Va siempre: el CSS lo estira sobre toda la tarjeta para que se pueda pulsar
    // en cualquier punto. Ojo: si cambias esto, cambia también lib/generar-resenas.js.
    var recortada = op.completa === false;
    html +=
      '<a class="greview__more" href="' +
      escapeHtml(op.resenaUrl || urlOpiniones) +
      '" target="_blank" rel="noopener nofollow" aria-label="' +
      escapeHtml((recortada ? 'Leer la opinión completa de ' : 'Ver la opinión de ') + op.nombre + ' en Google') +
      '">' +
      (recortada ? 'Leer la opinión completa en Google' : 'Ver esta opinión en Google') +
      '</a>';
    html += '</article>';
    return html;
  }

  // Enciende las flechas solo si de verdad hay tarjetas escondidas a los costados,
  // y las apaga cuando ya no se puede seguir en esa dirección.
  function prepararFlechas(seccion) {
    var grid = seccion.querySelector('[data-greviews-grid]');
    var prev = seccion.querySelector('[data-greviews-prev]');
    var next = seccion.querySelector('[data-greviews-next]');
    if (!grid || !prev || !next) return;

    function refrescar() {
      var sobra = grid.scrollWidth - grid.clientWidth;
      if (sobra < 8) {
        prev.hidden = true;
        next.hidden = true;
        return;
      }
      prev.hidden = grid.scrollLeft < 8;
      next.hidden = grid.scrollLeft > sobra - 8;
    }

    // La animación se hace a mano. El "behavior: smooth" del navegador no funciona
    // dentro de una fila con ajuste automático de tarjetas: se queda quieta.
    function deslizarHasta(destino) {
      var tope = grid.scrollWidth - grid.clientWidth;
      var fin = Math.max(0, Math.min(tope, destino));
      var inicio = grid.scrollLeft;
      var distancia = fin - inicio;
      if (!distancia) return;

      var lento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (lento || !window.requestAnimationFrame) {
        grid.scrollLeft = fin;
        return;
      }

      var duracion = 380;
      var comienzo = null;
      function paso(ahora) {
        if (comienzo === null) comienzo = ahora;
        var t = Math.min(1, (ahora - comienzo) / duracion);
        var suave = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // arranca y frena suave
        grid.scrollLeft = inicio + distancia * suave;
        if (t < 1) window.requestAnimationFrame(paso);
      }
      window.requestAnimationFrame(paso);
    }

    function mover(direccion) {
      var tarjeta = grid.querySelector('.greview');
      var paso = tarjeta ? tarjeta.getBoundingClientRect().width + 24 : grid.clientWidth * 0.8;
      deslizarHasta(grid.scrollLeft + direccion * paso);
    }

    if (!grid.dataset.flechasListas) {
      prev.addEventListener('click', function () { mover(-1); });
      next.addEventListener('click', function () { mover(1); });
      grid.addEventListener('scroll', refrescar, { passive: true });
      window.addEventListener('resize', refrescar);
      // Al girar el teléfono o cambiar el ancho, la fila pasa de rejilla a riel (o al
      // revés) y hay que volver a decidir si las flechas hacen falta. El "resize" de
      // la ventana no siempre alcanza, así que además vigilamos la fila en sí.
      if (window.ResizeObserver) new ResizeObserver(refrescar).observe(grid);
      grid.dataset.flechasListas = '1';
    }
    refrescar();
  }

  function pintar(seccion, datos) {
    var grid = seccion.querySelector('[data-greviews-grid]');
    if (!grid || !datos.opiniones || !datos.opiniones.length) return;

    var max = parseInt(seccion.getAttribute('data-greviews-max'), 10) || 0;
    var lista = max > 0 ? datos.opiniones.slice(0, max) : datos.opiniones;
    var urlOpiniones = datos.urlOpiniones || '';

    var html = '';
    for (var i = 0; i < lista.length; i++) html += tarjeta(lista[i], urlOpiniones);
    grid.innerHTML = html;

    var puntaje = seccion.querySelector('[data-greviews-score]');
    if (puntaje && datos.puntaje) puntaje.textContent = datos.puntaje;

    var puntajeEstrellas = seccion.querySelector('[data-greviews-score-stars]');
    if (puntajeEstrellas && datos.puntaje) {
      puntajeEstrellas.setAttribute('aria-label', datos.puntaje + ' de 5 estrellas');
    }

    var total = seccion.querySelector('[data-greviews-count]');
    if (total && datos.total) total.textContent = datos.total + ' opiniones en Google';

    var verTodas = seccion.querySelector('[data-greviews-link-all]');
    if (verTodas && datos.total) {
      verTodas.textContent = 'Ver las ' + datos.total + ' opiniones en Google';
      if (urlOpiniones) verTodas.setAttribute('href', urlOpiniones);
    }

    var escribir = seccion.querySelector('[data-greviews-link-write]');
    if (escribir && datos.urlEscribir) escribir.setAttribute('href', datos.urlEscribir);

    prepararFlechas(seccion);
  }

  // La insignia chiquita de las páginas de Servicios: solo el puntaje.
  function pintarInsignia(caja, datos) {
    var enlace = caja.querySelector('a');
    if (enlace && datos.urlOpiniones) enlace.setAttribute('href', datos.urlOpiniones);

    var puntaje = caja.querySelector('[data-gbadge-score]');
    if (puntaje && datos.puntaje) puntaje.textContent = datos.puntaje;

    var estrellasCaja = caja.querySelector('[data-gbadge-stars]');
    if (estrellasCaja && datos.puntaje) {
      estrellasCaja.setAttribute('aria-label', datos.puntaje + ' de 5 estrellas');
    }

    var total = caja.querySelector('[data-gbadge-count]');
    if (total && datos.total) total.textContent = datos.total + ' opiniones';
  }

  // Las flechas tienen que funcionar aunque Google no conteste, porque entonces se
  // quedan las tarjetas de respaldo que ya vienen escritas en el HTML.
  for (var k = 0; k < secciones.length; k++) prepararFlechas(secciones[k]);

  fetch('/api/resenas', { headers: { accept: 'application/json' } })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (datos) {
      if (!datos || !datos.ok) return; // se queda el respaldo del HTML
      for (var i = 0; i < secciones.length; i++) pintar(secciones[i], datos);
      for (var j = 0; j < insignias.length; j++) pintarInsignia(insignias[j], datos);
    })
    .catch(function () {
      /* sin internet o Google caído: se queda el respaldo del HTML */
    });
})();
