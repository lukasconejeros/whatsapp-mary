// ── FORMULARIOS ──────────────────────────────────────────────────────────────
//
// Encargo de Lukas (08-09-2026): poder armar un formulario desde el computador,
// mandárselo por WhatsApp a clientes nuevos o antiguos con un link, y que a la
// persona le llegue "bonito, minimalista, con este look", sin confundirse.
// La referencia que él pasó es https://tally.so/r/nGEA8z: una sola página, mucho
// aire, tipografía grande, sin cajas duras, un botón al final.
//
// ESTE ARCHIVO ES LÓGICA PURA: tipos, slug, tokens y validación. No toca la base
// ni React, para poder probarlo entero sin navegador (`npm run test:formularios`).
// La validación vive acá y NO en la pantalla a propósito: el link es público, y
// cualquiera puede mandar un POST a mano saltándose el HTML.

export type TipoPregunta =
  | "texto-corto"
  | "texto-largo"
  | "una-opcion"
  | "varias-opciones"
  | "escala"
  | "si-no"
  | "email"
  | "telefono";

export const TIPOS: TipoPregunta[] = [
  "texto-corto", "texto-largo", "una-opcion", "varias-opciones", "escala", "si-no", "email", "telefono",
];

/** Cómo se llama cada tipo en la pantalla de Mary, en cristiano. */
export const NOMBRE_TIPO: Record<TipoPregunta, string> = {
  "texto-corto": "Respuesta corta",
  "texto-largo": "Respuesta larga",
  "una-opcion": "Elegir una opción",
  "varias-opciones": "Elegir varias opciones",
  "escala": "Puntuación del 1 al 5",
  "si-no": "Sí o no",
  "email": "Correo",
  "telefono": "Teléfono",
};

export interface Pregunta {
  id: string;
  tipo: TipoPregunta;
  texto: string;
  /** Aclaración chica bajo la pregunta. Opcional. */
  ayuda?: string;
  /** Solo para 'una-opcion' y 'varias-opciones'. */
  opciones?: string[];
  obligatoria: boolean;
}

export interface Formulario {
  id: number;
  slug: string;
  titulo: string;
  /** Texto de bienvenida, arriba del todo. */
  intro: string;
  /** Lo que se ve después de enviar. */
  cierre: string;
  preguntas: Pregunta[];
  activo: boolean;
  created_at: number;
  updated_at: number;
}

export type Respuestas = Record<string, string | string[] | number>;

// ── Límites ──────────────────────────────────────────────────────────────────
// Están acá y no repartidos por el código para que el test los custodie de una.
export const LIMITES = {
  titulo: 120,
  intro: 600,
  cierre: 300,
  textoPregunta: 300,
  ayuda: 200,
  opcion: 120,
  maxPreguntas: 30,
  maxOpciones: 12,
  respuestaCorta: 300,
  respuestaLarga: 3000,
};

