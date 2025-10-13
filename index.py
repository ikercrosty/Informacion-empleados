from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response

app = Flask(__name__)
app.secret_key = "clave-secreta"

# Lista de usuarios válidos
USUARIOS = ["iker", "admin", "juan", "maria"]

# Contraseña única para todos
PASSWORD_GLOBAL = "Empaquetex25"

# 1) Forzar login en rutas protegidas
@app.before_request
def requerir_login():
    rutas_publicas = {"login", "static"}  # permite login y archivos estáticos
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

@app.route("/")
def home():
    return render_template("home.html", usuario=session.get("usuario"))

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

if __name__ == "__main__":
    app.run(debug=True)
