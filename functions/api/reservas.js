const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function getAppsScriptUrl(env) {
  const url = env.APPS_SCRIPT_RESERVAS_URL;

  if (!url) {
    throw new Error("Falta configurar APPS_SCRIPT_RESERVAS_URL en Cloudflare Pages.");
  }

  return url;
}

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      mensaje: "Apps Script no devolvió una respuesta JSON válida.",
      detalle: text.slice(0, 300),
    };
  }
}

// --- MOTOR NUEVO (Plataforma de Reservas Independiente, Fase 3c) ---
// Este proxy intenta primero el motor nuevo (Edge Function de Supabase:
// disponibilidad EN VIVO y reserva con rollback) y, si el motor no responde
// con HTTP 200, cae SOLO al Apps Script de siempre (salvavidas). La página
// reservas.html no cambia. La anon key es publicable por diseño: solo pasa
// el verificador JWT; las acciones de alumno exigen el código del link.
// Interruptor de emergencia: ?motor=0 (GET) o {motor:0} (POST) fuerza el
// camino viejo sin tocar código.
const MOTOR_URL = "https://ugexclueeqkancnraryh.supabase.co/functions/v1/api-reservas";
const MOTOR_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZXhjbHVlZXFrYW5jbnJhcnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjM0NTEsImV4cCI6MjA5OTYzOTQ1MX0.bdcNDZUDwwlnIiDH-rYaogmNm3QSRdBN_g7tN4j1iPw";

// Llama al motor nuevo. Devuelve el JSON solo si respondió HTTP 200
// (las validaciones del motor viajan con 200 y ok:false, así que llegan
// tal cual al alumno); ante red caída, timeout o 4xx/5xx devuelve null
// para que el llamador use el salvavidas.
async function llamarMotor(params, timeoutMs) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const respuesta = await fetch(`${MOTOR_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        "authorization": `Bearer ${MOTOR_ANON}`,
        "apikey": MOTOR_ANON,
        "accept": "application/json",
      },
      signal: controlador.signal,
    });

    if (respuesta.status !== 200) {
      return null;
    }

    const data = await respuesta.json();

    return data && typeof data === "object" ? data : null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const codigo = url.searchParams.get("codigo") || "";

    // 1) Motor nuevo: datos del link + disponibilidad calculada en vivo.
    if (url.searchParams.get("motor") !== "0") {
      const data = await llamarMotor(
        new URLSearchParams({ accion: "datosalumno", codigo }),
        25000,
      );

      if (data) {
        return json(data);
      }
    }

    // 2) Salvavidas: Apps Script (el camino de siempre, sin cambios).
    const appsScriptUrl = getAppsScriptUrl(env);
    const target = new URL(appsScriptUrl);
    target.searchParams.set("api", "1");
    target.searchParams.set("action", "datos");
    target.searchParams.set("codigo", codigo);

    const response = await fetch(target.toString(), {
      method: "GET",
      headers: {
        "accept": "application/json",
      },
    });

    const data = await readJson(response);

    return json(data, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return json(
      {
        ok: false,
        mensaje: error.message || "No se pudo conectar con el sistema interno de reservas.",
      },
      { status: 500 },
    );
  }
}

async function llamarAppsScriptPost(env, cuerpo) {
  const response = await fetch(getAppsScriptUrl(env), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });

  return readJson(response).then((data) => ({ response, data }));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const action = body.action === "actualizar" ? "actualizar" : "confirmar";

    if (action === "actualizar") {
      // Con el motor nuevo la disponibilidad se calcula en vivo, así que el
      // alumno puede volver a elegir de inmediato; la hoja de respaldo se
      // regenera igual que antes, pero en segundo plano.
      context.waitUntil(
        llamarAppsScriptPost(env, { action: "actualizar", codigo: body.codigo })
          .catch(() => {}),
      );

      return json({ ok: true, actualizacionEnSegundoPlano: true });
    }

    // 1) Motor nuevo: reserva con validación propia, eventos atómicos y
    //    rollback total si algo falla. Si la respuesta no llega (red caída,
    //    timeout), caer al Apps Script es SEGURO: ambos motores re-verifican
    //    el estado "pendiente" del link bajo el mismo candado y el perdedor
    //    revierte sus eventos.
    if (body.motor !== 0 && body.motor !== "0") {
      const keys = Array.isArray(body.slotsSeleccionados)
        ? body.slotsSeleccionados.join(",")
        : "";
      const data = await llamarMotor(
        new URLSearchParams({
          accion: "reservar",
          codigo: body.codigo || "",
          keys,
        }),
        155000,
      );

      if (data) {
        return json(data);
      }
    }

    // 2) Salvavidas: Apps Script (el camino de siempre, sin cambios).
    const { response, data } = await llamarAppsScriptPost(env, {
      action: "confirmar",
      codigo: body.codigo,
      slotsSeleccionados: body.slotsSeleccionados,
    });

    return json(data, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return json(
      {
        ok: false,
        mensaje: error.message || "No se pudo confirmar la reserva.",
      },
      { status: 500 },
    );
  }
}
