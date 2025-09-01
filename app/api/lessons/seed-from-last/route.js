// app/api/lessons/seed-from-last/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helpers (todas UTC)
function isValidYMD(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s||""); }
function ymdToUTCDate(s){ return new Date(`${s}T00:00:00.000Z`); }
function mondayUTC(d){
  const x = new Date(d); x.setUTCHours(0,0,0,0);
  const wd = x.getUTCDay(); // 0..6, 1=Lunes
  const delta = wd === 0 ? -6 : 1 - wd;
  x.setUTCDate(x.getUTCDate() + delta); return x;
}

// POST body: { weekStart: "YYYY-MM-DD", overwrite?: boolean }
// - Busca la última WeekState.saved=true anterior a weekStart
// - Si la semana de destino no tiene lessons (o overwrite=true), clona las franjas
// - No clona actualStartMin/actualDurMin (se reservan para el parte real)
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error:"JSON inválido" }, { status:400 });
  }
  const weekStr = String(body?.weekStart||"").trim();
  const overwrite = Boolean(body?.overwrite);
  if (!isValidYMD(weekStr)) {
    return NextResponse.json({ error:"weekStart debe ser YYYY-MM-DD" }, { status:400 });
  }
  const targetMonday = mondayUTC(ymdToUTCDate(weekStr));

  // 1) ¿La semana objetivo ya tiene lessons?
  const existing = await prisma.lesson.findMany({
    where: { weekStart: targetMonday },
    select: { id: true },
    take: 1
  });
  if (existing.length && !overwrite) {
    // Nada que hacer (ya está sembrada o trabajada)
    return NextResponse.json({ seeded:false, reason:"already-has-lessons" });
  }
  if (existing.length && overwrite) {
    // Si quieres permitir sobreescritura, descomenta:
    // await prisma.lesson.deleteMany({ where: { weekStart: targetMonday } });
  }

  // 2) Localiza la última semana guardada anterior
  const lastSaved = await prisma.weekState.findFirst({
    where: { saved: true, weekStart: { lt: targetMonday } },
    orderBy: { weekStart: "desc" },
    select: { weekStart: true }
  });
  if (!lastSaved) {
    return NextResponse.json({ seeded:false, reason:"no-previous-saved-week" });
  }

  // 3) Carga las franjas de esa semana guardada
  const sourceLessons = await prisma.lesson.findMany({
    where: { weekStart: lastSaved.weekStart },
    select: {
      studentId: true, teacher: true, dayOfWeek: true,
      startMin: true, durMin: true
      // NO copiamos actualStartMin/actualDurMin
    }
  });
  if (!sourceLessons.length) {
    return NextResponse.json({ seeded:false, reason:"source-week-has-no-lessons" });
  }

  // 4) Evita duplicados (clave lógica por alumno+dow+start+profesor en la semana destino)
  const existingKeys = new Set(
    (await prisma.lesson.findMany({
      where: { weekStart: targetMonday },
      select: { studentId:true, dayOfWeek:true, startMin:true, teacher:true }
    })).map(l => `${l.studentId}|${l.dayOfWeek}|${l.startMin}|${l.teacher}`)
  );

  const dataToCreate = [];
  for (const l of sourceLessons) {
    const key = `${l.studentId}|${l.dayOfWeek}|${l.startMin}|${l.teacher}`;
    if (existingKeys.has(key)) continue;
    dataToCreate.push({
      studentId: l.studentId,
      teacher: l.teacher,
      dayOfWeek: l.dayOfWeek,
      startMin: l.startMin,
      durMin: l.durMin,
      weekStart: targetMonday
    });
  }
  if (!dataToCreate.length) {
    return NextResponse.json({ seeded:false, reason:"nothing-to-create" });
  }

  // 5) Crea en batch
  const created = await prisma.lesson.createMany({ data: dataToCreate, skipDuplicates: true });

  return NextResponse.json({ seeded:true, created: created.count, sourceWeek: lastSaved.weekStart, weekStart: targetMonday });
}
