// static/js/main.js
// Reglas aplicadas:
// - Click en fila solo selecciona la fila; no habilita celdas.
// - Al presionar "Editar" se activan TODAS las celdas de la fila (sin crear inputs).
// - Las celdas se editan directamente (contentEditable) — no aparecen textboxes feos.
// - Al guardar se envían cadenas vacías "" para campos vacíos. Nunca se envía null/None.
// - Listener único en botones (se reemplaza el nodo del botón Agregar para limpiar listeners previos).
(function () {
  "use strict";

  const CFG = window.__FICHA_CONFIG || {};
  const PLACEHOLDER = CFG.placeholder || "/static/imagenes/default.jpg";
  const API_EMPLEADOS = CFG.apiEmpleados || "/api/empleados";
  const API_FOTO_BASE = CFG.apiFotoBase || "/api/foto/";
  const COLUMNS = [
    "Numero de DPI","Nombre","Apellidos","Apellidos de casada","Estado Civil",
    "Nacionalidad","Departamento","Fecha de nacimiento","Lugar de nacimiento",
    "Numero de Afiliación del IGGS","Dirección del Domicilio","Numero de Telefono",
    "Religión","Correo Electronico","Puesto de trabajo","Tipo de contrato",
    "Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
  ];

  // Estado
  let selectedRow = null;
  let originalCells = null;
  let isNewRow = false;
  let editing = false;

  // Util
  function flash(msg, type = "info") {
    const existing = document.getElementById("flashMessage");
    if (existing) existing.remove();
    const d = document.createElement("div");
    d.id = "flashMessage";
    d.className = `alert alert-${type} py-1 px-2 small position-fixed`;
    d.style.top = "16px";
    d.style.right = "16px";
    d.style.zIndex = 2000;
    d.innerText = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2500);
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str).replace(/[&<>"'`=\/]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s]));
  }

  // Selección de fila (solo selecciona)
  function selectRow(tr) {
    if (!tr) return;
    if (selectedRow && selectedRow !== tr) selectedRow.classList.remove("table-active");
    selectedRow = tr;
    selectedRow.classList.add("table-active");
    // actualización UI botones
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnEditar) btnEditar.disabled = false;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = false;
    // actualizar panel de foto (silencioso, mantiene comportamiento previo)
    const dpi = (tr.cells[0] && tr.cells[0].innerText || "").trim();
    const foto = document.getElementById("fotoEmpleado");
    const formSubir = document.getElementById("formSubirFoto");
    const formEliminar = document.getElementById("formEliminarFoto");
    const inputDpiUpload = document.getElementById("inputDpiForUpload");
    const inputDpiDelete = document.getElementById("inputDpiForDelete");
    if (inputDpiUpload) inputDpiUpload.value = dpi;
    if (inputDpiDelete) inputDpiDelete.value = dpi;
    if (!dpi) {
      if (foto) foto.src = PLACEHOLDER;
      if (formSubir) formSubir.style.display = "none";
      if (formEliminar) formEliminar.style.display = "none";
      return;
    }
    // fetch foto
    if (foto && (formSubir && formEliminar)) {
      fetch(`${API_FOTO_BASE}${encodeURIComponent(dpi)}`, { cache: "no-store" })
        .then(r => r.json())
        .then(j => {
          if (j && j.url) {
            foto.src = `${j.url}?t=${Date.now()}`;
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
    }
  }

  // Agregar fila: crea tr con celdas vacías y la selecciona. No alerta si no hay tabla.
  function agregarFila() {
    const tabla = document.getElementById("tablaEmpleados");
    if (!tabla) return;
    const tbody = tabla.querySelector("tbody");
    if (!tbody) return;
    const tr = document.createElement("tr");
    for (let i = 0; i < COLUMNS.length; i++) {
      const td = document.createElement("td");
      td.innerText = "";
      td.tabIndex = 0; // permite focus para empezar a teclear
      tr.appendChild(td);
    }
    tbody.insertBefore(tr, tbody.firstChild);
    isNewRow = true;
    selectRow(tr);
    // preparar para edición inmediata: habilitar guardar y cancelar, pero no activar contentEditable hasta Edit
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    const btnEditar = document.getElementById("btnEditar");
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    // place focus on first cell ready to type (without forcing contentEditable)
    const first = tr.querySelector("td");
    if (first) {
      // give a visual cue for typing
      first.focus();
      // allow typing by toggling contentEditable on focus only for that cell (temporary)
      // but we DO NOT want clicks to auto-enable editing for other cells, so do minimal
      first.addEventListener("focus", function oneFocus() {
        if (!editing) {
          first.contentEditable = true;
          first.style.backgroundColor = "#fff3cd";
        }
        first.removeEventListener("focus", oneFocus);
      });
    }
  }

  // Habilita edición de TODA la fila seleccionada (sin crear inputs)
  function editarFila() {
    if (!selectedRow) { flash("Selecciona una fila primero", "danger"); return; }
    if (editing) return;
    editing = true;
    isNewRow = !!isNewRow; // mantener bandera
    originalCells = Array.from(selectedRow.cells).map(td => td.innerText);
    // make each cell contentEditable except maybe DPI if you want to lock; here we allow editing but keep DPI required on save
    selectedRow.querySelectorAll("td").forEach((td, idx) => {
      td.contentEditable = true;
      td.style.backgroundColor = "#fff3cd";
    });
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    // focus first editable cell
    const first = selectedRow.querySelector("td");
    if (first) { first.focus(); }
  }

  // Cancelar edición
  function cancelarEdicion() {
    if (!selectedRow) return;
    if (editing && originalCells) {
      selectedRow.querySelectorAll("td").forEach((td, i) => {
        td.innerText = originalCells[i] || "";
        td.contentEditable = false;
        td.style.backgroundColor = "";
      });
    } else if (isNewRow) {
      // si era nueva y no se quería guardar, quitarla
      const parent = selectedRow.parentNode;
      if (parent) parent.removeChild(selectedRow);
    } else {
      // asegurar que no queden celdas editables
      selectedRow.querySelectorAll("td").forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
    }
    // reset estado
    selectedRow.classList.remove("table-active");
    selectedRow = null;
    originalCells = null;
    editing = false;
    isNewRow = false;
    // reset botones
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
    // reset foto panel
    const foto = document.getElementById("fotoEmpleado");
    if (foto) foto.src = PLACEHOLDER;
    const formSubir = document.getElementById("formSubirFoto");
    const formEliminar = document.getElementById("formEliminarFoto");
    if (formSubir) formSubir.style.display = "none";
    if (formEliminar) formEliminar.style.display = "none";
  }

  // Guardar: leer td.innerText; si está vacío enviar "" (nunca null); DPI obligatorio no vacío
  async function guardarEdicion() {
    if (!selectedRow) return;
    // collect values from tds in order
    const tds = Array.from(selectedRow.querySelectorAll("td"));
    const values = tds.map(td => {
      const v = (td.innerText || "").trim();
      return v === "" ? "" : v;
    });
    // build payload according to COLUMNS
    const payload = {};
    for (let i = 0; i < COLUMNS.length; i++) {
      payload[COLUMNS[i]] = values[i] !== undefined ? values[i] : "";
    }
    payload["nuevo"] = !!isNewRow;

    // DPI mandatory
    if (!payload["Numero de DPI"] || payload["Numero de DPI"].trim() === "") {
      flash("El campo Numero de DPI es obligatorio", "danger");
      // keep editing to allow user to fix
      return;
    }

    try {
      const res = await fetch(API_EMPLEADOS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(()=>"");
        throw new Error(`${res.status} ${text || res.statusText}`);
      }
      // on success: lock cells and clear styles
      tds.forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
      // reset state
      selectedRow.classList.remove("table-active");
      selectedRow = null;
      originalCells = null;
      editing = false;
      isNewRow = false;
      // reset buttons
      const btnEditar = document.getElementById("btnEditar");
      const btnGuardar = document.getElementById("btnGuardar");
      const btnCancelar = document.getElementById("btnCancelar");
      if (btnEditar) btnEditar.disabled = true;
      if (btnGuardar) btnGuardar.disabled = true;
      if (btnCancelar) btnCancelar.disabled = true;
      flash("Guardado correctamente", "success");
    } catch (err) {
      console.error("guardarEdicion error", err);
      flash("Error al guardar: " + (err.message || err), "danger");
    }
  }

  // Wire listeners once DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    // table row click -> select only
    const tabla = document.getElementById("tablaEmpleados");
    if (tabla) {
      tabla.addEventListener("click", (ev) => {
        const tr = ev.target.closest("tr");
        if (!tr || tr.parentElement.tagName !== "TBODY") return;
        // do not enable editing here; only select
        selectRow(tr);
      });
    }

    // Attach unique listeners to control buttons (replace node to clear prior listeners)
    const attachUnique = (id, handler) => {
      const el = document.getElementById(id);
      if (!el || !el.parentNode) return;
      const clean = el.cloneNode(true);
      el.parentNode.replaceChild(clean, el);
      clean.addEventListener("click", (e) => { e.stopPropagation(); handler(e); });
    };

    attachUnique("btnAgregar", () => agregarFila());
    attachUnique("btnEditar", () => editarFila());
    attachUnique("btnGuardar", () => guardarEdicion());
    attachUnique("btnCancelar", () => cancelarEdicion());

    // Also ensure photo forms and file preview remain functional (minimal, non-intrusive)
    const fileFoto = document.getElementById("fileFoto");
    const fotoEmpleado = document.getElementById("fotoEmpleado");
    if (fileFoto && fotoEmpleado) {
      fileFoto.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f || !f.type.startsWith("image/")) return;
        const r = new FileReader();
        r.onload = () => fotoEmpleado.src = r.result;
        r.readAsDataURL(f);
      });
    }

    // clicking outside table resets photo panel only if not editing
    document.addEventListener("click", (e) => {
      const insideTable = !!e.target.closest("#tablaEmpleados");
      const insideControls = !!e.target.closest("#formSubirFoto") || !!e.target.closest("#formEliminarFoto") || !!e.target.closest("#fileFoto");
      if (!insideTable && !insideControls && !editing) {
        const foto = document.getElementById("fotoEmpleado");
        if (foto) foto.src = PLACEHOLDER;
        const fs = document.getElementById("formSubirFoto");
        const fe = document.getElementById("formEliminarFoto");
        if (fs) fs.style.display = "none";
        if (fe) fe.style.display = "none";
      }
    });
  });

})();
