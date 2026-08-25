-- CreateEnum
CREATE TYPE "ComparisonObjective" AS ENUM ('GLOBAL', 'PROFITABILITY', 'SECURITY', 'CAPITAL_GAIN', 'NEGOTIATION', 'LIQUIDITY');

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" "ComparisonObjective" NOT NULL DEFAULT 'GLOBAL',
    "recommendedAnalysisId" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonAnalysis" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comparison_userId_idx" ON "Comparison"("userId");

-- CreateIndex
CREATE INDEX "Comparison_createdAt_idx" ON "Comparison"("createdAt");

-- CreateIndex
CREATE INDEX "ComparisonAnalysis_comparisonId_idx" ON "ComparisonAnalysis"("comparisonId");

-- CreateIndex
CREATE INDEX "ComparisonAnalysis_analysisId_idx" ON "ComparisonAnalysis"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonAnalysis_comparisonId_analysisId_key" ON "ComparisonAnalysis"("comparisonId", "analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonAnalysis_comparisonId_position_key" ON "ComparisonAnalysis"("comparisonId", "position");

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonAnalysis" ADD CONSTRAINT "ComparisonAnalysis_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonAnalysis" ADD CONSTRAINT "ComparisonAnalysis_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
