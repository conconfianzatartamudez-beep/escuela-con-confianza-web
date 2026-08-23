// Revisa que TODAS las direcciones del sitemap publicado respondan 200.
//
// Cómo usarlo (parado en la carpeta del repositorio):
//     node scripts/revisar-sitemap.mjs
//
// Por qué existe: el 23/08/2026 Google avisó ("Página con redirección") de que el
// sitemap ofrecía /servicios/mentorias-personalizadas/, que desde el cambio de
// nombre solo responde con un desvío 301. Había pasado desapercibido 12 días
// porque sitemap.xml se había corregido a mano pero PAGINAS_FIJAS (en
// lib/generar-web.js) no, y el panel lo rehízo con la dirección vieja.
//
// Un sitemap solo debe listar direcciones FINALES: si una desvía, Google la
// descarta y esa página no se indexa. Los desvíos de _redirects se quedan como
// están — mantienen vivos los enlaces viejos —, pero no deben salir en el sitemap.

const SITEMAP = process.argv[2] || 'https://escuelaconconfianza.com/sitemap.xml';

const xml = await fetch(SITEMAP, { cache: 'no-store' }).then((r) => {
  if (!r.ok) throw new Error(`No se pudo leer ${SITEMAP}: HTTP ${r.status}`);
  return r.text();
});

const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (urls.length === 0) throw new Error(`${SITEMAP} no tiene ninguna <loc>`);

console.log(`Revisando ${urls.length} direcciones de ${SITEMAP}\n`);

const problemas = [];
for (const url of urls) {
  const res = await fetch(url, { redirect: 'manual' });
  const destino = res.headers.get('location');
  const ok = res.status === 200;
  console.log(`  ${ok ? 'OK ' : '!! '} ${res.status}  ${url}${destino ? `  ->  ${destino}` : ''}`);
  if (!ok) problemas.push({ url, status: res.status, destino });
}

if (problemas.length === 0) {
  console.log(`\nTodo bien: las ${urls.length} direcciones responden 200.`);
  process.exit(0);
}

console.error(`\n${problemas.length} direccion(es) del sitemap NO responden 200:`);
for (const p of problemas) {
  console.error(`  - ${p.url}  (HTTP ${p.status}${p.destino ? `, desvía a ${p.destino}` : ''})`);
}
console.error(
  '\nQué hacer: cambiar esa dirección por la FINAL en PAGINAS_FIJAS de lib/generar-web.js\n' +
    'Y ADEMÁS en sitemap.xml. Los dos: sitemap.xml es un archivo generado y el panel\n' +
    'lo rehace desde generar-web.js, así que tocar solo uno se deshace al publicar.',
);
process.exit(1);
