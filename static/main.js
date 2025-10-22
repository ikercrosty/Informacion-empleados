// static/js/main.js
// Archivo único que maneja tablas, selección, edición y API de registro de tablas.
// Mantiene compatibilidad con las llamadas a window.registrarTabla desde las plantillas.
(function () {
  "use strict";

  // Config opcional desde plantillas
  const CFG = window.__FICHA_CONFIG || {};
  const PLACEHOLDER = CFG.placeholder || "/static/imagenes/default.jpg";
  const API_EMPLEADOS = CFG.apiEmpleados || "/api/empleados";
  const API_EMPLEADO_BASE = CFG.apiEmpleadoBase || "/api/empleado/";
  const API_FOTO_BASE = CFG.apiFotoBase || "/api/foto/";

  // Utilidades
  const safe = v => (v === null || typeof v === "undefined") ? "" : v;
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
    setTimeout(()=> container.remove(), 2200);
  }

  // Tabla registry
  const tablas = {};
  let tablaActiva = null;
  let filaActiva = null;
  let copiaOriginal = [];
  let esNuevo = false;
  let editing = false;

  // Botones globales (pueden o no existir en cada plantilla)
  function getBtn(id) { return document.getElementById(id); }

  function resetBotonesGlobal() {
    const btnAgregar = getBtn('btnAgregar');
    const btnEditar = getBtn('btnEditar');
    const btnGuardar = getBtn('btnGuardar');
    const btnCancelar = getBtn('btnCancelar');
    if (btnAgregar) btnAgregar.disabled = false;
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
  }

  // registrarTabla: expone comportamiento igual al home
  function registrarTabla(idTabla, columnas, endpoint, campos, bloqueadas = []) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;
    tablas[idTabla] = { tabla, columnas, endpoint, campos, bloqueadas };

    // doble click selecciona fila y habilita Edit en el UI
    tabla.addEventListener('dblclick', (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.parentElement.tagName !== "TBODY") return;
      if (filaActiva) filaActiva.classList.remove("table-active");
      filaActiva = tr;
      tablaActiva = tabla;
      filaActiva.classList.add("table-active");
      copiaOriginal = Array.from(filaActiva.querySelectorAll("td")).map(td => td.innerText);
      esNuevo = false;
      const btnEditar = getBtn('btnEditar');
      const btnGuardar = getBtn('btnGuardar');
      const btnCancelar = getBtn('btnCancelar');
      if (btnEditar) btnEditar.disabled = false;
      if (btnGuardar) btnGuardar.disabled = true;
      if (btnCancelar) btnCancelar.disabled = false;
    });

    // click simple: solo selecciona fila (no activa edición)
    tabla.addEventListener('click', (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.parentElement.tagName !== "TBODY") return;
      if (filaActiva && filaActiva !== tr) filaActiva.classList.remove("table-active");
      filaActiva = tr;
      tablaActiva = tabla;
      filaActiva.classList.add("table-active");
      // mantener botones (editar se habilita solo con dblclick)
      const btnEditar = getBtn('btnEditar');
      const btnGuardar = getBtn('btnGuardar');
      const btnCancelar = getBtn('btnCancelar');
      if (btnEditar) btnEditar.disabled = true;
      if (btnGuardar && !editing) btnGuardar.disabled = true;
      if (btnCancelar) btnCancelar.disabled = false;
    });
  }

  // Exponer función registrarTabla en window para que about.html y otras puedan llamarla
  window.registrarTabla = registrarTabla;

  // Operaciones sobre la fila activa (agregar, editar, guardar, cancelar)
  function agregarFilaGlobal() {
    // si no hay tablaActiva, buscamos la primera visible
    if (!tablaActiva) {
      const primero = Object.values(tablas).find(t => t.tabla && t.tabla.offsetParent !== null);
      if (!primero) { flashMessage("No hay tabla disponible para agregar", "danger"); return; }
      tablaActiva = primero.tabla;
    }
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const { columnas, bloqueadas } = info;
    const tbody = tablaActiva.querySelector("tbody");
    if (!tbody) return;
    const tr = document.createElement("tr");
    for (let i = 0; i < columnas; i++) {
      const td = document.createElement("td");
      td.innerText = "";
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      } else {
        td.contentEditable = false;
      }
      td.tabIndex = 0;
      tr.appendChild(td);
    }
    tbody.insertBefore(tr, tbody.firstChild);
    if (filaActiva) filaActiva.classList.remove("table-active");
    filaActiva = tr;
    filaActiva.classList.add("table-active");
    esNuevo = true;
    editing = true;
    copiaOriginal = [];
    const btnEditar = getBtn('btnEditar');
    const btnGuardar = getBtn('btnGuardar');
    const btnCancelar = getBtn('btnCancelar');
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    const firstEditable = Array.from(tr.cells).find((c,idx) => !bloqueadas.includes(idx));
    if (firstEditable) firstEditable.focus();
  }

  function editarFilaGlobal() {
    if (!filaActiva || !tablaActiva) { flashMessage("Selecciona una fila primero", "danger"); return; }
    if (editing) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const bloqueadas = info.bloqueadas || [];
    copiaOriginal = Array.from(filaActiva.querySelectorAll("td")).map(td => td.innerText);
    filaActiva.querySelectorAll("td").forEach((td, i) => {
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      } else {
        td.contentEditable = false;
      }
    });
    esNuevo = false;
    editing = true;
    const btnEditar = getBtn('btnEditar');
    const btnGuardar = getBtn('btnGuardar');
    const btnCancelar = getBtn('btnCancelar');
    if (btnEditar) btnEditar.disabled = true;
    if (btnGuardar) btnGuardar.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;
    const firstEditable = Array.from(filaActiva.cells).find((c,idx) => !bloqueadas.includes(idx));
    if (firstEditable) firstEditable.focus();
  }

  async function guardarFilaGlobal() {
    if (!filaActiva || !tablaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const { campos, endpoint, columnas } = info;
    const tdList = Array.from(filaActiva.querySelectorAll("td"));
    if (tdList.length < columnas) { flashMessage("Fila incompleta", "danger"); return; }
    // construir payload: vacíos -> "" (no null)
    const valores = tdList.map(td => td.innerText.trim() === "" ? "" : td.innerText.trim());
    const payload = {};
    for (let i = 0; i < campos.length; i++) payload[campos[i]] = valores[i] !== undefined ? valores[i] : "";
    payload.nuevo = esNuevo;

    // DPI obligatorio si existe ese campo
    if (campos.includes("Numero de DPI") && (!payload["Numero de DPI"] || payload["Numero de DPI"].trim() === "")) {
      flashMessage("El campo Numero de DPI es obligatorio", "danger");
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(()=>"");
        throw new Error(`HTTP ${res.status} ${text || res.statusText}`);
      }
      // bloquear y limpiar styles
      tdList.forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
      filaActiva.classList.remove("table-active");
      filaActiva = null;
      tablaActiva = null;
      copiaOriginal = [];
      esNuevo = false;
      editing = false;
      resetBotonesGlobal();
      flashMessage("Guardado correctamente", "success");
    } catch (err) {
      console.error("guardarFilaGlobal error", err);
      flashMessage("Error al guardar: " + (err.message || err), "danger");
    }
  }

  function cancelarEdicionGlobal() {
    if (!filaActiva) return;
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (esNuevo) {
      filaActiva.remove();
    } else if (copiaOriginal && copiaOriginal.length) {
      filaActiva.querySelectorAll("td").forEach((td, i) => {
        td.innerText = copiaOriginal[i] || "";
        td.contentEditable = false;
        td.style.backgroundColor = "";
      });
      filaActiva.classList.remove("table-active");
    } else {
      filaActiva.querySelectorAll("td").forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
      filaActiva.classList.remove("table-active");
    }
    filaActiva = null;
    tablaActiva = null;
    copiaOriginal = [];
    esNuevo = false;
    editing = false;
    resetBotonesGlobal();
  }

  // attach unique handlers for global buttons if present
  function attachUniqueHandler(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    const parent = el.parentNode;
    if (!parent) { el.addEventListener('click', fn); return; }
    const clean = el.cloneNode(true);
    parent.replaceChild(clean, el);
    clean.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
  }

  // Initialize on DOMContentLoaded: wire global buttons (if exist) and expose API
  document.addEventListener('DOMContentLoaded', () => {
    attachUniqueHandler('btnAgregar', (e) => { e.preventDefault(); agregarFilaGlobal(); });
    attachUniqueHandler('btnEditar', (e) => { e.preventDefault(); editarFilaGlobal(); });
    attachUniqueHandler('btnGuardar', (e) => { e.preventDefault(); guardarFilaGlobal(); });
    attachUniqueHandler('btnCancelar', (e) => { e.preventDefault(); cancelarEdicionGlobal(); });

    // default state
    resetBotonesGlobal();
  });

  // Exponer API adicional por si alguna plantilla quiere control directo
  window.__MAIN_TABLA = window.__MAIN_TABLA || {};
  window.__MAIN_TABLA.registrarTabla = registrarTabla;
  window.__MAIN_TABLA.agregarFila = agregarFilaGlobal;
  window.__MAIN_TABLA.editarFila = editarFilaGlobal;
  window.__MAIN_TABLA.guardarFila = guardarFilaGlobal;
  window.__MAIN_TABLA.cancelar = cancelarEdicionGlobal;

})();
