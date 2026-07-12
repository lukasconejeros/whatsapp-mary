import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { FFMPEG, transcodeToVoiceNote, duracionSeg } from "@/lib/audio";

// TEMPORAL — verifica que ffmpeg/ffprobe funcionan en el contenedor de producción.
// Genera un tono, lo transcodifica a ogg/opus y mide su duración. Se elimina tras
// confirmar. Se autoprotege con un token en la query (no usa la cookie de Mary).
export const dynamic = "force-dynamic";
const execFileP = promisify(execFile);
const TOKEN = "78aa75e6a6edacb02eae6dad7f598839";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "selftest-"));
  const src = path.join(dir, "tono.wav");
  const ogg = path.join(dir, "tono.ogg");
  try {
    await execFileP(FFMPEG, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", src]);
    const out = await transcodeToVoiceNote(src, ogg);
    const seconds = out ? await duracionSeg(ogg) : 0;
    const oggBytes = out && fs.existsSync(ogg) ? fs.statSync(ogg).size : 0;
    return NextResponse.json({
      ok: !!out && seconds > 0,
      ffmpegPath: FFMPEG,
      transcodeOk: !!out,
      seconds,
      oggBytes,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), ffmpegPath: FFMPEG }, { status: 500 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
