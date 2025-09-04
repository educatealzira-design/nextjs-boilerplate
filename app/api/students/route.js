// app/api/students/route.js
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// Normaliza el valor recibido a uno válido del enum ReferralSource
// Normaliza a un valor válido del enum del cliente Prisma (v6 usa $Enums)
// Normaliza el valor a los canónicos de la BD: 'amigos' | 'companeros' | 'internet' | 'otro'
const normalizeReferral = (v) => {
  if (v == null || v === "") return null;
  const key = String(v)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

  const map = {
    AMIGO: "amigos",
    AMIGOS: "amigos",
    COMPANERO: "companeros",
    COMPANEROS: "companeros",
    COMPANERAS: "companeros",
    COMPANERA: "companeros",
    INTERNET: "internet",
    OTRO: "otro",
    OTRA: "otro",
  };
  return map[key] ?? null; // si no cuadra, lo guardamos como null (opcional)
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const course = searchParams.get("course");

  const where = {
    ...(course ? { course } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
            { school: { contains: q, mode: "insensitive" } },
            { specialty: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const students = await prisma.student.findMany({
    where,
    include: { extras: true, subjects: true, schoolBlocks: true },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json(students);
}

export async function POST(req) {
  const body = await req.json();

  const created = await prisma.student.create({
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
      referralSource: normalizeReferral(body.referralSource),
      desiredHours: body.desiredHours ?? null,
      notes: body.notes ?? null,
      extras: {
        create: (body.extras || []).map((e) => ({
          label: e.label,
          dayOfWeek: Number(e.dayOfWeek),
          startMin: Number(e.startMin),
          durMin: Number(e.durMin),
        })),
      },
      subjects: {
        // ← NUEVO
        create: (body.subjects || []).map((s) => ({
          name: s.name,
        })),
      },
      schoolBlocks: {
        create: (body.schoolBlocks || []).map((b) => ({
          fromDay: Number(b.fromDay),
          toDay: Number(b.toDay),
          startMin: Number(b.startMin),
          endMin: Number(b.endMin),
        })),
      },
      
    },
    include: { extras: true, subjects: true, schoolBlocks: true },
  });

  return NextResponse.json(created, { status: 201 });
}