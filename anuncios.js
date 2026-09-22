// Formulario de inscripción de los eventos de /anuncios.
// Manda los datos a /api/inscripcion (functions/api/inscripcion.js), que los
// guarda en el Google Sheets del evento y envía el correo de confirmación.
(function () {
  const form = document.getElementById('form-inscripcion');
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const error = $('form-error');
  const boton = $('form-enviar');
  const campoEdades = $('campo-edades');
  const casillaNino = form.querySelector('input[name="quienes"][value="nino"]');
  const whatsapp = $('f-whatsapp');
  const avisos = $('f-avisos');
  const opcionAvisos = $('opcion-avisos');

  function actualizar() {
    campoEdades.hidden = !casillaNino.checked;
    const hayNumero = whatsapp.value.replace(/\D/g, '').length >= 6;
    avisos.disabled = !hayNumero;
    opcionAvisos.style.opacity = hayNumero ? '1' : '0.55';
    if (!hayNumero) avisos.checked = false;
  }
  form.addEventListener('change', actualizar);
  whatsapp.addEventListener('input', actualizar);
  actualizar();

  function mostrarError(texto, campo) {
    error.textContent = texto;
    error.hidden = false;
    if (campo) campo.focus();
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.hidden = true;

    const datos = {
      nombre: $('f-nombre').value.trim(),
      personas: Number($('f-personas').value),
      quienes: Array.from(form.querySelectorAll('input[name="quienes"]:checked')).map((c) => c.value),
      edades: $('f-edades').value.trim(),
      distrito: $('f-distrito').value.trim(),
      correo: $('f-correo').value.trim(),
      whatsapp: whatsapp.value.trim(),
      avisos: avisos.checked,
      comentario: $('f-comentario').value.trim(),
      acepta: $('f-acepta').checked,
      web: $('f-web').value,
      evento: 'tartamudez-en-la-plaza-2026',
    };

    if (datos.nombre.length < 2) return mostrarError('Escribe tu nombre.', $('f-nombre'));
    if (!(datos.personas >= 1 && datos.personas <= 20)) return mostrarError('Indica cuántas personas van, de 1 a 20.', $('f-personas'));
    if (!datos.quienes.length) return mostrarError('Marca quiénes van.', form.querySelector('input[name="quienes"]'));
    if (datos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) return mostrarError('Revisa tu correo, parece que le falta algo.', $('f-correo'));
    if (!datos.acepta) return mostrarError('Para inscribirte tienes que aceptar el uso de tus datos.', $('f-acepta'));

    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/inscripcion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok || !res.ok) throw new Error(res.error || 'error');

      $('listo-nombre').textContent = datos.nombre.split(' ')[0];
      $('listo-correo').hidden = !datos.correo;
      form.hidden = true;
      const listo = $('form-listo');
      listo.hidden = false;
      listo.focus();
      listo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      mostrarError('No se pudo enviar. Revisa tu conexión e inténtalo otra vez. Si sigue fallando, escríbenos por WhatsApp al 926 687 682.');
      boton.disabled = false;
      boton.textContent = 'Inscribirme';
    }
  });
})();
