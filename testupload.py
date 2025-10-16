# test_upload.py
from flask import Flask, request, redirect, url_for, render_template_string, send_from_directory, flash
import os
from PIL import Image
from io import BytesIO
from datetime import datetime

app = Flask(__name__)
app.secret_key = "testkey"
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "static_test", "fotos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXT = {"png","jpg","jpeg","gif","webp"}

def allowed_file(fname):
    return "." in fname and fname.rsplit(".",1)[1].lower() in ALLOWED_EXT

TEMPLATE = """
<!doctype html>
<title>Test upload</title>
<h3>Subir foto de prueba</h3>
<form method="post" enctype="multipart/form-data" action="{{ url_for('subir') }}">
  DPI: <input name="dpi" value="99999999"><br><br>
  <input type="file" name="foto" accept="image/*"><br><br>
  <button type="submit">Subir</button>
</form>
{% if url %}
  <h4>Vista previa:</h4>
  <img src="{{ url }}" style="width:220px;height:220px;object-fit:cover;border:1px solid #333;">
{% endif %}
"""

@app.route("/", methods=["GET"])
def index():
    return render_template_string(TEMPLATE, url=None)

@app.route("/subir_foto", methods=["POST"])
def subir():
    # puntos de depuración: devolver mensajes claros
    dpi = request.form.get("dpi")
    if not dpi:
        return "Falta DPI", 400
    if "foto" not in request.files:
        return "No se envió campo 'foto'", 400
    f = request.files["foto"]
    if f.filename == "":
        return "Archivo vacio", 400
    if not allowed_file(f.filename):
        return "Tipo no permitido", 400
    # normalizar a jpg
    img = Image.open(f.stream)
    if img.mode in ("RGBA","P","LA"):
        img = img.convert("RGB")
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    filename = f"{dpi}_{ts}.jpg"
    path = os.path.join(UPLOAD_FOLDER, filename)
    img.save(path, format="JPEG", quality=85)
    return redirect(url_for("ver", filename=filename))

@app.route("/fotos/<path:filename>")
def ver(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    app.run(debug=True)
