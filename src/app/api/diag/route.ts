import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { getPendingOutbox } from "@/lib/db";

export const dynamic = "force-dynamic";
const execFileP = promisify(execFile);
const FF = process.env.FFMPEG_PATH || "ffmpeg";
const FP = process.env.FFPROBE_PATH || "ffprobe";
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");

// Diagnóstico del pipeline de audio: ¿está ffmpeg?, ¿tiene opus?, ¿una conversión
// de prueba produce un ogg válido con duración?, ¿qué hay encolado?
export async function GET() {
  const out: Record<string, unknown> = {};

  try {
    const { stdout } = await execFileP(FF, ["-version"]);
    out.ffmpeg = stdout.split("\n")[0];
  } catch (e) {
    out.ffmpeg = "NO DISPONIBLE: " + String(e).slice(0, 200);
  }

  try {
    const { stdout } = await execFileP(FF, ["-hide_banner", "-encoders"]);
    out.libopus = /libopus/.test(stdout);
  } catch (e) {
    out.libopus = "err: " + String(e).slice(0, 120);
  }

  try {
    const tmp = path.join(os.tmpdir(), `diag_${process.pid}.ogg`);
    await execFileP(FF, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "libopus", "-ac", "1", "-ar", "48000", "-f", "ogg", tmp]);
    const size = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0;
    let duration: string | null = null;
    try {
      const { stdout } = await execFileP(FP, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tmp]);
      duration = stdout.trim();
    } catch (e) {
      duration = "ffprobe err: " + String(e).slice(0, 80);
    }
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    out.testTranscode = { ok: size > 0, size, duration };
  } catch (e) {
    out.testTranscode = "FALLÓ: " + String(e).slice(0, 200);
  }

  // Últimos audios encolados y si su archivo existe
  try {
    const audios = getPendingOutbox(200).filter((o) => o.kind === "audio").slice(-5).map((o) => ({
      media: o.media,
      existe: o.media ? fs.existsSync(path.join(MEDIA_DIR, o.media)) : false,
      size: o.media && fs.existsSync(path.join(MEDIA_DIR, o.media)) ? fs.statSync(path.join(MEDIA_DIR, o.media)).size : 0,
      sent: o.sent,
    }));
    out.audiosEncolados = audios;
  } catch (e) {
    out.audiosEncolados = "err: " + String(e).slice(0, 80);
  }

  return NextResponse.json(out);
}
