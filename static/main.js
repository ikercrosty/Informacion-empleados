document.addEventListener("DOMContentLoaded", () => {
  // Estado global para tablas y edición
  let tablaActiva = null;
  let filaActiva = null;
  let copiaOriginal = [];
  let esNuevo = false;

  // Botones globales (pueden no existir en algunas páginas)
  const btnAgregar = document.getElementById("btnAgregar");
  const btnEditar  = document.getElementById("btnEditar");
  const btnGuardar = document.getElementById("btnGuardar");
  const btnCancelar= document.getElementById("btnCancelar");

  function resetBotones() {
    if (!btnAgregar) return;
    btnAgregar.disabled = false;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
  }
  resetBotones();

  // Registro de tablas
  const tablas = {};

  // Registrar tabla con soporte de columnas bloqueadas (no editables)
  function registrarTabla(idTabla, columnas, endpoint, campos, bloqueadas = []) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;
    tablas[idTabla] = { tabla, columnas, endpoint, campos, bloqueadas };

    // Selección por doble click (para edición)
    tabla.addEventListener("dblclick", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.parentElement.tagName !== "TBODY") return;

      if (filaActiva) filaActiva.classList.remove("table-active");
      filaActiva = tr;
      tablaActiva = tabla;
      filaActiva.classList.add("table-active");

      copiaOriginal = Array.from(filaActiva.querySelectorAll("td")).map(td => td.innerText);
      esNuevo = false;

      if (btnEditar) btnEditar.disabled = false;
      if (btnGuardar) btnGuardar.disabled = true;
      if (btnCancelar) btnCancelar.disabled = false;
    });

    // Si es la tabla de empleados, al hacer click actualizamos la foto y controles
    if (idTabla === "tablaEmpleados") {
      tabla.addEventListener("click", (e) => {
        const tr = e.target.closest("tr");
        if (!tr || tr.parentElement.tagName !== "TBODY") return;

        const dpiCell = tr.cells[0];
        if (!dpiCell) return;
        const dpi = dpiCell.innerText.trim();
        if (!dpi) return;

        const foto = document.getElementById("fotoEmpleado");
        const formSubir = document.getElementById("formSubirFoto");
        const formEliminar = document.getElementById("formEliminarFoto");
        const inputDpiUpload = document.getElementById("inputDpiForUpload");
        const inputDpiDelete = document.getElementById("inputDpiForDelete");

        if (!foto || !formSubir || !formEliminar || !inputDpiUpload || !inputDpiDelete) return;

        // Siempre usar la ruta fija; poner DPI en inputs ocultos
        inputDpiUpload.value = dpi;
        inputDpiDelete.value = dpi;
        formSubir.style.display = "none";
        formEliminar.style.display = "none";

        // Petición a la API para saber si existe foto
        fetch(`/api/foto/${encodeURIComponent(dpi)}`, { cache: "no-store" })
          .then(res => res.json())
          .then(data => {
            if (data && data.foto) {
              // usamos la URL que devolvió la API si viene url, si no construimos con static
              const url = data.url ? data.url : `/static/fotos/${data.foto}`;
              foto.src = `${url}?t=${Date.now()}`;
              formEliminar.style.display = "block";
              formSubir.style.display = "none";
            } else {
              foto.src = "/static/imagenes/default.png";
              formSubir.style.display = "block";
              formEliminar.style.display = "none";
            }
          })
          .catch(() => {
            foto.src = "/static/imagenes/default.png";
            formSubir.style.display = "block";
            formEliminar.style.display = "none";
          });
      });
    }
  }

  // Obtener primera tabla visible si no hay activa al agregar
  function obtenerPrimeraTablaVisible() {
    const entries = Object.values(tablas);
    for (let i = 0; i < entries.length; i++) {
      const t = entries[i].tabla;
      if (t && t.offsetParent !== null) return entries[i];
    }
    return null;
  }

  // Agregar fila nueva (sin necesidad de seleccionar antes)
  function agregarFila() {
    if (!tablaActiva) {
      const primera = obtenerPrimeraTablaVisible();
      if (!primera) {
        alert("No hay tablas disponibles para agregar.");
        return;
      }
      tablaActiva = primera.tabla;
    }

    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const { columnas, bloqueadas } = info;

    const tbody = tablaActiva.querySelector("tbody");
    if (!tbody) return;

    const nueva = document.createElement("tr");
    for (let i = 0; i < columnas; i++) {
      const td = document.createElement("td");
      td.innerText = "";
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = "#fff3cd";
      }
      nueva.appendChild(td);
    }
    tbody.insertBefore(nueva, tbody.firstChild);

    if (filaActiva) filaActiva.classList.remove("table-active");
    filaActiva = nueva;
    filaActiva.classList.add("table-active");
    esNuevo = true;

    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
  }

  // Editar fila seleccionada (respeta columnas bloqueadas)
  function editarFila() {
    if (!filaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const bloqueadas = info.bloqueadas || [];

    const celdas = Array.from(filaActiva.querySelectorAll("td"));
    copiaOriginal = celdas.map(td => td.innerText);

    celdas.forEach((td, i) => {
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = "#fff3cd";
      }
    });

    esNuevo = false;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
  }

  // Cancelar edición o eliminar fila nueva
  function cancelarEdicion() {
    if (!filaActiva) return;
    if (esNuevo) {
      filaActiva.remove();
    } else {
      const celdas = Array.from(filaActiva.querySelectorAll("td"));
      celdas.forEach((td, i) => {
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
    resetBotones();
  }

  // Guardar edición (INSERT/UPDATE)
  function guardarEdicion() {
    if (!filaActiva || !tablaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const { campos, endpoint, columnas } = info;

    const celdas = Array.from(filaActiva.querySelectorAll("td"));
    if (celdas.length < columnas) {
      alert("La fila no tiene el número correcto de columnas.");
      return;
    }

    const datos = celdas.map(td => {
      const v = td.innerText.trim();
      return v === "" ? null : v;
    });

    const payload = {};
    campos.forEach((campo, i) => {
      payload[campo] = datos[i];
    });
    payload["nuevo"] = esNuevo;

    if (campos.includes("Numero de DPI") && !payload["Numero de DPI"]) {
      alert("El campo Numero de DPI es obligatorio.");
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) return res.json().then(j => Promise.reject(j));
      return res.json();
    })
    .then(json => {
      if (json.mensaje) alert(json.mensaje);
      celdas.forEach(td => {
        td.contentEditable = false;
        td.style.backgroundColor = "";
      });
      filaActiva.classList.remove("table-active");
      filaActiva = null;
      tablaActiva = null;
      esNuevo = false;
      copiaOriginal = [];
      resetBotones();
    })
    .catch(err => {
      const msg = (err && err.mensaje) ? err.mensaje : String(err);
      alert("Error al guardar: " + msg);
    });
  }

  // Conectar botones
  if (btnAgregar) btnAgregar.addEventListener("click", agregarFila);
  if (btnEditar)  btnEditar.addEventListener("click", editarFila);
  if (btnCancelar) btnCancelar.addEventListener("click", cancelarEdicion);
  if (btnGuardar) btnGuardar.addEventListener("click", guardarEdicion);

  // Exponer registrarTabla
  window.registrarTabla = registrarTabla;

  // --- Registro de tablas (llama estas funciones desde tus plantillas) ---
  registrarTabla("tablaEmpleados", 20, "/guardar_empleado", [
    "Numero de DPI","Nombre","Apellidos","Apellidos de casada","Estado Civil","Nacionalidad",
    "Departamento","Fecha de nacimiento","Lugar de nacimiento","Numero de Afiliación del IGGS",
    "Dirección del Domicilio","Numero de Telefono","Religión","Correo Electronico","Puesto de trabajo",
    "Tipo de contrato","Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
  ]);

  registrarTabla("tablaAcademico", 7, "/guardar_academico", [
    "Numero de DPI","Nombre","Apellidos",
    "Nivel de estudios","Profesión u Oficio","Colegio o establecimiento","Cursos o titulos adicionales"
  ], [0,1,2]);

  registrarTabla("tablaConyugue", 6, "/guardar_conyugue", [
    "Numero de DPI","Nombres del conyugue","Apellidos del conyugue","Direccion del conyugue","Numero de teléfono del conyugue","Correo electronico del conyugue"
  ]);

  registrarTabla("tablaEmergencia", 4, "/guardar_emergencia", [
    "Numero de DPI","Nombre del contacto de emergencia","Apellidos del contacto de emergencia","Numero de telefono de emergencia"
  ]);

  registrarTabla("tablaLaboral", 7, "/guardar_laboral", [
    "Numero de DPI","Nombre de la Empresa (Ultimo Trabajo)","Direccion de la empresa","Inicio laboral en la empresa","Fin Laboral en la empresa","Motivo del retiro","Nombre del Jefe Imediato"
  ]);

  registrarTabla("tablaMedica", 8, "/guardar_medica", [
    "Numero de DPI","Padece alguna enfermedad","Tipo de enfermedad","Recibe tratamiento medico","Nombre del tratamiento","Es alergico a algun medicamento","Nombre del medico Tratante","Tipo de sangre"
  ]);

  // ---------------- Foto: manejar subida y eliminación por AJAX ----------------
  // Elementos del DOM (pueden no existir en otras páginas)
  const formSubir = document.getElementById("formSubirFoto");
  const formEliminar = document.getElementById("formEliminarFoto");
  const fileFoto = document.getElementById("fileFoto");
  const fotoEmpleado = document.getElementById("fotoEmpleado");
  const inputDpiUpload = document.getElementById("inputDpiForUpload");
  const inputDpiDelete = document.getElementById("inputDpiForDelete");
  const DEFAULT_SRC = "/static/imagenes/default.png";

  // Manejo AJAX de subida (si existe el form)
  if (formSubir) {
    // Asegura que el action apunte a la ruta fija
    formSubir.action = "/subir_foto";
    formSubir.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dpi = inputDpiUpload ? inputDpiUpload.value.trim() : "";
      if (!dpi) {
        alert("Selecciona una fila primero.");
        return;
      }
      const file = fileFoto ? fileFoto.files[0] : null;
      if (!file) {
        alert("Selecciona un archivo.");
        return;
      }

      const fd = new FormData();
      fd.append("dpi", dpi);
      fd.append("foto", file);

      try {
        const res = await fetch("/subir_foto", {
          method: "POST",
          body: fd,
          credentials: "same-origin"
        });

        if (!res.ok && res.status !== 302) {
          const text = await res.text().catch(()=>"");
          alert("Error al subir: " + res.status + " " + text);
          return;
        }

        // Actualizar vista de la foto desde /api/foto/<dpi>
        const api = await fetch(`/api/foto/${encodeURIComponent(dpi)}?t=${Date.now()}`, { cache: "no-store" });
        const j = await api.json();
        if (j && j.url) {
          fotoEmpleado.src = `${j.url}?t=${Date.now()}`;
        } else if (j && j.foto) {
          fotoEmpleado.src = `/static/fotos/${j.foto}?t=${Date.now()}`;
        } else {
          fotoEmpleado.src = DEFAULT_SRC;
        }

        if (fileFoto) fileFoto.value = "";
        formSubir.style.display = "none";
        formEliminar.style.display = "block";
        alert("Foto subida correctamente");
      } catch (err) {
        console.error("Error subir foto:", err);
        alert("Error en la subida. Revisa la consola y la terminal del servidor.");
      }
    });
  }

  // Manejo AJAX de eliminación
  if (formEliminar) {
    // dejar action fija
    formEliminar.action = "/eliminar_foto";
    formEliminar.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dpi = inputDpiDelete ? inputDpiDelete.value.trim() : "";
      if (!dpi) {
        alert("Selecciona una fila primero.");
        return;
      }

      const fd = new FormData();
      fd.append("dpi", dpi);

      try {
        const res = await fetch("/eliminar_foto", {
          method: "POST",
          body: fd,
          credentials: "same-origin"
        });

        if (!res.ok && res.status !== 302) {
          const text = await res.text().catch(()=>"");
          alert("Error al eliminar: " + res.status + " " + text);
          return;
        }

        // Actualizar panel
        fotoEmpleado.src = DEFAULT_SRC;
        formEliminar.style.display = "none";
        formSubir.style.display = "block";
        if (fileFoto) fileFoto.value = "";
        alert("Foto eliminada");
      } catch (err) {
        console.error("Error eliminar foto:", err);
        alert("Error al eliminar la foto. Revisa la consola del servidor.");
      }
    });
  }

  // ---------------- Comportamiento del sidebar global (menuToggle / overlay) ----------------
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebarMenu');
  const overlay = document.getElementById('overlay');

  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.add('active');
      overlay.classList.add('active');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });
  }

  // ---------------- Botón volver a Planilla (cierra sidebar si está abierto) ----------------
  const backBtn = document.getElementById('btnBackToPlanilla');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (sidebar && sidebar.classList.contains('active')) sidebar.classList.remove('active');
      if (overlay && overlay.classList.contains('active')) overlay.classList.remove('active');
      // navegación por href del enlace
    });
  }

  // ---------------- Abrir Información empleados desde Planilla ----------------
  const abrirInfoBtn = document.getElementById('btnAbrirInfo'); // botón en planilla.html
  if (abrirInfoBtn) {
    abrirInfoBtn.addEventListener('click', () => {
      // No previene navegación; si quieres abrir sidebar automáticamente al llegar a home,
      // puedes agregar un query string ?open=1 al enlace y aquí gestionar su lectura en home.
    });
  }

  // ---------------- Tecla ESC cierra sidebar global ----------------
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (sidebar && overlay && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }
    }
  });
});

