// Panel de contenidos de Escuela Con Confianza.
// Recibe los cambios del panel (/panel/) y los guarda en GitHub,
// lo que hace que Cloudflare Pages republique la web en 1-2 minutos.
//
// Variables necesarias en Cloudflare Pages (Settings > Environment variables):
//   PANEL_CLAVE   -> contraseña que usa el equipo para entrar al panel.
//   GITHUB_TOKEN  -> token fine-grained con permiso Contents: Read and write
//                    SOLO sobre el repo escuela-con-confianza-web.
//   PANEL_RAMA    -> (opcional) rama donde se publica. Si falta, usa "main".

import {
  PAGINAS_CON_LISTADO,
  generarSitemap,
  actualizarPagina,
  actualizarPaginaArticulo,
  articulosPublicados,
  rutaPaginaArticulo,
} from "../../lib/generar-web.js";

const REPO_API =
  "https://api.github.com/repos/conconfianzatartamudez-beep/escuela-con-confianza-web/contents/";

const ARCHIVOS = {
  videos: "data/recursos/videos.json",
  guias: "data/recursos/guias.json",
  articulos: "data/recursos/articulos.json",
};

// Carpetas donde el panel puede subir archivos, y extensiones permitidas.
const CARPETAS_SUBIDA = ["images/recursos/", "recursos-didacticos/descargas/"];
const EXTENSIONES_SUBIDA = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".zip"];
const TAMANO_MAXIMO_BASE64 = 20 * 1024 * 1024; // ~15 MB reales

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

function error(status, mensaje) {
  return json({ ok: false, mensaje }, { status });
}

function ramaDestino(env) {
  return (env.PANEL_RAMA || "main").trim();
}

function claveValida(request, env) {
  const clave = request.headers.get("x-panel-clave") || "";
  const esperada = (env.PANEL_CLAVE || "").trim();
  if (!esperada) return false;
  if (clave.length !== esperada.length) return false;
  let distintos = 0;
  for (let i = 0; i < clave.length; i++) {
    distintos |= clave.charCodeAt(i) ^ esperada.charCodeAt(i);
  }
  return distintos === 0;
}

function base64aTexto(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function textoABase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function cabecerasGitHub(env) {
  return {
    authorization: `Bearer ${(env.GITHUB_TOKEN || "").trim()}`,
    accept: "application/vnd.github+json",
    "user-agent": "panel-escuela-con-confianza",
    "x-github-api-version": "2022-11-28",
  };
}

// Lee un archivo del repo. Devuelve { contenidoBase64, sha } o null si no existe.
async function leerArchivo(env, ruta) {
  const url = `${REPO_API}${ruta}?ref=${encodeURIComponent(ramaDestino(env))}`;
  const respuesta = await fetch(url, { headers: cabecerasGitHub(env) });

  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    throw new Error(`GitHub respondió ${respuesta.status} al leer ${ruta}.`);
  }

  const datos = await respuesta.json();
  return { contenidoBase64: datos.content || "", sha: datos.sha };
}

