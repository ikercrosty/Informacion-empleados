// static/js/main.js
// Minimal shared table engine that always exposes registrarTabla and __MAIN_TABLA.
// Keeps behavior lightweight and defensive so templates (about.html) can call registrarTabla reliably.
(function(){
  "use strict";

  // Registry storage
  const registry = {};
  let activeTable = null;
  let activeRow = null;

  // Default no-op endpoints and placeholders
  const DEFAULTS = {
    placeholder: "/static/imagenes/default.jpg"
  };

  // Small flash helper
  function flash(msg, type='info') {
    const id = '__flash_main';
    const prev = document.getElementById(id);
    if (prev) prev.remove();
    const d = document.createElement('div');
    d.id = id;
    d.className = `alert alert-${type} py-1 px-2 small position-fixed`;
    d.style.top = '12px';
    d.style.right = '12px';
    d.style.zIndex = 9999;
    d.innerText = msg;
    document.body.appendChild(d);
    setTimeout(()=> d.remove(), 2000);
  }

  // Helper: update Save button enabled state based on whether activeRow has any editable cells
  function updateSaveButtonState() {
    const bg = document.getElementById('btnGuardar');
    if (!bg) return;
    if (!activeRow) { bg.disabled = true; return; }
    const editableExists = Array.from(activeRow.cells).some(td => td.isContentEditable === true);
    bg.disabled = !editableExists;
  }

  // Finish editing without saving: remove contentEditable from cells, keep values, clear editing flags
  function finishEditingWithoutSave() {
    if (!activeRow) return;
    // remove contentEditable and background highlight from all cells
    Array.from(activeRow.cells).forEach(td => {
      td.contentEditable = false;
      td.style.backgroundColor = '';
    });
    // clear editing marker so other flows see it's not editing
    if (activeRow.dataset) {
      delete activeRow.dataset.editing;
    }
    // disable save, keep activeRow selected (do not remove new row)
    updateSaveButtonState();
  }

  // registrarTabla: expone la tabla al motor compartido
  function registrarTabla(idTabla, columnas, endpoint, campos, bloqueadas){
    const el = document.getElementById(idTabla);
    if (!el) {
      console.warn("registrarTabla: tabla no encontrada", idTabla);
      return;
    }

    registry[idTabla] = { tabla: el, columnas: columnas||0, endpoint: endpoint||'', campos: campos||[], bloqueadas: bloqueadas||[] };

    // Click/dblclick handlers (idempotentes)
    el.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr || tr.parentElement.tagName !== 'TBODY') return;
      if (activeRow && activeRow !== tr) activeRow.classList.remove('table-active');
      activeRow = tr;
      activeTable = el;
      activeRow.classList.add('table-active');
      // leave edit disabled; templates expect enabling on dblclick
      const btnEditar = document.getElementById('btnEditar');
      const btnGuardar = document.getElementById('btnGuardar');
      const btnCancelar = document.getElementById('btnCancelar');
      if (btnEditar) btnEditar.disabled = true;
      if (btnGuardar && !tr.dataset.editing) btnGuardar.disabled = true;
      if (btnCancelar) btnCancelar.disabled = false;
    });

    el.addEventListener('dblclick', (e) => {
      const tr = e.target.closest('tr');
      if (!tr || tr.parentElement.tagName !== 'TBODY') return;
      if (activeRow && activeRow !== tr) activeRow.classList.remove('table-active');
      activeRow = tr;
      activeTable = el;
      activeRow.classList.add('table-active');
      const btnEditar = document.getElementById('btnEditar');
      if (btnEditar) btnEditar.disabled = false;
    });
  }

  // expose functions for templates and fallback handlers
  function agregarFila(){
    // defensiva: si ya hay una fila nueva en edición, no crear otra
    if (activeRow && activeRow.dataset && activeRow.dataset.new === '1') {
      return;
    }

    if (!activeTable) {
      // try to pick a visible registered table
      const first = Object.values(registry).find(r=> r.tabla && r.tabla.offsetParent !== null);
      if (!first) { flash("No hay tabla registrada para agregar", "danger"); return; }
      activeTable = first.tabla;
    }
    const tbody = activeTable.querySelector('tbody');
    if (!tbody) { flash("tbody no encontrado", "danger"); return; }
    const info = Object.values(registry).find(r=> r.tabla === activeTable) || {};
    const cols = info.columnas || 0;
    const tr = document.createElement('tr');
    for (let i=0;i<cols;i++){
      const td = document.createElement('td');
      td.innerText = "";
      if (!((info.bloqueadas||[]).includes(i))) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      } else {
        td.contentEditable = false;
      }
      tr.appendChild(td);
    }
    tbody.insertBefore(tr, tbody.firstChild);
    if (activeRow) activeRow.classList.remove('table-active');
    activeRow = tr;
    activeRow.classList.add('table-active');
    activeRow.dataset.new = '1';
    activeRow.dataset.editing = '1';
    // enable Save/Cancel, disable Edit
    const be = document.getElementById('btnEditar');
    const bg = document.getElementById('btnGuardar');
    const bc = document.getElementById('btnCancelar');
    if (be) be.disabled = true;
    if (bg) bg.disabled = false;
    if (bc) bc.disabled = false;
    updateSaveButtonState();
  }

  function editarFila(){
    if (!activeRow) { flash("Selecciona una fila primero", "danger"); return; }
    if (activeRow.dataset.editing === '1') return;
    activeRow.dataset.editing = '1';
    const info = Object.values(registry).find(r=> r.tabla === activeTable) || {};
    const bloqueadas = info.bloqueadas || [];
    Array.from(activeRow.cells).forEach((td,i)=>{
      if (!bloqueadas.includes(i)) {
        td.contentEditable = true;
        td.style.backgroundColor = '#fff3cd';
      } else {
        td.contentEditable = false;
      }
    });
    const be = document.getElementById('btnEditar');
    const bg = document.getElementById('btnGuardar');
    const bc = document.getElementById('btnCancelar');
    if (be) be.disabled = true;
    if (bg) bg.disabled = false;
    if (bc) bc.disabled = false;
    updateSaveButtonState();
  }

  async function guardarFila(){
    if (!activeRow || !activeTable) { flash("No hay fila seleccionada", "danger"); return; }
    const info = Object.values(registry).find(r=> r.tabla === activeTable) || {};
    const campos = info.campos || [];
    const endpoint = info.endpoint || '';
    const values = Array.from(activeRow.cells).map(td=> td.innerText === null ? "" : td.innerText.trim());
    // build payload mapping campos -> values (leave empty strings if empty)
    const payload = {};
    for (let i=0;i<campos.length;i++){
      payload[campos[i]] = values[i] !== undefined ? values[i] : "";
    }
    // ensure DPI exists
    if ((payload['Numero de DPI']||"").trim() === "") { flash("El campo Numero de DPI es obligatorio", "danger"); return; }
    // decide nuevo based on presence of data-new flag
    payload.nuevo = activeRow.dataset.new === '1' ? true : false;
    // fallback endpoint if none provided
    const url = endpoint || '/guardar_academico' ;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text().catch(()=>res.statusText);
        throw new Error(`${res.status} ${t}`);
      }
      // lock cells and reset UI
      Array.from(activeRow.cells).forEach(td=> { td.contentEditable = false; td.style.backgroundColor = ""; });
      activeRow.classList.remove('table-active');
      delete activeRow.dataset.editing;
      delete activeRow.dataset.new;
      activeRow = null;
      activeTable = null;
      const be = document.getElementById('btnEditar');
      const bg = document.getElementById('btnGuardar');
      const bc = document.getElementById('btnCancelar');
      if (be) be.disabled = true;
      if (bg) bg.disabled = true;
      if (bc) bc.disabled = true;
      flash("Guardado correctamente", "success");
    } catch (err) {
      console.error("guardarFila error", err);
      flash("Error al guardar: " + (err.message||err), "danger");
    }
  }

  function cancelar(){
    if (!activeRow) return;
    if (activeRow.dataset.new === '1') {
      const p = activeRow.parentNode;
      if (p) p.removeChild(activeRow);
    } else {
      activeRow.querySelectorAll('td').forEach(td => { td.contentEditable = false; td.style.backgroundColor = ""; });
      activeRow.classList.remove('table-active');
    }
    activeRow = null;
    activeTable = null;
    const be = document.getElementById('btnEditar');
    const bg = document.getElementById('btnGuardar');
    const bc = document.getElementById('btnCancelar');
    if (be) be.disabled = true;
    if (bg) bg.disabled = true;
    if (bc) bc.disabled = true;
  }

  // attach safe single handlers to global buttons (idempotent)
  function attachOnce(id, fn){
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.attached) return;
    el.addEventListener('click', (e)=>{ e.stopPropagation(); fn(); });
    el.dataset.attached = '1';
  }

  // Click outside handler: when editing and user clicks outside table or controls, end editing (no save)
  function documentClickOutsideHandler(e) {
    if (!activeRow) return;
    // If there are no editable cells, nothing to do
    const isEditing = activeRow.dataset && activeRow.dataset.editing === '1';
    if (!isEditing) return;

    const clickedInsideTable = !!e.target.closest('table');
    const clickedControl = !!e.target.closest('#btnAgregar') || !!e.target.closest('#btnEditar') ||
                           !!e.target.closest('#btnGuardar') || !!e.target.closest('#btnCancelar') ||
                           !!e.target.closest('#formSubirFoto') || !!e.target.closest('#formEliminarFoto') ||
                           !!e.target.closest('#fileFoto');

    if (!clickedInsideTable && !clickedControl) {
      // finish edit without saving: remove contentEditable and editing flag
      Array.from(activeRow.cells).forEach(td => { td.contentEditable = false; td.style.backgroundColor = ''; });
      delete activeRow.dataset.editing;
      // keep activeRow selected but Save disabled
      updateSaveButtonState();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    attachOnce('btnAgregar', agregarFila);
    attachOnce('btnEditar', editarFila);
    attachOnce('btnGuardar', guardarFila);
    attachOnce('btnCancelar', cancelar);

    // global document click handler to end inline editing when clicking outside
    // attach only once
    if (!document.body.dataset.mainClickAttached) {
      document.addEventListener('click', documentClickOutsideHandler);
      document.body.dataset.mainClickAttached = '1';
    }

    // also observe mutations on activeRow cells to update Save button state (user typing)
    // use input/keydown on document to trigger update since contentEditable changes on key events
    document.addEventListener('input', () => updateSaveButtonState(), true);
    document.addEventListener('keydown', () => updateSaveButtonState(), true);
    document.addEventListener('keyup', () => updateSaveButtonState(), true);
  });

  // Public API
  window.registrarTabla = registrarTabla;
  window.__MAIN_TABLA = window.__MAIN_TABLA || {};
  window.__MAIN_TABLA.registrarTabla = registrarTabla;
  window.__MAIN_TABLA.agregarFila = agregarFila;
  window.__MAIN_TABLA.editarFila = editarFila;
  window.__MAIN_TABLA.guardarFila = guardarFila;
  window.__MAIN_TABLA.cancelar = cancelar;

})();
