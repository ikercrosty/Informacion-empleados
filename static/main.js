document.addEventListener("DOMContentLoaded", () => {
  // Estado global
  let tablaActiva = null;
  let filaActiva = null;
  let copiaOriginal = [];
  let esNuevo = false;

  // Botones globales
  const btnAgregar = document.getElementById("btnAgregar");
  const btnEditar  = document.getElementById("btnEditar");
  const btnGuardar = document.getElementById("btnGuardar");
  const btnCancelar= document.getElementById("btnCancelar");

  function resetBotones() {
    if (!btnAgregar) return;
    btnAgregar.disabled = false;
    btnEditar.disabled = true;
    btnGuardar.disabled = true;
    btnCancelar.disabled = true;
  }
  resetBotones();

  // Registro de tablas
  const tablas = {};

  // Registrar tabla con soporte de columnas bloqueadas (no editables)
  function registrarTabla(idTabla, columnas, endpoint, campos, bloqueadas = []) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;
    tablas[idTabla] = { tabla, columnas, endpoint, campos, bloqueadas };

    // Selección por doble click
    tabla.addEventListener("dblclick", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.parentElement.tagName !== "TBODY") return;

      if (filaActiva) filaActiva.classList.remove("table-active");
      filaActiva = tr;
      tablaActiva = tabla;
      filaActiva.classList.add("table-active");

      copiaOriginal = Array.from(filaActiva.querySelectorAll("td")).map(td => td.innerText);
      esNuevo = false;

      btnEditar.disabled = false;
      btnGuardar.disabled = true;
      btnCancelar.disabled = false;
    });
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
      // Si la columna está bloqueada, no permitir edición aquí
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

    btnEditar.disabled = true;
    btnGuardar.disabled = false;
    btnCancelar.disabled = false;
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
    btnEditar.disabled = true;
    btnGuardar.disabled = false;
    btnCancelar.disabled = false;
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

    // Validación de DPI cuando aplique
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

  // --- Registro de tablas ---

  // Datos personales (DPI primero, todo editable aquí)
  registrarTabla("tablaEmpleados", 20, "/guardar_empleado", [
    "Numero de DPI","Nombre","Apellidos","Apellidos de casada","Estado Civil","Nacionalidad",
    "Departamento","Fecha de nacimiento","Lugar de nacimiento","Numero de Afiliación del IGGS",
    "Dirección del Domicilio","Numero de Telefono","Religión","Correo Electronico","Puesto de trabajo",
    "Tipo de contrato","Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
  ]); // sin columnas bloqueadas

  // Información Académica (7 columnas: 3 bloqueadas + 4 editables)
  registrarTabla("tablaAcademico", 7, "/guardar_academico", [
    "Numero de DPI","Nombre","Apellidos",
    "Nivel de estudios","Profesión u Oficio","Colegio o establecimiento","Cursos o titulos adicionales"
  ], [0,1,2]); // bloquear DPI, Nombre, Apellidos

  // Cónyuge (DPI + 5)
  registrarTabla("tablaConyugue", 6, "/guardar_conyugue", [
    "Numero de DPI","Nombres del conyugue","Apellidos del conyugue","Direccion del conyugue","Numero de teléfono del conyugue","Correo electronico del conyugue"
  ]);

  // Emergencia (DPI + 3)
  registrarTabla("tablaEmergencia", 4, "/guardar_emergencia", [
    "Numero de DPI","Nombre del contacto de emergencia","Apellidos del contacto de emergencia","Numero de telefono de emergencia"
  ]);

  // Laboral (DPI + 6)
  registrarTabla("tablaLaboral", 7, "/guardar_laboral", [
    "Numero de DPI","Nombre de la Empresa (Ultimo Trabajo)","Direccion de la empresa","Inicio laboral en la empresa","Fin Laboral en la empresa","Motivo del retiro","Nombre del Jefe Imediato"
  ]);

  // Médica (DPI + 7)
  registrarTabla("tablaMedica", 8, "/guardar_medica", [
    "Numero de DPI","Padece alguna enfermedad","Tipo de enfermedad","Recibe tratamiento medico","Nombre del tratamiento","Es alergico a algun medicamento","Nombre del medico Tratante","Tipo de sangre"
  ]);
});
