// Rehace el sitemap.xml y los listados de lecturas a partir de
// data/recursos/articulos.json.
//
// Cómo usarlo (parado en la carpeta del repositorio):
//     node scripts/actualizar-web.mjs
//
// Normalmente NO hace falta correrlo: el panel (/panel/) lo hace solo cada vez que
// el equipo publica. Sirve para arreglar la web a mano si algo se desincronizó, o
// después de editar articulos.json directamente en el repositorio.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PAGINAS_CON_LISTADO,
  generarSitemap,
  actualizarPagina,
  articulosPublicados,
} from '../lib/generar-web.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

async function escribirSiCambia(rutaRelativa, contenido) {
  const ruta = join(RAIZ, rutaRelativa);
  const actual = await readFile(ruta, 'utf8').catch(() => null);
  if (actual === contenido) {
    console.log(`  = ${rutaRelativa} (sin cambios)`);
    return false;
  }
  await writeFile(ruta, contenido, 'utf8');
  console.log(`  ✔ ${rutaRelativa} actualizado`);
  return true;
}

const json = JSON.parse(await readFile(join(RAIZ, 'data/recursos/articulos.json'), 'utf8'));
const articulos = json.articulos || [];
const publicados = articulosPublicados(articulos);

console.log(`Lecturas en el panel: ${articulos.length} (publicadas: ${publicados.length})`);
for (const a of publicados) console.log(`  · ${a.date}  ${a.url}`);

const noPublicadas = articulos.filter((a) => !publicados.includes(a));
for (const a of noPublicadas) {
  console.log(`  · (fuera del sitemap: "${a.badge || 'sin página'}") ${a.title}`);
}

console.log('\nGenerando archivos:');
await escribirSiCambia('sitemap.xml', generarSitemap(articulos));

let hayError = false;
for (const pagina of PAGINAS_CON_LISTADO) {
  const html = await readFile(join(RAIZ, pagina.ruta), 'utf8').catch(() => null);
  if (html === null) {
    console.error(`  ✖ No se encontró ${pagina.ruta}`);
    hayError = true;
    continue;
  }
  const resultado = actualizarPagina(html, articulos, pagina);
  if (resultado.error) {
    console.error(`  ✖ ${resultado.error}`);
    hayError = true;
  } else if (resultado.sinCambios) {
    console.log(`  = ${pagina.ruta} (sin cambios)`);
  } else {
    await escribirSiCambia(pagina.ruta, resultado.html);
  }
}

if (hayError) {
  console.error('\nTerminó con errores. Revisa los mensajes de arriba.');
  process.exit(1);
}
console.log('\nListo. Revisa los cambios con "git diff" y súbelos con "git push".');
