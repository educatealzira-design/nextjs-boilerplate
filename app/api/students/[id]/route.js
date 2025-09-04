import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Normaliza el valor a los canónicos de la BD: 'amigos' | 'companeros' | 'internet' | 'otro'
const normalizeReferral = (v) => {
  if (v == null || v === "") return null;
  const key = String(v)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

  const map = {
    AMIGO: "amigos",
    AMIGOS: "amigos",
    COMPANERO: "companeros",
    COMPANEROS: "companeros",
    COMPANERAS: "companeros",
    COMPANERA: "companeros",
    INTERNET: "internet",
    OTRO: "otro",
    OTRA: "otro",
  };
  return map[key] ?? null; // si no cuadra, lo guardamos como null (opcional)
};

export async function GET(_req, ctx) {
  const { id } = await ctx.params;   
  const s = await prisma.student.findUnique({
    where: { id },
    include: { extras: true, subjects: true, schoolBlocks: true },
  });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(s);
}

// PUT /api/students/:id
export async function PUT(req, ctx) {
  const { id } = await ctx.params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Normalizaciones numéricas (permiten null)
  const toNumOrNull = (v) =>
    v === undefined ? undefined : v === null || v === "" ? null : Number(v);

  const desiredHoursNum = toNumOrNull(body.desiredHours);
  const sessionDurMinNum = toNumOrNull(body.sessionDurMin);
  const billingRateNum = toNumOrNull(body.billingRateEurHour);

  if (desiredHoursNum !== undefined && Number.isNaN(desiredHoursNum)) {
    return NextResponse.json(
      { error: "desiredHours debe ser numérico o null" },
      { status: 400 }
    );
  }
  if (sessionDurMinNum !== undefined && Number.isNaN(sessionDurMinNum)) {
    return NextResponse.json(
      { error: "sessionDurMin debe ser numérico o null" },
      { status: 400 }
    );
  }
  if (billingRateNum !== undefined && Number.isNaN(billingRateNum)) {
    return NextResponse.json(
      { error: "billingRateEurHour debe ser numérico o null" },
      { status: 400 }
    );
  }

  // Build de datos a actualizar (permite actualizaciones parciales)
  const data = {
    ...(body.fullName !== undefined && { fullName: body.fullName }),
    ...(body.phone !== undefined && { phone: body.phone ?? null }),
    ...(body.address !== undefined && { address: body.address ?? null }),
    ...(body.guardianName !== undefined && { guardianName: body.guardianName ?? null }),
    ...(body.guardianPhone !== undefined && { guardianPhone: body.guardianPhone ?? null }),
    ...(body.school !== undefined && { school: body.school ?? null }),
    ...(body.course !== undefined && { course: body.course }),
    ...(body.specialty !== undefined && { specialty: body.specialty ?? null }),
    ...(body.schoolSchedule !== undefined && { schoolSchedule: body.schoolSchedule ?? null }),
    ...(body.referralSource !== undefined && { referralSource: normalizeReferral(body.referralSource) }),
    ...(desiredHoursNum !== undefined && { desiredHours: desiredHoursNum }),
    ...(sessionDurMinNum !== undefined && { sessionDurMin: sessionDurMinNum }),
    ...(billingRateNum !== undefined && { billingRateEurHour: billingRateNum }),

    // Extras: si llega array, reemplaza todas
    ...(Array.isArray(body.extras)
      ? {
          extras: {
            deleteMany: {}, // borra todas las extras actuales del alumno
            create: body.extras.map((e) => ({
              label: e.label,
              dayOfWeek: Number(e.dayOfWeek),
              startMin: Number(e.startMin),
              durMin: Number(e.durMin),
            })),
          },
        }
      : {}),

    // Subjects: si llega array, reemplaza todas
    ...(Array.isArray(body.subjects)
      ? {
          subjects: {
            deleteMany: {}, // borra todas sus asignaturas actuales
            create: body.subjects.map((s) => ({ name: s.name })),
          },
        }
      : {}),
    
      // SchoolBlocks: si llega array, reemplaza todos
      ...(Array.isArray(body.schoolBlocks)
      ? {
          schoolBlocks: {
            deleteMany: {}, // borra todos los bloques actuales
            create: body.schoolBlocks.map((b) => ({
              fromDay: Number(b.fromDay),
              toDay: Number(b.toDay),
              startMin: Number(b.startMin),
              endMin: Number(b.endMin),
            })),
          },
        }
      : {}),
  };

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No hay campos válidos para actualizar" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.student.update({
      where: { id },
      data,
      include: { extras: true, subjects: true, schoolBlocks: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    // P2025 = record not found
    if (String(err?.code) === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    console.error("PUT /api/students/:id", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  const { id } = await ctx.params;
  await prisma.student.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
