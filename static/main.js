// static/js/main.js
// Mantiene todo igual salvo: al guardar, si el DPI existe hace UPDATE en lugar de INSERT.
// - Usa GET /api/empleado/:dpi para comprobar existencia.
// - Envía el payload a /guardar_empleado (el backend maneja INSERT/UPDATE según "nuevo").
// - Todo lo demás no se modifica.
(function () {
  "use strict";

  const CFG = window.__FICHA_CONFIG || {};
  const PLACEHOLDER = CFG.placeholder || "/static/imagenes/default.jpg";
  const API_EMPLEADOS = CFG.apiEmpleados || "/api/empleados";
  const API_EMPLEADO_BASE = CFG.apiEmpleadoBase || "/api/empleado/";
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

  // Utilidades
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
    setTimeout(() => d.remove(), 2200);
  }

  function safeTrim(v) {
    if (v == null) return "";
    return String(v).trim();
  }

  // Selección (click en fila) — solo selecciona, no habilita edición
  function selectRow(tr) {
    if (!tr) return;
    if (selectedRow && selectedRow !== tr) selectedRow.classList.remove("table-active");
    selectedRow = tr;
    selectedRow.classList.add("table-active");
    const btnEditar = document.getElementById("btnEditar");
    if (btnEditar) btnEditar.disabled = false;
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnGuardar && !editing) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = false;
    const dpi = safeTrim(selectedRow.cells[0] && selectedRow.cells[0].innerText);
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
    if (foto && formSubir && formEliminar) {
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
      td.tabIndex = 0;
      td.contentEditable = true;
      td.style.backgroundColor = "#fff3cd";
      tr.appendChild(td);
    }
    tbody.insertBefore(tr, tbody.firstChild);
    if (selectedRow) selectedRow.classList.remove("table-active");
    selectedRow = tr;
    selectedRow.classList.add("table-active");
    isNewRow = true;
    editing = true;
    originalCells = [];
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    const first = tr.querySelector("td");
    if (first) first.focus();
  }

  // Habilita edición de TODA la fila seleccionada (sin crear inputs)
  function editarFila() {
    if (!selectedRow) { flash("Selecciona una fila primero", "danger"); return; }
    if (editing) return;
    editing = true;
    isNewRow = !!isNewRow;
    originalCells = Array.from(selectedRow.cells).map(td => td.innerText);
    selectedRow.querySelectorAll("td").forEach(td => {
      td.contentEditable = true;
      td.style.backgroundColor = "#fff3cd";
    });
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    const first = selectedRow.querySelector("td");
    if (first) first.focus();
  }

  // Cancelar edición
  function cancelarEdicion() {
    if (!selectedRow) return;
    if (isNewRow) {
      const p = selectedRow.parentNode;
      if (p) p.removeChild(selectedRow);
    } else if (editing && originalCells) {
      selectedRow.querySelectorAll("td").forEach((td, i) => {
        td.innerText = originalCells[i] || "";
        td.contentEditable = false;
        td.style.backgroundColor = "";
      });
      selectedRow.classList.remove("table-active");
    } else {
      selectedRow.querySelectorAll("td").forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
      selectedRow.classList.remove("table-active");
    }
    selectedRow = null;
    originalCells = null;
    editing = false;
    isNewRow = false;
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
    const foto = document.getElementById("fotoEmpleado");
    if (foto) foto.src = PLACEHOLDER;
    const fs = document.getElementById("formSubirFoto");
    const fe = document.getElementById("formEliminarFoto");
    if (fs) fs.style.display = "none";
    if (fe) fe.style.display = "none";
  }

  // Nuevo: comprueba existencia por DPI y envía a /guardar_empleado; backend decide INSERT/UPDATE según "nuevo"
  async function guardarEdicion() {
    if (!selectedRow) return;
    const tds = Array.from(selectedRow.querySelectorAll("td"));
    const values = tds.map(td => safeTrim(td.innerText));
    const payload = {};
    for (let i = 0; i < COLUMNS.length; i++) {
      payload[COLUMNS[i]] = values[i] !== undefined ? values[i] : "";
    }

    const dpi = payload["Numero de DPI"] || "";
    if (!dpi || dpi.trim() === "") {
      flash("El campo Numero de DPI es obligatorio", "danger");
      return;
    }

    try {
      // comprobar existencia: si GET /api/empleado/:dpi devuelve 200 -> existe
      let exists = false;
      try {
        const r = await fetch(API_EMPLEADO_BASE + encodeURIComponent(dpi), { cache: 'no-store' });
        exists = r.ok;
      } catch (e) {
        exists = false;
      }
      payload["nuevo"] = !exists;

      // Enviar a endpoint que tu backend espera (/guardar_empleado)
      const res = await fetch("/guardar_empleado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text || res.statusText}`);
      }

      // Lock row and clear styles
      tds.forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
      selectedRow.classList.remove("table-active");
      selectedRow = null;
      originalCells = null;
      editing = false;
      isNewRow = false;
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

  // Inicialización y wiring de botones (asegurar listeners únicos)
  function attachUnique(id, handler) {
    const el = document.getElementById(id);
    if (!el || !el.parentNode) return null;
    const clean = el.cloneNode(true);
    el.parentNode.replaceChild(clean, el);
    clean.addEventListener("click", (e) => { e.stopPropagation(); handler(e); });
    return clean;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const tabla = document.getElementById("tablaEmpleados");
    if (tabla) {
      tabla.addEventListener("click", (ev) => {
        const tr = ev.target.closest("tr");
        if (!tr || tr.parentElement.tagName !== "TBODY") return;
        selectRow(tr);
      });
    }

    attachUnique("btnAgregar", () => agregarFila());
    attachUnique("btnEditar", () => editarFila());
    attachUnique("btnGuardar", () => guardarEdicion());
    attachUnique("btnCancelar", () => cancelarEdicion());

    const btnAgregar = document.getElementById("btnAgregar");
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnAgregar) btnAgregar.disabled = false;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;

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

