// Formulario de inscripción de los eventos de /anuncios.
// Manda los datos a /api/inscripcion (functions/api/inscripcion.js), que los
// guarda en el Google Sheets del evento y envía el correo de confirmación.
(function () {
  const form = document.getElementById('form-inscripcion');
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const elegido = (nombre) => (form.querySelector('input[name="' + nombre + '"]:checked') || {}).value || '';
  const error = $('form-error');
  const boton = $('form-enviar');
  const whatsapp = $('f-whatsapp');

  function actualizar(ev) {
    const quien = elegido('quien');
    // Quien trae a un niño va acompañado sí o sí.
    if (ev && ev.target.name === 'quien' && quien === 'familiar_nino') {
      form.querySelector('input[name="acompanado"][value="si"]').checked = true;
    }
    const acompanado = elegido('acompanado') === 'si';
    $('campo-acompanantes').hidden = !acompanado;
    $('campo-ninos').hidden = quien !== 'familiar_nino';

  }
  form.addEventListener('change', actualizar);
  // El aviso rojo se va apenas la persona corrige algo, para que no quede pegado.
  form.addEventListener('input', () => { error.hidden = true; });
  form.addEventListener('change', () => { error.hidden = true; });
  actualizar();

  function mostrarError(texto, campo) {
    error.textContent = texto;
    error.hidden = false;
    if (campo) campo.focus();
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.hidden = true;

    const quien = elegido('quien');
    const acompanado = elegido('acompanado');
    const acompanantes = acompanado === 'si' ? Number($('f-acompanantes').value) : 0;
    const ninos = quien === 'familiar_nino' ? Number($('f-ninos').value) : 0;

    const datos = {
      nombre: $('f-nombre').value.trim(),
      quien,
      acompanantes,
      ninos,
      personas: 1 + acompanantes,
      edades: quien === 'familiar_nino' ? $('f-edades').value.trim() : '',
      distrito: $('f-distrito').value,
      // El autocompletado del celular a veces mete espacios o caracteres invisibles.
      correo: $('f-correo').value.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase(),
      whatsapp: whatsapp.value.trim(),
      // El campo de WhatsApp es solo para quien quiere avisos: dejarlo es aceptarlos.
      avisos: whatsapp.value.replace(/\D/g, '').length >= 6,
      acepta: $('f-acepta').checked,
      web: $('f-web').value,
      evento: 'tartamudez-en-la-plaza-2026',
    };

    if (datos.nombre.length < 2) return mostrarError('Escribe tu nombre.', $('f-nombre'));
    if (!quien) return mostrarError('Cuéntanos quién eres.', form.querySelector('input[name="quien"]'));
    if (!acompanado) return mostrarError('Dinos si irás acompañado.', form.querySelector('input[name="acompanado"]'));
    if (acompanado === 'si' && !(acompanantes >= 1 && acompanantes <= 15)) return mostrarError('Indica con cuántas personas irás, de 1 a 15.', $('f-acompanantes'));
    if (quien === 'familiar_nino' && !(ninos >= 1 && ninos <= acompanantes)) return mostrarError('Revisa cuántos niños irán. No pueden ser más que las personas que van contigo.', $('f-ninos'));
    if (datos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) return mostrarError('Revisa tu correo, parece que le falta algo.', $('f-correo'));
    if (!datos.acepta) return mostrarError('Marca la casilla de aceptación para terminar tu inscripción.', $('f-acepta'));

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
