// app/api/lessons/by-month/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helpers
function firstDayUTC(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}
function firstMondayOnOrBeforeUTC(d) {
  // getUTCDay: 0=Domingo … 1=Lunes
  const wd = d.getUTCDay(); // 0..6
  const delta = wd === 0 ? -6 : 1 - wd; // mover al lunes
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + delta);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}
function addDaysUTC(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function lessThanUTC(a, b) { return a.getTime() < b.getTime(); }

// GET /api/lessons/by-month?month=YYYY-MM&saved=1
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ym = searchParams.get("month"); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(ym || "")) {
      return NextResponse.json({ error: "month debe ser YYYY-MM" }, { status: 400 });
    }
    const onlySaved = searchParams.get("saved") === "1";

    // Rango del mes (UTC)
    const startMonth = firstDayUTC(ym);                // p.ej. 2025-09-01T00:00Z
    const endMonth = new Date(startMonth);             // exclusivo
    endMonth.setUTCMonth(endMonth.getUTCMonth() + 1);

    // Calcula los lunes que caen dentro del mes (cubriendo solapes de semanas)
    // Tomamos el lunes de la primera semana que toca el mes y vamos de 7 en 7
    const firstMonday = firstMondayOnOrBeforeUTC(startMonth); // lunes de la semana del día 1
    const weekStarts = [];
    for (let ws = new Date(firstMonday); lessThanUTC(ws, endMonth); ws = addDaysUTC(ws, 7)) {
      weekStarts.push(new Date(ws)); // copia
    }

    // Si piden "solo guardadas", filtramos por WeekState.saved=true
    let allowedWeekStarts = weekStarts;
    if (onlySaved) {
      const states = await prisma.weekState.findMany({
        where: { weekStart: { in: weekStarts }, saved: true },
        select: { weekStart: true, saved: true },
      });
      const savedSet = new Set(states.map(s => s.weekStart.getTime()));
      allowedWeekStarts = weekStarts.filter(ws => savedSet.has(ws.getTime()));
    }
    if (allowedWeekStarts.length === 0) {
      return NextResponse.json([]); // nada guardado ese mes
    }

    // Trae todas las lecciones de esas semanas guardadas
    const lessons = await prisma.lesson.findMany({
      where: {
        weekStart: { in: allowedWeekStarts },
      },
      orderBy: [{ weekStart: "asc" }, { dayOfWeek: "asc" }, { startMin: "asc" }],
    });

    return NextResponse.json(lessons);
  } catch (err) {
    console.error("GET /api/lessons/by-month error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
