import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);

export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

// Transcodifica cualquier audio (webm/mp4/m4a…) a ogg/opus mono 48 kHz, que es lo
// que WhatsApp necesita para reproducir una NOTA DE VOZ (ptt). Recibe y devuelve
// rutas absolutas para poder testearse fuera de data/media. Devuelve la ruta del
// .ogg o null si ffmpeg falla o produce un archivo vacío.
export async function transcodeToVoiceNote(inPath: string, outPath: string): Promise<string | null> {
  try {
    await execFileP(FFMPEG, ["-y", "-i", inPath, "-vn", "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1", "-f", "ogg", outPath]);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return outPath;
    return null;
  } catch {
    return null;
  }
}

// Duración entera en segundos de un archivo de audio, con ffprobe. 0 si falla o si
// el contenedor no expone duración (típico en mp4 fragmentado de Safari iOS).
export async function duracionSeg(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileP(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath]);
    return Math.max(0, Math.round(parseFloat(stdout.trim()) || 0));
  } catch {
    return 0;
  }
}

export interface NotaVozResult {
  // Nombre del archivo a enviar por WhatsApp (el ogg si transcodificó; si no, el
  // original como último recurso).
  outName: string;
  // Duración en segundos para pasar como `seconds` (evita el "0:00" en WhatsApp).
  seconds: number;
  // true si ffmpeg produjo el ogg/opus; false si se cae al original.
  ffmpegOk: boolean;
}

// Prepara una nota de voz a partir del archivo ORIGINAL ya guardado en `mediaDir`.
// Duración ROBUSTA (nunca 0:00 si algún método la conoce):
//   1) ffprobe sobre el ogg transcodificado,
//   2) si da 0, ffprobe sobre el original,
//   3) si da 0, la pista de segundos que el cliente contó al grabar.
export async function prepararNotaVoz(mediaDir: string, originalName: string, hintSeg: number): Promise<NotaVozResult> {
  const inPath = path.join(mediaDir, originalName);
  const oggName = originalName.replace(/\.[^.]+$/, "") + "_voz.ogg";
  const oggPath = path.join(mediaDir, oggName);

  const ogg = await transcodeToVoiceNote(inPath, oggPath);
  const outName = ogg ? oggName : originalName;

  let seconds = await duracionSeg(path.join(mediaDir, outName));
  if (seconds === 0 && outName !== originalName) seconds = await duracionSeg(inPath);
  if (seconds === 0 && hintSeg > 0) seconds = Math.round(hintSeg);

  return { outName, seconds, ffmpegOk: !!ogg };
}
