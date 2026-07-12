import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { prepararNotaVoz, transcodeToVoiceNote, duracionSeg } from "../src/lib/audio.js";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

// Carpeta temporal aislada (no toca data/media del proyecto).
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "arteluk-audio-"));

// Genera una fuente de audio sintética (tono) en el formato pedido.
function gen(name: string, args: string[]) {
  execFileSync(FFMPEG, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", ...args, path.join(DIR, name)], { stdio: "ignore" });
}

async function main() {
  console.log("\n🧪 TEST audio → nota de voz WhatsApp\n");

  // 1) Fuente tipo Chrome/Android: webm/opus, 3 s.
  gen("chrome.webm", ["-c:a", "libopus", "-f", "webm"]);
  const r1 = await prepararNotaVoz(DIR, "chrome.webm", 0);
  check("webm → ogg transcodificado", r1.ffmpegOk && r1.outName.endsWith("_voz.ogg"), r1.outName);
  check("webm → duración ≈ 3 s (ffprobe)", r1.seconds >= 2 && r1.seconds <= 4, String(r1.seconds));

  // 2) Fuente tipo Safari iOS: mp4 FRAGMENTADO (sin duración en el contenedor).
  //    ffprobe suele devolver 0 → debe caer a la pista del cliente.
  gen("safari.m4a", ["-c:a", "aac", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-f", "mp4"]);
  const r2 = await prepararNotaVoz(DIR, "safari.m4a", 3);
  check("mp4 Safari → ogg transcodificado", r2.ffmpegOk && r2.outName.endsWith("_voz.ogg"), r2.outName);
  check("mp4 Safari → nunca 0:00 (duración > 0)", r2.seconds > 0, String(r2.seconds));

  // 3) Red de seguridad: si el transcode NO produce ogg (fuente ilegible), igual usa
  //    la pista del cliente y manda el original (no revienta, no 0:00 si hay hint).
  fs.writeFileSync(path.join(DIR, "roto.webm"), Buffer.from("no-es-audio-real"));
  const r3 = await prepararNotaVoz(DIR, "roto.webm", 7);
  check("archivo roto → cae al original (sin ogg)", !r3.ffmpegOk && r3.outName === "roto.webm", r3.outName);
  check("archivo roto → usa pista del cliente (7 s)", r3.seconds === 7, String(r3.seconds));

  // 4) Primitivas: transcode devuelve ruta y ffprobe mide bien un ogg real.
  const oggReal = await transcodeToVoiceNote(path.join(DIR, "chrome.webm"), path.join(DIR, "probe.ogg"));
  check("transcodeToVoiceNote devuelve ruta del ogg", oggReal !== null && fs.existsSync(oggReal), String(oggReal));
  const secs = await duracionSeg(path.join(DIR, "probe.ogg"));
  check("duracionSeg mide el ogg (≈ 3 s)", secs >= 2 && secs <= 4, String(secs));

  fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(1); });
