import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { setConnectionState } from "@/lib/db";

export const dynamic = "force-dynamic";

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const DATA_DIR = path.resolve(process.cwd(), "data");
const RESTART_FLAG = path.join(DATA_DIR, ".restart");

export async function POST() {
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RESTART_FLAG, "");
  return NextResponse.json({ ok: true });
}
