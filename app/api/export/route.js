import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  // Si contiene coma, comillas o salto de línea -> envolver en comillas dobles y duplicar comillas internas
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // "YYYY-MM"
  if (!month) {
    return new NextResponse("Missing month (YYYY-MM)", { status: 400 });
  }

  const rows = await prisma.invoice.findMany({
    where: { yearMonth: month },
    include: { student: true },
    orderBy: [{ student: { fullName: "asc" } }],
  });

  // Cabeceras CSV
  const headers = [
    "student_id",
    "student_name",
    "year_month",
    "rate_eur_hour",
    "adjust_min",
    "total_min",
    "total_hours",
    "amount_eur",
    "status",
    "sent_at",
    "paid_at",
    "notes"
  ];

  const lines = [headers.join(",")];

  for (const it of rows) {
    const totalHours = (it.totalMin || 0) / 60;
    const line = [
      it.studentId,
      it.student?.fullName ?? "",
      it.yearMonth,
      it.rate != null ? String(it.rate) : "",
      it.adjustMin != null ? String(it.adjustMin) : "",
      it.totalMin != null ? String(it.totalMin) : "",
      totalHours.toFixed(2),
      it.amount != null ? String(it.amount) : "",
      it.status,
      it.sentAt ? new Date(it.sentAt).toISOString() : "",
      it.paidAt ? new Date(it.paidAt).toISOString() : "",
      it.notes ?? ""
    ].map(csvEscape).join(",");

    lines.push(line);
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
