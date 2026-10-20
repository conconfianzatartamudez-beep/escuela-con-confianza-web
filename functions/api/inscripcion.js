// Inscripciones a los eventos de /anuncios.
//
// Qué hace: recibe el formulario de la página del evento y lo reenvía al Apps
// Script "Inscripciones · Tartamudez en la plaza" (cuenta de la escuela), que
// guarda la fila en su Google Sheets y manda el correo de confirmación.
// Pasa por aquí, y no directo desde el navegador a Google, para que la web no
// dependa de cómo responde Google a otros dominios y para poder cambiar el
// destino sin tocar el HTML.
//
// La dirección del Apps Script no es secreta (cualquiera puede mandarle una
// inscripción igual que desde el formulario), por eso va en el código.
// El código fuente del Apps Script está en
// Escritorio\PROYECTOS CON CONFIANZA\SISTEMAS ECC\inscripciones-eventos.

const DESTINOS = {
  'tartamudez-en-la-plaza-2026':
    'https://script.google.com/macros/s/AKfycbyFvLa1BiIVV4_oLRYQgV7zbxD-1HDwVs8_QyJVSegmoOeRSHAj4uLlWE3yzMU2G9zj/exec',
};

const CERRADOS = new Set(['tartamudez-en-la-plaza-2026']);

const CABECERAS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CABECERAS });
}

export async function onRequestPost({ request }) {
  const texto = await request.text();
  if (texto.length > 6000) return json({ ok: false, error: 'muy-largo' }, 413);

  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return json({ ok: false, error: 'formato' }, 400);
  }

  // Eventos que ya se realizaron: no se aceptan más inscripciones (Tartamudez en la plaza, 18/10/2026).
  if (CERRADOS.has(datos && datos.evento)) return json({ ok: false, error: 'cerrado' }, 410);

  const destino = DESTINOS[datos && datos.evento];
  if (!destino) return json({ ok: false, error: 'evento' }, 400);

  // Prueba del consentimiento (Ley 29733, reglamento art. 9): desde qué IP y a qué
  // hora llegó la inscripción. Los pone el servidor, así el navegador no los puede
  // inventar; si alguien los manda en el formulario, se reemplazan.
  datos.ip_origen = request.headers.get('CF-Connecting-IP') || '';
  datos.fecha_servidor = new Date().toISOString();

  try {
    const r = await fetch(destino, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(datos),
      redirect: 'follow',
    });
    const respuesta = await r.json();
    return json(respuesta, respuesta && respuesta.ok ? 200 : 400);
  } catch (e) {
    return json({ ok: false, error: 'servicio' }, 502);
  }
}

export function onRequestGet() {
  return json({ ok: false, error: 'usa POST' }, 405);
}
