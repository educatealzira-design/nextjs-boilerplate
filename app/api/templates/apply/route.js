import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function mondayUTC(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseWeekStart(param) {
  if (!param) return mondayUTC(new Date());
  const [y, m, dd] = String(param).split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, dd || 1));
  return mondayUTC(d);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const templateWeekStart = parseWeekStart(body.templateWeekStart);
    const targetWeekStart   = parseWeekStart(body.targetWeekStart);

    const src = await prisma.lesson.findMany({
      where: { weekStart: templateWeekStart },
      select: { studentId: true, teacher: true, dayOfWeek: true, startMin: true, durMin: true },
    });

    if (src.length === 0) {
      return NextResponse.json({ ok: false, error: 'template_empty' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.lesson.deleteMany({ where: { weekStart: targetWeekStart } });
      await tx.lesson.createMany({
        data: src.map(x => ({
          studentId:      x.studentId,
          teacher:        x.teacher,
          dayOfWeek:      x.dayOfWeek,
          startMin:       x.startMin,
          durMin:         x.durMin,
          actualStartMin: null,
          actualDurMin:   null,
          weekStart:      targetWeekStart,
        })),
        skipDuplicates: true,
      });
      return { applied: src.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('apply-template error', err);
    return NextResponse.json({ ok: false, error: 'apply_failed' }, { status: 500 });
  }
}
