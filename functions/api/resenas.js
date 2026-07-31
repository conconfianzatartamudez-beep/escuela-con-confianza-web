// Opiniones de Google EN VIVO.
//
// Qué hace: le pregunta a Google (Places API) cuántas estrellas tiene la ficha de
// Escuela Con Confianza y cuáles son las últimas opiniones, y devuelve todo en JSON
// para que la web lo dibuje. Así la sección de la web se actualiza sola cuando
// alguien deja una opinión nueva; nadie tiene que copiar nada a mano.
//
// Variables necesarias en Cloudflare Pages (Settings > Environment variables):
//   GOOGLE_PLACES_KEY -> llave de la API de Google (SECRETO: el repositorio es
//                        público, la llave NUNCA va en el código).
//   GOOGLE_PLACE_ID   -> (opcional) identificador de la ficha. Si falta se usa el
//                        de Escuela Con Confianza que está más abajo.
//
// Si la llave no está puesta, o Google falla, esta función responde
// { ok: false, fuente: "respaldo" } y la web se queda con las opiniones que ya
// están escritas en el HTML (data/resenas-google.json). Nunca se ve rota.
//
// Nota sobre Google: la API devuelve como máximo 5 opiniones. El puntaje y el
// total sí son los reales de toda la ficha.

const PLACE_ID_POR_DEFECTO = "ChIJxTzXduvIBZERF9FrdAr9P9o";
const FICHA_MAPS = "https://maps.app.goo.gl/SDBSp1u9EvL1XJZg7";

// Cada cuánto se le vuelve a preguntar a Google. Seis horas es de sobra: las
// opiniones nuevas llegan de a pocas, y así la llamada a la API es gratis.
const SEGUNDOS_CACHE = 6 * 60 * 60;

const CABECERAS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": `public, max-age=1800, s-maxage=${SEGUNDOS_CACHE}`,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CABECERAS });
}

// Google entrega el puntaje como número (4.9). En español se muestra con coma.
function puntajeBonito(valor) {
  const n = Number(valor);
  if (!isFinite(n) || n <= 0) return null;
  return n.toFixed(1).replace(".", ",");
}

function normalizar(datos, placeId) {
  const opiniones = (datos.reviews || [])
    .map((r) => {
      const autor = r.authorAttribution || {};
      const texto = ((r.originalText && r.originalText.text) || (r.text && r.text.text) || "").trim();
      if (!texto) return null;
      return {
        nombre: autor.displayName || "Alguien de Google",
        // Google exige mostrar la foto y el nombre de quien escribió, y enlazar a su
        // perfil. Si algún día no vienen, la web dibuja la inicial en un círculo.
        fotoUrl: autor.photoUri || "",
        perfilUrl: autor.uri || "",
        estrellas: Number(r.rating) || 5,
        fecha: r.relativePublishTimeDescription || "",
        texto,
        completa: true,
        resenaUrl: r.googleMapsUri || datos.googleMapsUri || FICHA_MAPS,
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    fuente: "google",
    puntaje: puntajeBonito(datos.rating),
    total: Number(datos.userRatingCount) || opiniones.length,
    urlOpiniones: datos.googleMapsUri || FICHA_MAPS,
    urlEscribir: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`,
    opiniones,
  };
}

async function pedirAGoogle(env) {
  const llave = (env.GOOGLE_PLACES_KEY || "").trim();
  if (!llave) return { ok: false, fuente: "respaldo", motivo: "sin-llave" };

  const placeId = (env.GOOGLE_PLACE_ID || PLACE_ID_POR_DEFECTO).trim();
  const url =
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
    "?languageCode=es&regionCode=PE";

  let respuesta;
  try {
    respuesta = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": llave,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
      },
    });
  } catch (e) {
    return { ok: false, fuente: "respaldo", motivo: "sin-conexion" };
  }

  if (!respuesta.ok) {
    return { ok: false, fuente: "respaldo", motivo: `google-${respuesta.status}` };
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch (e) {
    return { ok: false, fuente: "respaldo", motivo: "respuesta-rara" };
  }

  const limpio = normalizar(datos, placeId);
  if (!limpio.puntaje || !limpio.opiniones.length) {
    return { ok: false, fuente: "respaldo", motivo: "sin-opiniones" };
  }
  return limpio;
}

export async function onRequestGet({ request, env, waitUntil }) {
  // Guardamos la respuesta en la caché de Cloudflare para no llamar a Google en
  // cada visita (la API se paga por llamada a partir de cierto volumen).
  const clave = new Request(new URL("/api/resenas", request.url).toString(), { method: "GET" });
  const cache = caches.default;

  const guardada = await cache.match(clave);
  if (guardada) return guardada;

  const datos = await pedirAGoogle(env);
  const respuesta = json(datos, 200);

  // Si algo falló, se guarda poco tiempo para reintentar pronto.
  if (!datos.ok) {
    const corta = new Response(JSON.stringify(datos), {
      status: 200,
      headers: { ...CABECERAS, "cache-control": "public, max-age=300, s-maxage=300" },
    });
    waitUntil(cache.put(clave, corta.clone()));
    return corta;
  }

  waitUntil(cache.put(clave, respuesta.clone()));
  return respuesta;
}
