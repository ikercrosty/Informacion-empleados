// static/js/main.js
// - Edición directa en celdas (sin inputs)
// - Guardado envía cadenas vacías en lugar de null para evitar "None" en backend/templates
// - save/guardar funciona correctamente y botones están enlazados de forma única
(function () {
  "use strict";

  const CFG = window.__FICHA_CONFIG || {};
  const PLACEHOLDER = CFG.placeholder || "/static/imagenes/default.jpg";
  const API_EMPLEADOS = CFG.apiEmpleados || "/api/empleados";
  const API_EMPLEADO_BASE = CFG.apiEmpleadoBase || "/api/empleado/";
  const API_FOTO_BASE = CFG.apiFotoBase || "/api/foto/";

  const safe = v => (v === null || typeof v === "undefined") ? "" : v;

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, Object.assign({ cache: "no-store" }, opts));
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`HTTP ${res.status} ${text}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  }

  // Tabla / edición (edición directa en celdas)
  const tablas = {};
  let tablaActiva = null;
  let filaActiva = null;
  let copiaOriginal = [];
  let esNuevo = false;
  let editing = false;

  function resetBotones(btnAgregar, btnEditar, btnGuardar, btnCancelar) {
    if (!btnAgregar) return;
    btnAgregar.disabled = false;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
  }

  function registrarTabla(idTabla, columnas, endpoint, campos, bloqueadas = []) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;
    tablas[idTabla] = { tabla, columnas, endpoint, campos, bloqueadas };

    tabla.addEventListener("dblclick", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.parentElement.tagName !== "TBODY") return;
      if (filaActiva) filaActiva.classList.remove("table-active");
      filaActiva = tr;
      tablaActiva = tabla;
      filaActiva.classList.add("table-active");
      copiaOriginal = Array.from(filaActiva.querySelectorAll("td")).map(td => td.innerText);
      esNuevo = false;
      const btnEditar = document.getElementById("btnEditar");
      const btnGuardar = document.getElementById("btnGuardar");
      const btnCancelar = document.getElementById("btnCancelar");
      if (btnEditar) btnEditar.disabled = false;
      if (btnGuardar) btnGuardar.disabled = true;
      if (btnCancelar) btnCancelar.disabled = false;
    });

    if (idTabla === "tablaEmpleados") {
      tabla.addEventListener("click", (e) => {
        const tr = e.target.closest("tr");
        if (!tr || tr.parentElement.tagName !== "TBODY") return;
        const dpiCell = tr.cells && tr.cells[0];
        if (!dpiCell) return;
        const dpi = dpiCell.innerText.trim();
        if (!dpi) return;

        const foto = document.getElementById("fotoEmpleado");
        const formSubir = document.getElementById("formSubirFoto");
        const formEliminar = document.getElementById("formEliminarFoto");
        const inputDpiUpload = document.getElementById("inputDpiForUpload");
        const inputDpiDelete = document.getElementById("inputDpiForDelete");
        if (!foto || !formSubir || !formEliminar || !inputDpiUpload || !inputDpiDelete) return;

        inputDpiUpload.value = dpi;
        inputDpiDelete.value = dpi;
        formSubir.style.display = "none";
        formEliminar.style.display = "none";

        fetch(`${API_FOTO_BASE}${encodeURIComponent(dpi)}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => {
            if (data && data.url) {
              foto.src = `${data.url}?t=${Date.now()}`;
              formEliminar.style.display = "block";
              formSubir.style.display = "none";
            } else {
              foto.src = PLACEHOLDER;
              formSubir.style.display = "block";
              formEliminar.style.display = "none";
            }
          })
          .catch(() => {
            foto.src = PLACEHOLDER;
            formSubir.style.display = "block";
            formEliminar.style.display = "none";
          });

        // set active row for editing UI
        if (filaActiva && filaActiva !== tr) filaActiva.classList.remove("table-active");
        filaActiva = tr;
        filaActiva.classList.add("table-active");
        tablaActiva = tabla;
        // update buttons
        const btnEditar = document.getElementById("btnEditar");
        const btnGuardar = document.getElementById("btnGuardar");
        const btnCancelar = document.getElementById("btnCancelar");
        if (btnEditar) btnEditar.disabled = false;
        if (btnGuardar) btnGuardar.disabled = true;
        if (btnCancelar) btnCancelar.disabled = false;
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

  function agregarFilaDirecta(tablaId = "tablaEmpleados", columnas = 20) {
    const tabla = document.getElementById(tablaId);
    if (!tabla) return null;
    const tbody = tabla.querySelector("tbody");
    if (!tbody) return null;

    const nueva = document.createElement("tr");
    for (let i = 0; i < columnas; i++) {
      const td = document.createElement("td");
      td.innerText = "";
      nueva.appendChild(td);
    }
    tbody.insertBefore(nueva, tbody.firstChild);
    return nueva;
  }

  function agregarFila() {
    // Siempre intentar añadir en tablaEmpleados
    let nueva = agregarFilaDirecta("tablaEmpleados", 20);
    if (!nueva) {
      const primera = obtenerPrimeraTablaVisible();
      if (primera && primera.tabla && primera.tabla.querySelector("tbody")) {
        const tbody = primera.tabla.querySelector("tbody");
        nueva = document.createElement("tr");
        for (let i = 0; i < primera.columnas; i++) {
          const td = document.createElement("td");
          td.innerText = "";
          nueva.appendChild(td);
        }
        tbody.insertBefore(nueva, tbody.firstChild);
      }
    }
    if (!nueva) return; // silencioso si no existe tabla

    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");

    if (filaActiva) filaActiva.classList.remove("table-active");
    filaActiva = nueva;
    filaActiva.classList.add("table-active");
    esNuevo = true;
    editing = false; // no activar modo edición automático
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false; // permitir guardar la nueva fila
    if (btnCancelar) btnCancelar.disabled = false;

    // focus first cell for quick typing
    const firstTd = filaActiva.querySelector("td");
    if (firstTd) {
      firstTd.focus();
      // make it editable on click without showing inputs
      firstTd.contentEditable = true;
      firstTd.style.backgroundColor = '#fff3cd';
    }
  }

  function empezarEdicionFilas() {
    if (!filaActiva) return;
    if (editing) return;
    editing = true;
    copiaOriginal = Array.from(filaActiva.querySelectorAll("td")).map(td => td.innerText);
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva) || null;
    const bloqueadas = info ? (info.bloqueadas || []) : [];
    filaActiva.querySelectorAll("td").forEach((td, i) => {
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      } else {
        td.contentEditable = false;
      }
    });
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    // focus first editable cell (col 0 maybe read-only in some flows but here we allow typing)
    const firstEditable = Array.from(filaActiva.querySelectorAll("td")).find((td, idx) => !((info && info.bloqueadas || []).includes(idx)));
    if (firstEditable) { firstEditable.focus(); }
  }

  async function guardarEdicion() {
    if (!filaActiva) return;
    // read all td text; do NOT convert empty to null — keep empty string ''
    const celdas = Array.from(filaActiva.querySelectorAll("td"));
    const datos = celdas.map(td => {
      const v = td.innerText.trim();
      return v === "" ? "" : v;
    });

    // Build payload mapping to column names used by backend (home.html)
    const ordered = [
      "Numero de DPI","Nombre","Apellidos","Apellidos de casada","Estado Civil",
      "Nacionalidad","Departamento","Fecha de nacimiento","Lugar de nacimiento",
      "Numero de Afiliación del IGGS","Dirección del Domicilio","Numero de Telefono",
      "Religión","Correo Electronico","Puesto de trabajo","Tipo de contrato",
      "Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
    ];

    const payload = {};
    for (let i = 0; i < ordered.length; i++) {
      payload[ordered[i]] = datos[i] !== undefined ? datos[i] : "";
    }
    payload["nuevo"] = esNuevo;

    // DPI obligatorio and must not be empty string
    if (!payload["Numero de DPI"] || payload["Numero de DPI"].trim() === "") {
      // revert UI to allow editing DPI
      flashMessage("DPI es obligatorio", "danger");
      return;
    }

    try {
      const endpoint = API_EMPLEADOS;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(()=>"");
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      // convert td contentEditable -> false and remove highlight
      celdas.forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
      filaActiva.classList.remove("table-active");
      filaActiva = null;
      tablaActiva = null;
      esNuevo = false;
      editing = false;
      copiaOriginal = [];
      const btnAgregar = document.getElementById("btnAgregar");
      const btnEditar = document.getElementById("btnEditar");
      const btnGuardar = document.getElementById("btnGuardar");
      const btnCancelar = document.getElementById("btnCancelar");
      resetBotones(btnAgregar, btnEditar, btnGuardar, btnCancelar);
      flashMessage("Guardado correctamente", "success");
    } catch (err) {
      console.error("Error guardarEdicion:", err);
      flashMessage("Error al guardar: " + err.message, "danger");
    }
  }

  function cancelarEdicion() {
    if (!filaActiva) return;
    if (esNuevo) {
      filaActiva.remove();
    } else if (copiaOriginal && copiaOriginal.length) {
      filaActiva.querySelectorAll("td").forEach((td, i) => {
        td.innerText = copiaOriginal[i] || "";
        td.contentEditable = false;
        td.style.backgroundColor = "";
      });
      filaActiva.classList.remove("table-active");
    }
    filaActiva = null;
    tablaActiva = null;
    copiaOriginal = [];
    esNuevo = false;
    editing = false;
    const btnAgregar = document.getElementById("btnAgregar");
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    resetBotones(btnAgregar, btnEditar, btnGuardar, btnCancelar);
  }

  // Foto / uploads
  async function initUploadForms() {
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
        if (!dpi) return;
        const file = (fileFoto && fileFoto.files && fileFoto.files[0]) ? fileFoto.files[0] : null;
        if (!file) return;
        const fd = new FormData();
        fd.append('dpi', dpi);
        fd.append('foto', file);
        try {
          const res = await fetch('/subir_foto', { method: 'POST', body: fd, credentials: 'same-origin' });
          if (!res.ok && res.status !== 302) return;
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
        } catch (err) {
          console.error('Error subir foto:', err);
        }
      });
    }

    if (formEliminar) {
      formEliminar.action = '/eliminar_foto';
      formEliminar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dpi = (inputDpiDelete && inputDpiDelete.value) ? inputDpiDelete.value.trim() : '';
        if (!dpi) return;
        const fd = new FormData();
        fd.append('dpi', dpi);
        try {
          const res = await fetch('/eliminar_foto', { method: 'POST', body: fd, credentials: 'same-origin' });
          if (!res.ok && res.status !== 302) return;
          const fotoEmpleado = document.getElementById('fotoEmpleado') || document.getElementById('foto');
          if (fotoEmpleado) fotoEmpleado.src = PLACEHOLDER;
          if (formEliminar) formEliminar.style.display = 'none';
          if (formSubir) formSubir.style.display = 'block';
        } catch (err) {
          console.error('Error eliminar foto:', err);
        }
      });
    }
  }

  // Utilities
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"'`=\/]/g, function(s) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s];
    });
  }

  function flashMessage(msg, type='info') {
    const existing = document.getElementById('flashMessage');
    if (existing) existing.remove();
    const container = document.createElement('div');
    container.id = 'flashMessage';
    container.className = `alert alert-${type} py-1 px-2 small position-fixed`;
    container.style.top = '16px';
    container.style.right = '16px';
    container.style.zIndex = 2000;
    container.innerText = msg;
    document.body.appendChild(container);
    setTimeout(()=> container.remove(), 2500);
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    // register main table
    registrarTabla('tablaEmpleados', 20, API_EMPLEADOS, [
      "Numero de DPI","Nombre","Apellidos","Apellidos de casada","Estado Civil",
      "Nacionalidad","Departamento","Fecha de nacimiento","Lugar de nacimiento",
      "Numero de Afiliación del IGGS","Dirección del Domicilio","Numero de Telefono",
      "Religión","Correo Electronico","Puesto de trabajo","Tipo de contrato",
      "Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
    ], []);

    initUploadForms();
    initButtonsAndListeners();

    // load empleados into any select if present (keeps existing functionality)
    loadEmpleados().then(() => attachSelectListener()).catch(e => console.error(e));
  });

  // Ensure unique listeners and wire main controls
  function initButtonsAndListeners() {
    // Replace node to remove previous listeners and attach single handlers
    const origAgregar = document.getElementById('btnAgregar');
    if (origAgregar && origAgregar.parentNode) {
      const clean = origAgregar.cloneNode(true);
      origAgregar.parentNode.replaceChild(clean, origAgregar);
      clean.addEventListener('click', (e) => {
        e.stopPropagation();
        agregarFila();
      });
    }

    const btnEditar = document.getElementById('btnEditar');
    const btnGuardar = document.getElementById('btnGuardar');
    const btnCancelar = document.getElementById('btnCancelar');

    if (btnEditar) {
      btnEditar.addEventListener('click', (e) => {
        e.stopPropagation();
        // Make sure filaActiva is set (user clicked a row earlier)
        if (!filaActiva) {
          flashMessage("Selecciona una fila antes de editar", "danger");
          return;
        }
        empezarEdicionFilas();
      });
    }

    if (btnGuardar) {
      btnGuardar.addEventListener('click', (e) => {
        e.stopPropagation();
        guardarEdicion();
      });
    }

    if (btnCancelar) {
      btnCancelar.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelarEdicion();
      });
    }

    // allow clicking a cell to enable editing that single cell (inline, no inputs)
    document.addEventListener('click', (e) => {
      const td = e.target.closest('td');
      if (!td) return;
      // If this td belongs to the active row, enable contentEditable for quick inline editing
      if (td.closest('tr') === filaActiva) {
        // only enable if not already editing full row
        if (!editing) {
          td.contentEditable = true;
          td.style.backgroundColor = '#fff3cd';
          td.focus();
        }
      }
    });

    // clicking outside hides photo panel when not editing
    document.addEventListener('click', (e) => {
      const insideTable = e.target.closest('#tablaEmpleados');
      const insideControls = e.target.closest('#formSubirFoto') || e.target.closest('#formEliminarFoto') || e.target.closest('#fileFoto');
      if (!insideTable && !insideControls) {
        const foto = document.getElementById('fotoEmpleado');
        if (foto && !editing) foto.src = PLACEHOLDER;
      }
    });
  }

  // --- keep functions for ficha/select to preserve behavior ---
  function normalizeKey(k) {
    if (!k) return '';
    const from = 'ÁÀÂÄáàâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖóòôöÚÙÛÜúùûüÑñÇç';
    const to   = 'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNnCc';
    let s = String(k);
    for (let i=0;i<from.length;i++) s = s.replace(new RegExp(from[i], 'g'), to[i]);
    s = s.replace(/[\s\-_\/\.(),:]+/g, '').toLowerCase();
    return s;
  }
  function normalizedRecord(emp) {
    const map = {};
    if (!emp || typeof emp !== 'object') return map;
    const row = Array.isArray(emp) && emp.length > 0 ? emp[0] : emp;
    Object.keys(row).forEach(k => {
      const nk = normalizeKey(k);
      map[nk] = row[k];
    });
    return map;
  }
  const FIELD_VARIANTS = {
    dpi: ['numerodedpi','dpi','numero','id'],
    nombre: ['nombre','nombres','fullname','full_name'],
    apellidos: ['apellidos','apellido','apellido2','apellidopaterno','apellidomaterno'],
    apellidos_casada: ['apellidosdecasada','apellidos_casada'],
    estado_civil: ['estadocivil','estado','civil'],
    nacionalidad: ['nacionalidad'],
    fecha_nacimiento: ['fechadenacimiento','fechanacimiento','nacimiento','birthdate'],
    direccion: ['direccióndeldomicilio','direccion','direcciondeldomicilio','direcciondomicilio'],
    departamento: ['departamento','estado'],
    telefono: ['numerodetelefono','telefono','tel'],
    correo: ['correoelectronico','correo','email','mail'],
    puesto: ['puestodetrabajo','puesto','cargo'],
    fecha_ingreso: ['fechadeiniciolaboral','fechainiciolaboral','fecha_inicio','inicio'],
    sueldo: ['sueldo'],
    region: ['region','región']
  };

  async function loadEmpleados() {
    const sel = document.getElementById('empleadoSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando...</option>';
    try {
      const data = await fetchJson(API_EMPLEADOS);
      sel.innerHTML = '<option value="">Seleccione empleado...</option>';
      (Array.isArray(data) ? data : []).forEach(e => {
        const norm = normalizedRecord(e);
        const value = safe(norm['dpi'] || norm['numerodedpi'] || norm['id'] || norm['numero']);
        const label = safe(norm['fullname'] || norm['full_name'] || norm['nombre'] || value || '---');
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label || value || '---';
        sel.appendChild(opt);
      });
    } catch (err) {
      console.error('loadEmpleados error', err);
      sel.innerHTML = '<option value="">Error cargando empleados</option>';
    }
  }

  async function fillFicha(emp) {
    if (!emp) return;
    try {
      const rec = normalizedRecord(emp);
      Object.keys(FIELD_VARIANTS).forEach(fieldId => {
        const el = document.getElementById(fieldId) || document.getElementById(fieldId.replace(/_/g, ''));
        if (!el) return;
        let v = '';
        for (const variant of FIELD_VARIANTS[fieldId]) {
          if (Object.prototype.hasOwnProperty.call(rec, variant) && rec[variant] !== null && rec[variant] !== undefined) {
            v = rec[variant];
            break;
          }
        }
        el.value = safe(v);
      });

      const possibleDpi = rec['numerodedpi'] || rec['dpi'] || rec['numero'] || rec['id'] || '';
      const fotoEl = document.getElementById('fotoEmpleado') || document.getElementById('foto');
      if (!fotoEl) return;
      if (!possibleDpi) { fotoEl.src = PLACEHOLDER; return; }

      try {
        const j = await fetchJson(API_FOTO_BASE + encodeURIComponent(possibleDpi));
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
        const resolved = Array.isArray(emp) && emp.length > 0 ? emp[0] : emp;
        await fillFicha(resolved);
      } catch (err) {
        console.error('Error cargando empleado', err);
        alert('Error cargando datos del empleado');
        if (fotoEl) fotoEl.src = PLACEHOLDER;
      }
    });
  }

})();
