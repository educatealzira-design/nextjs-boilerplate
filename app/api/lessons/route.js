export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  // 1) Extraescolares (sólo aviso)
  const extras = await prisma.extracurricular.findMany({ where: { studentId, dayOfWeek } });
  const extraHit = extras.find(ex => overlaps(startMin, durMin, ex.startMin, ex.durMin));
  if (extraHit) return { type: "EXTRA", item: extraHit };

  // 2) Otras clases del mismo alumno (mismo día que se solapen)
  const lessons = await prisma.lesson.findMany({
    where: { studentId, dayOfWeek, NOT: excludeId ? { id: excludeId } : undefined }
  });
  const lessonHit = lessons.find(ls => overlaps(startMin, durMin, ls.startMin, ls.durMin));
  if (lessonHit) return { type: "LESSON", item: lessonHit };

  return null;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day");
  const where = day ? { dayOfWeek: Number(day) } : {};
  const weekStart = parseWeekStart(searchParams.get('weekStart'));
  const studentId = searchParams.get('studentId') || undefined;
  const lessons = await prisma.lesson.findMany({
    where: { weekStart },
    orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
    include: { student: { include: { extras: true } } }
  });
  return NextResponse.json(lessons);
}

export async function POST(req) {
  const body = await req.json();
  const weekStart = parseWeekStart(body.weekStart);
  const payload = {
    studentId: String(body.studentId),
    teacher: body.teacher === "NURIA" ? "NURIA" : "SANTI",
    dayOfWeek: Number(body.dayOfWeek),
    startMin: Number(body.startMin),
    durMin: Number(body.durMin || 60),
    weekStart,
  };

 // ❗️ COMPROBACIÓN DE DUPLICADO *POR SEMANA*
  const duplicate = await prisma.lesson.findFirst({
    where: {
      studentId: body.studentId,
      dayOfWeek: Number(body.dayOfWeek),
      startMin: Number(body.startMin),
      weekStart, // 👈 clave
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: 'duplicate_slot' }, { status: 409 });
  }

  const created = await prisma.lesson.create({
    data: {
      studentId: body.studentId,
      teacher: body.teacher,
      dayOfWeek: Number(body.dayOfWeek),
      startMin: Number(body.startMin),
      durMin: Number(body.durMin),
      weekStart, // 👈 guarda la semana
    },
    include: { student: true },
  });
  // Sólo aviso: conflicto (no bloquea)
  const conflict = await hasConflicts({ ...payload });

  return NextResponse.json({ ...created, conflict }, { status: 201 });
}
