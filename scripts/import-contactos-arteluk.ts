import "./env-loader.js";
import { upsertCliente, listContactos, setClienteEstado } from "../src/lib/db.js";
import { normalizeChilePhone } from "../src/lib/phone.js";

// Lista de apoderados/alumnos de Arteluk entregada por Mary.
// Formato: [apoderado, alumno(s), telefono]. Teléfono vacío = sin número.
// El import es idempotente (upsert por teléfono): correrlo dos veces no duplica.
const CONTACTOS: [string, string, string][] = [
  ["Myriam Beroiza Carrillo", "Catalina Jara Beroiza", "+56937172698"],
  ["Daniela Bachmann", "Francisca Esperguel", "+56950061781"],
  ["Lorena Muñoz", "Matilda Eleonor Durán Muñoz", "+56999634351"],
  ["Ariel Perez", "Maria Ignacia Perez Ferron", "+56978594757"],
  ["Patricio Garcés", "Antonella Garces Barría", "+56976582016"],
  ["Camilo Tomckowiack", "Josefina Tomckowiack", "+56982297822"],
  ["Carolina Domínguez", "Daniela Julieta Mena Domínguez", "+56951333508"],
  ["Rossana Aravena", "Javiera Peñailillo", "+56947604021"],
  ["María Soledad Castro Naranjo", "Ema Delgado Castro", "+569510728336600"],
  ["Carolina Bastidas", "Maite Muñoz Bastidas", "+56956685745"],
  ["Paz Riedemann", "Victoria Lovera", "+56993166255"],
  ["Roxana Aliquintui", "Diego Torres", "+56954240517"],
  ["Sebastián Roa", "Valentina Roa", "+56984057015"],
  ["Sandra Vera Perez", "Maite Zapata Vera", "+56994680154"],
  ["Sonia Monsslvez", "Amalia Campos", "+56994440098"],
  ["Veronica Arteche", "Antonia Pontigo", "+56976242369"],
  ["Maribel Silva", "Fernanda Muñoz", "+56985218849"],
  ["Carolina Hube", "Isidora Piñones", "+56994102408"],
  ["Daniela Sotomayor", "Julieta Monsalve", "+56986622713"],
  ["Natalia Ahrens Maitre", "Elena Jerez Ahrens", "+56945496234"],
  ["Mónica Díaz Ojeda", "Amalia, Renata, Colomba", "+56997620466"],
  ["Carla Schmitz Gutiérrez", "Gabriela Martínez Schmitz", "+56938731895"],
  ["Camila Vasquez", "Benjamín Martínez", "+56971974310"],
  ["Myrta Lira Riquelme", "Maria Ignacia Tauler Lira", "+56937491080"],
  ["Lizet Cristi Cordero", "Isidora Mariman Cristi", "+56977009334"],
  ["Francibel Figueroa", "Francesca Gil Figueroa", "+56947949669"],
  ["Patricia Robles", "José Pedro Mancilla Robles", "+56957535633"],
  ["Ana Maria Barrientos Villarroel", "Blu Fernanda Bachmann Barrientos", "+56927865041"],
  ["Fabiola Baeza", "Isabella Yobanolo Baeza", "+56984907600"],
  ["Eduardo Chi", "Samanta Chi", "+56951792574"],
  ["Karla Marcuello Martínez", "Florencia Mohr Marcuello", "+56984286212"],
  ["Moises Chavez", "Emma Chavez", "+56959850135"],
  ["Genoveva Montero Bravo", "Amparo Coronado", "+56995488723"],
  ["Rosa Fernández Colipue", "Fernando Carrasco Vera", "+56973907440"],
  ["Francisco Moraga", "Josefa Moraga", "+56967610488"],
  ["Jessica Cardenas Ruiz", "Emilia Matus Cardenas", "+56974080245"],
  ["Karen Guevara", "Emilia Rojas Guevara", "+56991944873"],
  ["Pablo Hernández", "Maite Hernández Verdejo", "+56934243621"],
  ["Sergio", "Diego", "+56977680454"],
  ["Catalina Inzunza", "Tiara Collica", "+56973526455"],
  ["Apoderado de Mateo Godoy Flores", "Mateo Godoy Flores", ""],
  ["Berta Medina", "Violeta Sanhueza", "+56946635672"],
  ["Laura Aguilera Cossio", "Ema Medina Aguilera", "+56959535600"],
  ["Alex Bratz", "Julieta Bratz", "+56956475871"],
  ["Alexie Paredes Monasterio", "Josefina Paredes Martínez", "+56973731316"],
  ["Lisset Gallardo", "Lía Pacheco", "+56965591846"],
  ["Oscar Niklitschek Oyarzun", "Emma Niklitschek Santana", "+56984494244"],
  ["Cecilia García Vargas", "Noah Campos Arteaga", "+56976487128"],
  ["Javiera Jiménez", "Pascuala Huentrún Jiménez", "+56975678723"],
  ["Judith Higueras", "Amelia y Amparo Sepúlveda", "+56994013641"],
  ["Dayra Olivares", "Allison Ferrada Olivares", "+56987981104"],
  ["Monica Roa", "Gianella Jaramillo Roa", "+56963347341"],
  ["Angela Alarcón", "Maite Isabella Cortez Alarcón", "+56957152441"],
  ["Susana Olivera Gatica", "Elizabeth Belén Arancibia Olivera", "+56947815181"],
  ["Cristal Maldonado", "Julieta Rivas", "+56952011526"],
  ["Catalina Desormeaux", "Agustina Decap", "+56979850517"],
  ["Camila Castro", "Amanda Diaz", "+56967070489"],
  ["Lucy Sandoval", "Sophia Iturra Sandoval", "+569412507578"],
  ["Zunia Peña y Lillo", "Valentina", "+56936750747"],
  ["Nadia", "Amapola", "+56936946841"],
  ["Andrea Pinto", "Sofía Reyes Pinto", "+56978776251"],
  ["Cecilia Klenner", "Oliver Moris Klenner", "+56998486844"],
  ["Kasandra Rivera", "Diego Montoya", "+56962189102"],
];

