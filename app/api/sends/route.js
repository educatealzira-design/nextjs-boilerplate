import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/sends?weekKey=YYYY-MM-DD
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const weekKey = searchParams.get("weekKey") || undefined;
    const where = weekKey ? { weekKey } : {};
    const rows = await prisma.scheduleSend.findMany({
      where,
      orderBy: [{ weekKey: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/sends error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

// POST /api/sends  body: { studentId: string, weekKey: 'YYYY-MM-DD', status?: 'ENVIADO' }
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : '';
  const weekKey = typeof body?.weekKey === 'string' ? body.weekKey.trim() : '';

  if (!studentId) return NextResponse.json({ error: "Falta studentId" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey || "")) {
    return NextResponse.json({ error: "weekKey debe ser YYYY-MM-DD" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "ENVIADO";
  const now = new Date();
  const sentAt = status === "ENVIADO" ? now : undefined;
  const weekStartDate = new Date(`${weekKey}T00:00:00.000Z`);

  try {
    const row = await prisma.scheduleSend.upsert({
      where: { studentId_weekKey: { studentId, weekKey } },
      update: { status, ...(sentAt ? { sentAt } : {}) },
      create: {
        studentId,
        weekKey,
        weekStart: weekStartDate,   // 👈 aquí el valor que faltaba
        status,
        sentAt: sentAt ?? null
      },
    });
    return NextResponse.json(row);
  } catch (err) {
    console.error("POST /api/sends error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
