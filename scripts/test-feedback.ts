import "./env-loader.js";
import { prepararEnvio, ejecutarEnvio } from "../src/lib/feedback.js";
import {
  upsertCliente,
  getBorradorPendiente,
  getPendingOutbox,
  getOrCreateConversation,
  cancelarBorradoresPendientes,
  searchClientes,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST feedback (preparar + enviar + no-encontrado + herencia de fotos)\n");

cancelarBorradoresPendientes();

// Semilla: un apoderado con token ÚNICO (evita colisiones con datos reales/otros tests).
const tel = "+56990001234";
const NINO = "Zqxunico Coronado"; // nombre de niño irrepetible para búsqueda determinista
upsertCliente({ nombre: "Genoveva Montero", telefono: tel, alumnos: NINO, estado: "activo" });
const conv = getOrCreateConversation("56990001234");

// 1) Preparar con match único → borrador con contacto resuelto
const p1 = prepararEnvio({ destinatario: "Zqxunico", mensaje: "Zqxunico trabajó precioso hoy", fotos: ["f1.jpg", "f2.jpg"] });
check("preparar nombra al apoderado", p1.respuesta.includes("Genoveva"), p1.respuesta);
check("preparar menciona las fotos", /2 foto/.test(p1.respuesta));
const b1 = getBorradorPendiente();
check("borrador resuelto con telefono", b1?.cliente_telefono === "56990001234", JSON.stringify(b1));
check("borrador guarda 2 fotos", (b1?.fotos.length ?? 0) === 2);

// 2) Enviar → encola 2 fotos + 1 texto, marca enviado
const e1 = ejecutarEnvio();
check("enviar ok", e1.ok === true, e1.respuesta);
const pend = getPendingOutbox(50).filter(o => o.conversation_id === conv.id && o.sent === 0);
const imgs = pend.filter(o => o.kind === "image");
const txts = pend.filter(o => o.kind === "text");
check("encoló 2 fotos", imgs.length >= 2, `imgs=${imgs.length}`);
check("encoló 1 texto con el mensaje", txts.some(t => t.content.includes("precioso")));
check("tras enviar no queda borrador", getBorradorPendiente() === null);

// 3) No encontrado → respuesta clara, sin envío
const p2 = prepararEnvio({ destinatario: "Fulanito Inexistente", mensaje: "hola" });
check("no-encontrado avisa a Mary", /no encontr/i.test(p2.respuesta), p2.respuesta);
check("no-encontrado deja borrador sin_destinatario", getBorradorPendiente()?.estado === "sin_destinatario");

// 4) Herencia de fotos: aclarar el nombre sin re-adjuntar → conserva las fotos previas
cancelarBorradoresPendientes();
prepararEnvio({ destinatario: "", mensaje: "Le felicito por el avance", fotos: ["g1.jpg"] }); // sin destinatario, con foto
prepararEnvio({ destinatario: "Zqxunico", mensaje: "Le felicito por el avance" });    // aclara, sin fotos
const b3 = getBorradorPendiente();
check("hereda la foto del borrador anterior", (b3?.fotos.length ?? 0) === 1, JSON.stringify(b3?.fotos));
check("aclarar resuelve el contacto", b3?.cliente_telefono === "56990001234");

// 5) Ambiguo: dos apoderados que comparten término
upsertCliente({ nombre: "Papá de Diego Torres", telefono: "+56990005555", alumnos: "Diego Torres", estado: "activo" });
upsertCliente({ nombre: "Mamá de Diego Montoya", telefono: "+56990006666", alumnos: "Diego Montoya", estado: "activo" });
cancelarBorradoresPendientes();
const p4 = prepararEnvio({ destinatario: "Diego", mensaje: "Buen trabajo" });
check("ambiguo lista opciones", /encontré varios/i.test(p4.respuesta), p4.respuesta);
check("ambiguo no permite enviar aún", ejecutarEnvio().ok === false);

// 6) Herencia CRUZADA bloqueada: borrador con fotos para un apoderado + nuevo turno
//    para OTRO apoderado sin fotos → NO hereda las fotos del primero.
upsertCliente({ nombre: "Ximenaxq Uno", telefono: "+56990007001", alumnos: "Ninoxq Uno", estado: "activo" });
upsertCliente({ nombre: "Yolandaxq Dos", telefono: "+56990007002", alumnos: "Otroxq Dos", estado: "activo" });
cancelarBorradoresPendientes();
prepararEnvio({ destinatario: "Ninoxq", mensaje: "Se portó lindo", fotos: ["px1.jpg", "px2.jpg"] }); // borrador Ximena con 2 fotos
const p6 = prepararEnvio({ destinatario: "Otroxq", mensaje: "Buen día" }); // otro apoderado, sin fotos
const b6 = getBorradorPendiente();
check("no hereda fotos a un destinatario distinto", (b6?.fotos.length ?? -1) === 0, JSON.stringify(b6?.fotos));
check("resuelve al apoderado correcto (Yolanda)", b6?.cliente_telefono === "56990007002", p6.respuesta);

// 7) Path traversal: un nombre de archivo malicioso se descarta.
cancelarBorradoresPendientes();
prepararEnvio({ destinatario: "Ximenaxq", mensaje: "hola", fotos: ["../../.env", "ok1.jpg"] });
const b7 = getBorradorPendiente();
check("descarta foto con path traversal, deja la segura", JSON.stringify(b7?.fotos) === JSON.stringify(["ok1.jpg"]), JSON.stringify(b7?.fotos));

// 8) Búsqueda por límite de palabra: "Ana" NO matchea "Mariana".
upsertCliente({ nombre: "Marianaxz Prueba", telefono: "+56990007003", alumnos: "Hijoxz", estado: "activo" });
check("'Anaxz' no matchea 'Marianaxz'", !searchClientes("Anaxz").some(c => c.telefono === "56990007003"));
check("'Marianaxz' sí matchea", searchClientes("Marianaxz").some(c => c.telefono === "56990007003"));
check("prefijo 'Marianax' matchea", searchClientes("Marianax").some(c => c.telefono === "56990007003"));

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
