import { NextResponse } from 'next/server';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
const prisma = new PrismaClient();

export async function PATCH(req, { params }) {
  const { id } = params;
  const body = await req.json();

  const data = {};
  if (typeof body.rate === 'number') data.rate = body.rate;
  if (typeof body.adjustMin === 'number') data.adjustMin = body.adjustMin;
  if (typeof body.totalMin === 'number') data.totalMin = body.totalMin;
  if (typeof body.amount === 'number') data.amount = body.amount;
  if (typeof body.notes === 'string') data.notes = body.notes;
  if (typeof body.status === 'string') {
    data.status = body.status;
    if (body.status === 'ENVIADO') data.sentAt = new Date();
    if (body.status === 'PAGADO') data.paidAt = new Date();
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data,
    include: { student: true }
  });
  return NextResponse.json(updated);
}
