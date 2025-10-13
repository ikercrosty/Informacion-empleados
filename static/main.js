document.addEventListener("DOMContentLoaded", function () {
  const tabla = document.getElementById("tablaEmpleados");
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

  // Agregar fila nueva (20 columnas exactas)
  btnAgregar.addEventListener("click", function () {
    const tbody = tabla.querySelector("tbody");
    const columnas = 20;

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
    // Convertir "" a null
    const datos = Array.from(celdas).map(c => {
      const val = c.innerText.trim();
      return val === "" ? null : val;
    });

    // Validar DPI (columna 6, índice 5)
    if (!datos[5]) {
      alert("El campo DPI es obligatorio.");
      return;
    }

    const payload = {
      dpi: datos[5],
      nombre: datos[0],
      apellidos: datos[1],
      apellidos_casada: datos[2],
      estado_civil: datos[3],
      nacionalidad: datos[4],
      departamento: datos[6],
      fecha_nacimiento: datos[7],
      lugar_nacimiento: datos[8],
      iggs: datos[9],
      direccion: datos[10],
      telefono: datos[11],
      religion: datos[12],
      correo: datos[13],
      puesto: datos[14],
      contrato: datos[15],
      jornada: datos[16],
      duracion: datos[17],
      inicio: datos[18],
      dias: datos[19],
      nuevo: esNuevo
    };

    fetch("/guardar_empleado", {
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
});
