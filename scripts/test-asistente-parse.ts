import { parseAccionIA } from "../src/lib/asistente";

let fails = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) fails++;
}

const a = parseAccionIA('{"accion":"registrar","tipo":"gasto","monto":5000,"categoria":"Materiales","descripcion":"pinturas","respuesta":"Anotado: gasto de $5.000 en pinturas."}');
check("registrar: accion", a.accion === "registrar");
check("registrar: tipo", a.tipo === "gasto");
check("registrar: monto entero", a.monto === 5000);
check("registrar: respuesta", a.respuesta.includes("Anotado"));

const fenced = parseAccionIA('```json\n{"accion":"responder","respuesta":"Este mes llevas $50.000 en ingresos."}\n```');
check("responder con fences", fenced.accion === "responder" && fenced.respuesta.includes("50.000"));

const surrounded = parseAccionIA('Claro: {"accion":"responder","respuesta":"ok"} listo');
check("JSON rodeado de texto", surrounded.accion === "responder" && surrounded.respuesta === "ok");

const broken = parseAccionIA("no es json para nada");
check("fallback: accion responder", broken.accion === "responder");
check("fallback: usa el texto crudo", broken.respuesta === "no es json para nada");

const empty = parseAccionIA("   ");
check("fallback vacío: mensaje por defecto", empty.respuesta.length > 0);

console.log(fails === 0 ? "\nTODOS OK" : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
