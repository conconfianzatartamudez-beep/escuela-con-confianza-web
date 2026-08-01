// Reescribe la sección "Opiniones en Google" de index.html y testimonios.html
// a partir de data/resenas-google.json.
//
// Cómo usarlo (parado en la carpeta del repositorio):
//     node scripts/actualizar-resenas.mjs
//
// Se corre a mano, cada vez que se agregan o cambian opiniones en el JSON.
// El panel de contenidos (/panel/) NO toca esto.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PAGINAS_CON_RESENAS,
  PAGINAS_CON_INSIGNIA,
  actualizarPagina,
  actualizarInsignia,
  ordenarPorFecha,
} from '../lib/generar-resenas.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const datos = JSON.parse(await readFile(join(RAIZ, 'data/resenas-google.json'), 'utf8'));
const opiniones = datos.opiniones || [];
const enOrden = ordenarPorFecha(opiniones);

console.log(`Ficha de Google: ${datos.puntaje} con ${datos.total} opiniones.`);
console.log(`Opiniones en el archivo: ${opiniones.length}. De la más nueva a la más antigua:`);
enOrden.forEach((o, i) => {
  const marca = i < 3 ? '  ← sale en la portada' : '';
  console.log(`  ${String(i + 1).padStart(2)}. ${o.fechaOrden || '(sin fecha)'}  ${o.nombre}${marca}`);
});
const sinFecha = opiniones.filter((o) => !o.fechaOrden);
if (sinFecha.length) {
  console.log(`  ⚠ ${sinFecha.length} sin "fechaOrden": van al final. Conviene ponérsela.`);
}

if (!opiniones.length) {
  console.error('No hay opiniones en data/resenas-google.json. No se cambió nada.');
  process.exit(1);
}

console.log('\nGenerando páginas:');
let hayError = false;

for (const pagina of PAGINAS_CON_RESENAS) {
  const ruta = join(RAIZ, pagina.ruta);
  const html = await readFile(ruta, 'utf8').catch(() => null);
  if (html === null) {
    console.error(`  ✖ No se encontró ${pagina.ruta}`);
    hayError = true;
    continue;
  }
  const resultado = actualizarPagina(html, datos, pagina);
  if (resultado.error) {
    console.error(`  ✖ ${resultado.error}`);
    hayError = true;
  } else if (resultado.sinCambios) {
    console.log(`  = ${pagina.ruta} (sin cambios)`);
  } else {
    await writeFile(ruta, resultado.html, 'utf8');
    console.log(`  ✔ ${pagina.ruta} actualizado`);
  }
}

console.log('\nInsignia en las páginas de Servicios:');
for (const pagina of PAGINAS_CON_INSIGNIA) {
  const ruta = join(RAIZ, pagina.ruta);
  const html = await readFile(ruta, 'utf8').catch(() => null);
  if (html === null) {
    console.error(`  ✖ No se encontró ${pagina.ruta}`);
    hayError = true;
    continue;
  }
  const resultado = actualizarInsignia(html, datos, pagina);
  if (resultado.error) {
    console.error(`  ✖ ${resultado.error}`);
    hayError = true;
  } else if (resultado.sinCambios) {
    console.log(`  = ${pagina.ruta} (sin cambios)`);
  } else {
    await writeFile(ruta, resultado.html, 'utf8');
    console.log(`  ✔ ${pagina.ruta} actualizado`);
  }
}

if (hayError) {
  console.error('\nTerminó con errores. Revisa los mensajes de arriba.');
  process.exit(1);
}
console.log('\nListo. Revisa los cambios con "git diff" y súbelos con "git push".');
