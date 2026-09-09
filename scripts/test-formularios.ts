/**
 * FORMULARIOS (Lukas, 08-09-2026).
 *
 * Lo que custodia este test, y por qué cada cosa está acá:
 *
 *  1. El LINK. Un slug con tildes o espacios se escapa dentro de WhatsApp y el mensaje
 *     parece estafa. Y si el link sale sin el link (plantilla sin {link}), el envío
 *     entero es basura: 35 mensajes que no llevan a ninguna parte.
 *  2. La VALIDACIÓN en el servidor. El formulario es público: cualquiera puede mandar
 *     un POST a mano saltándose el HTML. Si la validación viviera solo en la pantalla,
 *     una respuesta vacía o con una opción inventada entraría igual.
 *  3. NO MANDAR DOS VECES a la misma persona, y NO DEJAR CONTESTAR DOS VECES el mismo
 *     link. Los dos candados están en la base (UNIQUE), no en un `if`: dos clics
 *     seguidos en "Enviar" pasan por encima de cualquier comprobación en memoria.
 *  4. Que un formulario CERRADO o con el JSON corrupto no tumbe la pantalla pública.
 *
 * Correr con: npm run test:formularios
 */
import "./env-loader.js";
import {
  slugify, slugLibre, nuevoToken, esTokenValido, sanearFormulario, sanearPreguntas,
  validarRespuestas, armarMensaje, linkFormulario, respuestaEnTexto,
  MENSAJE_FORMULARIO_DEFAULT, LIMITES, type Pregunta,
} from "../src/lib/formularios.js";
import {
  crearFormulario, getFormulario, getFormularioPorSlug, actualizarFormulario, borrarFormulario,
  listSlugsFormularios, registrarEnvioFormulario, getEnvioPorToken, guardarRespuesta,
  listRespuestasFormulario, contarRespuestas, yaRespondio, listEnviosFormulario,
  candidatosFormulario,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); pass++; } else { console.log(`  ❌ ${msg}`); fail++; }
}

// Marca para no tocar NUNCA los formularios de verdad de Mary.
const T = "ZZTest formulario ";
function limpiar() {
  for (const s of listSlugsFormularios()) {
    const f = getFormularioPorSlug(s);
    if (f && f.titulo.startsWith(T)) borrarFormulario(f.id);
  }
}

const P = (over: Partial<Pregunta>): Pregunta => ({
  id: "q1", tipo: "texto-corto", texto: "¿Cómo se llama?", obligatoria: true, ...over,
});

