from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response, jsonify
import os
import pymysql
from urllib.parse import urlparse
from werkzeug.utils import secure_filename
from datetime import datetime
from io import BytesIO
from PIL import Image
import sys
import json
from pathlib import Path
import os
import json
import os
from PIL import Image, ExifTags
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)



app = Flask(__name__)
app.secret_key = "clave-secreta"
app.config["SESSION_PERMANENT"] = False

# Configuración de CORS con fallback si Flask-Cors no está instalado
FRONTEND_ORIGINS = os.environ.get("FRONTEND_ORIGINS", "http://localhost:5173")
try:
    from flask_cors import CORS
    CORS(app, resources={
        r"/api/*": {"origins": FRONTEND_ORIGINS},
        r"/subir_foto": {"origins": FRONTEND_ORIGINS},
        r"/eliminar_foto": {"origins": FRONTEND_ORIGINS},
        r"/planilla": {"origins": FRONTEND_ORIGINS},
        r"/guardar_planilla": {"origins": FRONTEND_ORIGINS},
        r"/api/planilla": {"origins": FRONTEND_ORIGINS}
    })
except Exception:
    @app.after_request
    def _simple_cors(response):
        origin = FRONTEND_ORIGINS
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

# Tamaño máximo de subida (ej. 16 MB)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

# Carpeta para fotos (asegura path absoluto dentro de la app)
UPLOAD_FOLDER = os.path.join(app.root_path, "static", "fotos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Extensiones permitidas
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}

# Archivo servidor para persistir la planilla (JSON)
PLANILLA_STORE_PATH = os.environ.get("PLANILLA_STORE_PATH",
                                    os.path.join(app.root_path, "data", "planilla_store.json"))
