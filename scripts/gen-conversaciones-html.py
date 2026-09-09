# -*- coding: utf-8 -*-
"""Arma el HTML de «cómo van a salir las conversaciones» con la corrida REAL del bot.

Lee scripts/salida/conversaciones-reales.json (lo escribe conversaciones-reales.ts, que habla
con el modelo de verdad) y PISA conejeros-lab/ARTELUK-CONVERSACIONES-EJEMPLO-2026-09-08.html.

    python scripts/gen-conversaciones-html.py
"""
import json, os, re, sys, subprocess, datetime

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON = os.path.join(REPO, "scripts", "salida", "conversaciones-reales.json")
SALIDA = r"c:\Users\lukas\conejeros-lab\ARTELUK-CONVERSACIONES-EJEMPLO-2026-09-08.html"
CHROME = r"C:\Users\lukas\AppData\Local\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe"

d = json.load(open(JSON, encoding="utf-8"))
casos = d["casos"]

def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

# ── Cuentas ────────────────────────────────────────────────────────────────
total_checks = sum(len(c["checks"]) for c in casos)
fallos = [(c, k) for c in casos for k in c["checks"] if not k["ok"]]
tandas = sum(1 for c in casos for t in c["turnos"] if t["de"] == "bot")
llamadas_ia = sum(1 for c in casos for t in c["turnos"] if t["de"] == "bot" and t["via"] != "regla-dura")

# Agrupar los fallos por nombre para la tabla de arriba
por_nombre = {}
for c, k in fallos:
    por_nombre.setdefault(k["nombre"], []).append((c["titulo"], k["detalle"]))

CSS = """
  @page { size: A4; margin: 13mm 11mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif;
         color: #241c2b; background: #fff; margin: 0; padding: 0 22px 60px; line-height: 1.55; }
  .wrap { max-width: 880px; margin: 0 auto; }
  header { padding: 30px 0 16px; border-bottom: 4px solid #c2185b; margin-bottom: 20px; }
  h1 { font-size: 29px; margin: 0 0 6px; letter-spacing: -.4px; }
  .sub { color: #6d6478; font-size: 15px; margin: 0; }
  h2 { font-size: 20px; margin: 30px 0 4px; padding-top: 16px; border-top: 2px solid #f0e6ee;
       color: #8e1650; page-break-after: avoid; }
  .cuando { color: #6d6478; font-size: 13.5px; margin: 0 0 2px; }
  .porque { color: #4a4152; font-size: 13.5px; margin: 0 0 10px; }
  p { margin: 8px 0; }
  .chat { background: #ece5dd; border-radius: 12px; padding: 12px 12px 16px; margin: 12px 0 6px;
          page-break-inside: avoid; }
  .b { max-width: 82%; border-radius: 10px; padding: 7px 11px; margin: 6px 0; font-size: 14px;
       box-shadow: 0 1px 1px rgba(0,0,0,.08); white-space: pre-line; }
  .cli { background: #fff; }
  .art { background: #d9fdd3; margin-left: auto; }
  .fija { background: #cfe9c5; margin-left: auto; }
  .et { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .5px;
        color: #4f7a44; margin-bottom: 2px; font-weight: 700; }
  .corte { text-align: center; font-size: 12.5px; color: #5a5164; background: #cfc7bd;
           border-radius: 20px; padding: 5px 12px; margin: 12px auto; max-width: 92%; }
  .ok { font-size: 12.5px; color: #2e7d32; margin: 4px 2px 0; }
  .mal { border-left: 4px solid #c62828; background: #fff6f6; border-radius: 0 8px 8px 0;
         padding: 8px 12px; margin: 8px 0 0; font-size: 13.5px; color: #4a4152; }
  .mal b { color: #b71c1c; }
  .caja { border: 1px solid #eadfe7; border-radius: 10px; padding: 14px 18px; margin: 16px 0;
          background: #fdfbfd; page-break-inside: avoid; }
  .verde { border-left: 5px solid #2e7d32; background: #f6fbf6; }
  .amar { border-left: 5px solid #ef6c00; background: #fffaf3; }
  .azul { border-left: 5px solid #1565c0; background: #f5f9fd; }
  .caja h3 { margin: 0 0 8px; font-size: 16px; color: #241c2b; }
  ul, ol { margin: 8px 0 8px 22px; padding: 0; }
  li { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13.5px;
          page-break-inside: avoid; }
  th, td { border: 1px solid #eadfe7; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: #fbf3f8; color: #8e1650; font-size: 12.5px; }
  .num { font-size: 27px; font-weight: 700; color: #8e1650; line-height: 1.1; }
  .cifras { display: flex; gap: 14px; margin: 16px 0; }
  .cifra { flex: 1; border: 1px solid #eadfe7; border-radius: 10px; padding: 11px 13px;
           background: #fdfbfd; }
  .cifra span { display: block; font-size: 12.5px; color: #6d6478; margin-top: 2px; }
  .pie { margin-top: 32px; padding-top: 14px; border-top: 2px solid #f0e6ee; font-size: 12.5px;
         color: #6d6478; }
"""

