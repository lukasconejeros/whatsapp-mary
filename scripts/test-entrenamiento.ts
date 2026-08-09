import "./env-loader.js";
import {
  addEnsayoMensaje, listEnsayoMensajes, listEnsayoTodo,
  archivarEnsayo, sesionEnsayoActual,
  guardarCorreccion, guardarCorreccionAudio,
  addAudioMary, listAudiosMary, updateAudioMary, deleteAudioMary,
  type AudioMary,
} from "../src/lib/db.js";
import { simularHerramienta, definicionProponerAudio, armarInforme } from "../src/lib/ensayo.js";

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

// Desde el 09-08-2026 Mary ya NO le pone nombre al audio: solo escribe cuándo hay que
// mandarlo. Pedido suyo: dos cajas confundían ("solo que diga cuándo lo ocuparía").
const idSinNombre = addAudioMary({ archivo: "sin_nombre.ogg", cuando_usarlo: "cuando preguntan por el horario", segundos: 9 });
const sinNombre = listAudiosMary().find(x => x.id === idSinNombre);
check("se puede guardar sin ponerle nombre", idSinNombre > 0);
check("y queda identificado por el cuándo usarlo", sinNombre?.titulo === "cuando preguntan por el horario");
deleteAudioMary(idSinNombre);

console.log("\n— El bot PROPONE el audio, nunca lo manda —");
const audios: AudioMary[] = [{
  id: 7, archivo: "mary_7.ogg", titulo: "el del autismo",
  cuando_usarlo: "cuando preguntan por niños con autismo", segundos: 20, created_at: 0,
}];
const prop = simularHerramienta("proponerAudio", { id: 7 }, audios);
check("avisa que te lo habría propuesto", prop.aviso.includes("propuesto"));
check("y lo nombra por el cuándo usarlo, que es lo que ella escribe",
  prop.aviso.includes("cuando preguntan por niños con autismo"));
check("NO dice que lo mandó",
  !prop.aviso.toLowerCase().includes("envió") && !prop.aviso.toLowerCase().includes("mandó"));
check("el modelo recibe que salió bien", prop.resultado.ok === true);
check("un id que no existe no revienta", simularHerramienta("proponerAudio", { id: 999 }, audios).resultado.ok === false);
check("sin audios grabados la herramienta ni se ofrece", definicionProponerAudio([]) === null);
const def = definicionProponerAudio(audios);
check("la descripción lleva las palabras de Mary", def!.description.includes("cuando preguntan por niños con autismo"));

// Audios de antes del 09-08-2026: los que tienen nombre viejo y nada escrito en
// "cuándo usarlo" no pueden quedar sin identificar, ni para el bot ni en el informe.
const viejo: AudioMary[] = [{ id: 8, archivo: "mary_8.ogg", titulo: "el de los valores", cuando_usarlo: "", segundos: 11, created_at: 0 }];
check("un audio viejo sin cuándo usarlo no queda anónimo",
  simularHerramienta("proponerAudio", { id: 8 }, viejo).aviso.includes("el de los valores"));
check("y el bot igual lo puede elegir", definicionProponerAudio(viejo)!.description.includes("el de los valores"));

console.log("\n— Descargar todo: la tarde entera en un archivo —");
const idAudioInforme = addAudioMary({ archivo: "mary_informe.ogg", cuando_usarlo: "cuando preguntan cuánto cuesta", segundos: 12 });
const informe = armarInforme(listEnsayoTodo(), listAudiosMary());
check("trae lo que escribió Mary haciendo de apoderado", informe.includes("Hola, cuánto cuesta"));
check("trae las respuestas del bot", informe.includes("¿Para quién sería la clase?"));
check("separa por práctica", informe.includes("Práctica 1"));
check("trae más de una práctica", informe.includes(`Práctica ${sesionEnsayoActual()}`));
check("marca el audio de la corrección", informe.includes("correccion_test.ogg"));
check("lista los audios con su cuándo usarlo", informe.includes("cuando preguntan cuánto cuesta"));
deleteAudioMary(idAudioInforme);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
