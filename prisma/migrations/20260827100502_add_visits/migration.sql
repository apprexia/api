-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ANALYSIS_RELAUNCHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "VisitAnswerStatus" AS ENUM ('NOT_CHECKED', 'OK', 'WARNING', 'PROBLEM');

-- CreateEnum
CREATE TYPE "VisitCategory" AS ENUM ('ENVIRONMENT', 'PROPERTY_CONDITION', 'WORKS', 'DOCUMENTS', 'COPROPERTY', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "VisitVerdict" AS ENUM ('REASSURING', 'VIGILANCE', 'NEGOTIATION', 'HIGH_RISK');

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "verdict" "VisitVerdict",
    "totalEstimatedCosts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "okCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "problemCount" INTEGER NOT NULL DEFAULT 0,
    "overallNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitAnswer" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "category" "VisitCategory" NOT NULL,
    "status" "VisitAnswerStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "note" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_userId_idx" ON "Visit"("userId");

-- CreateIndex
CREATE INDEX "Visit_analysisId_idx" ON "Visit"("analysisId");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE INDEX "Visit_createdAt_idx" ON "Visit"("createdAt");

-- CreateIndex
CREATE INDEX "VisitAnswer_visitId_idx" ON "VisitAnswer"("visitId");

-- CreateIndex
CREATE INDEX "VisitAnswer_category_idx" ON "VisitAnswer"("category");

-- CreateIndex
CREATE UNIQUE INDEX "VisitAnswer_visitId_questionKey_key" ON "VisitAnswer"("visitId", "questionKey");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAnswer" ADD CONSTRAINT "VisitAnswer_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
