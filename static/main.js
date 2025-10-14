document.addEventListener("DOMContentLoaded", function () {
  function activarTabla(idTabla, columnas, endpoint, campos) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;

    const btnAgregar = document.getElementById("btnAgregar");
    const btnEditar = document.getElementById("btnEditar");
    const btnGuardar = document.getElementById("btnGuardar");
    const btnCancelar = document.getElementById("btnCancelar");

    let filaSeleccionada = null;
    let copiaOriginal = [];
    let esNuevo = false;

    // Selección por doble click
    tabla.addEventListener("dblclick", function (e) {
      const fila = e.target.closest("tr");
      if (!fila) return;

      if (filaSeleccionada) filaSeleccionada.classList.remove("table-active");
      filaSeleccionada = fila;
      filaSeleccionada.classList.add("table-active");

      btnEditar.disabled = false;
      btnGuardar.disabled = true;
      btnCancelar.disabled = true;
      esNuevo = false;
    });

    // Agregar fila nueva
    btnAgregar.addEventListener("click", function () {
      const tbody = tabla.querySelector("tbody");

      const nuevaFila = document.createElement("tr");
      for (let i = 0; i < columnas; i++) {
        const celda = document.createElement("td");
        celda.innerText = "";
        celda.contentEditable = true;
        celda.style.backgroundColor = "#fff3cd";
        nuevaFila.appendChild(celda);
      }

      tbody.insertBefore(nuevaFila, tbody.firstChild);

      if (filaSeleccionada) filaSeleccionada.classList.remove("table-active");
      filaSeleccionada = nuevaFila;
      filaSeleccionada.classList.add("table-active");

      btnEditar.disabled = true;
      btnGuardar.disabled = false;
      btnCancelar.disabled = false;
      esNuevo = true;
    });

    // Editar fila
    btnEditar.addEventListener("click", function () {
      if (!filaSeleccionada) return;

      const celdas = filaSeleccionada.querySelectorAll("td");
      copiaOriginal = [];
      celdas.forEach((celda, i) => {
        copiaOriginal[i] = celda.innerText;
        celda.contentEditable = true;
        celda.style.backgroundColor = "#fff3cd";
      });

      btnEditar.disabled = true;
      btnGuardar.disabled = false;
      btnCancelar.disabled = false;
      esNuevo = false;
    });

    // Cancelar
    btnCancelar.addEventListener("click", function () {
      if (!filaSeleccionada) return;

      if (esNuevo) {
        filaSeleccionada.remove();
      } else {
        const celdas = filaSeleccionada.querySelectorAll("td");
        celdas.forEach((celda, i) => {
          celda.innerText = copiaOriginal[i];
          celda.contentEditable = false;
          celda.style.backgroundColor = "";
        });
        filaSeleccionada.classList.remove("table-active");
      }

      filaSeleccionada = null;
      btnEditar.disabled = true;
      btnGuardar.disabled = true;
      btnCancelar.disabled = true;
      esNuevo = false;
    });

    // Guardar (INSERT o UPDATE)
    btnGuardar.addEventListener("click", function () {
      if (!filaSeleccionada) return;

      const celdas = filaSeleccionada.querySelectorAll("td");
      const datos = Array.from(celdas).map(c => {
        const val = c.innerText.trim();
        return val === "" ? null : val;
      });

      // Construir payload dinámico según campos
      const payload = {};
      campos.forEach((campo, i) => {
        payload[campo] = datos[i];
      });
      payload["nuevo"] = esNuevo;

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          alert(data.mensaje);
          celdas.forEach(c => {
            c.contentEditable = false;
            c.style.backgroundColor = "";
          });
          filaSeleccionada.classList.remove("table-active");
          filaSeleccionada = null;

          btnEditar.disabled = true;
          btnGuardar.disabled = true;
          btnCancelar.disabled = true;
          esNuevo = false;
        })
        .catch(err => alert("Error al guardar: " + err));
    });
  }

  // Activar tabla de empleados (20 columnas)
  activarTabla("tablaEmpleados", 20, "/guardar_empleado", [
    "nombre", "apellidos", "apellidos_casada", "estado_civil", "nacionalidad",
    "dpi", "departamento", "fecha_nacimiento", "lugar_nacimiento", "iggs",
    "direccion", "telefono", "religion", "correo", "puesto",
    "contrato", "jornada", "duracion", "inicio", "dias"
  ]);

  // Activar tabla académica (4 columnas)
  activarTabla("tablaAcademico", 4, "/guardar_academico", [
    "nivel_estudios", "profesion", "colegio", "cursos"
  ]);
});
