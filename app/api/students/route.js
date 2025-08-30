// app/api/students/route.js
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

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
      referralSource: body.referralSource ?? null,
      desiredHours: body.desiredHours ?? null,
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