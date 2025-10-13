from flask import Flask, render_template, request, redirect, url_for, flash, session

app = Flask(__name__)
app.secret_key = "clave-secreta"  # Necesaria para sesiones y mensajes flash

# Diccionario de usuarios válidos (usuario: contraseña)
USUARIOS = {
    "iker": "1234",
    "admin": "adminpass",
    "juan": "juanpass",
    "maria": "mariapass"
}

@app.route("/")
def home():
    if "usuario" in session:
        return render_template("home.html", usuario=session["usuario"])
    else:
        return redirect(url_for("login"))

@app.route("/about")
def about():
    if "usuario" in session:
        return render_template("about.html", usuario=session["usuario"])
    else:
        return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        usuario = request.form["usuario"]
        password = request.form["password"]

        if usuario in USUARIOS and USUARIOS[usuario] == password:
            session["usuario"] = usuario
            flash(f"Bienvenido {usuario}", "success")
            return redirect(url_for("home"))
        else:
            flash("Usuario o contraseña incorrectos", "danger")
            return redirect(url_for("login"))

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.pop("usuario", None)
    flash("Sesión cerrada", "info")
    return redirect(url_for("login"))

if __name__ == "__main__":
    app.run(debug=True)
