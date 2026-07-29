// Prueba de la RESOLUCIÓN DE VERSIÓN de WhatsApp Web (wa-version.ts). Es lo que dejó a los bots mudos el
// 28-jul-2026: WhatsApp dejó de aceptar la versión que Baileys trae de fábrica (2.3000.1023223821) y
// respondió 405 en cada intento. El bot pedía la versión buena a internet EN CADA RECONEXIÓN, esa petición
// falla o la cortan por exceso, caía a la de fábrica → 405 → reconectar → repetir. Bucle infinito que se
// alimenta solo, sin QR y sin recuperación posible.
//
// Reglas que se prueban aquí (lógica pura, sin red ni disco reales):
//   1. WA_VERSION en el entorno MANDA (escotilla para arreglar en caliente sin desplegar código).
//   2. Con versión en memoria fresca NO se toca la red (esto es lo que mata el bucle).
//   3. Si la red responde, se guarda en disco para el próximo arranque.
//   4. Si la red falla, se usa el disco; si tampoco hay, el fallback fijo — NUNCA la de fábrica.
//   5. Entre dos consultas a la red hay un mínimo de 60s, aunque se invalide (anti-autoflagelo).
//   6. Se elige siempre la MÁS NUEVA: una respuesta más vieja que el fallback no nos hace retroceder.
import {
  resolverVersionWA, parsearVersion, esMasNueva, FALLBACK_WA_VERSION, MIN_MS_ENTRE_CONSULTAS,
  type VersionWA, type DepsVersion,
} from "../src/lib/baileys/wa-version.js";

let fails = 0;
function check(l: string, c: boolean) { console.log(`${c ? "✅" : "❌"} ${l}`); if (!c) fails++; }
const igual = (a: VersionWA | null, b: VersionWA) => !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// Derivada del fallback para que siga siendo "más nueva que todo lo local" cada vez que el fallback suba.
const NUEVA: VersionWA = [2, 3000, FALLBACK_WA_VERSION[2] + 1_000_000];
const FABRICA: VersionWA = [2, 3000, 1023223821];

// Banco de pruebas: deps falsas con contadores, para ver a quién se llamó de verdad.
function banco(over: Partial<DepsVersion> & { remota?: VersionWA | Error } = {}) {
  const estado = { consultasRed: 0, guardados: [] as VersionWA[] };
  const deps: DepsVersion = {
    env: undefined,
    ahora: 1_000_000,
    fetchRemota: async () => {
      estado.consultasRed++;
      if (over.remota instanceof Error) throw over.remota;
      return (over.remota ?? NUEVA);
    },
    leerCache: () => null,
    guardarCache: (v) => { estado.guardados.push(v); },
    memoria: null,
    ...over,
  };
  return { deps, estado };
}

// ── parsearVersion: solo acepta versiones con forma de versión ──
check("parsea un array de 3 enteros", igual(parsearVersion([2, 3000, 123]), [2, 3000, 123]));
check("parsea el JSON del disco", igual(parsearVersion(JSON.parse('{"version":[2,3000,999]}').version), [2, 3000, 999]));
check("parsea de texto '2.3000.777'", igual(parsearVersion("2.3000.777"), [2, 3000, 777]));
check("rechaza basura", parsearVersion("hola") === null && parsearVersion(null) === null && parsearVersion([1, 2]) === null);
check("rechaza no numéricos", parsearVersion([2, "x", 3]) === null);
check("rechaza una versión absurda (major < 2)", parsearVersion([0, 1, 1]) === null);

// ── esMasNueva: comparación por componentes ──
check("la nueva es más nueva que la de fábrica", esMasNueva(NUEVA, FABRICA));
check("la de fábrica NO es más nueva", !esMasNueva(FABRICA, NUEVA));
check("igual a sí misma no es más nueva", !esMasNueva(NUEVA, NUEVA));

// ── 1. el entorno manda y no consulta la red ──
{
  const { deps, estado } = banco({ env: "2.3000.7777777" });
  const r = await resolverVersionWA(deps);
  check("WA_VERSION del entorno manda", igual(r.version, [2, 3000, 7777777]));
  check("con WA_VERSION no se consulta la red", estado.consultasRed === 0);
  check("el origen dice que vino del entorno", r.origen === "env");
}
{
  const { deps } = banco({ env: "basura" });
  const r = await resolverVersionWA(deps);
  check("WA_VERSION inválida se ignora y sigue el flujo normal", igual(r.version, NUEVA) && r.origen === "red");
}

