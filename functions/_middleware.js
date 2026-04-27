import { onRequestGet, onRequestPost } from "./api/reservas.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname === "/.netlify/functions/reservas") {
    if (context.request.method === "GET") {
      return onRequestGet(context);
    }

    if (context.request.method === "POST") {
      return onRequestPost(context);
    }

    return new Response("Method Not Allowed", { status: 405 });
  }

  return context.next();
}
