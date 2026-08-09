import "./env-loader.js";
import {
  addEnsayoMensaje, listEnsayoMensajes, listEnsayoTodo,
  archivarEnsayo, sesionEnsayoActual,
  guardarCorreccion, guardarCorreccionAudio,
  addAudioMary, listAudiosMary, updateAudioMary, deleteAudioMary,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean) { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n}`); fail++; } }

console.log("\n🧪 TEST la tarde de entrenamiento de Mary\n");

console.log("— Empezar de nuevo NO borra la tarde de Mary —");
const antes = listEnsayoTodo().length;
const sesion0 = sesionEnsayoActual();
addEnsayoMensaje("apoderado", "Hola, cuánto cuesta");
addEnsayoMensaje("bot", "¿Para quién sería la clase?");
check("la práctica se ve en pantalla", listEnsayoMensajes().length >= 2);

const r = archivarEnsayo();
check("archiva los que había", r.archivados >= 2);
check("sube el número de sesión", r.sesion === sesion0 + 1 && sesionEnsayoActual() === sesion0 + 1);
check("la pantalla queda limpia", listEnsayoMensajes().length === 0);
check("PERO no se borró ni una fila", listEnsayoTodo().length === antes + 2);
check("las filas viejas guardan su sesión", listEnsayoTodo().slice(-2).every(m => m.sesion_id === sesion0));

addEnsayoMensaje("apoderado", "Ya, y para adultos?");
check("lo nuevo entra en la sesión nueva",
  listEnsayoMensajes().length === 1 && listEnsayoMensajes()[0].sesion_id === sesion0 + 1);
check("y lo viejo sigue estando", listEnsayoTodo().length === antes + 3);

console.log("\n— 'Yo diría esto': la corrección queda pegada a la respuesta —");
const idBot = addEnsayoMensaje("bot", "Hola! Los valores son 45.000 y 60.000 mensuales.");
check("guarda lo que ella diría", guardarCorreccion(idBot, "Yo primero pregunto la edad, no tiro los precios"));
const conCorr = listEnsayoTodo().find(m => m.id === idBot);
check("queda pegada a ESA respuesta", conCorr?.correccion?.includes("pregunto la edad") === true);
check("guarda la corrección hablada", guardarCorreccionAudio(idBot, "correccion_test.ogg", 7));
const conAudio = listEnsayoTodo().find(m => m.id === idBot);
check("con su archivo y su duración", conAudio?.correccion_audio === "correccion_test.ogg" && conAudio?.correccion_seg === 7);
check("el texto no se pierde al grabar", conAudio?.correccion?.includes("pregunto la edad") === true);
check("no se corrige lo que escribió el apoderado",
  !guardarCorreccion(addEnsayoMensaje("apoderado", "hola"), "nada"));
check("borrar la corrección la deja vacía, no rompe",
  guardarCorreccion(idBot, null) && listEnsayoTodo().find(m => m.id === idBot)?.correccion === null);
check("y el audio de la corrección sigue guardado",
  listEnsayoTodo().find(m => m.id === idBot)?.correccion_audio === "correccion_test.ogg");

console.log("\n— Mis audios: los graba ella y dice cuándo usarlos —");
const idA = addAudioMary({ archivo: "audio_test.ogg", titulo: "el del autismo", cuando_usarlo: "cuando preguntan por niños con autismo", segundos: 24 });
check("guarda el audio", idA > 0);
const a = listAudiosMary().find(x => x.id === idA);
check("con el nombre que ella le puso", a?.titulo === "el del autismo");
check("y con SUS palabras de cuándo usarlo", a?.cuando_usarlo.includes("autismo") === true);
check("guarda la duración", a?.segundos === 24);
check("puede renombrarlo",
  updateAudioMary(idA, { titulo: "el de los niños especiales" }) &&
  listAudiosMary().find(x => x.id === idA)?.titulo === "el de los niños especiales");
check("cambiar el título no borra el cuándo usarlo",
  listAudiosMary().find(x => x.id === idA)?.cuando_usarlo.includes("autismo") === true);
check("puede sacarlo de la lista", deleteAudioMary(idA) && !listAudiosMary().some(x => x.id === idA));

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