// ── Slug ─────────────────────────────────────────────────────────────────────
// El slug va en la URL que ve la persona (`/f/clase-de-prueba`). Sin tildes, sin
// espacios y sin nada raro: un link con caracteres escapados se ve a mensaje de
// estafa en WhatsApp, y eso es justo lo que él pidió evitar.
export function slugify(texto: string): string {
  const base = (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base || "formulario";
}

/** Slug libre: si `base` ya existe, prueba base-2, base-3… hasta encontrar hueco. */
export function slugLibre(base: string, existentes: string[]): string {
  const s = slugify(base);
  const usados = new Set(existentes.map((e) => e.toLowerCase()));
  if (!usados.has(s)) return s;
  for (let i = 2; i < 500; i++) {
    const c = `${s}-${i}`;
    if (!usados.has(c)) return c;
  }
  return `${s}-${Date.now().toString(36)}`;
}

// ── Token por persona ────────────────────────────────────────────────────────
// Un link distinto para cada destinatario: así se sabe QUIÉN respondió sin pedirle
// el teléfono dentro del formulario, y se puede impedir que conteste dos veces.
// 16 caracteres del alfabeto de abajo = 26^16 combinaciones: no se adivina.
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789"; // sin l/o/0/1: se confunden al leerlas

export function nuevoToken(azar: () => number = Math.random): string {
  let t = "";
  for (let i = 0; i < 16; i++) t += ALFABETO[Math.floor(azar() * ALFABETO.length)];
  return t;
}

export function esTokenValido(t: unknown): t is string {
  // Mismo alfabeto de arriba: todas las letras salvo la 'l' y la 'o', y los dígitos 2-9.
  return typeof t === "string" && /^[a-km-np-z2-9]{16}$/.test(t);
}

// ── Saneo de lo que Mary escribe al armar el formulario ──────────────────────

function limpiar(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

let contadorId = 0;
export function nuevoIdPregunta(): string {
  contadorId += 1;
  return `p${Date.now().toString(36)}${contadorId.toString(36)}`;
}

/**
 * Deja las preguntas en un estado en el que la pantalla pública no puede reventar:
 * tipo conocido, texto no vacío, y opciones obligatorias cuando el tipo las pide.
 * Una pregunta de opción SIN opciones se descarta (si se dejara, la persona vería
 * una pregunta obligatoria imposible de contestar y abandonaría el formulario).
 */
export function sanearPreguntas(entrada: unknown): Pregunta[] {
  if (!Array.isArray(entrada)) return [];
  const out: Pregunta[] = [];
  const ids = new Set<string>();
  for (const raw of entrada.slice(0, LIMITES.maxPreguntas)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const tipo = TIPOS.includes(r.tipo as TipoPregunta) ? (r.tipo as TipoPregunta) : "texto-corto";
    const texto = limpiar(r.texto, LIMITES.textoPregunta);
    if (!texto) continue;

    let opciones: string[] | undefined;
    if (tipo === "una-opcion" || tipo === "varias-opciones") {
      const brutas = Array.isArray(r.opciones) ? r.opciones : [];
      opciones = brutas
        .map((o) => limpiar(o, LIMITES.opcion))
        .filter((o, i, a) => o.length > 0 && a.indexOf(o) === i)
        .slice(0, LIMITES.maxOpciones);
      if (opciones.length < 2) continue; // una pregunta de opción con menos de 2 opciones no es una pregunta
    }

    let id = typeof r.id === "string" && /^[a-z0-9]{2,32}$/i.test(r.id) ? r.id : nuevoIdPregunta();
    while (ids.has(id)) id = nuevoIdPregunta();
    ids.add(id);

    const ayuda = limpiar(r.ayuda, LIMITES.ayuda);
    out.push({
      id,
      tipo,
      texto,
      ...(ayuda ? { ayuda } : {}),
      ...(opciones ? { opciones } : {}),
      obligatoria: r.obligatoria !== false,
    });
  }
  return out;
}

export interface FormularioInput {
  titulo: string;
  intro?: string;
  cierre?: string;
  preguntas: Pregunta[];
  activo?: boolean;
}

export function sanearFormulario(entrada: unknown): FormularioInput | null {
  if (!entrada || typeof entrada !== "object") return null;
  const r = entrada as Record<string, unknown>;
  const titulo = limpiar(r.titulo, LIMITES.titulo);
  if (!titulo) return null;
  const preguntas = sanearPreguntas(r.preguntas);
  if (preguntas.length === 0) return null; // un formulario sin preguntas no se guarda
  return {
    titulo,
    intro: limpiar(r.intro, LIMITES.intro),
    cierre: limpiar(r.cierre, LIMITES.cierre) || CIERRE_POR_DEFECTO,
    preguntas,
    activo: r.activo !== false,
  };
}

export const CIERRE_POR_DEFECTO = "¡Listo! Muchas gracias por responder 🎨";

// ── Validación de lo que CONTESTA la persona ─────────────────────────────────

export interface ResultadoValidacion {
  ok: boolean;
  /** id de pregunta → qué le falta, en cristiano, para pintarlo bajo la pregunta. */
  errores: Record<string, string>;
  /** Respuestas ya limpias y con el tipo correcto. Solo si ok. */
  limpias: Respuestas;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function validarRespuestas(preguntas: Pregunta[], entrada: unknown): ResultadoValidacion {
  const errores: Record<string, string> = {};
  const limpias: Respuestas = {};
  const src = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;

  for (const p of preguntas) {
    const v = src[p.id];
    const vacio =
      v === undefined || v === null || v === "" ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === "string" && v.trim() === "");

    if (vacio) {
      if (p.obligatoria) errores[p.id] = "Falta responder esta pregunta";
      continue;
    }

    switch (p.tipo) {
      case "texto-corto":
      case "telefono": {
        const s = String(v).trim().slice(0, LIMITES.respuestaCorta);
        if (p.tipo === "telefono" && (s.replace(/\D/g, "").length < 8)) {
          errores[p.id] = "Ese teléfono se ve incompleto";
          break;
        }
        limpias[p.id] = s;
        break;
      }
      case "texto-largo":
        limpias[p.id] = String(v).trim().slice(0, LIMITES.respuestaLarga);
        break;
      case "email": {
        const s = String(v).trim().slice(0, LIMITES.respuestaCorta);
        if (!RE_EMAIL.test(s)) { errores[p.id] = "Ese correo no se ve bien escrito"; break; }
        limpias[p.id] = s;
        break;
      }
      case "si-no": {
        const s = String(v).trim().toLowerCase();
        if (s !== "sí" && s !== "si" && s !== "no") { errores[p.id] = "Responda sí o no"; break; }
        limpias[p.id] = s === "no" ? "No" : "Sí";
        break;
      }
      case "escala": {
        const n = Math.round(Number(v));
        if (!Number.isFinite(n) || n < 1 || n > 5) { errores[p.id] = "Elija un número del 1 al 5"; break; }
        limpias[p.id] = n;
        break;
      }
      case "una-opcion": {
        const s = String(v).trim();
        if (!(p.opciones ?? []).includes(s)) { errores[p.id] = "Elija una de las opciones"; break; }
        limpias[p.id] = s;
        break;
      }
      case "varias-opciones": {
        const arr = (Array.isArray(v) ? v : [v]).map((x) => String(x).trim());
        const validas = arr.filter((x) => (p.opciones ?? []).includes(x));
        const unicas = validas.filter((x, i, a) => a.indexOf(x) === i);
        if (unicas.length === 0) { errores[p.id] = "Elija al menos una opción"; break; }
        limpias[p.id] = unicas;
        break;
      }
    }
  }

  return { ok: Object.keys(errores).length === 0, errores, limpias };
}

/** Cómo se lee una respuesta en la pantalla de resultados. */
export function respuestaEnTexto(v: string | string[] | number | undefined): string {
  if (v === undefined || v === null) return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "number") return `${v} de 5`;
  return v;
}

// ── El link ──────────────────────────────────────────────────────────────────
// Sale de APP_URL. Si no está puesta, se usa lo que diga el navegador al armar la
// pantalla; nunca se inventa un dominio: un link roto en un envío masivo es peor
// que no mandarlo.
export function baseUrl(): string {
  const raw = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  return raw;
}

export function linkFormulario(slug: string, token?: string | null, base?: string): string {
  const b = (base ?? baseUrl()).replace(/\/+$/, "");
  const path = `/f/${encodeURIComponent(slug)}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
  return b ? `${b}${path}` : path;
}

// ── El mensaje que acompaña al link ──────────────────────────────────────────
// Corto, de usted, una sola idea, y el link SIEMPRE en su propia línea al final:
// pegado a una frase, WhatsApp a veces se come el último carácter del enlace.
export const MSG_FORMULARIO_KEY = "msg_formulario";

export const MENSAJE_FORMULARIO_DEFAULT =
  "¡Hola {nombre}! 🎨 Soy Mary, de Arteluk. Le dejo unas preguntitas cortas que nos ayudan un montón a acompañar mejor a los niños. Son 2 minutos y se responden desde el mismo teléfono.\n\n{link}";

/**
 * Arma el mensaje final. `{nombre}` y `{link}` son los únicos tokens.
 * Si la plantilla no trae `{link}`, se pega al final igual: el objetivo del envío
 * es el link, y un envío masivo sin él son 35 mensajes tirados a la basura.
 */
export function armarMensaje(plantilla: string, nombre: string | null | undefined, link: string): string {
  const n = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  let txt = (plantilla || MENSAJE_FORMULARIO_DEFAULT)
    .replace(/\{nombre\}/gi, n)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/¡Hola\s+!/g, "¡Hola!")
    .replace(/Hola\s+,/g, "Hola,")
    .replace(/\s+([.!?,])/g, "$1");
  if (txt.includes("{link}")) txt = txt.replace(/\{link\}/gi, link);
  else txt = `${txt.trim()}\n\n${link}`;
  return txt.trim();
}
