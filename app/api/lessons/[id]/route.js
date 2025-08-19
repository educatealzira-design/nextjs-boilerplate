import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Normaliza a lunes 00:00 UTC
function mondayUTC(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Lunes=0
  d.setUTCDate(d.getUTCDate() - dow);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Convierte 'YYYY-MM-DD' (lunes local) a lunes UTC normalizado
function parseWeekStart(param) {
  if (!param) return mondayUTC(new Date());
  const [y, m, dd] = String(param).split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, dd || 1));
  return mondayUTC(d);
}

function overlaps(aStart, aDur, bStart, bDur) {
  const aEnd = aStart + aDur; const bEnd = bStart + bDur;
  return aStart < bEnd && bStart < aEnd;
}

async function hasConflicts({ studentId, dayOfWeek, startMin, durMin, excludeId }) {
  const extras = await prisma.extracurricular.findMany({ where: { studentId, dayOfWeek } });
  const extraHit = extras.find(ex => overlaps(startMin, durMin, ex.startMin, ex.durMin));
  if (extraHit) return { type: "EXTRA", item: extraHit };
  const lessons = await prisma.lesson.findMany({
    where: { studentId, dayOfWeek, NOT: excludeId ? { id: excludeId } : undefined }
  });
  const lessonHit = lessons.find(ls => overlaps(startMin, durMin, ls.startMin, ls.durMin));
  if (lessonHit) return { type: "LESSON", item: lessonHit };
  return null;
}

export async function PUT(req, { params }) {
  const body = await req.json();
  const current = await prisma.lesson.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  const weekStart = body.weekStart ? parseWeekStart(body.weekStart) : current.weekStart ?? mondayUTC(new Date());

  const payload = {
    studentId: body.studentId ?? current.studentId,
    teacher: body.teacher ?? current.teacher, // permite mover entre Nuria/Santi
    dayOfWeek: body.dayOfWeek != null ? Number(body.dayOfWeek) : current.dayOfWeek,
    startMin: body.startMin != null ? Number(body.startMin) : current.startMin,
    durMin: body.durMin != null ? Number(body.durMin) : current.durMin,

    // Soportar reales (respetar null si se envía)
    actualStartMin: Object.prototype.hasOwnProperty.call(body, 'actualStartMin')
      ? (body.actualStartMin === null ? null : Number(body.actualStartMin))
      : current.actualStartMin,
    actualDurMin: Object.prototype.hasOwnProperty.call(body, 'actualDurMin')
      ? (body.actualDurMin === null ? null : Number(body.actualDurMin))
      : current.actualDurMin,
  };

  // Bloqueo: mismo alumno en la MISMA FRANJA (día + inicio), da igual el profesor
  const duplicate = await prisma.lesson.findFirst({
    where: {
      id: { not: params.id },
      studentId: payload.studentId,
      dayOfWeek: payload.dayOfWeek,
      startMin: payload.startMin,
    }
  });
  if (duplicate) return NextResponse.json({ error: "duplicate_slot" }, { status: 409 });

  // Sólo aviso: conflicto (no bloquea)
  const conflict = await hasConflicts({ ...payload, excludeId: params.id });

  const updated = await prisma.lesson.update({
    where: { id: params.id },
    data: {
      teacher: body.teacher ?? current.teacher,
      dayOfWeek: body.dayOfWeek != null ? Number(body.dayOfWeek) : current.dayOfWeek,
      startMin: body.startMin != null ? Number(body.startMin) : current.startMin,
      payload,
      weekStart,
      // actualStartMin / actualDurMin si también los cambias aquí
      ...(body.actualStartMin !== undefined ? { actualStartMin: body.actualStartMin } : {}),
      ...(body.actualDurMin !== undefined ? { actualDurMin: body.actualDurMin } : {}),
    },
    include: { student: { include: { extras: true } } }
  });
  return NextResponse.json({ ...updated, conflict });
}

export async function DELETE(_req, { params }) {
  await prisma.lesson.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}