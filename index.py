from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response, jsonify
import os
import pymysql
from urllib.parse import urlparse

app = Flask(__name__)
app.secret_key = "clave-secreta"

# 🔑 Configuración: sesiones siempre temporales
app.config["SESSION_PERMANENT"] = False

# Lista de usuarios válidos
USUARIOS = ["iker", "admin", "juan", "maria"]

# Contraseña única para todos
PASSWORD_GLOBAL = "Empaquetex25"

# ---------------------------
# Conexión a la base de datos
# ---------------------------
def get_db_connection():
    url = os.environ.get("DATABASE_URL")  # Heroku o externo
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
        # Fallback local
        return pymysql.connect(
            host="localhost",
            user="root",
            password="Minicrosty21",
            database="empleados",
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor
        )

# ---------------------------
# Middleware de login
# ---------------------------
@app.before_request
def requerir_login():
    rutas_publicas = {"login", "static", "db_test", "guardar_empleado"}  
    endpoint = request.endpoint or ""
    if ("usuario" not in session) and (endpoint.split(".")[0] not in rutas_publicas):
        return redirect(url_for("login"))

@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# ---------------------------
# Rutas principales por sección
# ---------------------------

# Home: Datos personales (incluye Tiene hijos y Cuantos hijos)
@app.route("/")
def home():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Nombre`,
            `Apellidos`,
            `Apellidos de casada`,
            `Estado Civil`,
            `Tiene hijos`,
            `Cuantos hijos`,
            `Nacionalidad`,
            `Numero de DPI`,
            `Departamento`,
            `Fecha de nacimiento`,
            `Lugar de nacimiento`,
            `Numero de Afiliación del IGGS`,
            `Dirección del Domicilio`,
            `Numero de Telefono`,
            `Religión`,
            `Correo Electronico`,
            `Puesto de trabajo`,
            `Tipo de contrato`,
            `Jornada laboral`,
            `Duración del trabajo`,
            `Fecha de inicio laboral`,
            `Dias Laborales`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("home.html", empleados=empleados, usuario=session.get("usuario"))

# About: Información académica
@app.route("/about")
def about():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Nivel de estudios`,
            `Profesión u Oficio`,
            `Colegio o establecimiento`,
            `Cursos o titulos adicionales`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("about.html", empleados=empleados, usuario=session.get("usuario"))

# Datos del cónyuge
@app.route("/conyugue")
def conyugue():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Nombres del conyugue`,
            `Apellidos del conyugue`,
            `Direccion del conyugue`,
            `Numero de teléfono del conyugue`,
            `Correo electronico del conyugue`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("conyugue.html", empleados=empleados, usuario=session.get("usuario"))

# Contacto de emergencia
@app.route("/emergencia")
def emergencia():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Nombre del contacto de emergencia`,
            `Apellidos del contacto de emergencia`,
            `Numero de telefono de emergencia`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("emergencia.html", empleados=empleados, usuario=session.get("usuario"))

# Referencias laborales
@app.route("/laboral")
def laboral():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Nombre de la Empresa (Ultimo Trabajo)`,
            `Direccion de la empresa`,
            `Inicio laboral en la empresa`,
            `Fin Laboral en la empresa`,
            `Motivo del retiro`,
            `Nombre del Jefe Imediato`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("laboral.html", empleados=empleados, usuario=session.get("usuario"))

# Referencias médicas
@app.route("/medica")
def medica():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Padece alguna enfermedad`,
            `Tipo de enfermedad`,
            `Recibe tratamiento medico`,
            `Nombre del tratamiento`,
            `Es alergico a algun medicamento`,
            `Nombre del medico Tratante`,
            `Tipo de sangre`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template("medica.html", empleados=empleados, usuario=session.get("usuario"))

# ---------------------------
# Login / Logout
# ---------------------------
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

# ---------------------------
# Ruta de prueba de conexión
# ---------------------------
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

# ---------------------------
# Guardar empleado (INSERT o UPDATE)
# ---------------------------
@app.route("/guardar_empleado", methods=["POST"])
def guardar_empleado():
    data = request.get_json()

    if not data.get("dpi"):
        return jsonify({"mensaje": "El campo DPI es obligatorio"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if data.get("nuevo"):  # INSERT
            cursor.execute("""
                INSERT INTO empleados_info (
                    Nombre, Apellidos, `Apellidos de casada`, `Estado Civil`,
                    `Tiene hijos`, `Cuantos hijos`,
                    Nacionalidad, `Numero de DPI`, Departamento, `Fecha de nacimiento`,
                    `Lugar de nacimiento`, `Numero de Afiliación del IGGS`, `Dirección del Domicilio`,
                    `Numero de Telefono`, Religión, `Correo Electronico`, `Puesto de trabajo`,
                    `Tipo de contrato`, `Jornada laboral`, `Duración del trabajo`,
                    `Fecha de inicio laboral`, `Dias Laborales`
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s
                )
            """, (
                data.get("nombre"), data.get("apellidos"), data.get("apellidos_casada"),
                data.get("estado_civil"),
                data.get("tiene_hijos"), data.get("cuantos_hijos"),
                data.get("nacionalidad"), data.get("dpi"), data.get("departamento"),
                data.get("fecha_nacimiento"),
                data.get("lugar_nacimiento"), data.get("iggs"), data.get("direccion"),
                data.get("telefono"), data.get("religion"), data.get("correo"),
                data.get("puesto"),
                data.get("contrato"), data.get("jornada"), data.get("duracion"),
                data.get("inicio"), data.get("dias")
            ))
            mensaje = "Empleado agregado correctamente"

        else:  # UPDATE
            cursor.execute("""
                UPDATE empleados_info
                SET Nombre=%s,
                    Apellidos=%s,
                    `Apellidos de casada`=%s,
                    `Estado Civil`=%s,
                    `Tiene hijos`=%s,
                    `Cuantos hijos`=%s,
                    Nacionalidad=%s,
                    Departamento=%s,
                    `Fecha de nacimiento`=%s,
                    `Lugar de nacimiento`=%s,
                    `Numero de Afiliación del IGGS`=%s,
                    `Dirección del Domicilio`=%s,
                    `Numero de Telefono`=%s,
                    Religión=%s,
                    `Correo Electronico`=%s,
                    `Puesto de trabajo`=%s,
                    `Tipo de contrato`=%s,
                    `Jornada laboral`=%s,
                    `Duración del trabajo`=%s,
                    `Fecha de inicio laboral`=%s,
                    `Dias Laborales`=%s
                WHERE `Numero de DPI`=%s
            """, (
                data.get("nombre"), data.get("apellidos"), data.get("apellidos_casada"),
                data.get("estado_civil"),
                data.get("tiene_hijos"), data.get("cuantos_hijos"),
                data.get("nacionalidad"),
                data.get("departamento"), data.get("fecha_nacimiento"),
                data.get("lugar_nacimiento"), data.get("iggs"),
                data.get("direccion"), data.get("telefono"), data.get("religion"),
                data.get("correo"), data.get("puesto"),
                data.get("contrato"), data.get("jornada"), data.get("duracion"),
                data.get("inicio"), data.get("dias"),
                data.get("dpi")
            ))
            mensaje = "Empleado actualizado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})

    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500

# ---------------------------
# Main
# ---------------------------
if __name__ == "__main__":
    app.run(debug=True)
