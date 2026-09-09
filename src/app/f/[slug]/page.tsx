// LA PANTALLA QUE VE LA PERSONA. Es lo único de la app que se abre sin login.
//
// Look pedido por Lukas: como https://tally.so/r/nGEA8z — una sola página, mucho aire,
// tipografía grande, sin cajas duras, un botón al final. "Totalmente minimalista" y que
// no se confunda. Por eso: nada de menú, nada de barra de la app, nada de enlaces a
// otras pantallas. Solo el formulario.
//
// Se lee de la base aquí, en el servidor, y no con un fetch desde el navegador: así la
// persona ve el formulario en el primer pintado, sin un segundo en blanco (se abre desde
// un link de WhatsApp, muchas veces con mala señal).
import { getFormularioPorSlug, getEnvioPorToken } from "@/lib/db";
import { esTokenValido } from "@/lib/formularios";
import FormularioPublico from "@/components/FormularioPublico";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const f = getFormularioPorSlug(slug);
  // El título es lo que se ve en la vista previa del link dentro de WhatsApp: si dijera
  // "Panel de Mary" parecería un enlace equivocado y nadie lo abriría.
  return {
    title: f?.activo ? `${f.titulo} · Arteluk` : "Arteluk",
    description: f?.intro?.slice(0, 160) || "Academia de arte y arteterapia · Arteluk",
    robots: { index: false, follow: false },
  };
}

export default async function PaginaFormulario({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const f = getFormularioPorSlug(slug);

  if (!f || !f.activo || f.preguntas.length === 0) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 32, background: "#fff" }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
            Este formulario ya está cerrado
          </h1>
          <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.6 }}>
            Si tiene alguna duda, escríbanos por WhatsApp y le ayudamos.
          </p>
        </div>
      </main>
    );
  }

  // El token identifica a la persona a la que Mary le mandó el link. Sirve para dos
  // cosas y ninguna más: saludarla por su nombre y no dejar que conteste dos veces.
  const tParam = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  let nombre: string | null = null;
  let yaContesto = false;
  let token: string | null = null;
  if (esTokenValido(tParam)) {
    const e = getEnvioPorToken(tParam);
    if (e && e.formulario_id === f.id) {
      token = e.token;
      nombre = e.nombre ? e.nombre.trim().split(/\s+/)[0] : null;
      yaContesto = e.estado === "respondido";
    }
  }

  return (
    <FormularioPublico
      slug={f.slug}
      titulo={f.titulo}
      intro={f.intro}
      cierre={f.cierre}
      preguntas={f.preguntas}
      nombre={nombre}
      token={token}
      yaContesto={yaContesto}
    />
  );
}
