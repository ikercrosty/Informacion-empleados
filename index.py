from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response, jsonify
import mysql.connector   # 👈 Conector MySQL

app = Flask(__name__)
app.secret_key = "clave-secreta"

# Lista de usuarios válidos
USUARIOS = ["iker", "admin", "juan", "maria"]

# Contraseña única para todos
PASSWORD_GLOBAL = "Empaquetex25"

# ---------------------------
# Conexión a la base de datos
# ---------------------------
def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Minicrosty21",
        database="empleados"
    )

# 1) Forzar login en rutas protegidas
@app.before_request
def requerir_login():
    rutas_publicas = {"login", "static", "db_test", "guardar_empleado"}  
    endpoint = request.endpoint or ""
    if ("usuario" not in session) and (endpoint.split(".")[0] not in rutas_publicas):
        return redirect(url_for("login"))

# 2) Desactivar caché en todas las respuestas
@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# ---------------------------
# Rutas principales
# ---------------------------
@app.route("/")
def home():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT 
            `Nombre`,
            `Apellidos`,
            `Apellidos de casada`,
            `Estado Civil`,
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

@app.route("/about")
def about():
    return render_template("about.html", usuario=session.get("usuario"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        usuario = request.form.get("usuario", "").strip()
        password = request.form.get("password", "")

        # Validación: usuario válido + contraseña global correcta
        if usuario in USUARIOS and password == PASSWORD_GLOBAL:
            session["usuario"] = usuario
            return redirect(url_for("home"))
        else:
            flash("Usuario o contraseña incorrectos", "danger")
            return redirect(url_for("login"))

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()  # borra toda la sesión
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
                    Nacionalidad, `Numero de DPI`, Departamento, `Fecha de nacimiento`,
                    `Lugar de nacimiento`, `Numero de Afiliación del IGGS`, `Dirección del Domicilio`,
                    `Numero de Telefono`, Religión, `Correo Electronico`, `Puesto de trabajo`,
                    `Tipo de contrato`, `Jornada laboral`, `Duración del trabajo`,
                    `Fecha de inicio laboral`, `Dias Laborales`
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                          %s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                data.get("nombre"), data.get("apellidos"), data.get("apellidos_casada"),
                data.get("estado_civil"), data.get("nacionalidad"), data.get("dpi"),
                data.get("departamento"), data.get("fecha_nacimiento"),
                data.get("lugar_nacimiento"), data.get("iggs"), data.get("direccion"),
                data.get("telefono"), data.get("religion"), data.get("correo"),
                data.get("puesto"), data.get("contrato"), data.get("jornada"),
                data.get("duracion"), data.get("inicio"), data.get("dias")
            ))
            mensaje = "Empleado agregado correctamente"

        else:  # UPDATE
            cursor.execute("""
                UPDATE empleados_info
                SET Nombre=%s, Apellidos=%s, `Apellidos de casada`=%s, `Estado Civil`=%s,
                    Nacionalidad=%s, Departamento=%s, `Fecha de nacimiento`=%s,
                    `Lugar de nacimiento`=%s, `Numero de Afiliación del IGGS`=%s,
                    `Dirección del Domicilio`=%s, `Numero de Telefono`=%s, Religión=%s,
                    `Correo Electronico`=%s, `Puesto de trabajo`=%s, `Tipo de contrato`=%s,
                    `Jornada laboral`=%s, `Duración del trabajo`=%s,
                    `Fecha de inicio laboral`=%s, `Dias Laborales`=%s
                WHERE `Numero de DPI`=%s
            """, (
                data.get("nombre"), data.get("apellidos"), data.get("apellidos_casada"),
                data.get("estado_civil"), data.get("nacionalidad"), data.get("departamento"),
                data.get("fecha_nacimiento"), data.get("lugar_nacimiento"), data.get("iggs"),
                data.get("direccion"), data.get("telefono"), data.get("religion"),
                data.get("correo"), data.get("puesto"), data.get("contrato"),
                data.get("jornada"), data.get("duracion"), data.get("inicio"),
                data.get("dias"), data.get("dpi")
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
