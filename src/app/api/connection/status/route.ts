import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getConnectionState } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getConnectionState();

  // Show QR also during 'connecting' to avoid race condition on fast machines
  if (
    state.qr_string &&
    (state.status === "qr" || state.status === "connecting")
  ) {
    const qrPng = await QRCode.toDataURL(state.qr_string, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    return NextResponse.json({
      status: "qr",
      qrPng,
      phone: state.phone,
      updatedAt: state.updated_at,
    });
  }

  return NextResponse.json({
    status: state.status,
    phone: state.phone,
    updatedAt: state.updated_at,
  });
}
