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

export async function onRequestGet({ request, env }) {
  try {
    const appsScriptUrl = getAppsScriptUrl(env);
    const url = new URL(request.url);
    const codigo = url.searchParams.get("codigo") || "";

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

export async function onRequestPost({ request, env }) {
  try {
    const appsScriptUrl = getAppsScriptUrl(env);
    const body = await request.json();
    const action = body.action === "actualizar" ? "actualizar" : "confirmar";

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        action,
        codigo: body.codigo,
        slotsSeleccionados: body.slotsSeleccionados,
      }),
    });

    const data = await readJson(response);

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
