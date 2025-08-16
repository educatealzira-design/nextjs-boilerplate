-- CreateEnum
CREATE TYPE "public"."ReferralSource" AS ENUM ('AMIGOS', 'COMPANEROS', 'INTERNET', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."Teacher" AS ENUM ('NURIA', 'SANTI');

-- CreateTable
CREATE TABLE "public"."Student" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "school" TEXT,
    "course" TEXT NOT NULL,
    "specialty" TEXT,
    "schoolSchedule" TEXT,
    "referralSource" "public"."ReferralSource",
    "desiredHours" INTEGER,
    "sessionDurMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subject" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Extracurricular" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "durMin" INTEGER NOT NULL,

    CONSTRAINT "Extracurricular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lesson" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacher" "public"."Teacher" NOT NULL DEFAULT 'NURIA',
    "dayOfWeek" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "durMin" INTEGER NOT NULL,
    "actualStartMin" INTEGER,
    "actualDurMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Student_course_idx" ON "public"."Student"("course");

-- CreateIndex
CREATE INDEX "Subject_studentId_idx" ON "public"."Subject"("studentId");

-- CreateIndex
CREATE INDEX "Extracurricular_studentId_dayOfWeek_idx" ON "public"."Extracurricular"("studentId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Lesson_studentId_dayOfWeek_startMin_idx" ON "public"."Lesson"("studentId", "dayOfWeek", "startMin");

-- AddForeignKey
ALTER TABLE "public"."Subject" ADD CONSTRAINT "Subject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Extracurricular" ADD CONSTRAINT "Extracurricular_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
