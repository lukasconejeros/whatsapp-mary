// Tool: actualizar_state_crm
// Persiste datos del paciente en Airtable CRM

export const actualizarCrmDefinition = {
  type: "function" as const,
  function: {
    name: "actualizar_state_crm",
    description:
      "Persiste datos recopilados del paciente en el CRM (Airtable). Llamar cada vez que el paciente comparta RUT, nombre, tratamiento, fecha o cualquier dato relevante.",
    parameters: {
      type: "object" as const,
      properties: {
        rec_id: { type: "string", description: "ID del registro en Airtable (si ya existe)" },
        phone: { type: "string", description: "Teléfono del paciente (para buscar si no hay rec_id)" },
        datos: {
          type: "object",
          description: "Campos a actualizar: rut, nombre, tratamiento, fecha, hora, doctor, notas",
        },
      },
      required: ["datos"],
    },
  },
};

async function airtablePatch(recId: string, fields: Record<string, unknown>): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_CRM ?? "tblWNTvj3PSOXY9vv";
  if (!token || !baseId) return;

  await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}/${recId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
}

async function findRecId(phone: string): Promise<string | null> {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_CRM ?? "tblWNTvj3PSOXY9vv";
  if (!token || !baseId) return null;

  const formula = encodeURIComponent(`SEARCH("${phone.replace(/\D/g, "")}", {Whatsapp_number})`);
  const resp = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${formula}&maxRecords=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  const data = (await resp.json()) as { records?: { id: string }[] };
  return data?.records?.[0]?.id ?? null;
}

export async function actualizarCrm(
  args: Record<string, unknown>,
  ctx: { phone?: string }
): Promise<Record<string, unknown>> {
  const datos = (args.datos as Record<string, unknown>) ?? {};
  let recId = args.rec_id ? String(args.rec_id) : null;
  const phone = args.phone ? String(args.phone) : ctx.phone ?? null;

  if (!recId && phone) {
    recId = await findRecId(phone);
  }

  if (!recId) return { ok: false, error: "No se encontró registro CRM para actualizar" };

  // Mapear campos a nombres de Airtable
  const fields: Record<string, unknown> = {};
  if (datos.rut) fields["RUT"] = String(datos.rut).toUpperCase();
  if (datos.nombre) fields["Nombre_paciente"] = datos.nombre;
  if (datos.tratamiento) fields["Tratamiento"] = datos.tratamiento;
  if (datos.notas || datos.fecha || datos.hora || datos.doctor) {
    const resumen = [
      datos.fecha && `Fecha: ${datos.fecha}`,
      datos.hora && `Hora: ${datos.hora}`,
      datos.doctor && `Doctor: ${datos.doctor}`,
      datos.notas && `Notas: ${datos.notas}`,
    ]
      .filter(Boolean)
      .join(" | ");
    fields["Datos_Recopilados_Activos"] = resumen;
  }

  try {
    await airtablePatch(recId, fields);
    return { ok: true, rec_id: recId, campos_actualizados: Object.keys(fields) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