Path(os.path.dirname(PLANILLA_STORE_PATH)).mkdir(parents=True, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


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


# Helper: replace None values with empty strings in rows returned by cursor.fetchall()
def sanitize_rows(rows):
    out = []
    for r in rows:
        nr = {}
        for k, v in r.items():
            nr[k] = "" if v is None else v
        out.append(nr)
    return out


@app.before_request
def requerir_login():
    rutas_publicas = {
        "login", "static", "db_test", "db-test",
        "guardar_empleado", "guardar_academico", "guardar_conyugue",
        "guardar_emergencia", "guardar_laboral", "guardar_medica",
        "api_foto", "subir_foto", "eliminar_foto", "api_empleados_list", "api_empleado_get", "api_empleados",
        "planilla", "api_planilla", "guardar_planilla", "whoami"
    }
    endpoint = request.endpoint or ""
    base_endpoint = endpoint.split(".")[0] if "." in endpoint else endpoint
    if ("usuario" not in session) and (base_endpoint not in rutas_publicas):
        return redirect(url_for("login"))


@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# ---------------- Páginas principales ----------------

@app.route("/menu")
def menu():
    if "usuario" not in session:
        return redirect(url_for("login"))
    return render_template("menu.html", usuario=session.get("usuario"))


@app.route("/empleados")
def empleados():
    if "usuario" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Numero de DPI`, `Nombre`, `Apellidos`, `Apellidos de casada`, `Estado Civil`,
            `Nacionalidad`, `Departamento`, `Fecha de nacimiento`,
            `Lugar de nacimiento`, `Numero de Afiliación del IGGS`, `Dirección del Domicilio`,
            `Numero de Telefono`, `Religión`, `Correo Electronico`, `Puesto de trabajo`,
            `Tipo de contrato`, `Jornada laboral`, `Duración del trabajo`,
            `Fecha de inicio laboral`, `Dias Laborales`, `foto`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()

    empleados = sanitize_rows(empleados)
    return render_template("home.html", empleados=empleados, usuario=session.get("usuario"))


@app.route("/")
def home():
    if "usuario" in session:
        return redirect(url_for("menu"))
    return redirect(url_for("login"))


# ---------------- API lista / creación ----------------
@app.route("/api/empleados", methods=["GET", "POST"])
def api_empleados_list():
    if request.method == "GET":
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT `Numero de DPI` as dpi,
                       COALESCE(CONCAT(`Nombre`, ' ', `Apellidos`), `Nombre`, `Apellidos`) as full_name
                FROM empleados_info
                WHERE `Nombre` IS NOT NULL OR `Apellidos` IS NOT NULL
                ORDER BY `Apellidos`, `Nombre`
            """)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            rows = sanitize_rows(rows)
            return jsonify(rows)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # POST: crear empleado (compatibilidad con frontend)
    try:
        data = request.get_json() or {}
        if data.get("nuevo") is None:
            data["nuevo"] = True
        dpi_val = data.get("Numero de DPI") or data.get("dpi")
        if not dpi_val:
            return jsonify({"mensaje": "El campo DPI es obligatorio"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT `Numero de DPI` FROM empleados_info WHERE `Numero de DPI`=%s", (dpi_val,))
        existe = cursor.fetchone()
        if existe:
            cursor.close()
            conn.close()
            return jsonify({"mensaje": "Empleado ya existe"}), 409

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

        cursor.execute("""
            INSERT INTO empleados_info (
                `Numero de DPI`, `Nombre`, `Apellidos`, `Apellidos de casada`, `Estado Civil`,
                `Nacionalidad`, `Departamento`, `Fecha de nacimiento`,
                `Lugar de nacimiento`, `Numero de Afiliación del IGGS`, `Dirección del Domicilio`,
                `Numero de Telefono`, `Religión`, `Correo Electronico`, `Puesto de trabajo`,
                `Tipo de contrato`, `Jornada laboral`, `Duración del trabajo`,
                `Fecha de inicio laboral`, `Dias Laborales`
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            dpi_val, nombre, apellidos, apellidos_casada, estado_civil,
            nacionalidad, departamento, fecha_nacimiento,
            lugar_nacimiento, iggs, direccion,
            telefono, religion, correo, puesto,
            contrato, jornada, duracion,
            inicio, dias
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": "Empleado agregado correctamente"})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500


# Compatibilidad rápida para frontend que pide /api/categories
@app.route("/api/categories", methods=["GET"])
def api_categories_compat():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT `Numero de DPI` as dpi,
                   COALESCE(CONCAT(`Nombre`, ' ', `Apellidos`), `Nombre`, `Apellidos`) as full_name
            FROM empleados_info
            WHERE `Nombre` IS NOT NULL OR `Apellidos` IS NOT NULL
            ORDER BY `Apellidos`, `Nombre`
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        rows = sanitize_rows(rows)
        return jsonify(rows)
    except Exception as e:
        app.logger.exception("Error en /api/categories")
        return jsonify({"error": str(e)}), 500


# -----------------------------
# NUEVO ENDPOINT: /api/usuarios
# Devuelve lista de usuarios para la UI del FAB: username, email, role, active
# -----------------------------
# ---------------- API usuarios (reemplaza o crea en index.py) ----------------
@app.route("/api/usuarios", methods=["GET"])
def api_usuarios_list():
    """
    Devuelve lista de usuarios con campos mínimos: username, email, role.
    No intenta leer columnas opcionales que puedan faltar (e.g., activo).
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT `Usuarios` AS username,
                   `Correo Electronico` AS email,
                   COALESCE(`rol`, '') AS role
            FROM `Usuarios`
            ORDER BY `Usuarios` ASC
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        out = []
        for r in rows:
            username = (r.get("username") or r.get("Usuarios") or "")
            email = (r.get("email") or r.get("Correo Electronico") or "")
            role = (r.get("role") or r.get("rol") or "").strip().lower()
            out.append({"username": username, "email": email, "role": role, "active": True})
        return jsonify(out)
    except Exception as e:
        app.logger.exception("Error en /api/usuarios")
        return jsonify({"error": str(e)}), 500


@app.route("/api/usuarios/rol", methods=["PATCH"])
def api_usuarios_rol():
    """
    Cambia rol. Acepta JSON con { usuario, correo, id, rol }.
    Defiende contra tipos: convierte usuario a str si viene como int.
    Solo roles permitidos: admin y colaborador.
    Autorización: session['rol']=='admin' o 'superadmin'.
    """
    current = (session.get('rol') or '').strip().lower()
    if current not in ('admin', 'superadmin'):
        return jsonify({'mensaje': 'Permisos insuficientes'}), 403

    data = request.get_json(silent=True) or {}
    # aceptar distintos identificadores; convertir números a str
    usuario_raw = data.get('usuario') or data.get('username') or data.get('Usuarios') or data.get('id') or data.get('correo') or data.get('email')
    # si recibimos None -> error; si recibimos int -> convertir a str
    if usuario_raw is None:
        return jsonify({'mensaje': 'Se requiere identificador usuario o correo'}), 400
    usuario = str(usuario_raw).strip()

    nuevo_rol_raw = data.get('rol') or data.get('role') or ''
    nuevo_rol = str(nuevo_rol_raw).strip().lower()
    if not nuevo_rol:
        return jsonify({'mensaje': 'Se requiere rol'}), 400

    ALLOWED_ROLES = ('admin', 'colaborador')
    if nuevo_rol not in ALLOWED_ROLES:
        return jsonify({'mensaje': 'Rol no permitido'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # intentamos actualizar por Usuarios (username) o por correo
        cursor.execute("UPDATE `Usuarios` SET `rol` = %s WHERE `Usuarios` = %s OR `Correo Electronico` = %s", (nuevo_rol, usuario, usuario))
        if cursor.rowcount == 0:
            # opcional: si usuario estaba almacenado como id numérico en otra columna, intentar con id
            # cursor.execute("UPDATE `Usuarios` SET `rol` = %s WHERE id = %s", (nuevo_rol, usuario))
            cursor.close()
            conn.close()
            return jsonify({'mensaje': 'Usuario no encontrado'}), 404
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'mensaje': 'Rol actualizado correctamente'}), 200
    except Exception as e:
        app.logger.exception("Error actualizando rol")
        return jsonify({'mensaje': f'Error: {e}'}), 500

# Devuelve todos los campos relevantes de un empleado por DPI
# ---------------------------------------------------------
# API: Obtener o actualizar un empleado por DPI
# ---------------------------------------------------------
@app.route("/api/empleado/<dpi>", methods=["GET", "PUT"])
def api_empleado_get(dpi):

    # ---------------- GET: devolver datos del empleado ----------------
    if request.method == "GET":
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT *
                FROM empleados_info
                WHERE `Numero de DPI` = %s
                LIMIT 1
            """, (dpi,))
            row = cursor.fetchone()
            cursor.close()
            conn.close()

            if not row:
                return jsonify({"error": "Empleado no encontrado"}), 404

            # Reemplazar None por ""
            row = {k: ("" if v is None else v) for k, v in row.items()}

            return jsonify(row)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ---------------- PUT: actualizar empleado ----------------
    if request.method == "PUT":
        data = request.get_json() or {}

        new_dpi = data.get("Numero de DPI") or data.get("dpi") or dpi
        original_dpi = dpi

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute("""
                UPDATE empleados_info
                SET `Numero de DPI`=%s,
                    `Nombre`=%s,
                    `Apellidos`=%s,
                    `Apellidos de casada`=%s,
                    `Estado Civil`=%s,
                    `Nacionalidad`=%s,
                    `Departamento`=%s,
                    `Fecha de nacimiento`=%s,
                    `Lugar de nacimiento`=%s,
                    `Numero de Afiliación del IGGS`=%s,
                    `Dirección del Domicilio`=%s,
                    `Numero de Telefono`=%s,
                    `Religión`=%s,
                    `Correo Electronico`=%s,
                    `Puesto de trabajo`=%s,
                    `Tipo de contrato`=%s,
                    `Jornada laboral`=%s,
                    `Duración del trabajo`=%s,
                    `Fecha de inicio laboral`=%s,
                    `Dias Laborales`=%s
                WHERE `Numero de DPI`=%s
            """, (
                new_dpi,
                data.get("Nombre"),
                data.get("Apellidos"),
                data.get("Apellidos de casada"),
                data.get("Estado Civil"),
                data.get("Nacionalidad"),
                data.get("Departamento"),
                data.get("Fecha de nacimiento"),
                data.get("Lugar de nacimiento"),
                data.get("Numero de Afiliación del IGGS"),
                data.get("Dirección del Domicilio"),
                data.get("Numero de Telefono"),
                data.get("Religión"),
                data.get("Correo Electronico"),
                data.get("Puesto de trabajo"),
                data.get("Tipo de contrato"),
                data.get("Jornada laboral"),
                data.get("Duración del trabajo"),
                data.get("Fecha de inicio laboral"),
                data.get("Dias Laborales"),
                original_dpi
            ))

            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({"mensaje": "Empleado actualizado correctamente"})

        except Exception as e:
            return jsonify({"mensaje": f"Error: {e}"}), 500

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

    empleados = sanitize_rows(empleados)
    return render_template("about.html", empleados=empleados, usuario=session.get("usuario"))


@app.route("/conyugue")
def conyugue():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Numero de DPI`, `Nombre`, `Apellidos`,
            `Nombres del conyugue`, `Apellidos del conyugue`,
            `Direccion del conyugue`, `Numero de telefono del conyugue`, `Correo electronico del conyugue`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()

    empleados = sanitize_rows(empleados)
    return render_template("conyugue.html", empleados=empleados, usuario=session.get("usuario"))


@app.route("/emergencia")
def emergencia():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Numero de DPI`, `Nombre`, `Apellidos`,
            `Nombre del contacto de emergencia`, `Apellidos del contacto de emergencia`,
            `Numero de telefono de emergencia`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()

    empleados = sanitize_rows(empleados)
    return render_template("emergencia.html", empleados=empleados, usuario=session.get("usuario"))


@app.route("/laboral")
def laboral():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            `Numero de DPI`, `Nombre`, `Apellidos`,
            `Nombre de la Empresa (Ultimo Trabajo)`, `Direccion de la empresa`,
            `Inicio laboral en la empresa`, `Fin Laboral en la empresa`, `Motivo del retiro`,
            `Nombre del Jefe Imediato`, `Numero del Jefe inmediato`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()

    empleados = sanitize_rows(empleados)
    return render_template("laboral.html", empleados=empleados, usuario=session.get("usuario"))


@app.route("/medica")
def medica():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            `Numero de DPI`, `Nombre`, `Apellidos`,
            `Padece alguna enfermedad`, `Tipo de enfermedad`, `Recibe tratamiento medico`,
            `Nombre del tratamiento`, `Es alergico a algun medicamento`, `Nombre del medico Tratante`,`Numero del medico tratante`, `Tipo de sangre`
        FROM empleados_info
    """)
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()

    empleados = sanitize_rows(empleados)
    return render_template("medica.html", empleados=empleados, usuario=session.get("usuario"))


@app.route("/ficha")
def ficha():
    if "usuario" not in session:
        return redirect(url_for("login"))
    return render_template("ficha.html", usuario=session.get("usuario"))


# <-- CAMBIO PRINCIPAL: recibo ahora siempre pasa la variable 'recibo' y datos auxiliares -->
@app.route("/recibo")
def recibo():
    if "usuario" not in session:
        return redirect(url_for("login"))

    # optional: accept ?numero=... but do not fail if absent
    numero = request.args.get("numero", None)

    # For now return an empty dict so template has 'recibo' defined and url_for can resolve.
    recibo = {}
    if numero:
        # attempt to fetch minimal recibo data if exists in DB (non-invasive)
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM recibos WHERE numero = %s LIMIT 1", (numero,))
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            if row:
                # sanitize single row
                recibo = {k: ("" if v is None else v) for k, v in row.items()}
        except Exception:
            recibo = {}

    empresa_nombre = os.environ.get("EMPRESA_NOMBRE", "Empresa")
    fecha_emision = datetime.utcnow().strftime("%Y-%m-%d")
    current_date = fecha_emision

    return render_template(
        "recibo.html",
        usuario=session.get("usuario"),
        recibo=recibo,
        empresa_nombre=empresa_nombre,
        fecha_emision=fecha_emision,
        current_date=current_date
    )


# Rutas auxiliares que el template espera (evitan BuildError en url_for)
@app.route("/recibos")
def recibos_list():
    return redirect(url_for("menu"))


@app.route("/recibo/imprimir/<numero>")
def imprimir_recibo(numero):
    return redirect(url_for("recibo", numero=numero))


# ---------------- Login ----------------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        identificador = request.form.get("usuario", "").strip()
        password = request.form.get("password", "")

        if not identificador or not password:
            flash("Usuario/Correo y contraseña son obligatorios", "danger")
            return redirect(url_for("login"))

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT `Usuarios`, `Nombres`, `Correo Electronico`, `Constraseña`, `rol`
                FROM Usuarios
                WHERE `Usuarios` = %s OR `Correo Electronico` = %s
                LIMIT 1
            """, (identificador, identificador))
            user_row = cursor.fetchone()
            cursor.close()
            conn.close()

            if not user_row:
                flash("Usuario o correo no encontrado", "danger")
                return redirect(url_for("login"))

            stored_password = user_row.get("Constraseña")
            if stored_password is None:
                flash("Sin contraseña registrada para este usuario", "danger")
                return redirect(url_for("login"))

            if password == stored_password:
                session["usuario"] = user_row.get("Usuarios") or user_row.get("Correo Electronico")
                # normalize role to lowercase; default to editor if database value empty
                session["rol"] = (user_row.get("rol") or "colaborador").strip().lower()
                session.permanent = False
                return redirect(url_for("menu"))
            else:
                flash("Contraseña incorrecta", "danger")
                return redirect(url_for("login"))
        except Exception as e:
            flash(f"Error en autenticación: {e}", "danger")
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


@app.route("/planilla")
def planilla():
    # esta ruta puede ser pública para frontend
    return render_template("planilla.html", usuario=session.get("usuario"))


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


# ---------------- Guardados (POST JSON) ----------------
@app.route("/guardar_empleado", methods=["POST"])
def guardar_empleado():
    data = request.get_json() or {}

    # Accept new DPI and optional original_dpi (sent by frontend when editing)
    dpi_val = data.get("Numero de DPI") or data.get("dpi") or data.get("Numero_de_DPI") or data.get("NumeroDeDPI") or data.get("NumeroDeDpi")
    original_dpi = data.get("original_dpi") or data.get("dpi_original") or data.get("old_dpi") or data.get("dpiOld")

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
                    `Numero de DPI`, `Nombre`, `Apellidos`, `Apellidos de casada`, `Estado Civil`,
                    `Nacionalidad`, `Departamento`, `Fecha de nacimiento`,
                    `Lugar de nacimiento`, `Numero de Afiliación del IGGS`, `Dirección del Domicilio`,
                    `Numero de Telefono`, `Religión`, `Correo Electronico`, `Puesto de trabajo`,
                    `Tipo de contrato`, `Jornada laboral`, `Duración del trabajo`,
                    `Fecha de inicio laboral`, `Dias Laborales`
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                dpi_val, nombre, apellidos, apellidos_casada, estado_civil,
                nacionalidad, departamento, fecha_nacimiento,
                lugar_nacimiento, iggs, direccion,
                telefono, religion, correo, puesto,
                contrato, jornada, duracion,
                inicio, dias
            ))
            mensaje = "Empleado agregado correctamente"
        else:
            # Use original_dpi as key to find the row; fallback to dpi_val if not provided
            key_dpi = original_dpi if original_dpi else dpi_val

            # Update including Numero de DPI so changes to DPI are saved
            cursor.execute("""
                UPDATE empleados_info
                SET `Numero de DPI`=%s,
                    `Nombre`=%s, `Apellidos`=%s, `Apellidos de casada`=%s, `Estado Civil`=%s,
                    `Nacionalidad`=%s, `Departamento`=%s, `Fecha de nacimiento`=%s,
                    `Lugar de nacimiento`=%s, `Numero de Afiliación del IGGS`=%s,
                    `Dirección del Domicilio`=%s, `Numero de Telefono`=%s, `Religión`=%s,
                    `Correo Electronico`=%s, `Puesto de trabajo`=%s, `Tipo de contrato`=%s,
                    `Jornada laboral`=%s, `Duración del trabajo`=%s, `Fecha de inicio laboral`=%s,
                    `Dias Laborales`=%s
                WHERE `Numero de DPI`=%s
            """, (
                dpi_val, nombre, apellidos, apellidos_casada, estado_civil,
                nacionalidad, departamento, fecha_nacimiento,
                lugar_nacimiento, iggs,
                direccion, telefono, religion,
                correo, puesto, contrato,
                jornada, duracion, inicio,
                dias, key_dpi
            ))
            mensaje = "Empleado actualizado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500
    

@app.route("/eliminar_empleado", methods=["POST"])
def eliminar_empleado():
    # deletion remains admin-only on server-side
    if (session.get("rol") or "").strip().lower() != "admin":
        return jsonify({"mensaje": "Permisos insuficientes"}), 403

    data = request.get_json() or {}
    dpi = data.get("dpi")
    if not dpi:
        return jsonify({"mensaje": "DPI requerido"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM empleados_info WHERE `Numero de DPI` = %s", (dpi,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": f"Empleado con DPI {dpi} eliminado correctamente"})
    except Exception as e:
        return jsonify({"mensaje": f"Error al eliminar: {e}"}), 500



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
    telefono = data.get("Numero de telefono del conyugue")
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
                    `Direccion del conyugue`, `Numero de telefono del conyugue`, `Correo electronico del conyugue`
                ) VALUES (%s,%s,%s,%s,%s,%s)
            """, (dpi, nombres, apellidos, direccion, telefono, correo))
            mensaje = "Registro de cónyuge agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Nombres del conyugue`=%s, `Apellidos del conyugue`=%s,
                        `Direccion del conyugue`=%s, `Numero de telefono del conyugue`=%s,
                        `Correo electronico del conyugue`=%s
                    WHERE `Numero de DPI`=%s
                """, (nombres, apellidos, direccion, telefono, correo, dpi))
                mensaje = "Registro de cónyuge actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Nombres del conyugue`, `Apellidos del conyugue`,
                        `Direccion del conyugue`, `Numero de telefono del conyugue`, `Correo electronico del conyugue`
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
    jefnum = data.get("Numero del Jefe inmediato")
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
                    `Inicio laboral en la empresa`, `Fin Laboral en la empresa`, `Motivo del retiro`, `Nombre del Jefe Imediato`, `Numero del Jefe inmediato`
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (dpi, empresa, direccion, inicio, fin, motivo, jefe, jefnum))
            mensaje = "Registro laboral agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Nombre de la Empresa (Ultimo Trabajo)`=%s, `Direccion de la empresa`=%s,
                        `Inicio laboral en la empresa`=%s, `Fin Laboral en la empresa`=%s,
                        `Motivo del retiro`=%s, `Nombre del Jefe Imediato`=%s, `Numero del Jefe inmediato`=%s
                    WHERE `Numero de DPI`=%s
                """, (empresa, direccion, inicio, fin, motivo, jefe, jefnum, dpi))
                mensaje = "Registro laboral actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Nombre de la Empresa (Ultimo Trabajo)`, `Direccion de la empresa`,
                        `Inicio laboral en la empresa`, `Fin Laboral en la empresa`, `Motivo del retiro`, `Nombre del Jefe Imediato`, `Numero del Jefe inmediato `
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """, (dpi, empresa, direccion, inicio, fin, motivo, jefe, jefnum))
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
    numero = data.get("Numero del medico tratante")
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
                    `Nombre del tratamiento`, `Es alergico a algun medicamento`, `Nombre del medico Tratante`,`Numero del medico tratante`, `Tipo de sangre`
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (dpi, padece, tipo, recibe, tratamiento, alergico, medico, numero, sangre))
            mensaje = "Registro médico agregado correctamente"
        else:
            if existe:
                cursor.execute("""
                    UPDATE empleados_info
                    SET `Padece alguna enfermedad`=%s, `Tipo de enfermedad`=%s, `Recibe tratamiento medico`=%s,
                        `Nombre del tratamiento`=%s, `Es alergico a algun medicamento`=%s, `Nombre del medico Tratante`=%s, `Numero del medico tratante`=%s,
                        `Tipo de sangre`=%s
                    WHERE `Numero de DPI`=%s
                """, (padece, tipo, recibe, tratamiento, alergico, medico, numero, sangre, dpi))
                mensaje = "Registro médico actualizado correctamente"
            else:
                cursor.execute("""
                    INSERT INTO empleados_info (
                        `Numero de DPI`, `Padece alguna enfermedad`, `Tipo de enfermedad`, `Recibe tratamiento medico`,
                        `Nombre del tratamiento`, `Es alergico a algun medicamento`, `Nombre del medico Tratante`,`Numero del medico tratante`,`Tipo de sangre`
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (dpi, padece, tipo, recibe, tratamiento, alergico, medico, numero, sangre))
                mensaje = "Registro médico agregado correctamente"

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": mensaje})
    except Exception as e:
        return jsonify({"mensaje": f"Error: {e}"}), 500