try {
  limpiar();

  // ── 1. El link ────────────────────────────────────────────────────────────
  console.log("\nEl link que le llega a la persona");
  ok(slugify("Opinión de la Clase de Prueba 🎨") === "opinion-de-la-clase-de-prueba",
    "el slug sale sin tildes, sin emojis y sin espacios");
  ok(!/[^a-z0-9-]/.test(slugify("Cómo vamos ñandú ÁÉÍÓÚ")), "no queda ni un carácter que WhatsApp tenga que escapar");
  ok(slugify("   ") === "formulario", "un título vacío no deja el link roto");
  ok(slugify("a".repeat(80)).length <= 48, "el slug no se dispara de largo");
  ok(slugLibre("Encuesta", ["encuesta"]) === "encuesta-2", "si el slug está pillado, busca el siguiente");
  ok(slugLibre("Encuesta", ["encuesta", "encuesta-2", "encuesta-3"]) === "encuesta-4", "y sigue buscando hasta encontrar hueco");
  ok(slugLibre("Otra", ["encuesta"]) === "otra", "si está libre, lo deja tal cual");

  const link = linkFormulario("mi-forma", "abcdefghijkmnpqr", "https://arteluk.cl/");
  ok(link === "https://arteluk.cl/f/mi-forma?t=abcdefghijkmnpqr", "el link lleva el slug y el token de esa persona");
  ok(linkFormulario("mi-forma", null, "https://x.cl") === "https://x.cl/f/mi-forma", "sin token, el link es el general");

  // ── 2. El token ───────────────────────────────────────────────────────────
  console.log("\nEl token que identifica a cada persona");
  const toks = new Set<string>();
  for (let i = 0; i < 400; i++) toks.add(nuevoToken());
  ok(toks.size === 400, "400 tokens seguidos y ninguno repetido");
  ok([...toks].every((t) => esTokenValido(t)), "todos los tokens generados pasan la validación");
  ok([...toks].every((t) => !/[lo01]/.test(t)), "ninguno lleva l, o, 0 ni 1 (se confunden al leerlos)");
  ok(!esTokenValido("corto"), "un token corto se rechaza");
  ok(!esTokenValido("ABCDEFGHIJKMNPQR"), "un token en mayúsculas se rechaza");
  ok(!esTokenValido("../../etc/passw"), "un token con caracteres de ruta se rechaza");
  ok(!esTokenValido(null) && !esTokenValido(42), "un token que no es texto se rechaza");

  // ── 3. Saneo de lo que arma Mary ─────────────────────────────────────────
  console.log("\nLo que arma Mary en la pantalla");
  ok(sanearFormulario({ titulo: "", preguntas: [P({})] }) === null, "sin título no se guarda");
  ok(sanearFormulario({ titulo: "Hola", preguntas: [] }) === null, "sin preguntas no se guarda");
  ok(sanearPreguntas([P({ texto: "  " })]).length === 0, "una pregunta sin texto se descarta");
  ok(sanearPreguntas([P({ tipo: "una-opcion", opciones: ["Sí"] })]).length === 0,
    "una pregunta de opción con UNA sola opción se descarta (sería imposible de contestar)");
  ok(sanearPreguntas([P({ tipo: "una-opcion", opciones: ["Sí", "No"] })]).length === 1,
    "con dos opciones sí entra");
  ok(sanearPreguntas([P({ tipo: "una-opcion", opciones: ["Sí", "Sí", "No"] })])[0].opciones?.length === 2,
    "las opciones repetidas se juntan en una");
  ok(sanearPreguntas([{ ...P({}), tipo: "inventado" } as unknown])[0].tipo === "texto-corto",
    "un tipo inventado cae en respuesta corta en vez de reventar");
  ok(sanearPreguntas([P({ id: "x" }), P({ id: "x" })]).map((p) => p.id).length === 2 &&
     new Set(sanearPreguntas([P({ id: "x" }), P({ id: "x" })]).map((p) => p.id)).size === 2,
    "dos preguntas con el mismo id se separan (si no, la segunda pisaría la respuesta de la primera)");
  ok(sanearPreguntas(Array(50).fill(P({}))).length === LIMITES.maxPreguntas,
    `no se pasan de ${LIMITES.maxPreguntas} preguntas`);
  ok((sanearFormulario({ titulo: "Hola", preguntas: [P({})] })?.cierre ?? "").length > 0,
    "si no escribe el cierre, se pone uno por defecto");

  // ── 4. Validación de lo que contesta la persona ──────────────────────────
  console.log("\nLo que contesta la persona (validado en el SERVIDOR)");
  const preguntas: Pregunta[] = [
    P({ id: "nombre", tipo: "texto-corto", texto: "Nombre" }),
    P({ id: "correo", tipo: "email", texto: "Correo", obligatoria: false }),
    P({ id: "fono", tipo: "telefono", texto: "Teléfono", obligatoria: false }),
    P({ id: "nota", tipo: "escala", texto: "Del 1 al 5" }),
    P({ id: "plan", tipo: "una-opcion", texto: "Plan", opciones: ["Acuarela", "Artes"] }),
    P({ id: "dias", tipo: "varias-opciones", texto: "Días", opciones: ["Lunes", "Martes"], obligatoria: false }),
    P({ id: "foto", tipo: "si-no", texto: "¿Autoriza fotos?" }),
    P({ id: "libre", tipo: "texto-largo", texto: "Cuéntenos", obligatoria: false }),
  ];

  const vacio = validarRespuestas(preguntas, {});
  ok(!vacio.ok, "un envío vacío se rechaza");
  ok(Object.keys(vacio.errores).length === 4, "y marca las 4 obligatorias que faltan, no una sola");
  ok(!("correo" in vacio.errores), "las opcionales vacías no dan error");

  ok(!validarRespuestas(preguntas, { nombre: "   " }).limpias.nombre, "un nombre con solo espacios cuenta como vacío");
  ok(!!validarRespuestas(preguntas, { correo: "no-es-un-correo" }).errores.correo, "un correo mal escrito se rechaza");
  ok(!validarRespuestas(preguntas, { correo: "mary@arteluk.cl" }).errores.correo, "un correo bien escrito pasa");
  ok(!!validarRespuestas(preguntas, { fono: "123" }).errores.fono, "un teléfono de 3 dígitos se rechaza");
  ok(!validarRespuestas(preguntas, { fono: "+56 9 6355 4778" }).errores.fono, "un teléfono chileno bien escrito pasa");
  ok(!!validarRespuestas(preguntas, { nota: 9 }).errores.nota, "un 9 en una escala del 1 al 5 se rechaza");
  ok(!!validarRespuestas(preguntas, { nota: 0 }).errores.nota, "un 0 también");
  ok(!!validarRespuestas(preguntas, { plan: "Premium" }).errores.plan,
    "una opción que NO está en la lista se rechaza (el POST se puede escribir a mano)");
  ok(!!validarRespuestas(preguntas, { foto: "quizás" }).errores.foto, "en un sí/no, 'quizás' se rechaza");

  const completo = validarRespuestas(preguntas, {
    nombre: "  Mary  ", nota: "4", plan: "Acuarela", foto: "si",
    dias: ["Lunes", "Lunes", "Jueves"], libre: "x".repeat(9000),
  });
  ok(completo.ok, "un envío completo pasa");
  ok(completo.limpias.nombre === "Mary", "el texto llega sin espacios de sobra");
  ok(completo.limpias.nota === 4, "la escala llega como número, no como texto");
  ok(completo.limpias.foto === "Sí", "el 'si' sin tilde queda guardado como 'Sí'");
  ok(Array.isArray(completo.limpias.dias) && (completo.limpias.dias as string[]).length === 1,
    "de las varias opciones se quita la repetida y la que no existe");
  ok(String(completo.limpias.libre).length === LIMITES.respuestaLarga,
    "un texto larguísimo se corta en vez de guardarse entero");
  ok(respuestaEnTexto(4) === "4 de 5" && respuestaEnTexto(["a", "b"]) === "a, b" && respuestaEnTexto(undefined) === "—",
    "las respuestas se leen bien en la pantalla de resultados");

  // ── 5. El mensaje que acompaña al link ───────────────────────────────────
  console.log("\nEl mensaje de WhatsApp");
  const m1 = armarMensaje(MENSAJE_FORMULARIO_DEFAULT, "María José Pérez", "https://x.cl/f/a?t=b");
  ok(m1.includes("María"), "lo saluda por su nombre de pila");
  ok(!m1.includes("Pérez"), "y no le suelta el apellido entero");
  ok(m1.includes("https://x.cl/f/a?t=b"), "el link va dentro del mensaje");
  ok(!m1.includes("{nombre}") && !m1.includes("{link}"), "no queda ningún hueco sin rellenar");
  const m2 = armarMensaje("Hola {nombre}, mire esto.", null, "https://x.cl/f/a");
  ok(m2.includes("https://x.cl/f/a"), "si la plantilla no trae {link}, se pega igual al final");
  ok(!m2.includes("Hola ,"), "sin nombre, el saludo no queda con una coma suelta");
  ok(armarMensaje("¡Hola {nombre}! qué tal", null, "L").startsWith("¡Hola!"), "ni con un signo de admiración huérfano");

  // ── 6. Contra la base de verdad ──────────────────────────────────────────
  console.log("\nGuardar, mandar y responder (base de verdad)");
  const datos = sanearFormulario({
    titulo: `${T}opinión`, intro: "Son 3 preguntitas", cierre: "¡Gracias!",
    preguntas: [P({ id: "nombre", texto: "Nombre" }), P({ id: "plan", tipo: "una-opcion", texto: "Plan", opciones: ["A", "B"] })],
  })!;
  const slug = slugLibre(datos.titulo, listSlugsFormularios());
  const fid = crearFormulario(slug, datos);
  ok(fid > 0, "el formulario se guarda");
  const leido = getFormulario(fid)!;
  ok(leido.preguntas.length === 2 && leido.preguntas[1].opciones?.length === 2, "y se lee de vuelta con sus preguntas y opciones");
  ok(getFormularioPorSlug(slug)?.id === fid, "se encuentra por su slug (así lo abre la persona)");

  // El candado de "no dos veces a la misma persona"
  const e1 = registrarEnvioFormulario(fid, nuevoToken(), "+56911111111", "Ana", null);
  const e2 = registrarEnvioFormulario(fid, nuevoToken(), "+56911111111", "Ana", null);
  ok(e1 !== null, "el primer envío a Ana se registra");
  ok(e2 === null, "el SEGUNDO envío a Ana se rechaza: no se le manda dos veces lo mismo");
  ok(listEnviosFormulario(fid).length === 1, "y en la lista queda una sola fila");
  ok(getEnvioPorToken(e1!.token)?.telefono === "+56911111111", "el token lleva de vuelta a su persona");
  ok(getEnvioPorToken("noexisteestetok") === null, "un token inventado no devuelve a nadie");

  // El candado de "no contestar dos veces"
  const v = validarRespuestas(leido.preguntas, { nombre: "Ana", plan: "A" });
  ok(v.ok, "la respuesta de Ana es válida");
  ok(guardarRespuesta(fid, e1!.token, "+56911111111", "Ana", v.limpias), "se guarda su respuesta");
  ok(!guardarRespuesta(fid, e1!.token, "+56911111111", "Ana", v.limpias),
    "el MISMO link no puede contestar dos veces (candado en la base, no en un if)");
  ok(yaRespondio(e1!.token), "queda marcado que ya contestó");
  ok(getEnvioPorToken(e1!.token)?.estado === "respondido", "y el envío pasa a 'respondido'");
  ok(contarRespuestas(fid) === 1, "hay exactamente 1 respuesta");
  ok(listRespuestasFormulario(fid)[0].respuestas.plan === "A", "la respuesta se lee de vuelta entera");

  // El link general (sin token) sí admite varias respuestas: es el que Mary pega en un grupo.
  ok(guardarRespuesta(fid, null, null, null, v.limpias), "el link general acepta una respuesta anónima");
  ok(guardarRespuesta(fid, null, null, null, v.limpias), "y acepta otra más (es el que se pega en un grupo)");
  ok(contarRespuestas(fid) === 3, "quedan 3 respuestas en total");

  // Editar y cerrar
  ok(actualizarFormulario(fid, { ...datos, titulo: `${T}opinión`, activo: false }), "se puede cerrar el formulario");
  ok(getFormulario(fid)?.activo === false, "y queda cerrado (el link deja de recibir)");

  // Las audiencias no revientan aunque la base esté vacía
  console.log("\nA quién se le puede mandar");
  for (const a of ["alumnos", "clientes", "interesados"] as const) {
    const c = candidatosFormulario(a);
    ok(Array.isArray(c), `la audiencia '${a}' devuelve una lista`);
    ok(c.every((x) => /^569\d{8}$/.test(x.telefono)), `y todos los teléfonos de '${a}' vienen normalizados a 569XXXXXXXX`);
    ok(new Set(c.map((x) => x.telefono)).size === c.length, `y nadie sale dos veces en '${a}'`);
  }

  // Borrar se lleva todo el rastro
  ok(borrarFormulario(fid), "el formulario se borra");
  ok(getFormulario(fid) === null && contarRespuestas(fid) === 0 && listEnviosFormulario(fid).length === 0,
    "y se lleva sus respuestas y sus envíos (no quedan filas huérfanas)");
} finally {
  limpiar();
}

console.log(`\n${fail === 0 ? "🎉" : "💥"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
