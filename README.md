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
- `recursos-didacticos/articulos/index.html` (todas; hoy no se ve, porque `_redirects`
  manda esa dirección a `/publicaciones/`, pero se mantiene al día por si acaso)

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

### Lo que se genera dentro de cada página de artículo

Además del sitemap y los listados, cada página de artículo
(`recursos-didacticos/articulos/<id>/index.html`) recibe dos bloques generados:

1. **Ficha de datos estructurados** (JSON-LD, antes de `</head>`): le dice a Google que
   la página es un artículo, con su título, imagen, fecha y autor. Ayuda a que aparezca
   mejor presentado en los resultados de búsqueda. El nombre del autor se limpia solo
   (de `"Lic. T.M. Terapeuta de lenguaje, Adriano Vega."` saca `"Adriano Vega"`).
2. **"Sigue leyendo"** (antes de `</main>`): enlaces a las otras lecturas publicadas.
   Sirve a los lectores y también a Google, que así encuentra los artículos siguiendo
   enlaces entre ellos.

Van entre marcadores igual que los listados
(`<!-- DATOS-ESTRUCTURADOS:inicio/fin -->` y `<!-- SIGUE-LEYENDO:inicio/fin -->`) y, si
no existen, el generador los inserta en el sitio correcto. Cuando el panel guarda la
página de un artículo se los pone en el momento, así que una lectura nueva ya nace con
todo. Los estilos del bloque van en línea, a propósito, para no tener que tocar
`styles.css` ni subir su `?v=`.

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