// Crea o actualiza un archivo del repo (un commit por guardado).
async function escribirArchivo(env, ruta, contenidoBase64, mensaje, sha) {
  const cuerpo = {
    message: mensaje,
    content: contenidoBase64,
    branch: ramaDestino(env),
  };
  if (sha) cuerpo.sha = sha;

  const respuesta = await fetch(`${REPO_API}${ruta}`, {
    method: "PUT",
    headers: { ...cabecerasGitHub(env), "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(
      `GitHub respondió ${respuesta.status} al guardar ${ruta}: ${detalle.slice(0, 200)}`
    );
  }
}

// ---- Buzón del equipo (mensajes de sugerencias / preguntas / errores) ----
// Se guardan en Supabase (proyecto compartido) vía RPC. Las llaves y la clave
// del equipo viven en variables de entorno del proyecto (BUZON_*), nunca en el
// código, porque este repositorio es público.
async function rpcBuzon(env, fn, cuerpo) {
  const base = (env.BUZON_URL || "").trim();
  const anon = (env.BUZON_ANON || "").trim();
  if (!base || !anon) throw new Error("El buzón no está configurado.");
  const respuesta = await fetch(base + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: {
      apikey: anon,
      authorization: `Bearer ${anon}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (datos && datos.error) throw new Error(datos.error);
  return datos;
}

async function buzonListar(env) {
  try {
    const datos = await rpcBuzon(env, "panel_reportes_listar", {
      p_clave: (env.BUZON_CLAVE || "").trim(),
    });
    return json({ ok: true, reportes: (datos && datos.reportes) || [] });
  } catch (e) {
    return error(502, e.message || "No se pudo leer el buzón.");
  }
}

async function buzonCrear(env, cuerpo) {
  try {
    await rpcBuzon(env, "panel_reporte_crear", {
      p_clave: (env.BUZON_CLAVE || "").trim(),
      p_tipo: String(cuerpo.tipo || "sugerencia"),
      p_autor: String(cuerpo.autor || ""),
      p_texto: String(cuerpo.texto || ""),
    });
    return json({ ok: true });
  } catch (e) {
    return error(502, e.message || "No se pudo enviar el mensaje.");
  }
}

// GET /api/panel?tipo=videos|guias|articulos -> contenido actual.
// GET /api/panel?buzon=1 -> lista de mensajes del buzón del equipo.
export async function onRequestGet({ request, env }) {
  if (!claveValida(request, env)) {
    return error(401, "Contraseña incorrecta.");
  }

  const url = new URL(request.url);
  if (url.searchParams.get("buzon") === "1") {
    return await buzonListar(env);
  }

  const tipo = url.searchParams.get("tipo") || "";
  const ruta = ARCHIVOS[tipo];
  if (!ruta) return error(400, "Tipo de contenido no reconocido.");

  try {
    const archivo = await leerArchivo(env, ruta);
    if (!archivo) return error(404, `No se encontró ${ruta} en el repositorio.`);
    return json({ ok: true, datos: JSON.parse(base64aTexto(archivo.contenidoBase64)) });
  } catch (e) {
    return error(502, e.message || "No se pudo leer el contenido.");
  }
}

// PUT /api/panel  { tipo, datos } -> guarda el JSON completo de esa sección.
export async function onRequestPut({ request, env }) {
  if (!claveValida(request, env)) {
    return error(401, "Contraseña incorrecta.");
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error(400, "El cuerpo de la petición no es JSON válido.");
  }

  // Caso especial: escribir la página HTML de un artículo.
  if (cuerpo && cuerpo.pagina) {
    return await escribirPaginaArticulo(env, cuerpo);
  }

  const { tipo, datos } = cuerpo || {};
  const ruta = ARCHIVOS[tipo];
  if (!ruta) return error(400, "Tipo de contenido no reconocido.");

  // El JSON debe traer la lista esperada (videos/guias/articulos).
  if (!datos || !Array.isArray(datos[tipo])) {
    return error(400, `Los datos deben incluir la lista "${tipo}".`);
  }

  try {
    const actual = await leerArchivo(env, ruta);
    const texto = JSON.stringify(datos, null, 2) + "\n";
    await escribirArchivo(
      env,
      ruta,
      textoABase64(texto),
      `Panel web: actualizar ${tipo}`,
      actual ? actual.sha : undefined
    );

    let mensaje = "Cambios publicados. La web se actualiza en 1-2 minutos.";

    // Al tocar las lecturas hay que rehacer el sitemap y los listados en HTML,
    // para que Google encuentre los artículos sin depender de JavaScript.
    if (tipo === "articulos") {
      const aviso = await regenerarSeo(env, datos.articulos);
      if (aviso) mensaje += ` ${aviso}`;
    }

    return json({ ok: true, mensaje });
  } catch (e) {
    return error(502, e.message || "No se pudo publicar el cambio.");
  }
}

// Rehace sitemap.xml y los listados de lecturas a partir de la lista de artículos.
// Nunca lanza error: si algo falla, el contenido ya quedó publicado y solo devolvemos
// un aviso para que el equipo sepa que hay que revisarlo.
async function regenerarSeo(env, articulos) {
  const problemas = [];

  async function guardarSiCambia(ruta, contenido, mensaje) {
    const existente = await leerArchivo(env, ruta);
    if (existente && base64aTexto(existente.contenidoBase64) === contenido) return;
    await escribirArchivo(env, ruta, textoABase64(contenido), mensaje, existente ? existente.sha : undefined);
  }

  try {
    await guardarSiCambia("sitemap.xml", generarSitemap(articulos), "Panel web: actualizar sitemap");
  } catch (e) {
    problemas.push("sitemap.xml");
  }

  for (const pagina of PAGINAS_CON_LISTADO) {
    try {
      const existente = await leerArchivo(env, pagina.ruta);
      if (!existente) {
        problemas.push(pagina.ruta);
        continue;
      }
      const resultado = actualizarPagina(base64aTexto(existente.contenidoBase64), articulos, pagina);
      if (resultado.error) {
        problemas.push(pagina.ruta);
      } else if (!resultado.sinCambios) {
        await escribirArchivo(
          env,
          pagina.ruta,
          textoABase64(resultado.html),
          `Panel web: actualizar listado de lecturas (${pagina.ruta})`,
          existente.sha
        );
      }
    } catch (e) {
      problemas.push(pagina.ruta);
    }
  }

  // Cada página de artículo lleva su ficha de datos estructurados y su "Sigue leyendo".
  for (const articulo of articulosPublicados(articulos)) {
    const ruta = rutaPaginaArticulo(articulo);
    if (!ruta) continue;
    try {
      const existente = await leerArchivo(env, ruta);
      if (!existente) continue; // la página todavía no existe; se hará al guardarla
      const resultado = actualizarPaginaArticulo(
        base64aTexto(existente.contenidoBase64),
        articulo,
        articulos
      );
      if (resultado.error) {
        problemas.push(ruta);
      } else if (!resultado.sinCambios) {
        await escribirArchivo(
          env,
          ruta,
          textoABase64(resultado.html),
          `Panel web: datos estructurados y "Sigue leyendo" (${ruta})`,
          existente.sha
        );
      }
    } catch (e) {
      problemas.push(ruta);
    }
  }

  if (!problemas.length) return "";
  return `Aviso: no se pudo actualizar ${problemas.join(", ")}; avisa al administrador para que lo revise.`;
}

// Escribe la página HTML completa de un artículo en
// recursos-didacticos/articulos/<id>/index.html (solo texto, generado por el panel).
async function escribirPaginaArticulo(env, cuerpo) {
  const ruta = String(cuerpo.pagina || "");
  const html = String(cuerpo.html || "");

  const rutaValida =
    /^recursos-didacticos\/articulos\/[a-z0-9-]+\/index\.html$/.test(ruta) &&
    !ruta.includes("..");

  if (!rutaValida) return error(400, "Ruta de artículo no permitida.");
  if (!html || html.length > 400 * 1024) {
    return error(400, "El artículo está vacío o es demasiado largo.");
  }

  try {
    // La página nace ya con su ficha de datos estructurados y su "Sigue leyendo".
    // Si algo falla aquí, se guarda la página tal cual: el siguiente guardado de
    // las lecturas (regenerarSeo) los añade.
    let htmlFinal = html;
    try {
      const datos = await leerArchivo(env, ARCHIVOS.articulos);
      const articulos = datos ? JSON.parse(base64aTexto(datos.contenidoBase64)).articulos || [] : [];
      const articulo = articulos.find((a) => rutaPaginaArticulo(a) === ruta);
      if (articulo) {
        const resultado = actualizarPaginaArticulo(html, articulo, articulos);
        if (resultado.html) htmlFinal = resultado.html;
      }
    } catch (e) {
      // sin bloques extra; se completan en el siguiente guardado
    }

    const existente = await leerArchivo(env, ruta);
    await escribirArchivo(
      env,
      ruta,
      textoABase64(htmlFinal),
      `Panel web: página de artículo ${ruta}`,
      existente ? existente.sha : undefined
    );
    return json({ ok: true, ruta });
  } catch (e) {
    return error(502, e.message || "No se pudo guardar la página del artículo.");
  }
}

// POST /api/panel  { ruta, base64 } -> sube un archivo (imagen, PDF o ZIP).
export async function onRequestPost({ request, env }) {
  if (!claveValida(request, env)) {
    return error(401, "Contraseña incorrecta.");
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error(400, "El cuerpo de la petición no es JSON válido.");
  }

  // Enviar un mensaje al buzón del equipo.
  if (cuerpo && cuerpo.accion === "buzon_crear") {
    return await buzonCrear(env, cuerpo);
  }

  const ruta = (cuerpo && cuerpo.ruta) || "";
  const base64 = (cuerpo && cuerpo.base64) || "";

  const carpetaPermitida = CARPETAS_SUBIDA.some((c) => ruta.startsWith(c));
  const nombreValido = /^[a-z0-9/_.-]+$/.test(ruta) && !ruta.includes("..");
  const extension = ruta.slice(ruta.lastIndexOf(".")).toLowerCase();
  const extensionPermitida = EXTENSIONES_SUBIDA.includes(extension);

  if (!carpetaPermitida || !nombreValido || !extensionPermitida) {
    return error(400, "Ruta o tipo de archivo no permitido.");
  }
  if (!base64 || base64.length > TAMANO_MAXIMO_BASE64) {
    return error(400, "El archivo está vacío o pesa más de 15 MB.");
  }

  try {
    const existente = await leerArchivo(env, ruta);
    await escribirArchivo(
      env,
      ruta,
      base64,
      `Panel web: subir ${ruta}`,
      existente ? existente.sha : undefined
    );
    return json({ ok: true, ruta });
  } catch (e) {
    return error(502, e.message || "No se pudo subir el archivo.");
  }
}
