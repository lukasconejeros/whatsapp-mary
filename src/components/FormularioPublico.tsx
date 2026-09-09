"use client";

// EL FORMULARIO TAL COMO LO VE LA PERSONA.
//
// Referencia que pasó Lukas: https://tally.so/r/nGEA8z. Lo que se copia de ahí:
//   · una sola página, se baja con el dedo — nada de "pregunta 1 de 8", que da pereza;
//   · muchísimo aire entre preguntas (48 px), para que se lea una a la vez;
//   · tipografía grande (la pregunta a 19 px, no a 14);
//   · sin cajas con borde: los campos son una línea de abajo que se pinta al escribir;
//   · las opciones son botones grandes de tocar, no radios de 13 px;
//   · un solo botón al final, ancho, y nada más en la pantalla.
// Lo que se cambia respecto de Tally: el verde de Arteluk (#00A884) y la Inter de la app.
//
// Los errores se pintan BAJO cada pregunta y se baja solo hasta la primera que falta:
// en el teléfono, un "revisa el formulario" arriba del todo deja a la persona sin saber
// qué le falta y abandona.

import { useState, useRef, useCallback } from "react";
import type { Pregunta } from "@/lib/formularios";

const VERDE = "#00A884";
const VERDE_SUAVE = "#E7F1EC";
const TINTA = "#1F2A37";
const GRIS = "#6B7280";
const LINEA = "#E5E7EB";
const ROJO = "#C2410C";

type Valor = string | string[] | number | undefined;

