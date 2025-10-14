from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response, jsonify
import os
import pymysql
from urllib.parse import urlparse

app = Flask(__name__)
app.secret_key = "clave-secreta"

app.config["SESSION_PERMANENT"] = False

USUARIOS = ["iker", "admin", "juan", "maria"]
PASSWORD_GLOBAL = "Empaquetex25"

def get_db_connection():
    url = os.environ.get("DATABASE_URL")
    if url:
        result = urlparse(url)
        return pymysql.connect(
            host=result.hostname,
            user=result.username,
            password=result.password,
            database=result.path[1:],
            port=result.port or 3306,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor
        )
    else:
        return pymysql.connect(
            host="localhost",
            user="root",
            password="Minicrosty21",
            database="empleados",
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor
        )

@app.before_request
def requerir_login():
    rutas_publicas = {"login", "static", "db_test", "guardar_empleado", "guardar_academico",
                     "guardar_conyugue", "guardar_emergencia", "guardar_laboral", "guardar_medica"}
    endpoint = request.endpoint or ""
    if ("usuario" not in session) and (endpoint.split(".")[0] not in rutas_publicas):
        return redirect(url_for("login"))

@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route("/")
def home():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Nombre`, `Apellidos`, `Apellidos de casada`, `Estado Civil`,
            `Nacionalidad`, `Numero de DPI`, `Departamento`, `Fecha de nacimiento`,
            `Lugar de nacimiento`, `Numero de Afiliación del IGGS`, `Dirección del Domicilio`,
            `Numero de Telefono`, `Religión`, `Correo Electronico`, `Puesto de trabajo`,
            `Tipo de contrato`, `Jornada laboral`, `Duración del trabajo`,
            `Fecha de inicio laboral`, `Dias Laborales`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("home.html", empleados=empleados, usuario=session.get("usuario"))

@app.route("/about")
def about():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            `Numero de DPI`, `Nombre`, `Apellidos`,
            `Nivel de estudios`, `Profesión u Oficio`,
            `Colegio o establecimiento`, `Cursos o titulos adicionales`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("about.html", empleados=empleados, usuario=session.get("usuario"))

@app.route("/conyugue")
def conyugue():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Numero de DPI`, `Nombres del conyugue`, `Apellidos del conyugue`,
            `Direccion del conyugue`, `Numero de teléfono del conyugue`, `Correo electronico del conyugue`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("conyugue.html", empleados=empleados, usuario=session.get("usuario"))

@app.route("/emergencia")
def emergencia():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Numero de DPI`, `Nombre del contacto de emergencia`, `Apellidos del contacto de emergencia`,
            `Numero de telefono de emergencia`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("emergencia.html", empleados=empleados, usuario=session.get("usuario"))

@app.route("/laboral")
def laboral():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Numero de DPI`, `Nombre de la Empresa (Ultimo Trabajo)`, `Direccion de la empresa`,
            `Inicio laboral en la empresa`, `Fin Laboral en la empresa`, `Motivo del retiro`,
            `Nombre del Jefe Imediato`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("laboral.html", empleados=empleados, usuario=session.get("usuario"))

