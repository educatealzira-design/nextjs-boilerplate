import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function ddmmyyyy(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

export async function GET() {
  const savedWeeks = await prisma.weekState.findMany({
    where: { saved: true },
    orderBy: { weekStart: 'desc' },
  });

  const result = await Promise.all(
    savedWeeks.map(async (ws) => {
      const count = await prisma.lesson.count({ where: { weekStart: ws.weekStart } });
      return {
        weekStart: ws.weekStart.toISOString().split('T')[0],
        label: `Semana ${ddmmyyyy(ws.weekStart)}`,
        lessonCount: count,
      };
    })
  );

  return NextResponse.json(result);
}
