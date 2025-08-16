import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_req, { params }) {
  const s = await prisma.student.findUnique({
    where: { id: params.id },
    include: { extras: true, subjects: true },
  });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(s);
}

export async function PUT(req, { params }) {
  const body = await req.json();

  const updated = await prisma.student.update({
    where: { id: params.id },
    data: {
      fullName: body.fullName,
      phone: body.phone ?? null,
      address: body.address ?? null,
      guardianName: body.guardianName ?? null,
      guardianPhone: body.guardianPhone ?? null,
      school: body.school ?? null,
      course: body.course,
      specialty: body.specialty ?? null,
      schoolSchedule: body.schoolSchedule ?? null,
      referralSource: body.referralSource ?? null,
      desiredHours: body.desiredHours ?? null, 
      ...(Array.isArray(body.extras)
        ? {
            extras: {
              deleteMany: {}, // borra todas las extras actuales del alumno
              create: body.extras.map((e) => ({
                label: e.label,
                dayOfWeek: Number(e.dayOfWeek),
                startMin: Number(e.startMin),
                durMin: Number(e.durMin),
              })),
            },
          }
        : {}),
      ...(Array.isArray(body.subjects)
        ? {
            subjects: {
              deleteMany: {}, // ← NUEVO: borra todas sus asignaturas actuales
              create: body.subjects.map((s) => ({ name: s.name })),
            },
          }
        : {}),
    },
    include: { extras: true, subjects: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req, { params }) {
  await prisma.student.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