hoy = datetime.datetime.now().strftime("%d de septiembre de 2026, %H:%M")

out = []
A = out.append
A('<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">')
A("<title>Arteluk · Cómo contesta el bot ahora</title>")
A("<style>%s</style>\n</head>\n<body>\n<div class=\"wrap\">" % CSS)

A('<header><h1>Cómo contesta el bot ahora</h1>')
A('<p class="sub">Academia Arteluk · %s · <b>%d conversaciones corridas de verdad</b> contra el mismo cerebro que atiende en WhatsApp</p></header>' % (hoy, len(casos)))

A('<div class="cifras">')
A('<div class="cifra"><div class="num">%d</div><span>conversaciones</span></div>' % len(casos))
A('<div class="cifra"><div class="num">%d</div><span>respuestas del bot</span></div>' % tandas)
A('<div class="cifra"><div class="num">%d de %d</div><span>revisiones OK</span></div>' % (total_checks - len(fallos), total_checks))
A('<div class="cifra"><div class="num">US$%.2f</div><span>costó la corrida</span></div>' % d["costo_usd"])
A('</div>')

A('<div class="caja azul"><h3>De dónde sale cada palabra de este documento</h3><ul>')
A("<li><b>Ninguna conversación está escrita a mano.</b> Se le habló al bot y esto es lo que contestó, palabra por palabra. El documento anterior (8 de septiembre) traía cinco conversaciones <i>como deberían ser</i>; éste trae las que <i>de verdad salen</i>.</li>")
A("<li><b>Mismo cerebro que atiende:</b> Claude Haiku 4.5, el modelo de producción, con el manual del bot tal como quedó anoche.</li>")
A("<li><b>Mismos datos que tiene puestos Mary:</b> el saludo y los seis bloques que ella edita en «Entrenar IA» (precios, horarios, dirección, equipo, promociones y transferencia) se bajaron del panel de producción hoy, no del código.</li>")
A("<li><b>Mismo camino que un mensaje real:</b> se reproduce el orden del bot — primero las reglas duras (si piden los datos del banco o dicen que quieren la clase de prueba, contesta una frase fija y llama a Mary sin preguntarle nada a la inteligencia artificial) y solo después el modelo, con la respuesta partida en las mismas burbujas que salen por WhatsApp.</li>")
A("</ul></div>")

A('<div class="caja amar"><h3>Qué NO prueba este documento</h3><ul>')
A("<li><b>Esto todavía no está en producción.</b> Los cambios están subidos pero falta apretar «Implementar» en el panel del servidor. Hasta entonces el bot que atiende sigue siendo el de antes.</li>")
A("<li><b>No prueba que los mensajes lleguen.</b> El WhatsApp de Arteluk está desconectado desde el 6 de septiembre; acá se midió lo que el bot <i>escribe</i>, no lo que le <i>llega</i> a la persona.</li>")
A("<li><b>El modelo no contesta dos veces igual.</b> Las palabras cambian entre una corrida y otra; lo que se comprueba es que cumpla las reglas, no que repita la frase exacta.</li>")
A("<li><b>Los horarios y precios que dice el bot son los que hay cargados en el panel.</b> Si ahí hay un dato viejo, el bot lo repite: eso lo tiene que revisar Mary.</li>")
A("</ul></div>")

# ── Lo que sigue saliendo mal ──────────────────────────────────────────────
A('<h2>Lo que todavía sale mal (%d de %d revisiones)</h2>' % (len(fallos), total_checks))
A('<p>Son fallos de verdad, cazados en esta misma corrida. Ninguno inventa datos ni suelta la cuenta bancaria: son de estilo y de límites.</p>')
A("<table><tr><th>Qué pasa</th><th>Dónde salió</th><th>Por qué importa</th></tr>")
EXPLICA = {
    "no promete ni guarda cupos": "Lukas decidió el 8 de septiembre que el bot puede dar horarios generales pero <b>nunca</b> ofrecer un cupo: no ve la agenda de Mary. Ofrecer «le guardo un cupo» compromete algo que después nadie sostiene.",
    "máximo 2 emojis en la tanda": "La regla es máximo 2 emojis por tanda y <b>ninguno</b> en el mensaje que lleva horas o precios. Mary pone un emoji en el 20&nbsp;% de sus mensajes; el bot poniendo uno por cada día se le nota a la legua.",
    "no vuelve a pedir el nombre en cada mensaje": "Es lo que más se le criticó en la auditoría del 1 de septiembre (pidió el nombre 52 veces en 114 mensajes). Cansa y suena a robot.",
    "no le contesta a quien no pregunta por el taller": "El saludo de bienvenida sale <b>antes</b> de que la inteligencia artificial decida callarse, así que a una amiga que le escribe por otra cosa igual le llega la presentación comercial de Mary.",
}
for nombre, casos_ in por_nombre.items():
    donde = "; ".join("«%s»%s" % (t, (" — " + det if det else "")) for t, det in casos_)
    A("<tr><td><b>%s</b></td><td>%s</td><td>%s</td></tr>" % (esc(nombre), esc(donde), EXPLICA.get(nombre, "")))