@app.route("/medica")
def medica():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            `Numero de DPI`, `Padece alguna enfermedad`, `Tipo de enfermedad`, `Recibe tratamiento medico`,
            `Nombre del tratamiento`, `Es alergico a algun medicamento`, `Nombre del medico Tratante`, `Tipo de sangre`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("medica.html", empleados=empleados, usuario=session.get("usuario"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        usuario = request.form.get("usuario", "").strip()
        password = request.form.get("password", "")
        if usuario in USUARIOS and password == PASSWORD_GLOBAL:
            session["usuario"] = usuario
            session.permanent = False
            return redirect(url_for("home"))
        else:
            flash("Usuario o contraseña incorrectos", "danger")
            return redirect(url_for("login"))
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    resp = make_response(redirect(url_for("login")))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/db-test")
def db_test():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return f"Conexión OK. Resultado: {result}"
    except Exception as e:
        return f"Error de conexión: {e}"

@app.route("/guardar_empleado", methods=["POST"])
def guardar_empleado():
    data = request.get_json() or {}

    dpi_val = data.get("dpi") or data.get("Numero de DPI") or data.get("Numero_de_DPI") or data.get("NumeroDeDPI") or data.get("NumeroDeDpi")
    if not dpi_val:
        return jsonify({"mensaje": "El campo DPI es obligatorio"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        nombre = data.get("Nombre") or data.get("nombre")
        apellidos = data.get("Apellidos") or data.get("apellidos")
        apellidos_casada = data.get("Apellidos de casada") or data.get("apellidos_casada")
        estado_civil = data.get("Estado Civil") or data.get("estado_civil")
        nacionalidad = data.get("Nacionalidad") or data.get("nacionalidad")
        departamento = data.get("Departamento") or data.get("departamento")
        fecha_nacimiento = data.get("Fecha de nacimiento") or data.get("fecha_nacimiento")
        lugar_nacimiento = data.get("Lugar de nacimiento") or data.get("lugar_nacimiento")
        iggs = data.get("Numero de Afiliación del IGGS") or data.get("iggs")
        direccion = data.get("Dirección del Domicilio") or data.get("direccion")
        telefono = data.get("Numero de Telefono") or data.get("telefono")
        religion = data.get("Religión") or data.get("religion")
        correo = data.get("Correo Electronico") or data.get("correo")
        puesto = data.get("Puesto de trabajo") or data.get("puesto")
        contrato = data.get("Tipo de contrato") or data.get("contrato")
        jornada = data.get("Jornada laboral") or data.get("jornada")
        duracion = data.get("Duración del trabajo") or data.get("duracion")
        inicio = data.get("Fecha de inicio laboral") or data.get("inicio")
        dias = data.get("Dias Laborales") or data.get("dias")

        if data.get("nuevo"):
            cursor.execute("""
                INSERT INTO empleados_info (
                    `Nombre`, `Apellidos`, `Apellidos de casada`, `Estado Civil`,
                    `Nacionalidad`, `Numero de DPI`, `Departamento`, `Fecha de nacimiento`,
                    `Lugar de nacimiento`, `Numero de Afiliación del IGGS`, `Dirección del Domicilio`,
                    `Numero de Telefono`, `Religión`, `Correo Electronico`, `Puesto de trabajo`,
                    `Tipo de contrato`, `Jornada laboral`, `Duración del trabajo`,
                    `Fecha de inicio laboral`, `Dias Laborales`
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                nombre, apellidos, apellidos_casada, estado_civil,
                nacionalidad, dpi_val, departamento, fecha_nacimiento,
                lugar_nacimiento, iggs, direccion,
                telefono, religion, correo, puesto,
                contrato, jornada, duracion,
                inicio, dias
            ))
            mensaje = "Empleado agregado correctamente"
        else:
            cursor.execute("""
                UPDATE empleados_info
                SET `Nombre`=%s, `Apellidos`=%s, `Apellidos de casada`=%s, `Estado Civil`=%s,
                    `Nacionalidad`=%s, `Departamento`=%s, `Fecha de nacimiento`=%s,
                    `Lugar de nacimiento`=%s, `Numero de Afiliación del IGGS`=%s,
                    `Dirección del Domicilio`=%s, `Numero de Telefono`=%s, `Religión`=%s,
                    `Correo Electronico`=%s, `Puesto de trabajo`=%s, `Tipo de contrato`=%s,
                    `Jornada laboral`=%s, `Duración del trabajo`=%s, `Fecha de inicio laboral`=%s,
                    `Dias Laborales`=%s
                WHERE `Numero de DPI`=%s
            """, (
                nombre, apellidos, apellidos_casada, estado_civil,
                nacionalidad, departamento, fecha_nacimiento,
                lugar_nacimiento, iggs,
                direccion, telefono, religion,
                correo, puesto, contrato,
                jornada, duracion, inicio,
                dias, dpi_val
            ))
            mensaje = "Empleado actualizado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500

@app.route("/guardar_academico", methods=["POST"])
def guardar_academico():
    data = request.get_json() or {}
    dpi = data.get("Numero de DPI") or data.get("dpi")
    if not dpi:
        return jsonify({"mensaje": "El campo Numero de DPI es obligatorio"}), 400

    nivel = data.get("Nivel de estudios")
    profesion = data.get("Profesión u Oficio")
    colegio = data.get("Colegio o establecimiento")
    cursos = data.get("Cursos o titulos adicionales")
    nuevo = data.get("nuevo", False)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT `Numero de DPI` FROM empleados_info WHERE `Numero de DPI` = %s", (dpi,))
        existe = cursor.fetchone()

        if nuevo and not existe:
            cursor.execute("""
                INSERT INTO empleados_info (
                    `Numero de DPI`, `Nivel de estudios`, `Profesión u Oficio`,
                    `Colegio o establecimiento`, `Cursos o titulos adicionales`
                ) VALUES (%s, %s, %s, %s, %s)
            """, (dpi, nivel, profesion, colegio, cursos))
            mensaje = "Registro académico agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Nivel de estudios`=%s,
                        `Profesión u Oficio`=%s,
                        `Colegio o establecimiento`=%s,
                        `Cursos o titulos adicionales`=%s
                    WHERE `Numero de DPI`=%s
                """, (nivel, profesion, colegio, cursos, dpi))
                mensaje = "Registro académico actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Nivel de estudios`, `Profesión u Oficio`,
                        `Colegio o establecimiento`, `Cursos o titulos adicionales`
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (dpi, nivel, profesion, colegio, cursos))
                mensaje = "Registro académico agregado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500

@app.route("/guardar_conyugue", methods=["POST"])
def guardar_conyugue():
    data = request.get_json() or {}
    dpi = data.get("Numero de DPI") or data.get("dpi")
    if not dpi:
        return jsonify({"mensaje": "El campo Numero de DPI es obligatorio"}), 400

    nombres = data.get("Nombres del conyugue")
    apellidos = data.get("Apellidos del conyugue")
    direccion = data.get("Direccion del conyugue")
    telefono = data.get("Numero de teléfono del conyugue")
    correo = data.get("Correo electronico del conyugue")
    nuevo = data.get("nuevo", False)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT `Numero de DPI` FROM empleados_info WHERE `Numero de DPI` = %s", (dpi,))
        existe = cursor.fetchone()
        if nuevo and not existe:
            cursor.execute("""
                INSERT INTO empleados_info (
                    `Numero de DPI`, `Nombres del conyugue`, `Apellidos del conyugue`,
                    `Direccion del conyugue`, `Numero de teléfono del conyugue`, `Correo electronico del conyugue`
                ) VALUES (%s,%s,%s,%s,%s,%s)
            """, (dpi, nombres, apellidos, direccion, telefono, correo))
            mensaje = "Registro de cónyuge agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Nombres del conyugue`=%s, `Apellidos del conyugue`=%s,
                        `Direccion del conyugue`=%s, `Numero de teléfono del conyugue`=%s,
                        `Correo electronico del conyugue`=%s
                    WHERE `Numero de DPI`=%s
                """, (nombres, apellidos, direccion, telefono, correo, dpi))
                mensaje = "Registro de cónyuge actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Nombres del conyugue`, `Apellidos del conyugue`,
                        `Direccion del conyugue`, `Numero de teléfono del conyugue`, `Correo electronico del conyugue`
                    ) VALUES (%s,%s,%s,%s,%s,%s)
                """, (dpi, nombres, apellidos, direccion, telefono, correo))
                mensaje = "Registro de cónyuge agregado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500

@app.route("/guardar_emergencia", methods=["POST"])
def guardar_emergencia():
    data = request.get_json() or {}
    dpi = data.get("Numero de DPI") or data.get("dpi")
    if not dpi:
        return jsonify({"mensaje": "El campo Numero de DPI es obligatorio"}), 400

    nombre = data.get("Nombre del contacto de emergencia")
    apellidos = data.get("Apellidos del contacto de emergencia")
    telefono = data.get("Numero de telefono de emergencia")
    nuevo = data.get("nuevo", False)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT `Numero de DPI` FROM empleados_info WHERE `Numero de DPI` = %s", (dpi,))
        existe = cursor.fetchone()
        if nuevo and not existe:
            cursor.execute("""
                INSERT INTO empleados_info (
                    `Numero de DPI`, `Nombre del contacto de emergencia`, `Apellidos del contacto de emergencia`, `Numero de telefono de emergencia`
                ) VALUES (%s,%s,%s,%s)
            """, (dpi, nombre, apellidos, telefono))
            mensaje = "Contacto de emergencia agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Nombre del contacto de emergencia`=%s, `Apellidos del contacto de emergencia`=%s,
                        `Numero de telefono de emergencia`=%s
                    WHERE `Numero de DPI`=%s
                """, (nombre, apellidos, telefono, dpi))
                mensaje = "Contacto de emergencia actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Nombre del contacto de emergencia`, `Apellidos del contacto de emergencia`, `Numero de telefono de emergencia`
                    ) VALUES (%s,%s,%s,%s)
                """, (dpi, nombre, apellidos, telefono))
                mensaje = "Contacto de emergencia agregado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500

@app.route("/guardar_laboral", methods=["POST"])
def guardar_laboral():
    data = request.get_json() or {}
    dpi = data.get("Numero de DPI") or data.get("dpi")
    if not dpi:
        return jsonify({"mensaje": "El campo Numero de DPI es obligatorio"}), 400

    empresa = data.get("Nombre de la Empresa (Ultimo Trabajo)")
    direccion = data.get("Direccion de la empresa")
    inicio = data.get("Inicio laboral en la empresa")
    fin = data.get("Fin Laboral en la empresa")
    motivo = data.get("Motivo del retiro")
    jefe = data.get("Nombre del Jefe Imediato")
    nuevo = data.get("nuevo", False)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT `Numero de DPI` FROM empleados_info WHERE `Numero de DPI` = %s", (dpi,))
        existe = cursor.fetchone()
        if nuevo and not existe:
            cursor.execute("""
                INSERT INTO empleados_info (
                    `Numero de DPI`, `Nombre de la Empresa (Ultimo Trabajo)`, `Direccion de la empresa`,
                    `Inicio laboral en la empresa`, `Fin Laboral en la empresa`, `Motivo del retiro`, `Nombre del Jefe Imediato`
                ) VALUES (%s,%s,%s,%s,%s,%s,%s)
            """, (dpi, empresa, direccion, inicio, fin, motivo, jefe))
            mensaje = "Registro laboral agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Nombre de la Empresa (Ultimo Trabajo)`=%s, `Direccion de la empresa`=%s,
                        `Inicio laboral en la empresa`=%s, `Fin Laboral en la empresa`=%s,
                        `Motivo del retiro`=%s, `Nombre del Jefe Imediato`=%s
                    WHERE `Numero de DPI`=%s
                """, (empresa, direccion, inicio, fin, motivo, jefe, dpi))
                mensaje = "Registro laboral actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Nombre de la Empresa (Ultimo Trabajo)`, `Direccion de la empresa`,
                        `Inicio laboral en la empresa`, `Fin Laboral en la empresa`, `Motivo del retiro`, `Nombre del Jefe Imediato`
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, (dpi, empresa, direccion, inicio, fin, motivo, jefe))
                mensaje = "Registro laboral agregado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500

@app.route("/guardar_medica", methods=["POST"])
def guardar_medica():
    data = request.get_json() or {}
    dpi = data.get("Numero de DPI") or data.get("dpi")
    if not dpi:
        return jsonify({"mensaje": "El campo Numero de DPI es obligatorio"}), 400

    padece = data.get("Padece alguna enfermedad")
    tipo = data.get("Tipo de enfermedad")
    recibe = data.get("Recibe tratamiento medico")
    tratamiento = data.get("Nombre del tratamiento")
    alergico = data.get("Es alergico a algun medicamento")
    medico = data.get("Nombre del medico Tratante")
    sangre = data.get("Tipo de sangre")
    nuevo = data.get("nuevo", False)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT `Numero de DPI` FROM empleados_info WHERE `Numero de DPI` = %s", (dpi,))
        existe = cursor.fetchone()
        if nuevo and not existe:
            cursor.execute("""
                INSERT INTO empleados_info (
                    `Numero de DPI`, `Padece alguna enfermedad`, `Tipo de enfermedad`, `Recibe tratamiento medico`,
                    `Nombre del tratamiento`, `Es alergico a algun medicamento`, `Nombre del medico Tratante`, `Tipo de sangre`
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (dpi, padece, tipo, recibe, tratamiento, alergico, medico, sangre))
            mensaje = "Registro médico agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Padece alguna enfermedad`=%s, `Tipo de enfermedad`=%s, `Recibe tratamiento medico`=%s,
                        `Nombre del tratamiento`=%s, `Es alergico a algun medicamento`=%s, `Nombre del medico Tratante`=%s,
                        `Tipo de sangre`=%s
                    WHERE `Numero de DPI`=%s
                """, (padece, tipo, recibe, tratamiento, alergico, medico, sangre, dpi))
                mensaje = "Registro médico actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Padece alguna enfermedad`, `Tipo de enfermedad`, `Recibe tratamiento medico`,
                        `Nombre del tratamiento`, `Es alergico a algun medicamento`, `Nombre del medico Tratante`, `Tipo de sangre`
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """, (dpi, padece, tipo, recibe, tratamiento, alergico, medico, sangre))
                mensaje = "Registro médico agregado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500

if __name__ == "__main__":
    app.run(debug=True)
