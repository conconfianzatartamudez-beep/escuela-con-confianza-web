// Panel de contenidos de Escuela Con Confianza.
// Recibe los cambios del panel (/panel/) y los guarda en GitHub,
// lo que hace que Cloudflare Pages republique la web en 1-2 minutos.
//
// Variables necesarias en Cloudflare Pages (Settings > Environment variables):
//   PANEL_CLAVE   -> contraseña que usa el equipo para entrar al panel.
//   GITHUB_TOKEN  -> token fine-grained con permiso Contents: Read and write
//                    SOLO sobre el repo escuela-con-confianza-web.
//   PANEL_RAMA    -> (opcional) rama donde se publica. Si falta, usa "main".

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
  return env.PANEL_RAMA || "main";
}

function claveValida(request, env) {
  const clave = request.headers.get("x-panel-clave") || "";
  const esperada = env.PANEL_CLAVE || "";
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
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
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

// GET /api/panel?tipo=videos|guias|articulos -> contenido actual.
export async function onRequestGet({ request, env }) {
  if (!claveValida(request, env)) {
    return error(401, "Contraseña incorrecta.");
  }

  const tipo = new URL(request.url).searchParams.get("tipo") || "";
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
    return json({ ok: true, mensaje: "Cambios publicados. La web se actualiza en 1-2 minutos." });
  } catch (e) {
    return error(502, e.message || "No se pudo publicar el cambio.");
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
