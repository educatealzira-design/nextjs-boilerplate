import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

export async function POST(req) {
  const body = await req.json();
  const toWeekStart = parseWeekStart(body.toWeekStart);

  const lastSaved = await prisma.weekState.findFirst({
    where: { weekStart: { lt: toWeekStart }, saved: true },
    orderBy: { weekStart: 'desc' },
  });
  if (!lastSaved) return NextResponse.json([], { status: 204 });

  const templateLessons = await prisma.lesson.findMany({
    where: { weekStart: lastSaved.weekStart },
  });
  if (templateLessons.length === 0) return NextResponse.json([], { status: 204 });

  // Clona solo si el destino está vacío
  const exists = await prisma.lesson.count({ where: { weekStart: toWeekStart } });
  if (exists > 0) return NextResponse.json([], { status: 200 });

  const created = await prisma.$transaction(
    templateLessons.map(t =>
      prisma.lesson.create({
        data: {
          studentId: t.studentId,
          teacher: t.teacher,
          dayOfWeek: t.dayOfWeek,
          startMin: t.startMin,
          durMin: t.durMin,
          actualStartMin: t.actualStartMin,
          actualDurMin: t.actualDurMin,
          weekStart: toWeekStart,
        },
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}