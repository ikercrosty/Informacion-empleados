
(function () {
  'use strict';

  // ---------------- Config global (puede ser sobrescrita por plantilla) ----------------
  const CFG = window.__FICHA_CONFIG || {};
  const PLACEHOLDER = CFG.placeholder || '/static/imagenes/default.png';
  const API_EMPLEADOS = CFG.apiEmpleados || '/api/empleados';
  const API_EMPLEADO_BASE = CFG.apiEmpleadoBase || '/api/empleado/';
  const API_FOTO_BASE = CFG.apiFotoBase || '/api/foto/';

  const safe = v => (v === null || typeof v === 'undefined') ? '' : v;

  // ---------------- Utilidades fetch JSON ----------------
  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, Object.assign({ cache: 'no-store' }, opts));
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status} ${text}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  }

  // ---------------- Registro y edición de tablas (planilla) ----------------
  const tablas = {};
  let tablaActiva = null;
  let filaActiva = null;
  let copiaOriginal = [];
  let esNuevo = false;

  const btnAgregar = document.getElementById('btnAgregar');
  const btnEditar  = document.getElementById('btnEditar');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnCancelar= document.getElementById('btnCancelar');

  function resetBotones() {
    if (!btnAgregar) return;
    btnAgregar.disabled = false;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
  }
  resetBotones();

  function registrarTabla(idTabla, columnas, endpoint, campos, bloqueadas = []) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;
    tablas[idTabla] = { tabla, columnas, endpoint, campos, bloqueadas };

    tabla.addEventListener('dblclick', (e) => {
      const tr = e.target.closest('tr');
      if (!tr || tr.parentElement.tagName !== 'TBODY') return;
      if (filaActiva) filaActiva.classList.remove('table-active');
      filaActiva = tr;
      tablaActiva = tabla;
      filaActiva.classList.add('table-active');
      copiaOriginal = Array.from(filaActiva.querySelectorAll('td')).map(td => td.innerText);
      esNuevo = false;
      if (btnEditar) btnEditar.disabled = false;
      if (btnGuardar) btnGuardar.disabled = true;
      if (btnCancelar) btnCancelar.disabled = false;
    });

    if (idTabla === 'tablaEmpleados') {
      tabla.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        if (!tr || tr.parentElement.tagName !== 'TBODY') return;
        const dpiCell = tr.cells && tr.cells[0];
        if (!dpiCell) return;
        const dpi = dpiCell.innerText.trim();
        if (!dpi) return;

        const foto = document.getElementById('fotoEmpleado');
        const formSubir = document.getElementById('formSubirFoto');
        const formEliminar = document.getElementById('formEliminarFoto');
        const inputDpiUpload = document.getElementById('inputDpiForUpload');
        const inputDpiDelete = document.getElementById('inputDpiForDelete');
        if (!foto || !formSubir || !formEliminar || !inputDpiUpload || !inputDpiDelete) return;

        inputDpiUpload.value = dpi;
        inputDpiDelete.value = dpi;
        formSubir.style.display = 'none';
        formEliminar.style.display = 'none';

        fetch(`${API_FOTO_BASE}${encodeURIComponent(dpi)}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => {
            if (data && data.foto) {
              const url = data.url ? data.url : `/static/fotos/${data.foto}`;
              foto.src = `${url}?t=${Date.now()}`;
              formEliminar.style.display = 'block';
              formSubir.style.display = 'none';
            } else {
              foto.src = PLACEHOLDER;
              formSubir.style.display = 'block';
              formEliminar.style.display = 'none';
            }
          })
          .catch(() => {
            foto.src = PLACEHOLDER;
            formSubir.style.display = 'block';
            formEliminar.style.display = 'none';
          });
      });
    }
  }

  function obtenerPrimeraTablaVisible() {
    const entries = Object.values(tablas);
    for (let i = 0; i < entries.length; i++) {
      const t = entries[i].tabla;
      if (t && t.offsetParent !== null) return entries[i];
    }
    return null;
  }

  function agregarFila() {
    if (!tablaActiva) {
      const primera = obtenerPrimeraTablaVisible();
      if (!primera) { alert('No hay tablas disponibles para agregar.'); return; }
      tablaActiva = primera.tabla;
    }
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const { columnas, bloqueadas } = info;
    const tbody = tablaActiva.querySelector('tbody');
    if (!tbody) return;

    const nueva = document.createElement('tr');
    for (let i = 0; i < columnas; i++) {
      const td = document.createElement('td');
      td.innerText = '';
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      }
      nueva.appendChild(td);
    }
    tbody.insertBefore(nueva, tbody.firstChild);

    if (filaActiva) filaActiva.classList.remove('table-active');
    filaActiva = nueva;
    filaActiva.classList.add('table-active');
    esNuevo = true;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
  }

  function editarFila() {
    if (!filaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const bloqueadas = info.bloqueadas || [];
    const celdas = Array.from(filaActiva.querySelectorAll('td'));
    copiaOriginal = celdas.map(td => td.innerText);
    celdas.forEach((td, i) => {
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      }
    });
    esNuevo = false;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
  }

  function cancelarEdicion() {
    if (!filaActiva) return;
    if (esNuevo) {
      filaActiva.remove();
    } else {
      const celdas = Array.from(filaActiva.querySelectorAll('td'));
      celdas.forEach((td, i) => {
        td.innerText = copiaOriginal[i] || '';
        td.contentEditable = false;
        td.style.backgroundColor = '';
      });
      filaActiva.classList.remove('table-active');
    }
    filaActiva = null;
    tablaActiva = null;
    copiaOriginal = [];
    esNuevo = false;
    resetBotones();
  }

  async function guardarEdicion() {
    if (!filaActiva || !tablaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const { campos, endpoint, columnas } = info;
    const celdas = Array.from(filaActiva.querySelectorAll('td'));
    if (celdas.length < columnas) { alert('La fila no tiene el número correcto de columnas.'); return; }

    const datos = celdas.map(td => {
      const v = td.innerText.trim();
      return v === '' ? null : v;
    });

    const payload = {};
    campos.forEach((campo, i) => payload[campo] = datos[i]);
    payload['nuevo'] = esNuevo;

    if (campos.includes('Numero de DPI') && !payload['Numero de DPI']) { alert('El campo Numero de DPI es obligatorio.'); return; }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw j;
      }
      const json = await res.json();
      if (json.mensaje) alert(json.mensaje);
      celdas.forEach(td => { td.contentEditable = false; td.style.backgroundColor = ''; });
      filaActiva.classList.remove('table-active');
      filaActiva = null;
      tablaActiva = null;
      esNuevo = false;
      copiaOriginal = [];
      resetBotones();
    } catch (err) {
      const msg = (err && err.mensaje) ? err.mensaje : String(err);
      alert('Error al guardar: ' + msg);
    }
  }

  if (btnAgregar) btnAgregar.addEventListener('click', agregarFila);
  if (btnEditar)  btnEditar.addEventListener('click', editarFila);
  if (btnCancelar) btnCancelar.addEventListener('click', cancelarEdicion);
  if (btnGuardar) btnGuardar.addEventListener('click', guardarEdicion);

  window.registrarTabla = registrarTabla;

  // -------------- final registro de tablas: tus plantillas pueden llamar registrarTabla(...) --------------

  // ---------------- FICHA (select, load, fill) ----------------
  async function loadEmpleados() {
    const sel = document.getElementById('empleadoSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando...</option>';
    try {
      const data = await fetchJson(API_EMPLEADOS);
      sel.innerHTML = '<option value="">Seleccione empleado...</option>';
      (Array.isArray(data) ? data : []).forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.dpi || '';
        opt.textContent = e.full_name || e.dpi || '---';
        sel.appendChild(opt);
      });
    } catch (err) {
      console.error('loadEmpleados error', err);
      sel.innerHTML = '<option value="">Error cargando empleados</option>';
    }
  }

  async function fillFicha(emp) {
    if (!emp || typeof emp !== 'object') return;
    try {
      const map = {
        nombre: ['Nombre'],
        apellidos: ['Apellidos'],
        apellidos_casada: ['Apellidos de casada'],
        fecha_nacimiento: ['Fecha de nacimiento'],
        edad: ['Edad'],
        sexo: ['Sexo'],
        estado_civil: ['Estado Civil'],
        iggs: ['Numero de Afiliación del IGGS'],
        telefono: ['Numero de Telefono'],
        celular: ['Celular', 'Telefono Celular'],
        correo: ['Correo Electronico'],
        direccion: ['Dirección del Domicilio', 'direccion'],
        numero: ['Numero', 'numero'],
        colonia: ['Colonia', 'colonia'],
        municipio: ['Municipio', 'municipio'],
        departamento: ['Departamento'],
        cp: ['C.P.', 'CP'],
        puesto: ['Puesto de trabajo', 'Puesto'],
        area: ['Area'],
        jefe: ['Nombre del Jefe Imediato', 'Jefe'],
        fecha_ingreso: ['Fecha de inicio laboral'],
        sueldo: ['Sueldo'],
        escolaridad: ['Nivel de estudios'],
        especifique: ['Profesión u Oficio', 'Especifique'],
        otros_estudios: ['Cursos o titulos adicionales'],
        padece: ['Padece alguna enfermedad'],
        medicamento: ['Nombre del tratamiento'],
        operaciones: ['Operaciones', 'Cirugias'],
        accidentes: ['Accidentes', 'Ha tenido algun accidente'],
        emerg_nombre: ['Nombre del contacto de emergencia'],
        emerg_telefono: ['Numero de telefono de emergencia'],
        emerg_parentesco: ['Parentesco']
      };

      Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const keys = map[id];
        let val = '';
        for (let k of keys) {
          if (Object.prototype.hasOwnProperty.call(emp, k) && emp[k] != null) { val = emp[k]; break; }
        }
        el.value = safe(val);
      });

      const dpi = emp['Numero de DPI'] || emp.dpi || emp.numero || '';
      const fotoEl = document.getElementById('fotoEmpleado') || document.getElementById('foto');
      if (!fotoEl) return;
      if (!dpi) { fotoEl.src = PLACEHOLDER; return; }

      try {
        const j = await fetchJson(API_FOTO_BASE + encodeURIComponent(dpi));
        if (j && j.url) fotoEl.src = `${j.url}?t=${Date.now()}`;
        else if (j && j.foto) fotoEl.src = `/static/fotos/${j.foto}?t=${Date.now()}`;
        else fotoEl.src = PLACEHOLDER;
      } catch (err) {
        console.error('Error fetch foto', err);
        fotoEl.src = PLACEHOLDER;
      }
    } catch (err) {
      console.error('fillFicha error', err);
    }
  }

  function attachSelectListener() {
    const sel = document.getElementById('empleadoSelect');
    if (!sel) return;
    sel.addEventListener('change', async function () {
      const dpi = this.value || '';
      const fotoEl = document.getElementById('fotoEmpleado') || document.getElementById('foto');
      if (!dpi) {
        const form = document.getElementById('fichaForm');
        if (form) form.reset();
        if (fotoEl) fotoEl.src = PLACEHOLDER;
        return;
      }
      try {
        const emp = await fetchJson(API_EMPLEADO_BASE + encodeURIComponent(dpi));
        await fillFicha(emp);
      } catch (err) {
        console.error('Error cargando empleado', err);
        alert('Error cargando datos del empleado');
        if (fotoEl) fotoEl.src = PLACEHOLDER;
      }
    });
  }

  // ---------------- Subida / eliminación de fotos (forms AJAX) ----------------
  function initUploadForms() {
    const formSubir = document.getElementById('formSubirFoto');
    const formEliminar = document.getElementById('formEliminarFoto');
    const fileFoto = document.getElementById('fileFoto');
    const fotoEmpleado = document.getElementById('fotoEmpleado') || document.getElementById('foto');
    const inputDpiUpload = document.getElementById('inputDpiForUpload');
    const inputDpiDelete = document.getElementById('inputDpiForDelete');

    if (formSubir) {
      formSubir.action = '/subir_foto';
      formSubir.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dpi = (inputDpiUpload && inputDpiUpload.value) ? inputDpiUpload.value.trim() : '';
        if (!dpi) { alert('Selecciona una fila primero.'); return; }
        const file = (fileFoto && fileFoto.files && fileFoto.files[0]) ? fileFoto.files[0] : null;
        if (!file) { alert('Selecciona un archivo.'); return; }

        const fd = new FormData();
        fd.append('dpi', dpi);
        fd.append('foto', file);

        try {
          const res = await fetch('/subir_foto', { method: 'POST', body: fd, credentials: 'same-origin' });
          if (!res.ok && res.status !== 302) {
            const text = await res.text().catch(() => '');
            alert('Error al subir: ' + res.status + ' ' + text);
            return;
          }
          try {
            const j = await fetchJson(API_FOTO_BASE + encodeURIComponent(dpi) + '?t=' + Date.now());
            if (fotoEmpleado) {
              if (j && j.url) fotoEmpleado.src = `${j.url}?t=${Date.now()}`;
              else if (j && j.foto) fotoEmpleado.src = `/static/fotos/${j.foto}?t=${Date.now()}`;
              else fotoEmpleado.src = PLACEHOLDER;
            }
          } catch (_) { if (fotoEmpleado) fotoEmpleado.src = PLACEHOLDER; }
          if (fileFoto) fileFoto.value = '';
          if (formSubir) formSubir.style.display = 'none';
          if (formEliminar) formEliminar.style.display = 'block';
          alert('Foto subida correctamente');
        } catch (err) {
          console.error('Error subir foto:', err);
          alert('Error en la subida. Revisa la consola del servidor.');
        }
      });
    }

    if (formEliminar) {
      formEliminar.action = '/eliminar_foto';
      formEliminar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dpi = (inputDpiDelete && inputDpiDelete.value) ? inputDpiDelete.value.trim() : '';
        if (!dpi) { alert('Selecciona una fila primero.'); return; }

        const fd = new FormData();
        fd.append('dpi', dpi);

        try {
          const res = await fetch('/eliminar_foto', { method: 'POST', body: fd, credentials: 'same-origin' });
          if (!res.ok && res.status !== 302) {
            const text = await res.text().catch(() => '');
            alert('Error al eliminar: ' + res.status + ' ' + text);
            return;
          }
          if (fotoEmpleado) fotoEmpleado.src = PLACEHOLDER;
          if (formEliminar) formEliminar.style.display = 'none';
          if (formSubir) formSubir.style.display = 'block';
          if (fileFoto) fileFoto.value = '';
          alert('Foto eliminada');
        } catch (err) {
          console.error('Error eliminar foto:', err);
          alert('Error al eliminar la foto. Revisa la consola del servidor.');
        }
      });
    }
  }

  // ---------------- UI global (sidebar, overlay, botones) ----------------
  function initGlobalUI() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('overlay');

    if (menuToggle && sidebar && overlay) {
      menuToggle.addEventListener('click', () => { sidebar.classList.add('active'); overlay.classList.add('active'); });
      overlay.addEventListener('click', () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) { sidebar.classList.remove('active'); overlay.classList.remove('active'); }
      });
    }

    const backBtn = document.getElementById('btnBackToPlanilla');
    if (backBtn) backBtn.addEventListener('click', () => {
      if (sidebar && sidebar.classList.contains('active')) sidebar.classList.remove('active');
      if (overlay && overlay.classList.contains('active')) overlay.classList.remove('active');
    });
  }

  // ---------------- Public API ----------------
  window.__FICHA = window.__FICHA || {};
  window.__FICHA.loadEmpleados = loadEmpleados;
  window.__FICHA.fillFicha = fillFicha;
  window.__FICHA.attachSelectListener = attachSelectListener;

  // ---------------- Auto-init ----------------
  document.addEventListener('DOMContentLoaded', () => {
    // Planilla scripts assume registrarTabla() calls happen from templates after this file loads.
    loadEmpleados().then(() => attachSelectListener()).catch(e => console.error(e));
    initUploadForms();
    initGlobalUI();

    const btnClear = document.getElementById('btnClear');
    if (btnClear) btnClear.addEventListener('click', () => {
      const sel = document.getElementById('empleadoSelect'); if (sel) sel.value = '';
      const form = document.getElementById('fichaForm'); if (form) form.reset();
      const fotoEl = document.getElementById('fotoEmpleado') || document.getElementById('foto');
      if (fotoEl) fotoEl.src = PLACEHOLDER;
    });
  });

})();
