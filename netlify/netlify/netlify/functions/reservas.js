const APPS_SCRIPT_URL = "PEGA_AQUI_TU_URL_DE_APPS_SCRIPT";

exports.handler = async function (event) {
  try {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("PEGA_AQUI")) {
      return responder(500, {
        ok: false,
        mensaje: "Falta configurar la URL de Apps Script en la función de Netlify."
      });
    }

    if (event.httpMethod === "GET") {
      const codigo = event.queryStringParameters?.codigo || "";

      const url =
        `${APPS_SCRIPT_URL}?api=1&action=datos&codigo=${encodeURIComponent(codigo)}`;

      const respuesta = await fetch(url);
      const data = await respuesta.json();

      return responder(200, data);
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      const respuesta = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "confirmar",
          codigo: body.codigo,
          slotsSeleccionados: body.slotsSeleccionados
        })
      });

      const data = await respuesta.json();

      return responder(200, data);
    }

    return responder(405, {
      ok: false,
      mensaje: "Método no permitido."
    });
  } catch (error) {
    return responder(500, {
      ok: false,
      mensaje: error.message || "Error interno en la función de reservas."
    });
  }
};

function responder(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  };
}