export default function FormularioPublico(props: {
  slug: string;
  titulo: string;
  intro: string;
  cierre: string;
  preguntas: Pregunta[];
  nombre: string | null;
  token: string | null;
  yaContesto: boolean;
}) {
  const { slug, titulo, intro, cierre, preguntas, nombre, token } = props;
  const [valores, setValores] = useState<Record<string, Valor>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(props.yaContesto);
  const [errorGeneral, setErrorGeneral] = useState("");
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const set = useCallback((id: string, v: Valor) => {
    setValores((p) => ({ ...p, [id]: v }));
    // El error se borra en cuanto empieza a corregir: dejarlo puesto mientras escribe
    // es lo que hace que parezca que el formulario está roto.
    setErrores((p) => (p[id] ? { ...p, [id]: "" } : p));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErrorGeneral("");
    try {
      const r = await fetch(`/api/f/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, respuestas: valores }),
      });
      const j = (await r.json()) as { ok: boolean; errores?: Record<string, string>; error?: string };
      if (j.ok) { setListo(true); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (j.errores) {
        setErrores(j.errores);
        const primera = preguntas.find((p) => j.errores?.[p.id]);
        if (primera) refs.current[primera.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setErrorGeneral(j.error ?? "No se pudo enviar. Inténtelo de nuevo en un momento.");
      }
    } catch {
      // Se abre desde WhatsApp, muchas veces con mala señal: el mensaje tiene que decir
      // qué hacer, no "Error de red".
      setErrorGeneral("No se pudo enviar. Revise su conexión y toque enviar otra vez.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <Marco>
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 44, marginBottom: 18 }}>🎨</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: TINTA, lineHeight: 1.3, marginBottom: 12 }}>
            {cierre || "¡Listo! Muchas gracias por responder"}
          </h1>
          <p style={{ fontSize: 16, color: GRIS, lineHeight: 1.6 }}>Ya tenemos su respuesta. Arteluk 💚</p>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <form onSubmit={enviar} noValidate>
        <header style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 30, marginBottom: 14 }}>🎨</div>
          <h1 style={{ fontSize: 27, fontWeight: 700, color: TINTA, lineHeight: 1.25, letterSpacing: "-0.02em" }}>
            {nombre ? `${titulo}` : titulo}
          </h1>
          {(intro || nombre) && (
            <p style={{ marginTop: 14, fontSize: 16.5, color: GRIS, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
              {nombre ? `Hola ${nombre}. ` : ""}{intro}
            </p>
          )}
        </header>

        {preguntas.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => { refs.current[p.id] = el; }}
            style={{ marginBottom: 48, scrollMarginTop: 24 }}
          >
            <label
              htmlFor={`c-${p.id}`}
              style={{ display: "block", fontSize: 19, fontWeight: 600, color: TINTA, lineHeight: 1.4 }}
            >
              <span style={{ color: GRIS, fontWeight: 500, marginRight: 8 }}>{i + 1}.</span>
              {p.texto}
              {p.obligatoria && <span style={{ color: VERDE, marginLeft: 4 }}>*</span>}
            </label>
            {p.ayuda && (
              <p style={{ marginTop: 6, fontSize: 14.5, color: GRIS, lineHeight: 1.55 }}>{p.ayuda}</p>
            )}

            <div style={{ marginTop: 16 }}>
              <Campo pregunta={p} valor={valores[p.id]} onChange={(v) => set(p.id, v)} />
            </div>

            {errores[p.id] && (
              <p style={{ marginTop: 10, fontSize: 14.5, color: ROJO, fontWeight: 500 }}>{errores[p.id]}</p>
            )}
          </div>
        ))}

        {errorGeneral && (
          <p style={{ marginBottom: 18, fontSize: 15, color: ROJO, fontWeight: 500, lineHeight: 1.5 }}>{errorGeneral}</p>
        )}

        <button
          type="submit"
          disabled={enviando}
          style={{
            width: "100%", padding: "17px 20px", fontSize: 17, fontWeight: 600,
            color: "#fff", background: enviando ? "#7FD4BF" : VERDE, border: "none",
            borderRadius: 12, cursor: enviando ? "default" : "pointer",
            fontFamily: "inherit", marginBottom: 10,
          }}
        >
          {enviando ? "Enviando…" : "Enviar respuestas"}
        </button>
        <p style={{ textAlign: "center", fontSize: 13.5, color: "#9CA3AF", marginBottom: 8 }}>
          Sus respuestas las ve solo Arteluk.
        </p>
      </form>
    </Marco>
  );
}

// ── El marco: blanco, centrado, ancho de lectura y nada más en pantalla ─────
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: "#FFFFFF", padding: "48px 22px 72px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
      <div style={{ maxWidth: 560, margin: "40px auto 0", textAlign: "center", fontSize: 13, color: "#B6BDC7" }}>
        Arteluk · Arte &amp; Arteterapia
      </div>
    </main>
  );
}

// ── Los campos ──────────────────────────────────────────────────────────────
// Sin bordes de caja: una línea abajo que se pone verde al escribir. Las opciones son
// botones grandes (mínimo 52 px de alto) porque esto se contesta con el pulgar.

const estiloLinea: React.CSSProperties = {
  width: "100%", padding: "12px 2px", fontSize: 17, color: TINTA,
  border: "none", borderBottom: `2px solid ${LINEA}`, outline: "none",
  background: "transparent", fontFamily: "inherit", borderRadius: 0,
};

function Campo({ pregunta, valor, onChange }: {
  pregunta: Pregunta; valor: Valor; onChange: (v: Valor) => void;
}) {
  const [foco, setFoco] = useState(false);
  const linea = { ...estiloLinea, borderBottomColor: foco ? VERDE : LINEA };
  const id = `c-${pregunta.id}`;

  switch (pregunta.tipo) {
    case "texto-largo":
      return (
        <textarea
          id={id} rows={3} value={(valor as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
          placeholder="Escriba aquí…"
          style={{ ...linea, resize: "vertical", lineHeight: 1.6 }}
        />
      );

    case "email":
    case "telefono":
    case "texto-corto":
      return (
        <input
          id={id}
          type={pregunta.tipo === "email" ? "email" : pregunta.tipo === "telefono" ? "tel" : "text"}
          inputMode={pregunta.tipo === "telefono" ? "tel" : undefined}
          value={(valor as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
          placeholder={pregunta.tipo === "email" ? "nombre@correo.com" : pregunta.tipo === "telefono" ? "+56 9 …" : "Escriba aquí…"}
          style={linea}
        />
      );

    case "si-no":
      return (
        <Opciones
          opciones={["Sí", "No"]}
          elegidas={valor ? [String(valor)] : []}
          onToggle={(o) => onChange(o)}
        />
      );

    case "una-opcion":
      return (
        <Opciones
          opciones={pregunta.opciones ?? []}
          elegidas={valor ? [String(valor)] : []}
          onToggle={(o) => onChange(o === valor ? undefined : o)}
        />
      );

    case "varias-opciones": {
      const actuales = Array.isArray(valor) ? valor : [];
      return (
        <Opciones
          opciones={pregunta.opciones ?? []}
          elegidas={actuales}
          multiple
          onToggle={(o) => onChange(actuales.includes(o) ? actuales.filter((x) => x !== o) : [...actuales, o])}
        />
      );
    }

    case "escala":
      return (
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const activo = Number(valor) === n;
            return (
              <button
                key={n} type="button" onClick={() => onChange(activo ? undefined : n)}
                aria-pressed={activo}
                style={{
                  flex: 1, height: 54, fontSize: 18, fontWeight: 600, fontFamily: "inherit",
                  color: activo ? "#fff" : TINTA, background: activo ? VERDE : VERDE_SUAVE,
                  border: `2px solid ${activo ? VERDE : "transparent"}`, borderRadius: 12, cursor: "pointer",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      );
  }
}

function Opciones({ opciones, elegidas, onToggle, multiple }: {
  opciones: string[]; elegidas: string[]; onToggle: (o: string) => void; multiple?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {opciones.map((o) => {
        const activo = elegidas.includes(o);
        return (
          <button
            key={o} type="button" onClick={() => onToggle(o)} aria-pressed={activo}
            style={{
              display: "flex", alignItems: "center", gap: 12, minHeight: 54,
              padding: "14px 16px", textAlign: "left", fontSize: 16.5, fontFamily: "inherit",
              color: TINTA, background: activo ? VERDE_SUAVE : "#F8FAF9",
              border: `2px solid ${activo ? VERDE : "transparent"}`,
              borderRadius: 12, cursor: "pointer", lineHeight: 1.4,
            }}
          >
            <span
              aria-hidden
              style={{
                flex: "0 0 auto", width: 22, height: 22,
                borderRadius: multiple ? 6 : 999,
                border: `2px solid ${activo ? VERDE : "#CBD5D1"}`,
                background: activo ? VERDE : "#fff",
                display: "grid", placeItems: "center", color: "#fff", fontSize: 13, fontWeight: 700,
              }}
            >
              {activo ? "✓" : ""}
            </span>
            {o}
          </button>
        );
      })}
    </div>
  );
}
