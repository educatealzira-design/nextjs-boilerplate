import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
  const lessons = await prisma.lesson.findMany({
    where,
    orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
    include: { student: { include: { extras: true } } }
  });
  return NextResponse.json(lessons);
}

export async function POST(req) {
  const body = await req.json();
  const payload = {
    studentId: String(body.studentId),
    teacher: body.teacher === "NURIA" ? "NURIA" : "SANTI",
    dayOfWeek: Number(body.dayOfWeek),
    startMin: Number(body.startMin),
    durMin: Number(body.durMin || 60),
  };

  // Bloqueo: mismo alumno en la MISMA FRANJA (día + inicio), da igual el profesor
  const duplicate = await prisma.lesson.findFirst({
    where: { studentId: payload.studentId, dayOfWeek: payload.dayOfWeek, startMin: payload.startMin }
  });
  if (duplicate) return NextResponse.json({ error: "duplicate_slot" }, { status: 409 });

  // Sólo aviso: conflicto (no bloquea)
  const conflict = await hasConflicts({ ...payload });

  const created = await prisma.lesson.create({
    data: payload,
    include: { student: { include: { extras: true } } }
  });
  return NextResponse.json({ ...created, conflict }, { status: 201 });
}