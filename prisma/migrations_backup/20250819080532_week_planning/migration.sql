/*
  Warnings:

  - You are about to drop the column `billingRateEurHour` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Invoice" DROP CONSTRAINT "Invoice_studentId_fkey";

-- AlterTable
ALTER TABLE "public"."Lesson" ADD COLUMN     "weekStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Student" DROP COLUMN "billingRateEurHour";

-- DropTable
DROP TABLE "public"."Invoice";

-- DropEnum
DROP TYPE "public"."InvoiceStatus";

-- CreateTable
CREATE TABLE "public"."WeekState" (
    "weekStart" TIMESTAMP(3) NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekState_pkey" PRIMARY KEY ("weekStart")
);

-- CreateIndex
CREATE INDEX "Lesson_weekStart_dayOfWeek_startMin_teacher_idx" ON "public"."Lesson"("weekStart", "dayOfWeek", "startMin", "teacher");

-- CreateIndex
CREATE INDEX "Lesson_teacher_dayOfWeek_startMin_idx" ON "public"."Lesson"("teacher", "dayOfWeek", "startMin");
