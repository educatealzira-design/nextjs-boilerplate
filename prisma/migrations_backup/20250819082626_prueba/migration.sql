/*
  Warnings:

  - You are about to drop the column `weekStart` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the `WeekState` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "public"."Lesson_teacher_dayOfWeek_startMin_idx";

-- DropIndex
DROP INDEX "public"."Lesson_weekStart_dayOfWeek_startMin_teacher_idx";

-- AlterTable
ALTER TABLE "public"."Lesson" DROP COLUMN "weekStart";

-- AlterTable
ALTER TABLE "public"."Student" ADD COLUMN     "billingRateEurHour" DOUBLE PRECISION;

-- DropTable
DROP TABLE "public"."WeekState";
