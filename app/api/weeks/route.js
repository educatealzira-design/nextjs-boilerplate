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

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const weekStart = parseWeekStart(searchParams.get('weekStart'));
  const st = await prisma.weekState.findUnique({ where: { weekStart } });
  return NextResponse.json({ saved: !!st?.saved });
}

export async function POST(req) {
  const body = await req.json();
  const weekStart = parseWeekStart(body.weekStart);
  const saved = !!body.saved;

  const st = await prisma.weekState.upsert({
    where: { weekStart },
    create: { weekStart, saved },
    update: { saved },
  });

  return NextResponse.json({ saved: st.saved });
}