// static/js/main.js
// Este archivo asume que ficha.html definió window.__FICHA_CONFIG con:
// { placeholder: "/static/placeholder.png", apiEmpleados: "/api/empleados", apiEmpleado: "/api/empleado/", apiFoto: "/api/foto/" }

(function () {
  const cfg = window.__FICHA_CONFIG || {};
  const placeholder = cfg.placeholder || '/static/placeholder.png';
  const apiEmpleados = cfg.apiEmpleados || '/api/empleados';
  const apiEmpleadoBase = cfg.apiEmpleadoBase || '/api/empleado/';
  const apiFotoBase = cfg.apiFotoBase || '/api/foto/';

  const safe = v => v ?? '';

  async function loadEmpleados() {
    const sel = document.getElementById('empleadoSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando...</option>';
    try {
      const res = await fetch(apiEmpleados);
      const data = await res.json();
      sel.innerHTML = '<option value="">Seleccione empleado...</option>';
      data.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.dpi;
        opt.textContent = e.full_name || e.dpi;
        sel.appendChild(opt);
      });
    } catch (err) {
      sel.innerHTML = '<option value="">Error cargando empleados</option>';
      console.error('loadEmpleados error', err);
    }
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  // fillFicha expuesto globalmente
  async function fillFicha(emp) {
    if (!emp) return;

    try {
      document.getElementById('nombre').value = safe(emp['Nombre']);
      document.getElementById('apellidos').value = safe(emp['Apellidos']);
      document.getElementById('apellidos_casada').value = safe(emp['Apellidos de casada']);
      document.getElementById('fecha_nacimiento').value = safe(emp['Fecha de nacimiento']);
      document.getElementById('edad').value = safe(emp['Edad']);
      document.getElementById('sexo').value = safe(emp['Sexo']);
      document.getElementById('estado_civil').value = safe(emp['Estado Civil']);
      document.getElementById('iggs').value = safe(emp['Numero de Afiliación del IGGS']);
      document.getElementById('telefono').value = safe(emp['Numero de Telefono']);
      document.getElementById('celular').value = safe(emp['Celular'] ?? emp['Telefono Celular']);
      document.getElementById('correo').value = safe(emp['Correo Electronico']);

      document.getElementById('direccion').value = safe(emp['Dirección del Domicilio'] ?? emp['direccion']);
      document.getElementById('numero').value = safe(emp['Numero'] ?? emp['numero']);
      document.getElementById('colonia').value = safe(emp['Colonia'] ?? emp['colonia']);
      document.getElementById('municipio').value = safe(emp['Municipio'] ?? emp['municipio']);
      document.getElementById('departamento').value = safe(emp['Departamento']);
      document.getElementById('cp').value = safe(emp['C.P.'] ?? emp['CP']);

      document.getElementById('puesto').value = safe(emp['Puesto de trabajo'] ?? emp['Puesto']);
      document.getElementById('area').value = safe(emp['Area']);
      document.getElementById('jefe').value = safe(emp['Nombre del Jefe Imediato'] ?? emp['Jefe']);
      document.getElementById('fecha_ingreso').value = safe(emp['Fecha de inicio laboral']);
      document.getElementById('sueldo').value = safe(emp['Sueldo']);

      document.getElementById('escolaridad').value = safe(emp['Nivel de estudios']);
      document.getElementById('especifique').value = safe(emp['Profesión u Oficio'] ?? emp['Especifique']);
      document.getElementById('otros_estudios').value = safe(emp['Cursos o titulos adicionales']);

      document.getElementById('padece').value = safe(emp['Padece alguna enfermedad']);
      document.getElementById('medicamento').value = safe(emp['Nombre del tratamiento']);
      document.getElementById('operaciones').value = safe(emp['Operaciones'] ?? emp['Cirugias']);
      document.getElementById('accidentes').value = safe(emp['Accidentes'] ?? emp['Ha tenido algun accidente']);

      document.getElementById('emerg_nombre').value = safe(emp['Nombre del contacto de emergencia']);
      document.getElementById('emerg_telefono').value = safe(emp['Numero de telefono de emergencia']);
      document.getElementById('emerg_parentesco').value = safe(emp['Parentesco'] ?? '');

      // Foto
      const fotoEl = document.getElementById('fotoEmpleado') || document.getElementById('foto');
      const dpi = emp['Numero de DPI'] ?? emp.dpi ?? emp.numero ?? '';
      if (!fotoEl) return;
      if (!dpi) {
        fotoEl.src = placeholder;
        return;
      }
      try {
        const j = await fetchJson(apiFotoBase + encodeURIComponent(dpi));
        fotoEl.src = (j && j.url) ? j.url : placeholder;
      } catch (err) {
        console.error('Error fetch foto', err);
        fotoEl.src = placeholder;
      }
    } catch (err) {
      console.error('fillFicha error', err);
    }
  }

  // Listener para cambio de select (busca empleado por DPI y llama fillFicha)
  function attachSelectListener() {
    const sel = document.getElementById('empleadoSelect');
    if (!sel) return;
    sel.addEventListener('change', async function () {
      const dpi = this.value;
      if (!dpi) {
        const form = document.getElementById('fichaForm');
        if (form) form.reset();
        const fotoEl = document.getElementById('fotoEmpleado') || document.getElementById('foto');
        if (fotoEl) fotoEl.src = placeholder;
        return;
      }
      try {
        const emp = await fetchJson(apiEmpleadoBase + encodeURIComponent(dpi));
        await fillFicha(emp);
      } catch (err) {
        console.error('Error cargando empleado', err);
        alert('Error cargando datos del empleado');
      }
    });
  }

  // Public API
  window.__FICHA = {
    loadEmpleados,
    fillFicha,
    attachSelectListener
  };

  // Auto-init cuando DOM listo
  document.addEventListener('DOMContentLoaded', () => {
    loadEmpleados().then(() => attachSelectListener()).catch(e => console.error(e));
    // Botón limpiar si existe
    const btnClear = document.getElementById('btnClear');
    if (btnClear) btnClear.addEventListener('click', () => {
      const sel = document.getElementById('empleadoSelect');
      if (sel) sel.value = '';
      const form = document.getElementById('fichaForm');
      if (form) form.reset();
      const fotoEl = document.getElementById('fotoEmpleado') || document.getElementById('foto');
      if (fotoEl) fotoEl.src = placeholder;
    });
  });
})();

