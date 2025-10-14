document.addEventListener("DOMContentLoaded", () => {
  // Estado global
  let tablaActiva = null;
  let filaActiva = null;
  let copiaOriginal = [];
  let esNuevo = false;

  // Botones globales (un solo set de listeners)
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

  // Registro de tablas: id -> {element, columnas, endpoint, campos}
  const tablas = {};

  // Registrar una tabla para que pueda ser activada por doble click
  function registrarTabla(idTabla, columnas, endpoint, campos) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;
    tablas[idTabla] = { tabla, columnas, endpoint, campos };

    // Delegación: doble click en una fila de tbody selecciona la fila y tabla activa
    tabla.addEventListener("dblclick", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.parentElement.tagName !== "TBODY") return;

      if (filaActiva) filaActiva.classList.remove("table-active");
      filaActiva = tr;
      tablaActiva = tabla;
      filaActiva.classList.add("table-active");

      // guardar copia original para posible cancel
      copiaOriginal = Array.from(filaActiva.querySelectorAll("td")).map(td => td.innerText);
      esNuevo = false;

      btnEditar.disabled = false;
      btnGuardar.disabled = true;
      btnCancelar.disabled = false;
    });
  }

  // Crear nueva fila editable al inicio del tbody de la tabla activa
  function agregarFila() {
    if (!tablaActiva) {
      alert("Abre la tabla primero o selecciona una fila con doble click.");
      return;
    }
    const info = Object.values(tablas).find(t => t.tabla === tablaActiva);
    if (!info) return;
    const { columnas } = info;
    const tbody = tablaActiva.querySelector("tbody");
    const nueva = document.createElement("tr");
    for (let i = 0; i < columnas; i++) {
      const td = document.createElement("td");
      td.innerText = "";
      td.contentEditable = true;
      td.style.backgroundColor = "#fff3cd";
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

  // Habilitar edición de la fila activa
  function editarFila() {
    if (!filaActiva) return;
    const celdas = Array.from(filaActiva.querySelectorAll("td"));
    copiaOriginal = celdas.map(td => td.innerText);
    celdas.forEach(td => {
      td.contentEditable = true;
      td.style.backgroundColor = "#fff3cd";
    });
    esNuevo = false;
    btnEditar.disabled = true;
    btnGuardar.disabled = false;
    btnCancelar.disabled = false;
  }

  // Cancelar edición o eliminar nueva fila
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

  // Guardar (INSERT o UPDATE) usando el endpoint y campos registrados
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

    // Construir payload con nombres de campos exactamente como se registraron
    const payload = {};
    campos.forEach((campo, i) => {
      payload[campo] = datos[i];
    });
    payload["nuevo"] = esNuevo;

    // Validación básica: si se requiere Numero de DPI, verificar que exista
    if (campos.includes("Numero de DPI") && !payload["Numero de DPI"]) {
      alert("El campo Numero de DPI es obligatorio.");
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(json => {
      if (json.mensaje) alert(json.mensaje);
      // desactivar edición visual
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
      alert("Error al guardar: " + err);
    });
  }

  // Conectar botones globales (solo una vez)
  if (btnAgregar) btnAgregar.addEventListener("click", agregarFila);
  if (btnEditar)  btnEditar.addEventListener("click", editarFila);
  if (btnCancelar) btnCancelar.addEventListener("click", cancelarEdicion);
  if (btnGuardar) btnGuardar.addEventListener("click", guardarEdicion);

  // Hacer accesible la función de registro para llamadas desde abajo o desde plantillas
  window.registrarTabla = registrarTabla;

  // --- Registra las tablas usadas en la app ---
  // home (Datos personales) - 20 columnas (sin columna DPI oculta aquí porque la primera fila tiene Nombre)
  registrarTabla("tablaEmpleados", 20, "/guardar_empleado", [
    "Nombre","Apellidos","Apellidos de casada","Estado Civil","Nacionalidad",
    "Numero de DPI","Departamento","Fecha de nacimiento","Lugar de nacimiento","Numero de Afiliación del IGGS",
    "Dirección del Domicilio","Numero de Telefono","Religión","Correo Electronico","Puesto de trabajo",
    "Tipo de contrato","Jornada laboral","Duración del trabajo","Fecha de inicio laboral","Dias Laborales"
  ]);

  // about (Académico) - incluir DPI oculto como primera columna => 5 columnas
  registrarTabla("tablaAcademico", 5, "/guardar_academico", [
    "Numero de DPI","Nivel de estudios","Profesión u Oficio","Colegio o establecimiento","Cursos o titulos adicionales"
  ]);

  // conyugue - DPI oculto + 5 columnas = 6
  registrarTabla("tablaConyugue", 6, "/guardar_conyugue", [
    "Numero de DPI","Nombres del conyugue","Apellidos del conyugue","Direccion del conyugue","Numero de teléfono del conyugue","Correo electronico del conyugue"
  ]);

  // emergencia - DPI oculto + 3 = 4
  registrarTabla("tablaEmergencia", 4, "/guardar_emergencia", [
    "Numero de DPI","Nombre del contacto de emergencia","Apellidos del contacto de emergencia","Numero de telefono de emergencia"
  ]);

  // laboral - DPI oculto + 6 = 7
  registrarTabla("tablaLaboral", 7, "/guardar_laboral", [
    "Numero de DPI","Nombre de la Empresa (Ultimo Trabajo)","Direccion de la empresa","Inicio laboral en la empresa","Fin Laboral en la empresa","Motivo del retiro","Nombre del Jefe Imediato"
  ]);

  // medica - DPI oculto + 7 = 8
  registrarTabla("tablaMedica", 8, "/guardar_medica", [
    "Numero de DPI","Padece alguna enfermedad","Tipo de enfermedad","Recibe tratamiento medico","Nombre del tratamiento","Es alergico a algun medicamento","Nombre del medico Tratante","Tipo de sangre"
  ]);
});
