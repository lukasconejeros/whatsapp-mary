// Tool: buscar_paciente_crm
// Busca un paciente en Airtable CRM por teléfono o RUT

export const buscarPacienteDefinition = {
  type: "function" as const,
  function: {
    name: "buscar_paciente_crm",
    description:
      "Busca los datos de un paciente en el CRM (Airtable) por teléfono o RUT. Devuelve nombre, rut, id_paciente_dentalink y datos previos. Usar cuando necesites saber si el paciente está en el sistema antes de agendar.",
    parameters: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Número de teléfono sin + (ej: 56912345678)" },
        rut: { type: "string", description: "RUT chileno (ej: 12345678-9 o 12345678-K)" },
      },
    },
  },
};

async function airtableGet(path: string): Promise<unknown> {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) throw new Error("Faltan credenciales Airtable");

  const resp = await fetch(`https://api.airtable.com/v0/${baseId}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Airtable ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

function normRut(rut: string): string {
  return rut.replace(/\./g, "").toUpperCase().trim();
}

export async function buscarPaciente(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const phone = args.phone ? String(args.phone).replace(/\D/g, "") : null;
  const rut = args.rut ? normRut(String(args.rut)) : null;
  const tableId = process.env.AIRTABLE_TABLE_CRM ?? "tblWNTvj3PSOXY9vv";

  if (!phone && !rut) {
    return { ok: false, error: "Proporcionar phone o rut para buscar" };
  }

  try {
    let formula = "";
    if (phone) {
      formula = `SEARCH("${phone}", {Whatsapp_number})`;
    } else if (rut) {
      formula = `{RUT}="${rut}"`;
    }

    const encoded = encodeURIComponent(formula);
    const data = (await airtableGet(
      `/${tableId}?filterByFormula=${encoded}&maxRecords=3`
    )) as { records?: { id: string; fields: Record<string, unknown> }[] };

    const records = data?.records ?? [];
    if (records.length === 0) {
      return {
        ok: false,
        estado: phone ? "paciente_no_encontrado_por_phone" : "paciente_no_encontrado_por_rut",
      };
    }

    const r = records[0];
    return {
      ok: true,
      rec_id: r.id,
      nombre_paciente: r.fields["Nombre_paciente"] ?? r.fields["nombre_paciente"] ?? "",
      rut: r.fields["RUT"] ?? r.fields["rut"] ?? "",
      whatsapp_number: r.fields["Whatsapp_number"] ?? "",
      id_paciente_dentalink: r.fields["id_paciente_dentalink"] ?? null,
      datos_recopilados: r.fields["Datos_Recopilados_Activos"] ?? "",
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
