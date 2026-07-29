# escuela-con-confianza-web

Sitio web de Escuela Con Confianza (`escuelaconconfianza.com`).
Es un sitio estático: Cloudflare Pages sirve estos archivos tal cual, no hay compilación.

## Cómo se publica el contenido

El equipo publica desde el panel: `escuelaconconfianza.com/panel/`.
El panel guarda los cambios en este repositorio (vía la API de GitHub) y Cloudflare
Pages vuelve a publicar la web en 1-2 minutos.

## Que Google encuentre las lecturas (importante)

El listado de lecturas se dibuja con JavaScript en el navegador (`recursos.js`, a partir
de `data/recursos/articulos.json`). Los buscadores muchas veces **no** ejecutan ese
JavaScript, así que veían la página vacía y no encontraban los artículos.

Por eso, los enlaces de las lecturas también se escriben **dentro del HTML**, y el
`sitemap.xml` se arma solo con las lecturas publicadas:

- `sitemap.xml`
- `recursos-didacticos.html` (lecturas destacadas)
- `recursos-didacticos/publicaciones/index.html` (todas)
- `recursos-didacticos/articulos/index.html` (todas)

En esos tres HTML hay un bloque delimitado así:

```html
<div class="resources-articles__grid" data-all-articles><!-- LISTA-AUTOMATICA:inicio -->
  ... enlaces generados ...
<!-- LISTA-AUTOMATICA:fin --></div>
```

**No edites a mano lo que hay entre esos dos comentarios**, ni borres los comentarios:
son las marcas que el generador necesita para saber dónde escribir.

### Se actualiza solo

Cada vez que se guardan las lecturas desde el panel, `functions/api/panel.js` rehace el
sitemap y los tres listados en el mismo momento. No hay que hacer nada más.

Una lectura entra al `sitemap.xml` cuando tiene página propia
(`/recursos-didacticos/articulos/<id>/`) y **no** está marcada como "Próximamente".
Las marcadas como "Próximamente" siguen apareciendo en la web, pero sin enlace y sin
entrar al sitemap.

### Si hay que rehacerlo a mano

Con [Node.js](https://nodejs.org) instalado, parado en la carpeta del repositorio:

```bash
node scripts/actualizar-web.mjs
```

Muestra qué lecturas encontró, reescribe lo que haga falta y no toca lo que ya está bien.
Después: `git add -A && git commit -m "Actualizar sitemap y listados" && git push`.

La lógica vive en un solo archivo, `lib/generar-web.js`, que usan tanto el panel como el
script. Si cambias el diseño de las tarjetas en `recursos.js`, cámbialo también ahí para
que el HTML generado siga siendo idéntico a lo que dibuja el navegador.

### Páginas nuevas hechas a mano

Si algún día se crea una página nueva que no venga del panel (por ejemplo, un servicio
nuevo), hay que agregarla a la lista `PAGINAS_FIJAS` de `lib/generar-web.js` para que
aparezca en el sitemap.

## Otras notas

- **Caché de JS y CSS:** los `.js` y `.css` se cachean por mucho tiempo. Si editas uno,
  hay que subir el número del `?v=` en **todos** los HTML que lo cargan, o los visitantes
  seguirán con la versión vieja.
- **`robots.txt`:** bloquea a propósito a los rastreadores de IA (ClaudeBot, GPTBot, CCBot,
  Bytespider, Google-Extended, Amazonbot, Applebot-Extended, meta-externalagent) y permite
  a los buscadores normales. Es intencional: Google sí indexa, las IA no entrenan.
- **Tras publicar cambios grandes de SEO**, conviene reenviar el sitemap en Google Search
  Console para que Google vuelva a rastrear.