// ── 2. memoria fresca → cero red (esto es lo que rompe el bucle de reconexión) ──
{
  const { deps, estado } = banco({ memoria: { version: NUEVA, ts: 1_000_000 - 1000 } });
  const r = await resolverVersionWA(deps);
  check("con memoria fresca no se consulta la red", estado.consultasRed === 0 && igual(r.version, NUEVA));
  check("el origen dice memoria", r.origen === "memoria");
}
{
  // memoria caducada (más de 6h) → sí se refresca
  const { deps, estado } = banco({ memoria: { version: FABRICA, ts: 1_000_000 - 7 * 60 * 60 * 1000 } });
  const r = await resolverVersionWA(deps);
  check("memoria caducada → se refresca por red", estado.consultasRed === 1 && igual(r.version, NUEVA));
}

// ── 3. la red responde → se guarda en disco para el próximo arranque ──
{
  const { deps, estado } = banco();
  const r = await resolverVersionWA(deps);
  check("con red OK se usa la versión de la red", igual(r.version, NUEVA) && r.origen === "red");
  check("y se guarda en disco", estado.guardados.length === 1 && igual(estado.guardados[0], NUEVA));
}

// ── 4. la red falla → disco; sin disco → fallback fijo (NUNCA la de fábrica) ──
{
  // el disco guarda lo último que funcionó de verdad, que puede ser MÁS nuevo que el fallback compilado
  const guardada: VersionWA = [2, 3000, 1040000000];
  const { deps } = banco({ remota: new Error("getaddrinfo ENOTFOUND"), leerCache: () => guardada });
  const r = await resolverVersionWA(deps);
  check("red caída → se usa lo guardado en disco", igual(r.version, guardada) && r.origen === "disco");
}
{
  // pero si lo guardado quedó viejo, no nos hace retroceder: gana el fallback
  const { deps } = banco({ remota: new Error("x"), leerCache: () => [2, 3000, 1030000000] });
  const r = await resolverVersionWA(deps);
  check("disco viejo no nos hace retroceder: gana el fallback", igual(r.version, FALLBACK_WA_VERSION) && r.origen === "fallback");
}
{
  const { deps, estado } = banco({ remota: new Error("403 rate limit") });
  const r = await resolverVersionWA(deps);
  check("red caída y disco vacío → fallback fijo", igual(r.version, FALLBACK_WA_VERSION) && r.origen === "fallback");
  check("el fallback NO es la versión de fábrica de Baileys", !igual(FALLBACK_WA_VERSION, FABRICA));
  check("un fallo de red no se guarda en disco", estado.guardados.length === 0);
}
{
  const { deps } = banco({ remota: new Error("x"), leerCache: () => JSON.parse("null") });
  const r = await resolverVersionWA(deps);
  check("disco corrupto/vacío no rompe: cae al fallback", igual(r.version, FALLBACK_WA_VERSION));
}

// ── 5. mínimo de 60s entre consultas a la red, aunque se invalide ──
{
  const { deps, estado } = banco({ memoria: null, ultimoIntento: 1_000_000 - 5_000 });
  const r = await resolverVersionWA(deps);
  check("si se consultó hace 5s NO se vuelve a consultar", estado.consultasRed === 0);
  check("y aun así devuelve algo usable", igual(r.version, FALLBACK_WA_VERSION));
}
{
  const { deps, estado } = banco({ memoria: null, ultimoIntento: 1_000_000 - (MIN_MS_ENTRE_CONSULTAS + 1) });
  await resolverVersionWA(deps);
  check("pasado el mínimo sí se vuelve a consultar", estado.consultasRed === 1);
}

// ── 6. nunca retroceder: una respuesta más vieja que el fallback no nos hunde ──
{
  const { deps } = banco({ remota: FABRICA });
  const r = await resolverVersionWA(deps);
  check("si la red devuelve la de fábrica, gana el fallback más nuevo", igual(r.version, FALLBACK_WA_VERSION));
}
{
  const futura: VersionWA = [2, 3000, 1099999999];
  const { deps, estado } = banco({ remota: futura });
  const r = await resolverVersionWA(deps);
  check("si la red devuelve una MÁS nueva, esa gana", igual(r.version, futura));
  check("y esa sí se guarda en disco", igual(estado.guardados[0], futura));
}

// ── el resultado siempre es usable: nunca null, nunca la de fábrica ──
{
  const { deps } = banco({ remota: new Error("x"), leerCache: () => { throw new Error("disco ilegible"); } });
  const r = await resolverVersionWA(deps);
  check("si hasta leer el disco revienta, sigue devolviendo el fallback", igual(r.version, FALLBACK_WA_VERSION));
}

if (fails === 0) { console.log("\n🟢 WA-VERSION OK — el bot nunca se presenta con la versión de fábrica ni machaca la red en cada reintento"); process.exit(0); }
else { console.log(`\n🔴 ${fails} fallo(s)`); process.exit(1); }
