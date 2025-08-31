import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data = {};
  if (typeof body.status === "string") {
    data.status = body.status;
    if (body.status === "ENVIADO") data.sentAt = new Date();
    if (body.status === "PENDIENTE") data.sentAt = null;
  }

  const row = await prisma.scheduleSend.update({ where: { id }, data });
  return NextResponse.json(row);
}
