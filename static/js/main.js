// static/js/main.js
// Versión definitiva: elimina los alerts "No hay tablas disponibles"
// - asegura que el botón Agregar solo tenga UN listener (clona el elemento para eliminar listeners previos)
// - cuando se pulsa Agregar siempre inserta una fila vacía al inicio de tbody de #tablaEmpleados
// - mantiene el resto de funciones (foto, edición, guardado) intactas y defensivas
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

  // ---------- Tabla / edición ----------
  const tablas = {};
  let tablaActiva = null;
  let filaActiva = null;
  let copiaOriginal = [];
  let esNuevo = false;

  // query elements lazily inside DOMContentLoaded auto-init

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
    // Intent: siempre agregar directamente a #tablaEmpleados tbody si existe.
    let nueva = agregarFilaDirecta("tablaEmpleados", 20);
    if (!nueva) {
      // fallback: si no existe registrada, intenta con la primera tabla visible sin alert
      const primera = obtenerPrimeraTablaVisible();
      if (primera && primera.tabla) {
        nueva = primera.tabla.querySelector("tbody") ? primera.tabla.querySelector("tbody").insertBefore(document.createElement("tr"), primera.tabla.querySelector("tbody").firstChild) : null;
      }
    }

    if (!nueva) return; // no hacemos alert ni bloqueamos UI
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");

    if (filaActiva) filaActiva.classList.remove("table-active");
    filaActiva = nueva;
    filaActiva.classList.add("table-active");
    esNuevo = true;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;

    // start inline edit: convert cells to inputs for immediate editing like original behavior
    filaActiva.querySelectorAll("td").forEach((td, idx) => {
      const text = td.innerText || "";
      if (idx === 0 && !esNuevo) {
        td.innerHTML = `<input class="form-control form-control-sm" value="${escapeHtml(text)}" readonly>`;
      } else {
        td.innerHTML = `<input class="form-control form-control-sm" value="${escapeHtml(text)}">`;
      }
    });
    // focus first editable
    const firstEditable = filaActiva.querySelector('td input:not([readonly])');
    if (firstEditable) firstEditable.focus();
  }

  async function guardarEdicion() {
    if (!filaActiva || !tablaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    const campos = info ? info.campos : null;
    const columnas = info ? info.columnas : 20;
    const celdas = Array.from(filaActiva.querySelectorAll('td'));
    if (celdas.length < columnas) return;

    const datos = celdas.map(td => {
      const v = td.innerText.trim();
      return v === '' ? null : v;
    });

    const payload = {};
    if (campos) campos.forEach((campo, i) => payload[campo] = datos[i]);
    else {
      // best-effort payload following home.html column names
      const ordered = [
        "Numero de DPI","Nombre","Apellidos","Apellidos de casada","Estado Civil",
        "Nacionalidad","Departamento","Fecha de nacimiento","Lugar de nacimiento",
        "Numero de Afiliación del IGGS","Dirección del Domicilio","Numero de Telefono",
        "Religión","Correo Electronico","Puesto de trabajo","Tipo de contrato",
        "Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
      ];
      ordered.forEach((k, i) => payload[k] = datos[i]);
    }
    payload["nuevo"] = esNuevo;

    // minimal validation
    if (payload["Numero de DPI"] == null) return;

    try {
      const endpoint = info && info.endpoint ? info.endpoint : API_EMPLEADOS;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(()=>({}));
      // replace inputs by plain text
      filaActiva.querySelectorAll('td').forEach((td, idx) => {
        const v = Object.values(payload)[idx];
        td.innerText = v !== undefined && v !== null ? v : '';
      });
      filaActiva.classList.remove("table-active");
      filaActiva = null;
      tablaActiva = null;
      esNuevo = false;
      copiaOriginal = [];
      const btnAgregar = document.getElementById("btnAgregar");
      const btnEditar = document.getElementById("btnEditar");
      const btnGuardar = document.getElementById("btnGuardar");
      const btnCancelar = document.getElementById("btnCancelar");
      resetBotones(btnAgregar, btnEditar, btnGuardar, btnCancelar);
    } catch (err) {
      console.error("Error guardarEdicion:", err);
    }
  }

  function editarFila() {
    if (!filaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    const bloqueadas = info ? info.bloqueadas || [] : [];
    const celdas = Array.from(filaActiva.querySelectorAll('td'));
    copiaOriginal = celdas.map(td => td.innerText);
    celdas.forEach((td, i) => {
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      }
    });
    esNuevo = false;
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
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
    const btnAgregar = document.getElementById("btnAgregar");
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    resetBotones(btnAgregar, btnEditar, btnGuardar, btnCancelar);
  }

  // ---------- Foto, uploads y UI (sin cambios críticos) ----------
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
        const label = safe(norm['fullname'] || norm['full_name'] || norm['nombre'] || ((e.nombre && e.apellido) ? (e.nombre + ' ' + e.apellido) : '---'));
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
          if (fotoEmpleado) fotoEmpleado.src = PLACEHOLDER;
          if (formEliminar) formEliminar.style.display = 'none';
          if (formSubir) formSubir.style.display = 'block';
          if (fileFoto) fileFoto.value = '';
        } catch (err) {
          console.error('Error eliminar foto:', err);
        }
      });
    }
  }

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
  }

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
    setTimeout(()=> container.remove(), 3000);
  }

  // ---------- Auto-init ----------
  document.addEventListener('DOMContentLoaded', () => {
    // init upload and global UI
    initUploadForms();
    initGlobalUI();

    // register the main table so registrarTabla can detect it if used
    registrarTabla('tablaEmpleados', 20, API_EMPLEADOS, [
      "Numero de DPI","Nombre","Apellidos","Apellidos de casada","Estado Civil",
      "Nacionalidad","Departamento","Fecha de nacimiento","Lugar de nacimiento",
      "Numero de Afiliación del IGGS","Dirección del Domicilio","Numero de Telefono",
      "Religión","Correo Electronico","Puesto de trabajo","Tipo de contrato",
      "Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
    ], []);

    // ensure single, clean listener on btnAgregar by replacing node (removes previous listeners)
    const origBtn = document.getElementById('btnAgregar');
    if (origBtn && origBtn.parentNode) {
      const clean = origBtn.cloneNode(true);
      origBtn.parentNode.replaceChild(clean, origBtn);
      // now attach single listener
      clean.addEventListener('click', (e) => {
        e.stopPropagation();
        agregarFila();
      });
    }

    // Attach remaining control listeners if present
    const btnEditar = document.getElementById('btnEditar');
    const btnGuardar = document.getElementById('btnGuardar');
    const btnCancelar = document.getElementById('btnCancelar');

    if (btnEditar) btnEditar.addEventListener('click', editarFila);
    if (btnGuardar) btnGuardar.addEventListener('click', guardarEdicion);
    if (btnCancelar) btnCancelar.addEventListener('click', cancelarEdicion);

    // load empleados into any select
    loadEmpleados().then(() => attachSelectListener()).catch(e => console.error(e));

    // small helper: clicking outside table hides foto panel if not editing
    document.addEventListener('click', (e) => {
      const insideTable = e.target.closest('#tablaEmpleados');
      const insideControls = e.target.closest('#formSubirFoto') || e.target.closest('#formEliminarFoto') || e.target.closest('#fileFoto');
      if (!insideTable && !insideControls) {
        const editingNow = !!(document.querySelector('td[contenteditable="true"]') || document.querySelector('td input'));
        if (!editingNow) {
          const foto = document.getElementById('fotoEmpleado');
          if (foto) foto.src = PLACEHOLDER;
          const formSubir = document.getElementById('formSubirFoto');
          const formEliminar = document.getElementById('formEliminarFoto');
          if (formSubir) formSubir.style.display = 'none';
          if (formEliminar) formEliminar.style.display = 'none';
        }
      }
    });
  });

})();