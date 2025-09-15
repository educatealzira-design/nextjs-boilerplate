// app/api/lessons/clone-to-next/route.js
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

function addDaysUTC(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return mondayUTC(x);
}

export async function POST(req) {
  try {
    const body = await req.json();
    // weekStart viene como 'YYYY-MM-DD' (local) desde el cliente
    const fromWeekStart = parseWeekStart(body.weekStart);
    const toWeekStart = addDaysUTC(fromWeekStart, 7); // semana siguiente (lunes)

    // Lee las clases de la semana origen
    const src = await prisma.lesson.findMany({
      where: { weekStart: fromWeekStart },
      select: {
        studentId: true,
        teacher: true,
        dayOfWeek: true,
        startMin: true,
        durMin: true,
      }
    });

    // Si no hay nada que clonar, salimos OK
    if (src.length === 0) {
      // también puedes limpiar la semana destino si quieres:
      // await prisma.lesson.deleteMany({ where: { weekStart: toWeekStart } });
      return NextResponse.json({ ok: true, cloned: 0 });
    }

    // Transacción: sustituye la semana siguiente por la plantilla actual
    const result = await prisma.$transaction(async (tx) => {
      // 1) Borra todo lo de la semana destino
      await tx.lesson.deleteMany({ where: { weekStart: toWeekStart } });

      // 2) Inserta copia de la semana origen, sin tiempos “reales”
      if (src.length > 0) {
        await tx.lesson.createMany({
          data: src.map(x => ({
            studentId:      x.studentId,
            teacher:        x.teacher,
            dayOfWeek:      x.dayOfWeek,
            startMin:       x.startMin,
            durMin:         x.durMin,
            actualStartMin: null,
            actualDurMin:   null,
            weekStart:      toWeekStart,
          })),
          skipDuplicates: true, // por si existe una UNIQUE en (studentId,weekStart,dayOfWeek,startMin)
        });
      }

      // 3) Marca/crea el estado de la semana destino como NO guardada (plantilla)
      await tx.weekState.upsert({
        where: { weekStart: toWeekStart },
        update: { saved: false },
        create: { weekStart: toWeekStart, saved: false },
      });

      return { cloned: src.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('clone-to-next error', err);
    return NextResponse.json({ ok: false, error: 'clone_failed' }, { status: 500 });
  }
}
