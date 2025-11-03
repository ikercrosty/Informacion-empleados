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

  document.addEventListener('DOMContentLoaded', ()=> {
    attachOnce('btnAgregar', agregarFila);
    attachOnce('btnEditar', editarFila);
    attachOnce('btnGuardar', guardarFila);
    attachOnce('btnCancelar', cancelar);

    // NEW: click outside registered tables -> clear selection if not editing
    if (!document.body.dataset.mainOutsideHandler) {
      document.addEventListener('click', (e) => {
        if (!activeRow) return;
        // if row is in editing mode, do not clear selection here
        if (activeRow.dataset && activeRow.dataset.editing === '1') return;
        // clicked inside any registered table?
        const clickedInsideRegisteredTable = Object.values(registry).some(r => {
          try { return r.tabla && r.tabla.contains(e.target); } catch(_) { return false; }
        });
        // clicked on control buttons we care about?
        const clickedControl = !!e.target.closest('#btnAgregar') || !!e.target.closest('#btnEditar') ||
                               !!e.target.closest('#btnGuardar') || !!e.target.closest('#btnCancelar') ||
                               !!e.target.closest('#formSubirFoto') || !!e.target.closest('#formEliminarFoto') ||
                               !!e.target.closest('#fileFoto');
        if (!clickedInsideRegisteredTable && !clickedControl) {
          try { activeRow.classList.remove('table-active'); } catch(_) {}
          activeRow = null;
          // keep activeTable as is; main flows will reset it when necessary
        }
      }, true);
      document.body.dataset.mainOutsideHandler = '1';
    }
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
// --- START: KEY_FALLBACKS + getFirstMatching (safe, non-intrusive) ---
/*
  Agrega un mapa global de claves alternativas y una función utilitaria
  para obtener la primera clave no vacía desde un objeto servidor.
  Diseñado para no interferir con la lógica existente de main.js.
*/
(function(){
  if (!window.__KEY_FALLBACKS) {
    window.__KEY_FALLBACKS = {
      dpi: ['Numero de DPI','Numero_de_DPI','dpi','numero_de_dpi'],
      nombre: ['Nombre','nombre','full_name','fullName'],
      apellidos: ['Apellidos','apellidos','surname','last_name'],
      apellidos_casada: ['Apellidos de casada','apellidos_de_casada'],
      estado_civil: ['Estado Civil','estado_civil'],
      nacionalidad: ['Nacionalidad','nacionalidad'],
      departamento: ['Departamento','departamento'],
      fecha_nacimiento: ['Fecha de nacimiento','fecha_nacimiento','birth_date','birthdate'],
      lugar_nacimiento: ['Lugar de nacimiento','lugar_de_nacimiento'],
      iggs: ['Numero de Afiliacion del IGSS','Numero de Afiliación del IGSS','Numero IGSS','Numero de Afiliacion IGSS','Numero de Afiliación del IGGS','Numero IGGS','igss','iggs'],
      religion: ['Religión','Religion','religion'],
      direccion: ['Dirección del Domicilio','Direccion del Domicilio','direccion','direccion_del_domicilio'],
      telefono: ['Numero de Telefono','Numero de Teléfono','Telefono','telefono','telefono_personal','telefono_celular','tel','mobile'],
      correo: ['Correo Electronico','Correo','correo','email','e-mail'],
      puesto: ['Puesto de trabajo','puesto','puesto_de_trabajo'],
      tipo_contrato: ['Tipo de contrato','tipo_de_contrato'],
      jornada: ['Jornada laboral','jornada_laboral','jornada'],
      duracion: ['Duración del trabajo','Duracion del trabajo','duracion_del_trabajo','duracion'],
      fecha_inicio: ['Fecha de inicio laboral','fecha_inicio_laboral','fecha_inicio'],
      dias_laborales: ['Dias Laborales','dias_laborales'],
      nivel_estudios: ['Nivel de estudios','nivel_de_estudios'],
      profesion: ['Profesión u Oficio','Profesion u Oficio','profesion_u_oficio','profesion'],
      colegio: ['Colegio o establecimiento','colegio_o_establecimiento','colegio'],
      cursos: ['Cursos o títulos adicionales','Cursos o titulos adicionales','Cursos','cursos'],
      conyuge_nombres: ['Nombres del cónyuge','Nombres del conyugue','conyuge_nombres','nombres_del_conyuge','spouse_name'],
      conyuge_apellidos: ['Apellidos del cónyuge','Apellidos del conyugue','conyuge_apellidos','apellidos_del_conyuge','spouse_surname'],
      conyuge_direccion: ['Dirección del cónyuge','Direccion del conyugue','conyuge_direccion'],
      conyuge_telefono: ['Numero de telefono del conyugue','Telefono del conyugue','conyuge_telefono','telefono_conyuge','spouse_phone'],
      conyuge_correo: ['Correo del cónyuge','Correo_del_conyuge','conyuge_correo','correo_conyuge','email_conyuge'],
      contacto_nombre: ['Nombre contacto','nombre_contacto','contacto_nombre','emergency_name'],
      contacto_apellidos: ['Apellidos contacto','apellidos_contacto','contacto_apellidos'],
      contacto_telefono: ['Teléfono de emergencia','Telefono de emergencia','contacto_telefono','telefono_de_emergencia','emergency_phone']
    };
  }

  if (!window.getFirstMatching) {
    window.getFirstMatching = function(obj, fallbacks){
      if (!obj || typeof obj !== 'object' || !Array.isArray(fallbacks)) return '';
      // normalizer: remove accents, lowercase, replace non-alnum with underscore
      const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'_');
      for (const key of fallbacks) {
        if (!key) continue;
        // check raw key
        if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null) {
          const v = obj[key];
          if (String(v).trim() !== '') return v;
        }
        // check normalized key
        const nk = normalize(key);
        for (const k2 of Object.keys(obj)) {
          try {
            if (normalize(k2) === nk) {
              const v2 = obj[k2];
              if (v2 !== undefined && v2 !== null && String(v2).trim() !== '') return v2;
            }
          } catch(_) { /* defensive */ }
        }
      }
      return '';
    };
  }
})();
