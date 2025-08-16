import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { buildScheduleMessage } from '@/lib/scheduleText';

// Normaliza teléfono a formato internacional simple (ES por defecto)
function normalizePhone(phone){
  const digits = String(phone||'').replace(/\D/g,'');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('34')) return digits;
  if (digits.length === 9) return '34' + digits; // móvil/fijo español
  return digits;
}

export async function GET(req){
  const { searchParams } = new URL(req.url);
  // ?range=current|next (por si luego quieres "próxima semana"); ahora no filtra nada
  const range = searchParams.get('range') || 'current';

  // Cargamos todos los alumnos + sus clases
  const [students, lessons] = await Promise.all([
    prisma.student.findMany({ orderBy: { fullName: 'asc' } }),
    prisma.lesson.findMany({ orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }] })
  ]);

  // Agrupamos por alumno
  const byStudent = new Map();
  for (const ls of lessons) {
    if (!byStudent.has(ls.studentId)) byStudent.set(ls.studentId, []);
    byStudent.get(ls.studentId).push(ls);
  }

  const out = [];
  for (const s of students) {
    const ls = byStudent.get(s.id) || [];
    // Si quisieras excluir sábados/domingos, ya están fuera por tu horario; dejamos tal cual.
    const text = buildScheduleMessage(s, ls);
    const phone = normalizePhone(s.phone || s.guardianPhone);
    out.push({
      studentId: s.id,
      fullName: s.fullName,
      phone,
      text,
      count: ls.length,
    });
  }

  return NextResponse.json({ range, items: out });
}