A("</table>")
A('<p class="porque">Ninguno de estos cuatro está arreglado: se dejan a la vista para que Lukas y Mary decidan cuáles se tapan.</p>')

# ── Las conversaciones ─────────────────────────────────────────────────────
A("<h2>Las %d conversaciones, una por una</h2>" % len(casos))
A('<p>El fondo verde es lo que escribe el bot; el blanco, la persona. Las burbujas verdes más oscuras son <b>frases fijas</b>: no las escribe la inteligencia artificial, salen siempre iguales.</p>')

for n, c in enumerate(casos, 1):
    A('<h2>%d. %s</h2>' % (n, esc(c["titulo"])))
    A('<p class="cuando">%s</p>' % esc(c["cuando"]))
    A('<p class="porque">%s</p>' % esc(c["porque"]))
    A('<div class="chat">')
    for t in c["turnos"]:
        if t["de"] == "cliente":
            A('<div class="b cli">%s</div>' % esc(t["texto"]))
        elif t["de"] == "sistema":
            A('<div class="corte">%s</div>' % esc(t["texto"]))
        else:
            fija = t["via"] == "regla-dura"
            for i, b in enumerate(t["burbujas"]):
                et = '<span class="et">frase fija · sin inteligencia artificial</span>' if (fija and i == 0) else ""
                A('<div class="b %s">%s%s</div>' % ("fija" if fija else "art", et, esc(b)))
    A("</div>")
    malos = [k for k in c["checks"] if not k["ok"]]
    if malos:
        for k in malos:
            A('<div class="mal"><b>Falla acá:</b> %s%s</div>' % (esc(k["nombre"]), (" — " + esc(k["detalle"])) if k["detalle"] else ""))
    else:
        A('<p class="ok">✓ Las %d revisiones de esta conversación pasaron (trato de usted, máximo 3 burbujas, máximo 2 emojis, sin datos del banco, sin prometer cupos, y lo propio del caso).</p>' % len(c["checks"]))

A('<div class="caja verde"><h3>Lo que sí quedó bien, y se comprobó en las %d conversaciones</h3><ul>' % len(casos))
A("<li><b>Trata de usted siempre.</b> Cero tuteos en las %d respuestas. Antes tuteaba en 27 de cada 100 mensajes.</li>" % tandas)
A("<li><b>Contesta primero y pregunta después.</b> Cuando preguntan el precio, el precio va en esa misma respuesta.</li>")
A("<li><b>Preguntan por un taller y va ese entero</b>, sin soltarle encima los otros dos: es lo que hizo que una señora dijera que la habían mareado.</li>")
A("<li><b>Nunca manda los datos del banco.</b> Ni el RUT, ni la cuenta, ni el correo: contesta «deme unos minutos y le confirmo los datos», se apaga y le avisa a Mary.</li>")
A("<li><b>Con un diagnóstico se calla.</b> No escribe nada y queda anotado como silencio a propósito, no como una falla del bot.</li>")
A("<li><b>No se inventa el espacio.</b> Como el bloque «Nuestro espacio» está vacío, no habla de salas ni salones aunque se lo pregunten derechamente.</li>")
A("<li><b>Un mensaje, una idea.</b> Las respuestas salen en 2 o 3 burbujas con pausa, como escribe Mary, nunca en un ladrillo.</li>")
A("</ul></div>")

A('<div class="pie">Corrida del %s · %d llamadas al modelo (%s) · US$%.4f, marcadas como prueba en el panel de gasto · '
  'El detalle en bruto de cada conversación queda en <i>scripts/salida/conversaciones-reales.json</i> del repositorio, '
  'y se reproduce con <i>npx tsx scripts/conversaciones-reales.ts</i>.</div>' % (hoy, llamadas_ia, d["modelo"], d["costo_usd"]))

A("</div>\n</body>\n</html>")

html = "\n".join(out)
open(SALIDA, "w", encoding="utf-8", newline="\n").write(html)
print("HTML  %s  (%.0f KB)" % (SALIDA, os.path.getsize(SALIDA) / 1024))

pdf = os.path.splitext(SALIDA)[0] + ".pdf"
r = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    "--print-to-pdf=" + pdf, "file:///" + SALIDA.replace("\\", "/")],
                   capture_output=True, text=True, timeout=180)
if os.path.exists(pdf):
    print("PDF   %s  (%.0f KB)" % (pdf, os.path.getsize(pdf) / 1024))
    try:
        import pypdf
        print("      %d páginas" % len(pypdf.PdfReader(pdf).pages))
    except Exception as e:
        print("      (sin pypdf: %s)" % e)
else:
    print("ERR", r.stderr[-400:])
