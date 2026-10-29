"""Convierte el archivo de la app RAO (el mismo que se publica en Claude) en la app instalable.
Uso: python3 build.py <ruta a bovinos.html> <carpeta de salida>
Cada cambio que se haga a RAO aquí se pasa volviendo a correr esto y subiendo la carpeta."""
import re, shutil, sys
from pathlib import Path

SRC = Path(__file__).parent
FB = "https://www.gstatic.com/firebasejs/10.12.2/"

def build(entrada, salida):
    html = Path(entrada).read_text(encoding="utf-8")
    salida = Path(salida)
    salida.mkdir(parents=True, exist_ok=True)

    # La página de Claude no trae <head>; se le pone uno completo.
    html = html.replace('<meta name="claude:viewport-fit-sides" content="cover">', "")
    i = html.index("<style>")
    j = html.index("</style>") + len("</style>")
    head, cuerpo = html[:j], html[j:]
    head = head.replace("<title>RAO</title>", "")
    head = (
        '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<title>RAO</title>\n<meta name="theme-color" content="#000000">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-192.png">\n'
        + head + "\n</head>\n<body>\n"
    )

    # Fotos: en vez de /_blob/<id> de Claude, se leen de Firestore.
    cuerpo, n = re.subn(r'src="/_blob/\$\{esc\(([^)]*)\)\}"', r'src="${fotoSrc(\1)}" data-foto="${esc(\1)}"', cuerpo)
    assert n >= 2, "no se encontraron las fotos"
    cuerpo = cuerpo.replace("Abre esta página con tu cuenta de Claude iniciada para poder guardar datos.", "Revisa tu conexión e intenta de nuevo.")
    cuerpo = cuerpo.replace("Solo quien puede editar la app puede subir fotos.", "No se pueden subir fotos ahora.")

    # Firebase y el adaptador van justo antes del código de la app.
    k = cuerpo.index("<script>")
    libs = "".join(f'<script src="{FB}firebase-{m}-compat.js"></script>\n' for m in ("app", "auth", "firestore"))
    libs += '<script src="firebase-config.js"></script>\n<script>\n' + (SRC / "shim.js").read_text(encoding="utf-8") + "\n</script>\n"
    cuerpo = cuerpo[:k] + libs + cuerpo[k:] + "\n</body>\n</html>\n"

    (salida / "index.html").write_text(head + cuerpo, encoding="utf-8")
    for f in ("sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png"):
        if (SRC / f).exists():
            shutil.copy(SRC / f, salida / f)
    if not (salida / "firebase-config.js").exists():
        shutil.copy(SRC / "firebase-config.js", salida / "firebase-config.js")
    (salida / ".nojekyll").write_text("")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