function main() {
  let ok = 0;
  const invalidos: string[] = [];
  const importados = new Set<string>();

  for (const [apoderado, alumno, tel] of CONTACTOS) {
    const norm = normalizeChilePhone(tel);
    if (!norm) {
      invalidos.push(`${apoderado} (${alumno}) — teléfono "${tel || "vacío"}"`);
      continue;
    }
    // nombre = apoderado (quien recibe el WhatsApp); alumnos = niño(s) para la búsqueda.
    // NO pasamos estado aquí: upsert hace COALESCE y pisaría la etiqueta que Mary ya
    // haya puesto. El default 'activo' se aplica abajo SOLO a los que quedan sin estado.
    upsertCliente({
      nombre: apoderado.trim(),
      telefono: norm,
      alumnos: alumno.trim(),
    });
    importados.add(norm);
    ok++;
  }

  // Default: contactos recién creados (sin estado) → 'activo'. No toca los que ya
  // tienen estado (respeta 'inactivo' puesto por Mary o el estado que venía de Airtable).
  let defaulted = 0;
  for (const c of listContactos()) {
    if (importados.has(c.telefono) && (!c.estado || !c.estado.trim())) {
      setClienteEstado(c.telefono, "activo");
      defaulted++;
    }
  }
  if (defaulted) console.log(`   (${defaulted} contactos nuevos marcados como 'activo')`);

  const total = listContactos().length;
  console.log(`\n✅ Importados/actualizados: ${ok} de ${CONTACTOS.length}`);
  if (invalidos.length) {
    console.log(`\n⚠️  No se pudieron cargar (${invalidos.length}) — teléfono inválido o faltante:`);
    for (const s of invalidos) console.log(`   • ${s}`);
    console.log("\n   Estos hay que revisarlos a mano (número mal escrito o sin registrar).");
  }
  console.log(`\n📇 Total de contactos en la base ahora: ${total}\n`);
}

main();
