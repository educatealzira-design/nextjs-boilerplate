-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'PAGADO');

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "adjustMin" INTEGER NOT NULL DEFAULT 0,
    "totalMin" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'PENDIENTE',
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_yearMonth_status_idx" ON "public"."Invoice"("yearMonth", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_studentId_yearMonth_key" ON "public"."Invoice"("studentId", "yearMonth");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
