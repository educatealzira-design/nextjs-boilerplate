-- AlterTable
ALTER TABLE "public"."Lesson" ADD COLUMN     "weekStart" TIMESTAMP(3);

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