# ---------------- Fotos: API, subida y eliminación (solo archivos en disco) ----------------
@app.route("/api/foto/<dpi>")
def api_foto(dpi):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT `foto` FROM empleados_info WHERE `Numero de DPI` = %s", (dpi,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row or not row.get("foto"):
            return jsonify({"foto": None, "url": None})

        filename = row["foto"]
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        if os.path.exists(filepath):
            return jsonify({"foto": filename, "url": url_for('static', filename=f"fotos/{filename}")})
        else:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE empleados_info SET `foto`=NULL WHERE `Numero de DPI`=%s", (dpi,))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({"foto": None, "url": None})
    except Exception as e:
        return jsonify({"foto": None, "url": None, "error": str(e)}), 500


# --- Endpoint subir foto ---
# ---------------- Endpoint subir foto ----------------
@app.route("/subir_foto", methods=["POST"])
def subir_foto():
    dpi = (request.form.get("dpi") or "").strip()
    if not dpi:
        return jsonify({"error": "Debe seleccionar un empleado (DPI)"}), 400

    if "foto" not in request.files:
        return jsonify({"error": "No se seleccionó archivo"}), 400

    file = request.files["foto"]
    if file.filename.strip() == "":
        return jsonify({"error": "Archivo vacío"}), 400

    # Validar extensión
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXT:
        return jsonify({"error": "Tipo de archivo no permitido"}), 400

    # Procesar imagen (PIL) y convertir a JPEG
    try:
        image = Image.open(file.stream)
        try:
            exif = image._getexif()
            if exif:
                orientation_key = next((k for k, v in ExifTags.TAGS.items() if v == "Orientation"), None)
                if orientation_key and orientation_key in exif:
                    orientation = exif[orientation_key]
                    if orientation == 3:
                        image = image.rotate(180, expand=True)
                    elif orientation == 6:
                        image = image.rotate(270, expand=True)
                    elif orientation == 8:
                        image = image.rotate(90, expand=True)
        except Exception:
            pass

        if image.mode in ("RGBA", "P", "LA"):
            image = image.convert("RGB")

        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=85, optimize=True)
        buffer.seek(0)
    except Exception as e:
        return jsonify({"error": f"Error procesando imagen: {e}"}), 500

    # Nombre único
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    filename = f"{dpi}_{ts}.jpg"

    # Subir a Supabase
    try:
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=f"empleados/{filename}",
            file=buffer.getvalue(),
            file_options={"content-type": "image/jpeg"}
        )
        foto_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/empleados/{filename}"
    except Exception as e:
        return jsonify({"error": f"Error subiendo a Supabase: {e}"}), 500

    # Guardar URL en BD y verificar
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE empleados_info SET foto=%s WHERE `Numero de DPI`=%s",
            (foto_url, dpi)
        )
        conn.commit()
        rows_affected = cursor.rowcount

        cursor.execute("SELECT `Numero de DPI`, foto FROM empleados_info WHERE `Numero de DPI`=%s", (dpi,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if rows_affected == 0:
            return jsonify({
                "error": "No se actualizó la fila. Verifica que el DPI exista y coincida exactamente.",
                "dpi": dpi,
                "db_row": row
            }), 500

    except Exception as e:
        return jsonify({"error": f"Error guardando URL en BD: {e}"}), 500

    return jsonify({"url": foto_url, "db_foto": row.get("foto") if isinstance(row, dict) else row[0]})

# ---------------- Endpoint eliminar foto ----------------
@app.route("/eliminar_foto", methods=["POST"])
def eliminar_foto():
    dpi = (request.form.get("dpi") or (request.get_json() or {}).get("dpi") or "").strip()
    if not dpi:
        return jsonify({"error": "Debe seleccionar un empleado (DPI)"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT foto FROM empleados_info WHERE `Numero de DPI`=%s", (dpi,))
        row = cursor.fetchone()

        if not row or not row.get("foto"):
            cursor.close()
            conn.close()
            return jsonify({"ok": False, "message": "No existe foto para ese empleado"}), 200

        foto_url = row.get("foto")
        filename = foto_url.split("/")[-1]

        # Eliminar del bucket (no detener si falla)
        try:
            supabase.storage.from_(SUPABASE_BUCKET).remove([f"empleados/{filename}"])
        except Exception:
            pass

        # Limpiar campo en BD
        cursor.execute("UPDATE empleados_info SET foto=NULL WHERE `Numero de DPI`=%s", (dpi,))
        conn.commit()
        cursor.close()
        conn.close()

    except Exception as e:
        return jsonify({"error": f"Error eliminando foto: {e}"}), 500

    return jsonify({"ok": True})


# --- Ejecutar app (solo si corres localmente) ---
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

# ------------------ NUEVOS ENDPOINTS PARA SINCRONIZAR LA PLANILLA ------------------

def read_planilla_store():
    try:
        if not os.path.exists(PLANILLA_STORE_PATH):
            return None
        with open(PLANILLA_STORE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def write_planilla_store(obj):
    try:
        obj_to_save = obj.copy() if isinstance(obj, dict) else {"rows": [], "meta": {}}
        obj_to_save["meta"] = obj_to_save.get("meta", {})
        obj_to_save["meta"]["server_saved_at"] = datetime.utcnow().isoformat()
        with open(PLANILLA_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(obj_to_save, f, ensure_ascii=False, indent=2)
        return obj_to_save["meta"]["server_saved_at"]
    except Exception:
        return None


@app.route("/api/planilla", methods=["GET"])
def api_planilla_get():
    """
    Devuelve la última planilla guardada en el servidor (archivo JSON).
    Si no existe retorna 204/empty JSON {} con código 204.
    """
    try:
        data = read_planilla_store()
        if not data:
            return jsonify({}), 204
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/guardar_planilla", methods=["POST"])
def guardar_planilla():
    """
    Recibe payload JSON { rows, meta } y lo persiste en servidor.
    Retorna { ok: true, saved_at: ISO } en caso exitoso.
    """
    try:
        payload = request.get_json() or {}
        # validate basic shape
        rows = payload.get("rows") if isinstance(payload, dict) else None
        meta = payload.get("meta") if isinstance(payload, dict) else {}
        if rows is None:
            # still allow empty rows but enforce object shape
            rows = []
        store = {"rows": rows, "meta": meta or {}}
        saved_at = write_planilla_store(store)
        if saved_at:
            return jsonify({"ok": True, "saved_at": saved_at})
        else:
            return jsonify({"ok": False, "message": "No se pudo guardar en servidor"}), 500
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500


if __name__ == "__main__":
    # escucha en todas las interfaces en el puerto 7287 (http)
    app.run(host="0.0.0.0", port=7287, debug=True)
