-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
    "billingRateEurHour" DOUBLE PRECISION,

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
CREATE TABLE "public"."student_school_blocks" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "from_day" INTEGER NOT NULL,
    "to_day" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_school_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeekState" (
    "weekStart" TIMESTAMP(3) NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekState_pkey" PRIMARY KEY ("weekStart")
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
    "weekStart" TIMESTAMP(3),

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "adjustMin" INTEGER NOT NULL DEFAULT 0,
    "totalMin" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."students" (
    "id" BIGSERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "guardian_name" TEXT,
    "guardian_phone" TEXT,
    "school" TEXT,
    "course" TEXT,
    "specialty" TEXT,
    "referral_source" TEXT,
    "desired_hours" INTEGER,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Student_course_idx" ON "public"."Student"("course");

-- CreateIndex
CREATE INDEX "Subject_studentId_idx" ON "public"."Subject"("studentId");

-- CreateIndex
CREATE INDEX "Extracurricular_studentId_dayOfWeek_idx" ON "public"."Extracurricular"("studentId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "idx_school_blocks_days" ON "public"."student_school_blocks"("student_id", "from_day", "to_day");

-- CreateIndex
CREATE INDEX "idx_school_blocks_student" ON "public"."student_school_blocks"("student_id");

-- CreateIndex
CREATE INDEX "Lesson_weekStart_dayOfWeek_startMin_teacher_idx" ON "public"."Lesson"("weekStart", "dayOfWeek", "startMin", "teacher");

-- CreateIndex
CREATE INDEX "Lesson_studentId_dayOfWeek_startMin_idx" ON "public"."Lesson"("studentId", "dayOfWeek", "startMin");

-- CreateIndex
CREATE INDEX "Lesson_teacher_dayOfWeek_startMin_idx" ON "public"."Lesson"("teacher", "dayOfWeek", "startMin");

-- CreateIndex
CREATE INDEX "Invoice_studentId_idx" ON "public"."Invoice"("studentId");

-- CreateIndex
CREATE INDEX "Invoice_yearMonth_idx" ON "public"."Invoice"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_studentId_yearMonth_key" ON "public"."Invoice"("studentId", "yearMonth");

-- AddForeignKey
ALTER TABLE "public"."Subject" ADD CONSTRAINT "Subject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Extracurricular" ADD CONSTRAINT "Extracurricular_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_school_blocks" ADD CONSTRAINT "student_school_blocks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

