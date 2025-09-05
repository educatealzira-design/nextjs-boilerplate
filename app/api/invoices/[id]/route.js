// app/api/invoices/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { upsertInvoiceRow } from "@/lib/sheetsInvoices";


export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  const body = await req.json();

  const data = {};
  if (typeof body.rate === 'number')        data.rate = body.rate;
  if (typeof body.adjustMin === 'number')   data.adjustMin = body.adjustMin;
  if (typeof body.totalMin === 'number')    data.totalMin = body.totalMin;
  if (typeof body.amount === 'number')      data.amount = body.amount;
  if (typeof body.notes === 'string')       data.notes  = body.notes;
  if (typeof body.paymentMethod === 'string') data.paymentMethod = body.paymentMethod;
  if (typeof body.status === 'string')      data.status = body.status;

  // timestamps si cambia el status
  if (typeof body.status === 'string') {
    const now = new Date();
    if (body.status === 'ENVIADO' || body.status === 'PAGADO') {
      data.sentAt = now;
    }
    if (body.status === 'PAGADO') {
      data.paidAt = now;
    } else if (body.status !== 'PAGADO') {
      // si se desmarca, no pisamos paidAt (conserva histórico) — quita esto si quieres limpiarlo
    }
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data,
    include: { student: true },
  });

  // 🔥 Refleja el cambio en la pestaña de su mes
  await upsertInvoiceRow(updated);
  
  return NextResponse.json(updated);
}