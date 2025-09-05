export const runtime = "nodejs"; // importante

import { NextResponse } from "next/server";
import { syncStudentsToSheet } from "@/lib/syncStudentsToSheet";

export async function POST() {
  try {
    const result = await syncStudentsToSheet();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}

// (Opcional) añade GET temporal para probar rápido en el navegador
export async function GET() {
  return NextResponse.json({ ok: true, msg: "Ruta viva" });
}
