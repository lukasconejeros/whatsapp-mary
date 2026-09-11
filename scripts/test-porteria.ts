// Pruebas de la portería del login. Corre con: npm run test:porteria
// El reloj avanza a mano, así que los castigos de 15 minutos se prueban en milisegundos.

import {
  anotarFallo, veredicto, fichaNueva, sortearCodigo, textoVeredicto,
  FALLOS_ANTES_DE_ESPERA, FALLOS_ANTES_DE_CERRAR, ESPERA_MIN, MEMORIA_MIN, type Ficha,
} from "../src/lib/porteria";

let fallos = 0;
const MIN = 60_000;

function ok(condicion: boolean, que: string) {
  console.log(`${condicion ? "OK  " : "FALLA"} ${que}`);
  if (!condicion) fallos++;
}

/** Simula a alguien probando contraseñas: devuelve la ficha después de `n` fallos seguidos. */
function insistir(n: number, t0 = 1_000_000, pasoMs = 1000): { f: Ficha; cierres: number } {
  let f: Ficha | undefined;
  let cierres = 0;
  for (let i = 0; i < n; i++) {
    const r = anotarFallo(f, t0 + i * pasoMs, () => "123456");
    f = r.ficha;
    if (r.seCierraAhora) cierres++;
  }
  return { f: f!, cierres };
}

console.log("\n--- Nivel 1: a los 3 fallos, espera de 15 minutos ---");
{
  const t0 = 1_000_000;
  const dos = insistir(2, t0).f;
  ok(veredicto(dos, t0 + 3000).paso === "adelante", "con 2 fallos todavía puede intentar");
  ok((veredicto(dos, t0 + 3000) as any).intentosRestantes === 1, "le queda 1 intento y se le puede decir");

  const tres = insistir(3, t0).f;
  const v = veredicto(tres, t0 + 4000);
  ok(v.paso === "espera", `al tercer fallo queda esperando (fue "${v.paso}")`);
  ok(v.paso === "espera" && v.restanteMs > 14 * MIN, "la espera es de ~15 minutos");
  ok(textoVeredicto(v).includes("15"), `el mensaje le dice cuánto esperar: "${textoVeredicto(v)}"`);
}

console.log("\n--- La espera se cumple sola: la secretaria no necesita a nadie ---");
{
  const t0 = 1_000_000;
  const tres = insistir(3, t0).f;
  const despues = t0 + (ESPERA_MIN + 1) * MIN;
  const v = veredicto(tres, despues);
  ok(v.paso === "adelante", "pasados los 15 minutos puede volver a intentar");
  ok((v as any).intentosRestantes === FALLOS_ANTES_DE_CERRAR - 3, "pero solo le quedan los que faltan para el cierre");
}

console.log("\n--- Nivel 2: a los 6 fallos queda CERRADA y ya no la abre el tiempo ---");
{
  const t0 = 1_000_000;
  // Insiste 3, espera el castigo, y vuelve a insistir 3 más.
  let f: Ficha | undefined;
  let cierres = 0;
  const instantes = [0, 1, 2, (ESPERA_MIN + 1) * MIN, (ESPERA_MIN + 1) * MIN + 1, (ESPERA_MIN + 1) * MIN + 2];
  for (const d of instantes) {
    const r = anotarFallo(f, t0 + d, () => "654321");
    f = r.ficha;
    if (r.seCierraAhora) cierres++;
  }
  ok(cierres === 1, `se cierra una sola vez, no una por intento (fueron ${cierres})`);
  ok(f!.codigo === "654321", "al cerrarse genera el código que hay que dictarle");
  const v = veredicto(f, t0 + 30 * 24 * 60 * MIN); // un mes después
  ok(v.paso === "cerrada", "un mes después sigue cerrada: el tiempo NO la abre");
  ok(textoVeredicto(v).includes("código"), "el mensaje le dice que pida el código");
}

console.log("\n--- El que insiste no puede regenerarse el código a fuerza de intentos ---");
{
  const { f, cierres } = insistir(20);
  ok(cierres === 1, `20 intentos generan UN cierre y un código, no 15 (fueron ${cierres})`);
  ok(f.codigo === "123456", "el código sigue siendo el del momento del cierre");
}

console.log("\n--- Se olvida sola: el que falló 2 veces ayer no empieza castigado hoy ---");
{
  const t0 = 1_000_000;
  const dos = insistir(2, t0).f;
  const manana = t0 + (MEMORIA_MIN + 1) * MIN;
  const v = veredicto(dos, manana);
  ok(v.paso === "adelante" && v.intentosRestantes === FALLOS_ANTES_DE_ESPERA, "vuelve a tener sus 3 intentos limpios");
  // Y el arranque desde cero tras el olvido no arrastra los fallos viejos:
  const r = anotarFallo(dos, manana, () => "000000");
  ok(r.ficha.fallos === 1, `el fallo de hoy cuenta como el primero (contó ${r.ficha.fallos})`);
}

console.log("\n--- Una puerta cerrada NO caduca aunque pase el tiempo de olvido ---");
{
  const t0 = 1_000_000;
  const seis = insistir(6, t0).f;
  const v = veredicto(seis, t0 + (MEMORIA_MIN + 5) * MIN);
  ok(v.paso === "cerrada", "pasada la hora de memoria sigue cerrada (si no, bastaba con esperar)");
}

console.log("\n--- El código ---");
{
  ok(sortearCodigo(() => 0).length === 6, "siempre 6 dígitos, hasta con el azar en su mínimo");
  ok(sortearCodigo(() => 0.999999).length === 6, "siempre 6 dígitos, hasta con el azar en su máximo");
  ok(/^\d{6}$/.test(sortearCodigo()), "solo dígitos, para poder dictarlo por teléfono");
}

console.log("\n--- Nada de fugas: el mensaje no dice si el correo existe ---");
{
  const t0 = 1_000_000;
  ok(textoVeredicto(veredicto(fichaNueva(), t0)) === "", "quien va bien no recibe ningún aviso raro");
  const tres = insistir(3, t0).f;
  const txt = textoVeredicto(veredicto(tres, t0 + 1000));
  ok(!/correo|email|usuario/i.test(txt), `el texto no menciona el correo: "${txt}"`);
}

console.log(fallos === 0 ? `\n✅ TODO OK` : `\n❌ ${fallos} PRUEBAS FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
