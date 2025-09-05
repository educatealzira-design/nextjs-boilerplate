// app/api/invoices/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { upsertInvoiceRow } from "@/lib/sheetsInvoices";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const where = month ? { yearMonth: month } : {};
    const invoices = await prisma.invoice.findMany({
     where,
     orderBy: [{ yearMonth: "desc" }, { createdAt: "desc" }],
     include: { student: true },
   });
    return NextResponse.json(invoices);
  } catch (err) {
    console.error("GET /api/invoices error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const required = ["studentId", "yearMonth", "rate", "adjustMin", "totalMin", "amount", "status"];
  for (const k of required) {
    if (!(k in body)) return NextResponse.json({ error: `Falta campo: ${k}` }, { status: 400 });
  }

  const rate = Number(body.rate);
  const adjustMin = Number(body.adjustMin);
  const totalMin = Number(body.totalMin);
  const amount = Number(body.amount);
  if ([rate, adjustMin, totalMin, amount].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "rate/adjustMin/totalMin/amount deben ser numéricos" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(body.yearMonth)) {
    return NextResponse.json({ error: "yearMonth debe tener formato YYYY-MM" }, { status: 400 });
  }

  const status = body.status || "PENDIENTE";
  const now = new Date();
  const sentAt = status === "ENVIADO" || status === "PAGADO" ? now : undefined;
  const paidAt = status === "PAGADO" ? now : undefined;

  try {
    const invoice = await prisma.invoice.upsert({
      where: { studentId_yearMonth: { studentId: body.studentId, yearMonth: body.yearMonth } },
      update: {
        rate,
        adjustMin,
        totalMin,
        amount,
        status,
        paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined,
        ...(sentAt ? { sentAt } : {}),
        ...(paidAt ? { paidAt } : {}),
      },
      create: {
        studentId: body.studentId,
        yearMonth: body.yearMonth,
        rate,
        adjustMin,
        totalMin,
        amount,
        status,
        paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : null,
        sentAt: sentAt ?? null,
        paidAt: paidAt ?? null,
      },
      include: { student: true }, // ← incluimos alumno para volcar a Sheets
    });

    // 🔥 Actualiza/añade la fila en la pestaña "Recibos YYYY-MM"
    await upsertInvoiceRow(invoice);

    return NextResponse.json(invoice, { status: 200 });
  } catch (err) {
    console.error("POST /api/invoices error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}